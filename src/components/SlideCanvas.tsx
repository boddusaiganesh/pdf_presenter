import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { renderPage } from '../utils/pdfRenderer';
import { detectMediaType, isVideoType } from '../utils/mediaDetector';
import AnnotationCanvas from './AnnotationCanvas';
import { cn } from '../utils/cn';
import {
  Film, Image as ImageIcon, Globe, FileText, Maximize2,
  Volume2, VolumeX, Play, Pause, RotateCcw
} from 'lucide-react';

interface SlideCanvasProps {
  isPresenting?: boolean;
}

export default function SlideCanvas({ isPresenting = false }: SlideCanvasProps) {
  const {
    currentSession, currentSlideIndex, setCurrentSlideIndex,
    renderedPages, addRenderedPage, removeRenderedPage, renderingPages, addRenderingPage, removeRenderingPage,
    isBlackScreen, isFrozen, isOverviewMode, setIsOverviewMode,
    currentTool, pointerMode, setPointerPosition,
    zoomLevel, setZoomLevel, panOffset, setPanOffset,
    settings, isPresenting: storeIsPresenting,
  } = useStore();

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1280, height: 720 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const frozenImageRef = useRef<string | null>(null);
  const [videoRef] = useState(() => ({ current: null as HTMLVideoElement | null }));
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const slides = currentSession?.slides || [];
  const visibleSlides = slides.filter((s) => !s.hidden);
  const currentSlide = slides[currentSlideIndex];

  // Resize observer
  useEffect(() => {
    const container = canvasContainerRef.current?.parentElement;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const aspectRatio = 16 / 9;
        let w = width;
        let h = width / aspectRatio;
        if (h > height) {
          h = height;
          w = height * aspectRatio;
        }
        setCanvasSize({ width: Math.floor(w), height: Math.floor(h) });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render PDF pages in background
  useEffect(() => {
    if (!currentSession) return;

    const pagesToRender: number[] = [];
    
    slides.forEach((slide) => {
      if (slide.type === 'pdf' && slide.pdfPageIndex !== undefined) {
        const currentPage = currentSlide?.pdfPageIndex ?? 0;
        const distance = Math.abs(slide.pdfPageIndex - currentPage);
        
        // Only render if within preload radius to prevent Out of Memory errors
        if (distance <= settings.preloadSlides) {
          if (!renderedPages[slide.pdfPageIndex] && !renderingPages.has(slide.pdfPageIndex)) {
            pagesToRender.push(slide.pdfPageIndex);
          }
        }
      }
    });

    // Sort by proximity to current slide
    pagesToRender.sort((a, b) => {
      const currentPage = currentSlide?.pdfPageIndex ?? 0;
      return Math.abs(a - currentPage) - Math.abs(b - currentPage);
    });

    // Render in batches
    const renderNext = async (index: number) => {
      if (index >= pagesToRender.length) return;
      const pageIndex = pagesToRender[index];
      if (renderingPages.has(pageIndex)) {
        await renderNext(index + 1);
        return;
      }
      addRenderingPage(pageIndex);
      console.log(`[SlideCanvas] Starting render for slide index ${pageIndex}`);
      try {
        const dataURL = await renderPage(
          pageIndex,
          settings.renderingQuality,
          settings.compressionContrastBoost,
          settings.contrastBoostStrength
        );
        addRenderedPage(pageIndex, dataURL);
        const kbSize = Math.round(dataURL.length / 1024);
        console.log(`[SlideCanvas] Successfully rendered slide ${pageIndex} (${kbSize} KB)`);
      } catch (e) {
        console.error(`[SlideCanvas] Render error for slide ${pageIndex}:`, e);
      } finally {
        removeRenderingPage(pageIndex);
        // Render next after small delay to not block UI
        setTimeout(() => renderNext(index + 1), 50);
      }
    };

    // Garbage collection: clear rendered pages that are far from the current slide
    const safeRadius = Math.max(10, settings.preloadSlides * 2);
    const currentPageIndex = currentSlide?.pdfPageIndex ?? 0;
    let purgedCount = 0;
    Object.keys(renderedPages).forEach((key) => {
      const pageIndex = Number(key);
      if (Math.abs(pageIndex - currentPageIndex) > safeRadius) {
        removeRenderedPage(pageIndex);
        purgedCount++;
      }
    });
    
    if (purgedCount > 0) {
      console.log(`[MemoryManager] Garbage collection purged ${purgedCount} off-screen slide(s) to free memory`);
    }

    renderNext(0);
  }, [currentSession?.id, currentSlideIndex, settings.renderingQuality]);

  // Mouse tracking for pointer
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setPointerPosition({ x: e.clientX, y: e.clientY });

    if (isPanning && zoomLevel > 1) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [isPanning, panStart, panOffset, setPointerPosition, setPanOffset, setZoomLevel, zoomLevel]);

  // Scroll to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(zoomLevel + delta);
    }
  }, [zoomLevel, setZoomLevel]);

  // Pan on middle mouse or when zoomed
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && zoomLevel > 1 && currentTool === 'select')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [zoomLevel, currentTool]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

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
      const isRendering = renderingPages.has(pageIndex);

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
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="shimmer absolute inset-0" />
        </div>
      );
    }

    if (currentSlide.type === 'blank-white') {
      return <div className="absolute inset-0 bg-white" />;
    }

    if (currentSlide.type === 'blank-black') {
      return <div className="absolute inset-0 bg-black" />;
    }

    if (currentSlide.type === 'image' && currentSlide.mediaUrl) {
      return (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <img
            src={currentSlide.mediaUrl}
            alt="Image slide"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }

    if (currentSlide.mediaUrl) {
      const detected = detectMediaType(currentSlide.mediaUrl);
      const isVideo = isVideoType(detected.type);

      if (detected.type === 'direct-mp4') {
        return (
          <div className="absolute inset-0 bg-black">
            <video
              ref={(el) => { videoRef.current = el; }}
              src={detected.embedUrl}
              className={cn("w-full h-full object-contain", pointerMode !== 'normal' && 'pointer-events-none')}
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
            className={cn("w-full h-full border-0", pointerMode !== 'normal' && 'pointer-events-none')}
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

  // Overview mode
  if (isOverviewMode) {
    const cols = Math.ceil(Math.sqrt(visibleSlides.length));
    return (
      <div className="absolute inset-0 bg-[#0a0b0f] overflow-auto p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Slide Overview</h2>
          <button
            onClick={() => setIsOverviewMode(false)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-white/60 hover:text-white text-sm transition-colors"
          >
            Close Overview
          </button>
        </div>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(cols + 1, 8)}, 1fr)` }}
        >
          {visibleSlides.map((slide, i) => {
            const realIndex = slides.indexOf(slide);
            const isActive = realIndex === currentSlideIndex;
            return (
              <div
                key={slide.id}
                onClick={() => {
                  setCurrentSlideIndex(realIndex);
                  setIsOverviewMode(false);
                }}
                className={cn(
                  'relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all border-2',
                  isActive
                    ? 'border-indigo-500 shadow-lg shadow-indigo-500/30'
                    : 'border-transparent hover:border-white/30'
                )}
              >
                {slide.type === 'pdf' && slide.pdfPageIndex !== undefined && renderedPages[slide.pdfPageIndex] ? (
                  <img src={renderedPages[slide.pdfPageIndex]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className={cn('w-full h-full flex items-center justify-center', slide.type === 'blank-white' ? 'bg-white' : 'bg-slate-800')}>
                    <span className="text-gray-500 text-xs">{i + 1}</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                  <span className="text-white/80 text-[10px] bg-black/60 px-1.5 py-0.5 rounded font-mono">
                    {i + 1}
                  </span>
                  {isActive && (
                    <span className="text-indigo-400 text-[10px] bg-black/60 px-1.5 py-0.5 rounded">
                      Current
                    </span>
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
    transition: isPanning ? 'none' : 'transform 0.1s ease',
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
      {/* Main Slide */}
      <div
        className="relative shadow-2xl shadow-black/80"
        style={containerStyle}
        ref={canvasContainerRef}
      >
        <div
          className="relative overflow-hidden"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          {/* Black screen overlay */}
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
              {isFrozen && frozenImageRef.current && (
                <div className="absolute inset-0 z-40">
                  <img src={frozenImageRef.current} alt="frozen" className="w-full h-full" />
                  <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/70 rounded-full text-white/60 text-xs flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Frozen
                  </div>
                </div>
              )}

              {/* Slide Content */}
              {renderCurrentSlide()}

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

      {/* Zoom indicator */}
      {zoomLevel !== 1 && (
        <div className="absolute top-4 right-4 glass px-3 py-1.5 rounded-full text-white/60 text-xs font-mono pointer-events-none">
          {Math.round(zoomLevel * 100)}%
        </div>
      )}
    </div>
  );
}
