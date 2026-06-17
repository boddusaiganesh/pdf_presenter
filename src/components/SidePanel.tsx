import React, { useState, useRef } from 'react';
import {
  Eye, EyeOff, Trash2, Copy, Plus, GripVertical, Film,
  Image, FileText, X, ChevronRight,
  Video, Link, Layout, AlignJustify, MoreHorizontal
} from 'lucide-react';
import { useStore, Slide } from '../store/useStore';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

interface SlideThumbnailProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  slideNumber: number;
  renderedPages: Record<number, string>;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onContextMenu: (e: React.MouseEvent, index: number) => void;
}

function SlideThumbnail({
  slide, index, isActive, slideNumber, renderedPages,
  onSelect, onDragStart, onDragOver, onDrop, onContextMenu
}: SlideThumbnailProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const getSlidePreview = () => {
    if (slide.type === 'pdf' && slide.pdfPageIndex !== undefined) {
      const img = renderedPages[slide.pdfPageIndex];
      if (img) return <img src={img} alt={`Slide ${slideNumber}`} className="w-full h-full object-cover" />;
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      );
    }
    if (slide.type === 'blank-white') return <div className="w-full h-full bg-white rounded flex items-center justify-center"><span className="text-gray-300 text-xs">Blank</span></div>;
    if (slide.type === 'blank-black') return <div className="w-full h-full bg-black rounded flex items-center justify-center"><span className="text-gray-600 text-xs">Blank</span></div>;
    if (slide.type === 'image') return (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center relative overflow-hidden rounded">
        {slide.mediaUrl ? <img src={slide.mediaUrl} alt="" className="w-full h-full object-cover" /> : <Image className="w-6 h-6 text-white/30" />}
      </div>
    );
    if (slide.type === 'youtube' || slide.type === 'vimeo' || slide.type === 'loom') return (
      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center gap-1 rounded">
        <Film className="w-6 h-6 text-red-400" />
        <span className="text-white/30 text-[9px]">{slide.type}</span>
      </div>
    );
    if (slide.type === 'video') return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center rounded">
        <Video className="w-6 h-6 text-blue-400" />
      </div>
    );
    if (slide.type === 'iframe') return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center rounded">
        <Link className="w-6 h-6 text-teal-400" />
      </div>
    );
    return <div className="w-full h-full bg-slate-800 flex items-center justify-center rounded"><FileText className="w-6 h-6 text-white/30" /></div>;
  };

  return (
    <div
      className={cn(
        'relative group rounded-xl transition-all cursor-pointer select-none',
        isDragOver ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#0f1117]' : '',
        isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#0f1117]' : 'hover:ring-1 hover:ring-white/20 hover:ring-offset-1 hover:ring-offset-[#0f1117]',
        slide.hidden ? 'opacity-40' : ''
      )}
      onClick={onSelect}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); onDragOver(e, index); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { setIsDragOver(false); onDrop(e, index); }}
      onContextMenu={(e) => onContextMenu(e, index)}
    >
      {/* Drag Handle */}
      <div className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3 h-3 text-white/40" />
      </div>

      {/* Tools Menu Button (3 dots) */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, index);
          }}
          className="p-1 rounded-md bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur shadow-sm transition-all"
          title="Slide Options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Thumbnail */}
      <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden">
        {getSlidePreview()}
      </div>

      {/* Slide Number & Badges */}
      <div className="flex items-center justify-between mt-1.5 px-0.5">
        <span className={cn('text-xs font-mono', isActive ? 'text-indigo-400' : 'text-white/30')}>
          {String(slideNumber).padStart(2, '0')}
        </span>
        <div className="flex items-center gap-1">
          {slide.annotation.fabricJSON && (
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Has annotations" />
          )}
          {slide.note.content && (
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Has notes" />
          )}
          {slide.hidden && <EyeOff className="w-3 h-3 text-white/30" />}
        </div>
      </div>
    </div>
  );
}

// ─── Context Menu ──────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  slideIndex: number;
  slide: Slide;
  onClose: () => void;
}

function ContextMenu({ x, y, slideIndex, slide, onClose }: ContextMenuProps) {
  const {
    toggleHideSlide, removeSlide, duplicateSlide,
    addSlide, openMediaPanel
  } = useStore();

  const menuRef = useRef<HTMLDivElement>(null);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const menuItems = [
    {
      label: slide.hidden ? 'Show Slide' : 'Hide Slide',
      icon: slide.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />,
      action: () => toggleHideSlide(slideIndex),
    },
    {
      label: 'Duplicate',
      icon: <Copy className="w-3.5 h-3.5" />,
      action: () => duplicateSlide(slideIndex),
    },
    { separator: true },
    {
      label: 'Insert Blank White Slide',
      icon: <Layout className="w-3.5 h-3.5" />,
      action: () => addSlide({ type: 'blank-white' }, slideIndex),
    },
    {
      label: 'Insert Blank Black Slide',
      icon: <Layout className="w-3.5 h-3.5" />,
      action: () => addSlide({ type: 'blank-black' }, slideIndex),
    },
    { separator: true },
    {
      label: 'Insert Media / Image',
      icon: <Image className="w-3.5 h-3.5" />,
      action: () => openMediaPanel(slideIndex),
    },
    {
      label: 'Insert Video',
      icon: <Film className="w-3.5 h-3.5" />,
      action: () => openMediaPanel(slideIndex),
    },
    { separator: true },
    {
      label: 'Delete Slide',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      action: () => {
        if (window.confirm('Delete this slide?')) {
          removeSlide(slideIndex);
          toast.success('Slide deleted');
        }
      },
      danger: true,
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-[1000] glass rounded-xl shadow-2xl shadow-black/50 py-1 w-52 animate-fade-in"
        style={{
          left: Math.min(x, window.innerWidth - 220),
          top: Math.min(y, window.innerHeight - 300),
        }}
      >
        {menuItems.map((item, i) => {
          if ('separator' in item) return <div key={i} className="my-1 border-t border-white/[0.06]" />;
          return (
            <button
              key={item.label}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                item.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
              )}
              onClick={() => handleAction(item.action)}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── Main Side Panel ───────────────────────────────────────────────────────────

export default function SidePanel() {
  const {
    currentSession, currentSlideIndex, setCurrentSlideIndex,
    isSidePanelOpen, setIsSidePanelOpen, renderedPages,
    addSlide, reorderSlide, openMediaPanel
  } = useStore();

  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const slides = currentSession?.slides || [];
  const visibleSlides = slides;
  let displayNumber = 0;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragFromIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, _index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragFromIndex === null || dragFromIndex === toIndex) return;
    reorderSlide(dragFromIndex, toIndex);
    setDragFromIndex(null);
    toast.success('Slide moved');
  };

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, index });
  };

  if (!isSidePanelOpen) {
    return (
      <button
        onClick={() => setIsSidePanelOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 w-6 h-16 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] border-l-0 rounded-r-lg flex items-center justify-center transition-all group"
      >
        <ChevronRight className="w-3 h-3 text-white/40 group-hover:text-white/70" />
      </button>
    );
  }

  return (
    <>
      <aside className="w-56 flex-shrink-0 border-r border-white/[0.06] flex flex-col h-full bg-[#0f1117] min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
          <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
            Slides ({slides.length})
          </span>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
                title="Add slide"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {showAddMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 glass rounded-xl shadow-xl w-48 py-1 animate-fade-in">
                    {[
                      { label: 'Blank White Slide', icon: <Layout className="w-3.5 h-3.5" />, type: 'blank-white' as const },
                      { label: 'Blank Black Slide', icon: <Layout className="w-3.5 h-3.5" />, type: 'blank-black' as const },
                      { label: 'Image Slide', icon: <Image className="w-3.5 h-3.5" />, type: 'image' as const, isMedia: true },
                      { label: 'Video Slide', icon: <Film className="w-3.5 h-3.5" />, type: 'video' as const, isMedia: true },
                      { label: 'Web/iFrame Slide', icon: <Link className="w-3.5 h-3.5" />, type: 'iframe' as const, isMedia: true },
                    ].map((item) => (
                      <button
                        key={item.label}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors"
                        onClick={() => {
                          if (item.isMedia) {
                            openMediaPanel(currentSlideIndex);
                          } else {
                            addSlide({ type: item.type }, currentSlideIndex);
                          }
                          setShowAddMenu(false);
                        }}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setIsSidePanelOpen(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Slides List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {visibleSlides.map((slide, index) => {
            if (!slide.hidden) displayNumber++;
            const isActive = index === currentSlideIndex;
            return (
              <SlideThumbnail
                key={slide.id}
                slide={slide}
                index={index}
                isActive={isActive}
                slideNumber={slide.hidden ? index + 1 : displayNumber}
                renderedPages={renderedPages}
                onSelect={() => {
                  setCurrentSlideIndex(index);
                }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onContextMenu={handleContextMenu}
              />
            );
          })}

          {slides.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center px-2">
              <AlignJustify className="w-8 h-8 text-white/10 mb-2" />
              <p className="text-white/30 text-xs">No slides yet</p>
              <p className="text-white/20 text-xs mt-0.5">Open a PDF or add slides</p>
            </div>
          )}
        </div>
      </aside>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          slideIndex={contextMenu.index}
          slide={slides[contextMenu.index]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
