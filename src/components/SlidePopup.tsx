import React, { useState, useRef, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useStore, PopupSlide } from '../store/useStore';
import { X, Minus, Trash2, Layout, Image as ImageIcon, ZoomIn, ZoomOut, MoreVertical, Copy, Link, Layers } from 'lucide-react';
import { detectMediaType } from '../utils/mediaDetector';
import AnnotationCanvas from './AnnotationCanvas';

interface SlidePopupProps {
  slideId: string;
  popup: PopupSlide;
  index: number;
}

export default function SlidePopup({ slideId, popup, index }: SlidePopupProps) {
  const { updatePopupSlide, removePopupSlide, duplicateSlide, currentSession, renderedPages } = useStore();
  const currentSlideIndex = useStore(s => s.currentSlideIndex);
  // Subscribe to currentTool so the popup reacts when drawing tools are selected
  const currentTool = useStore(s => s.currentTool);
  const isDrawingTool = currentTool !== 'select' && currentTool !== 'lasso';
  const dragControls = useDragControls();

  const [localRect, setLocalRect] = useState({ x: popup.x, y: popup.y, width: popup.width, height: popup.height });
  const latestRect = useRef(localRect);
  latestRect.current = localRect;

  const [isResizing, setIsResizing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [contentZoom, setContentZoom] = useState(1);
  const [contentPan, setContentPan] = useState({ x: 0, y: 0 });
  const [isPanningContent, setIsPanningContent] = useState(false);

  // Inline URL input — replaces window.prompt which is blocked in Electron
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');

  useEffect(() => {
    if (!isResizing) {
      setLocalRect({ x: popup.x, y: popup.y, width: popup.width, height: popup.height });
    }
  }, [popup.x, popup.y, popup.width, popup.height, isResizing]);

  const handleResizeStart = (e: React.PointerEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX, startY = e.clientY;
    const startWidth = localRect.width, startHeight = localRect.height;
    const startLocalX = localRect.x, startLocalY = localRect.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let newWidth = startWidth, newHeight = startHeight;
      let newX = startLocalX, newY = startLocalY;
      if (direction.includes('e')) newWidth = Math.max(200, startWidth + dx);
      if (direction.includes('w')) { newWidth = Math.max(200, startWidth - dx); newX = startLocalX + (startWidth - newWidth); }
      if (direction.includes('s')) newHeight = Math.max(150, startHeight + dy);
      if (direction.includes('n')) { newHeight = Math.max(150, startHeight - dy); newY = startLocalY + (startHeight - newHeight); }
      setLocalRect({ x: newX, y: newY, width: newWidth, height: newHeight });
    };
    const handlePointerUp = () => {
      setIsResizing(false);
      updatePopupSlide(slideId, popup.id, latestRect.current);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleContentPointerDown = (e: React.PointerEvent) => {
    // Never capture events when a drawing tool is active —
    // Fabric's canvas handles them and panning must not interfere.
    if (isDrawingTool) return;
    if (contentZoom <= 1 || !hasContent) return;
    e.preventDefault();
    e.stopPropagation();
    setIsPanningContent(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startPanX = contentPan.x;
    const startPanY = contentPan.y;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setContentPan({ x: startPanX + dx, y: startPanY + dy });
    };

    const handlePointerUp = () => {
      setIsPanningContent(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const hasContent = popup.targetSlideId || popup.mediaType;
  const slides = currentSession?.slides || [];

  if (popup.isMinimized) {
    return (
      <button
        onClick={() => updatePopupSlide(slideId, popup.id, { isMinimized: false })}
        className="absolute bottom-4 z-50 p-3 rounded-full bg-indigo-500 text-white shadow-xl hover:bg-indigo-600 transition-all cursor-pointer animate-fade-in"
        style={{ right: 24 + index * 60 }}
        title="Restore Popup"
      >
        <Layout className="w-5 h-5" />
      </button>
    );
  }

  return (
    <motion.div
      drag dragControls={dragControls} dragListener={false} dragMomentum={false} initial={false}
      onWheel={(e) => e.stopPropagation()}
      onDragEnd={(_e, info) => {
        updatePopupSlide(slideId, popup.id, { x: localRect.x + info.offset.x, y: localRect.y + info.offset.y });
      }}
      animate={{ x: localRect.x, y: localRect.y }}
      style={{ width: localRect.width, height: localRect.height }}
      className="absolute z-50 bg-[#0f1117] border border-white/20 shadow-2xl rounded-xl overflow-visible flex flex-col group"
    >
      {/* Header */}
      <div
        className="h-8 bg-black/40 border-b border-white/10 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing shrink-0"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="flex items-center gap-1.5 px-1">
          <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center gap-1 relative">
          <button onClick={() => { setShowMenu(!showMenu); setShowUrlInput(false); }}
            className="w-6 h-6 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors pointer-events-auto">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-[#1a1d27] border border-white/10 shadow-2xl rounded-lg py-1 z-[60] pointer-events-auto">
              <button className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  // Mirror: show the current slide inside the popup
                  const slides = currentSession?.slides || [];
                  const currentSlide = slides[currentSlideIndex];
                  if (currentSlide) {
                    updatePopupSlide(slideId, popup.id, { targetSlideId: currentSlide.id, mediaType: undefined, mediaUrl: undefined });
                  }
                  setShowMenu(false);
                }}>
                <Copy className="w-3.5 h-3.5" /> Mirror Current Slide
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  duplicateSlide(currentSlideIndex);
                  setShowMenu(false);
                }}>
                <Layers className="w-3.5 h-3.5" /> Duplicate to New Slide
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => { updatePopupSlide(slideId, popup.id, { mediaType: 'blank-white', targetSlideId: undefined }); setShowMenu(false); }}>
                <Layout className="w-3.5 h-3.5" /> Blank White
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => { updatePopupSlide(slideId, popup.id, { mediaType: 'blank-black', targetSlideId: undefined }); setShowMenu(false); }}>
                <Layout className="w-3.5 h-3.5" /> Blank Black
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file'; input.accept = 'image/*';
                  input.onchange = (e: any) => {
                    const file = e.target?.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        updatePopupSlide(slideId, popup.id, { mediaType: 'image', mediaUrl: ev.target?.result as string, targetSlideId: undefined });
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                  setShowMenu(false);
                }}>
                <ImageIcon className="w-3.5 h-3.5" /> Upload Image
              </button>

              {/* Inline URL input — replaces window.prompt */}
              {showUrlInput ? (
                <div className="px-3 py-2 flex flex-col gap-2">
                  <input
                    type="url" value={urlInputValue}
                    onChange={(e) => setUrlInputValue(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="w-full px-2 py-1.5 bg-white/[0.08] border border-white/[0.15] rounded text-white text-xs focus:outline-none focus:border-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && urlInputValue.trim()) {
                        const detected = detectMediaType(urlInputValue.trim());
                        // @ts-ignore
                        updatePopupSlide(slideId, popup.id, { mediaType: detected.type, mediaUrl: detected.originalUrl, targetSlideId: undefined });
                        setShowUrlInput(false); setUrlInputValue(''); setShowMenu(false);
                      }
                      if (e.key === 'Escape') { setShowUrlInput(false); setUrlInputValue(''); }
                    }}
                  />
                  <div className="flex gap-1">
                    <button
                      className="flex-1 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-400 transition-colors"
                      onClick={() => {
                        if (urlInputValue.trim()) {
                          const detected = detectMediaType(urlInputValue.trim());
                          // @ts-ignore
                          updatePopupSlide(slideId, popup.id, { mediaType: detected.type, mediaUrl: detected.originalUrl, targetSlideId: undefined });
                        }
                        setShowUrlInput(false); setUrlInputValue(''); setShowMenu(false);
                      }}
                    >Insert</button>
                    <button
                      className="px-2 py-1 text-xs text-white/50 hover:text-white rounded transition-colors"
                      onClick={() => { setShowUrlInput(false); setUrlInputValue(''); }}
                    >Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                  onClick={() => setShowUrlInput(true)}>
                  <Link className="w-3.5 h-3.5" /> Media Link
                </button>
              )}

              <div className="h-px bg-white/10 my-1" />
              <button className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => { 
                  const defaultRect = { width: 400, height: 300 };
                  setLocalRect(prev => ({ ...prev, ...defaultRect }));
                  updatePopupSlide(slideId, popup.id, defaultRect); 
                  setShowMenu(false); 
                }}>
                <Layout className="w-3.5 h-3.5" /> Reset Popup Size
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2"
                onClick={() => { updatePopupSlide(slideId, popup.id, { targetSlideId: undefined, mediaType: undefined, mediaUrl: undefined }); setShowMenu(false); }}>
                <Trash2 className="w-3.5 h-3.5" /> Clear Content
              </button>
            </div>
          )}

          <button onClick={() => updatePopupSlide(slideId, popup.id, { isMinimized: true })}
            className="w-6 h-6 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors pointer-events-auto">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => removePopupSlide(slideId, popup.id)}
            className="w-6 h-6 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-colors pointer-events-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div
        className="flex-1 overflow-hidden relative pointer-events-auto bg-black rounded-b-xl"
        onWheel={(e) => {
          if (!hasContent) return; // let native scroll work on the slide-picker grid
          e.stopPropagation();
          if (e.ctrlKey || e.metaKey) {
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            setContentZoom(prev => Math.max(0.25, Math.min(prev * zoomFactor, 5)));
          } else if (contentZoom > 1) {
            setContentPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
          }
        }}
        onPointerDown={handleContentPointerDown}
        style={{
          cursor: isPanningContent
            ? 'grabbing'
            : isDrawingTool
              ? (currentTool === 'eraser' ? 'cell' : 'crosshair')
              : contentZoom > 1
                ? 'grab'
                : 'default',
        }}
      >
        <div className="w-full h-full" style={{
          transform: `translate(${contentPan.x}px, ${contentPan.y}px) scale(${contentZoom})`,
          transformOrigin: 'center center',
          transition: isPanningContent ? 'none' : 'transform 0.1s ease-out',
        }}>
          {!hasContent ? (
            <div className="w-full h-full overflow-y-auto p-4">
              <h3 className="text-white/60 text-xs font-semibold mb-3 uppercase tracking-wider">Select Slide to Mirror</h3>
              <div className="grid grid-cols-3 gap-2">
                {slides.map((s, i) => (
                  <button key={s.id} onClick={() => updatePopupSlide(slideId, popup.id, { targetSlideId: s.id })}
                    className="aspect-video relative rounded border border-white/10 hover:border-indigo-400 overflow-hidden group/thumb">
                    {s.type === 'pdf' && s.pdfPageIndex !== undefined && renderedPages[s.pdfPageIndex] ? (
                      <img src={renderedPages[s.pdfPageIndex]} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                        <span className="text-white/30 text-[10px]">Slide {i + 1}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-indigo-500/20 transition-all" />
                    <div className="absolute bottom-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[9px] text-white/80">{i + 1}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : popup.targetSlideId ? (
            <div className="w-full h-full relative">
              {(() => {
                const target = slides.find(s => s.id === popup.targetSlideId);
                if (!target) return <div className="text-white/50 p-4 text-sm">Slide not found</div>;
                if (target.type === 'pdf' && target.pdfPageIndex !== undefined && renderedPages[target.pdfPageIndex]) {
                  return <img src={renderedPages[target.pdfPageIndex]} className="w-full h-full object-contain" alt="" />;
                }
                return <div className="w-full h-full flex flex-col items-center justify-center text-white/30"><Layout className="w-8 h-8 mb-2 opacity-50" /><span className="text-sm">Blank Slide</span></div>;
              })()}
            </div>
          ) : popup.mediaType === 'blank-white' ? (
            <div className="w-full h-full bg-white" />
          ) : popup.mediaType === 'blank-black' ? (
            <div className="w-full h-full bg-black" />
          ) : popup.mediaType === 'image' && popup.mediaUrl ? (
            <img src={popup.mediaUrl} className="w-full h-full object-contain" alt="" />
          ) : popup.mediaUrl ? (
            (() => {
              const detected = detectMediaType(popup.mediaUrl);
              if (detected.type === 'direct-mp4') {
                return (
                  <video 
                    src={detected.embedUrl} 
                    className="w-full h-full object-contain pointer-events-auto" 
                    controls 
                    autoPlay
                  />
                );
              }
              return (
                <iframe 
                  src={detected.embedUrl} 
                  className="w-full h-full border-0 pointer-events-auto" 
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              );
            })()
          ) : null}
        </div>

        {/* Annotation Layer — only when there is content to annotate */}
        {hasContent && (
          <AnnotationCanvas 
            width={localRect.width} 
            height={localRect.height - 32} 
            slideId={slideId} 
            popupId={popup.id} 
          />
        )}

        {hasContent && (
          <div 
            className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 border border-white/10 shadow-lg backdrop-blur-sm rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button onClick={() => setContentZoom(prev => Math.max(0.25, prev - 0.25))}
              className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded cursor-pointer"
              title="Zoom Out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setContentZoom(1); setContentPan({ x: 0, y: 0 }); }}
              className="px-1 text-[10px] text-white/50 hover:text-white font-mono min-w-[36px] cursor-pointer"
              title="Reset Zoom & Pan">
              {Math.round(contentZoom * 100)}%
            </button>
            <button onClick={() => setContentZoom(prev => Math.min(5, prev + 0.25))}
              className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded cursor-pointer"
              title="Zoom In">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Resize Handles */}
      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50" onPointerDown={(e) => handleResizeStart(e, 'se')} />
      <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50" onPointerDown={(e) => handleResizeStart(e, 'sw')} />
      <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50" onPointerDown={(e) => handleResizeStart(e, 'ne')} />
      <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50" onPointerDown={(e) => handleResizeStart(e, 'nw')} />
      <div className="absolute top-4 bottom-4 right-0 w-2 cursor-e-resize z-40" onPointerDown={(e) => handleResizeStart(e, 'e')} />
      <div className="absolute top-4 bottom-4 left-0 w-2 cursor-w-resize z-40" onPointerDown={(e) => handleResizeStart(e, 'w')} />
      <div className="absolute left-4 right-4 top-0 h-2 cursor-n-resize z-40" onPointerDown={(e) => handleResizeStart(e, 'n')} />
      <div className="absolute left-4 right-4 bottom-0 h-2 cursor-s-resize z-40" onPointerDown={(e) => handleResizeStart(e, 's')} />
    </motion.div>
  );
}
