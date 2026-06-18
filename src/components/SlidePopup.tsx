import React, { useState, useRef, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useStore, PopupSlide, MediaType, Slide } from '../store/useStore';
import { X, Minus, Trash2, Layout, Image as ImageIcon, Film, MoreVertical, Copy, Link, Video, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../utils/cn';

interface SlidePopupProps {
  slideId: string;
  popup: PopupSlide;
  index: number;
}

export default function SlidePopup({ slideId, popup, index }: SlidePopupProps) {
  const { updatePopupSlide, removePopupSlide, currentSession, renderedPages } = useStore();
  const dragControls = useDragControls();

  const [localRect, setLocalRect] = useState({
    x: popup.x,
    y: popup.y,
    width: popup.width,
    height: popup.height,
  });

  const latestRect = useRef(localRect);
  latestRect.current = localRect;

  const [isResizing, setIsResizing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [contentZoom, setContentZoom] = useState(1);
  const [contentPan, setContentPan] = useState({ x: 0, y: 0 });
  const [isPanningContent, setIsPanningContent] = useState(false);

  // Sync local state when store changes externally (except while resizing)
  useEffect(() => {
    if (!isResizing) {
      setLocalRect({
        x: popup.x,
        y: popup.y,
        width: popup.width,
        height: popup.height,
      });
    }
  }, [popup.x, popup.y, popup.width, popup.height, isResizing]);

  const handleResizeStart = (e: React.PointerEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = localRect.width;
    const startHeight = localRect.height;
    const startLocalX = localRect.x;
    const startLocalY = localRect.y;
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startLocalX;
      let newY = startLocalY;
      
      if (direction.includes('e')) newWidth = Math.max(200, startWidth + dx);
      if (direction.includes('w')) {
        newWidth = Math.max(200, startWidth - dx);
        newX = startLocalX + (startWidth - newWidth);
      }
      
      if (direction.includes('s')) newHeight = Math.max(150, startHeight + dy);
      if (direction.includes('n')) {
        newHeight = Math.max(150, startHeight - dy);
        newY = startLocalY + (startHeight - newHeight);
      }
      
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
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      initial={false}
      onWheel={(e) => e.stopPropagation()}
      onDragEnd={(e, info) => {
        updatePopupSlide(slideId, popup.id, {
          x: localRect.x + info.offset.x,
          y: localRect.y + info.offset.y,
        });
      }}
      animate={{ x: localRect.x, y: localRect.y }}
      style={{
        width: localRect.width,
        height: localRect.height,
      }}
      className="absolute z-50 bg-[#0f1117] border border-white/20 shadow-2xl rounded-xl overflow-visible flex flex-col group"
    >
      {/* Header Bar */}
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
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-6 h-6 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors pointer-events-auto"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          
          {showMenu && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-[#1a1d27] border border-white/10 shadow-2xl rounded-lg py-1 z-[60] pointer-events-auto">
              <button
                className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  updatePopupSlide(slideId, popup.id, { targetSlideId: slideId, mediaType: undefined, mediaUrl: undefined });
                  setShowMenu(false);
                }}
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate Slide
              </button>
              <button
                className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  updatePopupSlide(slideId, popup.id, { mediaType: 'blank-white', targetSlideId: undefined });
                  setShowMenu(false);
                }}
              >
                <Layout className="w-3.5 h-3.5" /> Blank White
              </button>
              <button
                className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  updatePopupSlide(slideId, popup.id, { mediaType: 'blank-black', targetSlideId: undefined });
                  setShowMenu(false);
                }}
              >
                <Layout className="w-3.5 h-3.5" /> Blank Black
              </button>
              <button
                className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e: any) => {
                    const file = e.target?.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      updatePopupSlide(slideId, popup.id, { mediaType: 'image', mediaUrl: url, targetSlideId: undefined });
                    }
                  };
                  input.click();
                  setShowMenu(false);
                }}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Upload Image
              </button>
              <button
                className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                onClick={() => {
                  const url = prompt('Enter video URL (YouTube, Vimeo, etc):');
                  if (url) {
                    updatePopupSlide(slideId, popup.id, { mediaType: 'video', mediaUrl: url, targetSlideId: undefined });
                  }
                  setShowMenu(false);
                }}
              >
                <Link className="w-3.5 h-3.5" /> Media Link
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2"
                onClick={() => {
                  updatePopupSlide(slideId, popup.id, { targetSlideId: undefined, mediaType: undefined, mediaUrl: undefined });
                  setShowMenu(false);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Content
              </button>
            </div>
          )}

          <button
            onClick={() => updatePopupSlide(slideId, popup.id, { isMinimized: true })}
            className="w-6 h-6 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors pointer-events-auto"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => removePopupSlide(slideId, popup.id)}
            className="w-6 h-6 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-colors pointer-events-auto"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div 
        className="flex-1 overflow-hidden relative pointer-events-auto bg-black rounded-b-xl"
        onWheel={(e) => {
          if (!hasContent || popup.targetSlideId === undefined && !popup.mediaType) return;
          e.stopPropagation();
          if (e.ctrlKey || e.metaKey) {
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            setContentZoom(prev => Math.max(0.25, Math.min(prev * zoomFactor, 5)));
          } else if (contentZoom > 1) {
            setContentPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
          }
        }}
        onPointerDown={(e) => {
          if (contentZoom > 1 && hasContent) {
            setIsPanningContent(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (isPanningContent) {
            setContentPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
          }
        }}
        onPointerUp={(e) => {
          setIsPanningContent(false);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        style={{ cursor: isPanningContent ? 'grabbing' : contentZoom > 1 ? 'grab' : 'default' }}
      >
        <div 
          className="w-full h-full"
          style={{
            transform: `translate(${contentPan.x}px, ${contentPan.y}px) scale(${contentZoom})`,
            transformOrigin: 'center center',
            transition: isPanningContent ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {!hasContent ? (
          <div className="w-full h-full overflow-y-auto p-4 custom-scrollbar">
            <h3 className="text-white/60 text-xs font-semibold mb-3 uppercase tracking-wider">Select Slide to Mirror</h3>
            <div className="grid grid-cols-3 gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => updatePopupSlide(slideId, popup.id, { targetSlideId: s.id })}
                  className="aspect-video relative rounded border border-white/10 hover:border-indigo-400 overflow-hidden group/thumb"
                >
                  {s.type === 'pdf' && s.pdfPageIndex !== undefined && renderedPages[s.pdfPageIndex] ? (
                    <img src={renderedPages[s.pdfPageIndex]} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <span className="text-white/30 text-[10px]">Slide {i + 1}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-indigo-500/20 transition-all" />
                  <div className="absolute bottom-1 right-1 bg-black/60 px-1 py-0.5 rounded text-[9px] text-white/80">
                    {i + 1}
                  </div>
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
              return (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/30">
                  <Layout className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-sm">Blank Slide</span>
                </div>
              );
            })()}
          </div>
        ) : popup.mediaType === 'blank-white' ? (
          <div className="w-full h-full bg-white" />
        ) : popup.mediaType === 'blank-black' ? (
          <div className="w-full h-full bg-black" />
        ) : popup.mediaType === 'image' && popup.mediaUrl ? (
          <img src={popup.mediaUrl} className="w-full h-full object-contain" alt="" />
        ) : popup.mediaType === 'video' || popup.mediaType === 'youtube' || popup.mediaType === 'vimeo' ? (
          <iframe
            src={popup.mediaUrl}
            className="w-full h-full border-0 pointer-events-auto"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        ) : null}
        </div>

        {hasContent && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 border border-white/10 shadow-lg backdrop-blur-sm rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-auto">
            <button
              onClick={() => setContentZoom(prev => Math.max(0.25, prev - 0.25))}
              className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setContentZoom(1); setContentPan({ x: 0, y: 0 }); }}
              className="px-1 text-[10px] text-white/50 hover:text-white font-mono min-w-[36px] cursor-pointer"
            >
              {Math.round(contentZoom * 100)}%
            </button>
            <button
              onClick={() => setContentZoom(prev => Math.min(5, prev + 0.25))}
              className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Resize Handles - Corners */}
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50"
        onPointerDown={(e) => handleResizeStart(e, 'se')}
      />
      <div 
        className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50"
        onPointerDown={(e) => handleResizeStart(e, 'sw')}
      />
      <div 
        className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50"
        onPointerDown={(e) => handleResizeStart(e, 'ne')}
      />
      <div 
        className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50"
        onPointerDown={(e) => handleResizeStart(e, 'nw')}
      />

      {/* Resize Handles - Edges */}
      <div 
        className="absolute top-4 bottom-4 right-0 w-2 cursor-e-resize z-40"
        onPointerDown={(e) => handleResizeStart(e, 'e')}
      />
      <div 
        className="absolute top-4 bottom-4 left-0 w-2 cursor-w-resize z-40"
        onPointerDown={(e) => handleResizeStart(e, 'w')}
      />
      <div 
        className="absolute left-4 right-4 top-0 h-2 cursor-n-resize z-40"
        onPointerDown={(e) => handleResizeStart(e, 'n')}
      />
      <div 
        className="absolute left-4 right-4 bottom-0 h-2 cursor-s-resize z-40"
        onPointerDown={(e) => handleResizeStart(e, 's')}
      />
    </motion.div>
  );
}
