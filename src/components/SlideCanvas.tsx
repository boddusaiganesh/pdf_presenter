import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { renderPage } from '../utils/pdfRenderer';
import { detectMediaType, isVideoType } from '../utils/mediaDetector';
import AnnotationCanvas from './AnnotationCanvas';
import SlidePopup from './SlidePopup';
import html2canvas from 'html2canvas';
import { cn } from '../utils/cn';
import { Film, Image as ImageIcon, FileText, Play } from 'lucide-react';

interface SlideCanvasProps {
  isPresenting?: boolean;
}

export default function SlideCanvas({ isPresenting = false }: SlideCanvasProps) {
  const {
    currentSession, currentSlideIndex, setCurrentSlideIndex,
    renderedPages, addRenderedPage, removeRenderedPage,
    renderingPages, addRenderingPage, removeRenderingPage,
    isBlackScreen, isFrozen, isOverviewMode, setIsOverviewMode,
    currentTool, pointerMode, setPointerPosition,
    zoomLevel, setZoomLevel, panOffset, setPanOffset,
    settings,
  } = useStore();

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [frozenImage, setFrozenImage] = useState<string | null>(null);
  const previousIsFrozen = useRef(isFrozen);
  const [videoRef] = useState(() => ({ current: null as HTMLVideoElement | null }));
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Slide fade transition state
  const [isTransitioning, setIsTransitioning] = useState(false);

  const slides = currentSession?.slides || [];
  const visibleSlides = slides.filter((s) => !s.hidden);
  const currentSlide = slides[currentSlideIndex];

  // ── Resize observer ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = canvasContainerRef.current?.parentElement;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const aspectRatio = 16 / 9;
        let w = width;
        let h = width / aspectRatio;
        if (h > height) { h = height; w = height * aspectRatio; }
        setCanvasSize({ width: Math.floor(w), height: Math.floor(h) });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Reset panOffset when zoom returns to 1 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (zoomLevel === 1) setPanOffset({ x: 0, y: 0 });
  }, [zoomLevel, setPanOffset]);

  // ── Slide fade transition ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (settings.slideTransition !== 'fade') return;
    setIsTransitioning(true);
    const t = setTimeout(() => setIsTransitioning(false), 150);
    return () => clearTimeout(t);
  }, [currentSlideIndex, settings.slideTransition]);

  // ── Freeze canvas ─────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFrozen && !previousIsFrozen.current) {
      const container = canvasContainerRef.current;
      if (!container) { previousIsFrozen.current = isFrozen; return; }
      // html2canvas throws CORS errors on cross-origin iframes (YouTube, Vimeo, etc.).
      // Ignore iframes during capture; fall back to rendering only the PDF/image layer.
      html2canvas(container, {
        backgroundColor: '#0a0b0f',
        useCORS: true,
        allowTaint: false,
        ignoreElements: (el) => el.tagName === 'IFRAME',
      })
        .then(canvas => setFrozenImage(canvas.toDataURL('image/png')))
        .catch(() => {
          // Last-resort fallback: draw the rendered PDF page directly onto a blank canvas
          const state = useStore.getState();
          const slide = state.currentSession?.slides[state.currentSlideIndex];
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = canvasSize.width;
          fallbackCanvas.height = canvasSize.height;
          const ctx = fallbackCanvas.getContext('2d');
          if (!ctx) return;
          ctx.fillStyle = '#0a0b0f';
          ctx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          if (slide?.type === 'pdf' && slide.pdfPageIndex !== undefined) {
            const imgSrc = state.renderedPages[slide.pdfPageIndex];
            if (imgSrc) {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
                setFrozenImage(fallbackCanvas.toDataURL('image/png'));
              };
              img.src = imgSrc;
              return;
            }
          }
          setFrozenImage(fallbackCanvas.toDataURL('image/png'));
        });
    } else if (!isFrozen && previousIsFrozen.current) {
      setFrozenImage(null);
    }
    previousIsFrozen.current = isFrozen;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFrozen, canvasSize.width, canvasSize.height]);

  // ── Render PDF pages in background ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentSession) return;

    const pagesToRender: number[] = [];
    slides.forEach((slide) => {
      if (slide.type === 'pdf' && slide.pdfPageIndex !== undefined) {
        // Use .includes() — renderingPages is now number[] not Set
        if (!renderedPages[slide.pdfPageIndex] && !renderingPages.includes(slide.pdfPageIndex)) {
          pagesToRender.push(slide.pdfPageIndex);
        }
      }
    });

    // Sort by proximity to current slide so nearest slides render first
    pagesToRender.sort((a, b) => {
      const currentPage = currentSlide?.pdfPageIndex ?? 0;
      return Math.abs(a - currentPage) - Math.abs(b - currentPage);
    });

    // Use requestIdleCallback for background rendering to avoid blocking UI
    const scheduleNext = (fn: () => void) => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(fn, { timeout: 500 });
      } else {
        setTimeout(fn, 0);
      }
    };

    const renderNext = async (index: number) => {
      if (index >= pagesToRender.length) return;
      const pageIndex = pagesToRender[index];
      // Read fresh state from the store — avoids stale closure on renderingPages
      const freshState = useStore.getState();
      if (freshState.renderingPages.includes(pageIndex) || freshState.renderedPages[pageIndex]) {
        scheduleNext(() => renderNext(index + 1));
        return;
      }
      addRenderingPage(pageIndex);
      try {
        const dataURL = await renderPage(
          pageIndex,
          settings.renderingQuality,
          settings.compressionContrastBoost,
          settings.contrastBoostStrength
        );
        addRenderedPage(pageIndex, dataURL);
      } catch (e) {
        console.error(`[SlideCanvas] Render error for slide ${pageIndex}:`, e);
      } finally {
        removeRenderingPage(pageIndex);
        scheduleNext(() => renderNext(index + 1));
      }
    };

    renderNext(0);
  }, [currentSession?.id, currentSlideIndex, settings.renderingQuality]);

  // ── Mouse tracking ────────────────────────────────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setPointerPosition({ x: e.clientX, y: e.clientY });
    if (isPanning && zoomLevel > 1) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [isPanning, panStart, panOffset, setPointerPosition, setPanOffset, zoomLevel]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Trackpad pinch-to-zoom is intentionally disabled on the canvas
    // Users zoom via toolbar buttons (Ctrl+/- or zoom buttons)
    if (e.ctrlKey || e.metaKey) e.preventDefault();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && zoomLevel > 1 && currentTool === 'select')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [zoomLevel, currentTool]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  // ── Render current slide content ───────────────────────────────────────────────────────────────────────────
  const renderCurrentSlide = () => {
    if (!currentSlide) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-sm">No slides loaded</p>
            <p className="text-white/20 text-xs mt-1">Open a PDF to get started</p>
          </div>
        </div>
      );
    }

    if (currentSlide.type === 'pdf') {
      const pageIndex = currentSlide.pdfPageIndex ?? 0;
      const imgSrc = renderedPages[pageIndex];
      // Use .includes() — renderingPages is now number[]
      const isRendering = renderingPages.includes(pageIndex);

      if (imgSrc) {
        return (
          <img
            src={imgSrc}
            alt={`Slide ${currentSlideIndex + 1}`}
            className="absolute inset-0 w-full h-full object-contain"
            style={{
              filter: settings.compressionContrastBoost
                ? `contrast(${100 + settings.contrastBoostStrength}%)`
                : 'none',
            }}
          />
        );
      }
      if (isRendering) {
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-white/30 text-sm">Rendering slide...</p>
            </div>
          </div>
        );
      }
      return <div className="absolute inset-0 flex items-center justify-center bg-slate-900"><div className="shimmer absolute inset-0" /></div>;
    }

    if (currentSlide.type === 'blank-white') return <div className="absolute inset-0 bg-white" />;
    if (currentSlide.type === 'blank-black') return <div className="absolute inset-0 bg-black" />;

    if (currentSlide.type === 'image' && currentSlide.mediaUrl) {
      return (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <img src={currentSlide.mediaUrl} alt="Image slide" className="max-w-full max-h-full object-contain" />
        </div>
      );
    }

    if (currentSlide.mediaUrl) {
      const detected = detectMediaType(currentSlide.mediaUrl);
      if (detected.type === 'direct-mp4') {
        return (
          <div className="absolute inset-0 bg-black">
            <video
              ref={(el) => { videoRef.current = el; }}
              src={detected.embedUrl}
              className={cn('w-full h-full object-contain', pointerMode !== 'normal' && 'pointer-events-none')}
              controls={pointerMode === 'normal'}
              autoPlay={settings.autoAdvanceSeconds === 0}
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
            />
          </div>
        );
      }
      return (
        <div className="absolute inset-0 bg-black media-slide">
          <iframe
            src={detected.embedUrl}
            className={cn('w-full h-full border-0', pointerMode !== 'normal' && 'pointer-events-none')}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            title={`Media slide ${currentSlideIndex + 1}`}
          />
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <Film className="w-12 h-12 text-white/20 mx-auto mb-2" />
          <p className="text-white/30 text-sm">No media URL set</p>
        </div>
      </div>
    );
  };

  // ── Overview mode ────────────────────────────────────────────────────────────────────────────────────────────
  if (isOverviewMode) {
    const cols = Math.ceil(Math.sqrt(visibleSlides.length));
    return (
      <div className="absolute inset-0 bg-[#0a0b0f] overflow-auto p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Slide Overview</h2>
          <button onClick={() => setIsOverviewMode(false)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/60 hover:text-white text-sm transition-colors">
            Close Overview
          </button>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cols + 1, 8)}, 1fr)` }}>
          {visibleSlides.map((slide) => {
            const realIndex = slides.indexOf(slide);
            const isActive = realIndex === currentSlideIndex;
            // Show actual slide number in the full deck, not index in visible array
            const slideNumber = realIndex + 1;
            return (
              <div
                key={slide.id}
                onClick={() => { setCurrentSlideIndex(realIndex); setIsOverviewMode(false); }}
                className={cn(
                  'relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all border-2',
                  isActive ? 'border-indigo-500 shadow-lg shadow-indigo-500/30' : 'border-transparent hover:border-white/30'
                )}
              >
                {slide.type === 'pdf' && slide.pdfPageIndex !== undefined && renderedPages[slide.pdfPageIndex] ? (
                  <img src={renderedPages[slide.pdfPageIndex]} alt="" className="w-full h-full object-cover" />
                ) : slide.type === 'image' && slide.mediaUrl ? (
                  <img src={slide.mediaUrl} alt="" className="w-full h-full object-cover" />
                ) : ['video', 'youtube', 'vimeo', 'loom', 'googledrive', 'dropbox', 'onedrive', 'direct-mp4', 'iframe'].includes(slide.type) ? (
                  <div className="w-full h-full bg-[#161925] flex flex-col items-center justify-center relative">
                    <div className="w-16 h-12 bg-black/50 rounded-xl flex items-center justify-center border border-white/10 shadow-lg backdrop-blur-sm group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 text-white ml-1 fill-white" />
                    </div>
                    <span className="absolute bottom-2 right-2 text-white/50 text-[10px] font-mono bg-black/40 px-1.5 py-0.5 rounded">{slideNumber}</span>
                  </div>
                ) : (
                  <div className={cn('w-full h-full flex items-center justify-center relative', slide.type === 'blank-white' ? 'bg-white' : 'bg-slate-800')}>
                    <span className="text-gray-500 text-xs">{slideNumber}</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                  <span className="text-white/80 text-[10px] bg-black/60 px-1.5 py-0.5 rounded font-mono">
                    {slideNumber}
                  </span>
                  {isActive && (
                    <span className="text-indigo-400 text-[10px] bg-black/60 px-1.5 py-0.5 rounded">Current</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const containerStyle = {
    width: canvasSize.width,
    height: canvasSize.height,
    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
    // No transition while panning — prevents lag/rubber-band feel
    transition: isPanning ? 'none' : 'transform 0.15s ease-out',
  };

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#0a0b0f]"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isPanning ? 'grabbing' : pointerMode !== 'normal' ? 'none' : 'default' }}
    >
      <div className="relative shadow-2xl shadow-black/80" style={containerStyle} ref={canvasContainerRef}>
        <div className="relative overflow-hidden" style={{ width: canvasSize.width, height: canvasSize.height }}>
          {isBlackScreen ? (
            <div className="absolute inset-0 bg-black z-50 flex items-center justify-center">
              <div className="text-white/20 text-center">
                <div className="w-16 h-16 rounded-full border-2 border-white/10 flex items-center justify-center mx-auto mb-3">
                  <div className="w-8 h-8 rounded-full bg-white/5" />
                </div>
                <p className="text-sm">Screen paused</p>
              </div>
            </div>
          ) : (
            <>
              {/* Frozen overlay */}
              {isFrozen && frozenImage && (
                <div className="absolute inset-0 z-40">
                  <img src={frozenImage} alt="frozen" className="w-full h-full" />
                  <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/70 rounded-full text-white/60 text-xs flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Frozen
                  </div>
                </div>
              )}

              {/* Slide content with fade transition */}
              <div
                key={currentSlide?.id}
                style={{
                  opacity: isTransitioning ? 0 : 1,
                  transition: settings.slideTransition === 'fade' ? 'opacity 0.15s ease' : 'none',
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                {renderCurrentSlide()}
              </div>

              {/* Annotation Canvas */}
              {currentSlide && (
                <AnnotationCanvas
                  width={canvasSize.width}
                  height={canvasSize.height}
                  slideId={currentSlide.id}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Popups */}
      {!isBlackScreen && currentSlide?.popups?.map((popup, index) => (
        <SlidePopup key={popup.id} slideId={currentSlide.id} popup={popup} index={index} />
      ))}

      {/* Zoom indicator */}
      {zoomLevel !== 1 && (
        <div className="absolute top-4 right-4 glass px-3 py-1.5 rounded-full text-white/60 text-xs font-mono pointer-events-none">
          {Math.round(zoomLevel * 100)}%
        </div>
      )}
    </div>
  );
}
