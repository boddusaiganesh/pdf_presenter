import { useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useDragControls } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  ChevronLeft, ChevronRight, Pen, Highlighter, Square, Circle,
  Minus, ArrowRight, Type, StickyNote, Eraser, MousePointer,
  Crosshair, Zap, Eye, EyeOff, ZoomIn, ZoomOut,
  Undo2, Redo2, Trash2, Settings, LayoutGrid,
  Timer, BookOpen, Play, Pause, RotateCcw,
  Triangle, Lock, PanelLeft, Bomb, Layout
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';
import type { DrawTool, PointerMode } from '../store/useStore';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

function ToolbarButton({ icon, label, onClick, active, danger, disabled, shortcut }: ToolbarButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all duration-150',
            active
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
              : danger
                ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
                : 'text-white/60 hover:text-white hover:bg-white/[0.08]',
            disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
          )}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="bg-black/90 text-white px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap shadow-xl z-[99999] animate-fade-in"
          sideOffset={8}
        >
          {label}
          {shortcut && <span className="text-white/40 ml-1.5">{shortcut}</span>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-white/[0.08] mx-1 shrink-0" />;
}

interface ColorSwatchProps {
  color: string;
  active: boolean;
  onClick: () => void;
}

function ColorSwatch({ color, active, onClick }: ColorSwatchProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-5 h-5 rounded-full border-2 transition-all duration-150 cursor-pointer',
        active ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-110 hover:border-white/50'
      )}
      style={{ background: color }}
    />
  );
}

const QUICK_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff', '#000000'];

export default function FloatingToolbar({ onToggleNotes }: { onToggleNotes?: () => void }) {
  const {
    currentTool, setCurrentTool,
    drawColor, setDrawColor,
    drawSize, setDrawSize,
    drawOpacity, setDrawOpacity,
    pointerMode, setPointerMode,
    currentSlideIndex, setCurrentSlideIndex,
    currentSession,
    isBlackScreen, setIsBlackScreen,
    isFrozen, setIsFrozen,
    isOverviewMode, setIsOverviewMode,
    isSidePanelOpen, setIsSidePanelOpen,
    zoomLevel, setZoomLevel,
    timer, startTimer, pauseTimer, resetTimer, setTimerMode,
    settings, setShowSettings,
    isPresenting, setIsPresenting, setCurrentScreen,
    clearSlideAnnotation, clearAllAnnotations,
    setPostSessionStats,
  } = useStore();

  const [activeSection, setActiveSection] = useState<'draw' | 'pointer' | null>(null);
  const [showTimerPanel, setShowTimerPanel] = useState(false);

  const drawDragControls = useDragControls();
  const pointerDragControls = useDragControls();

  // Two-step confirm for "Clear All Slides" — no window.confirm
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const confirmClearAllTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClearAll = () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      confirmClearAllTimerRef.current = setTimeout(() => setConfirmClearAll(false), 3000);
    } else {
      if (confirmClearAllTimerRef.current) clearTimeout(confirmClearAllTimerRef.current);
      clearAllAnnotations();
      setConfirmClearAll(false);
    }
  };

  const slides = currentSession?.slides || [];
  const visibleSlides = slides.filter((s) => !s.hidden);
  const totalVisible = visibleSlides.length;
  const currentVisible = visibleSlides.findIndex(
    (s) => s.id === slides[currentSlideIndex]?.id
  );

  // Refs for portal popup trigger buttons
  const drawBtnRef = useRef<HTMLButtonElement>(null);
  const pointerBtnRef = useRef<HTMLButtonElement>(null);
  const timerBtnRef = useRef<HTMLButtonElement>(null);

  // Absolute fixed pixel position for each draggable popup (no transforms)
  const [drawPos, setDrawPos] = useState({ x: 0, y: 0 });
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [timerPos, setTimerPos] = useState({ x: 0, y: 0 });

  // Compute center-above-button position in viewport px.
  // Returns { x: left px from viewport left, y: bottom px from viewport bottom } — both positive.
  const getPopupPos = useCallback((ref: React.RefObject<HTMLButtonElement | null>, popupWidth = 320) => {
    if (!ref.current) return { x: 8, y: 80 };
    const r = ref.current.getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const left = Math.round(centerX - popupWidth / 2);
    // Distance from the bottom of the viewport to the top of the button, plus gap
    const bottomFromViewport = Math.round(window.innerHeight - r.top + 12);
    return {
      x: Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8)),
      // Store as positive number; panels use `bottom: y` in their style
      y: Math.max(60, bottomFromViewport),
    };
  }, []);

  const openDraw = () => {
    if (activeSection === 'draw') { setActiveSection(null); return; }
    const pos = getPopupPos(drawBtnRef, 340);
    setDrawPos(pos);
    setActiveSection('draw');
  };
  const openPointer = () => {
    if (activeSection === 'pointer') { setActiveSection(null); return; }
    const pos = getPopupPos(pointerBtnRef, 340);
    setPointerPos(pos);
    setActiveSection('pointer');
  };
  const openTimer = () => {
    if (showTimerPanel) { setShowTimerPanel(false); return; }
    const pos = getPopupPos(timerBtnRef, 224);
    setTimerPos(pos);
    setShowTimerPanel(true);
  };

  // Dispatch custom events — AnnotationCanvas listens for these
  const handleUndo = () => document.dispatchEvent(new CustomEvent('annotation:undo'));
  const handleRedo = () => document.dispatchEvent(new CustomEvent('annotation:redo'));

  const handleEndSession = () => {
    const timings = timer.slideTimings;
    const total = Object.values(timings).reduce((a, b) => a + b, 0);
    setPostSessionStats({
      slideTimings: timings,
      totalDuration: total,
      annotationsCount: slides.filter((s) => s.annotation.fabricJSON).length,
    });
    setIsPresenting(false);
    setCurrentScreen('post-session');
  };

  // Memoize timer display to avoid recalculating on every render
  const td = useMemo(() => {
    const elapsed = timer.elapsed;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (timer.mode === 'countdown') {
      const remaining = Math.max(0, timer.target - elapsed);
      const rMins = Math.floor(remaining / 60);
      const rSecs = remaining % 60;
      const pct = elapsed / timer.target;
      return {
        text: `${String(rMins).padStart(2, '0')}:${String(rSecs).padStart(2, '0')}`,
        color: pct > 1 ? 'text-red-400' : pct > 0.8 ? 'text-amber-400' : 'text-white/70',
      };
    }
    return { text: display, color: 'text-white/70' };
  }, [timer.elapsed, timer.mode, timer.target]);

  const drawTools: { tool: DrawTool; icon: React.ReactNode; label: string; shortcut?: string }[] = [
    { tool: 'select', icon: <MousePointer className="w-4 h-4" />, label: 'Select', shortcut: 'V' },
    { tool: 'pen', icon: <Pen className="w-4 h-4" />, label: 'Pen', shortcut: 'P' },
    { tool: 'highlighter', icon: <Highlighter className="w-4 h-4" />, label: 'Highlighter', shortcut: 'H' },
    { tool: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
    { tool: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
    { tool: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
    { tool: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
    { tool: 'triangle', icon: <Triangle className="w-4 h-4" />, label: 'Triangle' },
    { tool: 'text', icon: <Type className="w-4 h-4" />, label: 'Text', shortcut: 'T' },
    { tool: 'sticky', icon: <StickyNote className="w-4 h-4" />, label: 'Sticky Note' },
    { tool: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser', shortcut: 'E' },
  ];

  const pointerModes: { mode: PointerMode; icon: React.ReactNode; label: string; shortcut?: string }[] = [
    { mode: 'normal', icon: <MousePointer className="w-4 h-4" />, label: 'Normal Cursor' },
    { mode: 'laser', icon: <Zap className="w-4 h-4" />, label: 'Laser Pointer', shortcut: 'L' },
    { mode: 'spotlight', icon: <Eye className="w-4 h-4" />, label: 'Spotlight', shortcut: 'S' },
    { mode: 'squarelight', icon: <Square className="w-4 h-4" />, label: 'Squarelight' },
    { mode: 'magnifier', icon: <ZoomIn className="w-4 h-4" />, label: 'Magnifier' },
    { mode: 'crosshair', icon: <Crosshair className="w-4 h-4" />, label: 'Crosshair' },
  ];

  return (
    <Tooltip.Provider delayDuration={300}>
    <>
      {/* Main Toolbar — horizontally scrollable with a sleek scrollbar */}
      <div className="flex items-center gap-1 px-3 py-2 rounded-2xl glass border border-white/[0.1] shadow-2xl shadow-black/50 select-none max-w-[95vw] overflow-x-auto custom-scrollbar">

        {/* Navigation */}
        <ToolbarButton
          icon={<ChevronLeft className="w-4 h-4" />}
          label="Previous Slide" shortcut="←"
          onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)}
          disabled={currentVisible <= 0}
        />
        <div className="px-2 text-xs font-mono text-white/50 min-w-[56px] text-center whitespace-nowrap shrink-0">
          {currentVisible + 1} / {totalVisible}
        </div>
        <ToolbarButton
          icon={<ChevronRight className="w-4 h-4" />}
          label="Next Slide" shortcut="→"
          onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)}
          disabled={currentVisible >= totalVisible - 1}
        />

        <Divider />

        <ToolbarButton
          icon={<LayoutGrid className="w-4 h-4" />}
          label="Slide Overview" shortcut="G"
          onClick={() => setIsOverviewMode(!isOverviewMode)}
          active={isOverviewMode}
        />

        <Divider />

        {/* Draw Tools trigger — portal popup */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              ref={drawBtnRef}
              onClick={openDraw}
              className={cn(
                'w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer',
                (activeSection === 'draw' || ['pen', 'highlighter', 'line', 'arrow', 'rectangle', 'circle', 'triangle', 'text', 'sticky', 'eraser', 'lasso'].includes(currentTool))
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.08]'
              )}
            >
              <Pen className="w-4 h-4" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="bg-black/90 text-white px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap shadow-xl z-[99999] animate-fade-in" sideOffset={8}>
              Drawing Tools
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {/* Pointer Mode trigger — portal popup */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              ref={pointerBtnRef}
              onClick={openPointer}
              className={cn(
                'w-9 h-9 shrink-0 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer',
                (activeSection === 'pointer' || pointerMode !== 'normal')
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.08]'
              )}
            >
              <Zap className="w-4 h-4" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="bg-black/90 text-white px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap shadow-xl z-[99999] animate-fade-in" sideOffset={8}>
              Pointer Modes
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        <Divider />

        {/* Zoom Controls */}
        <ToolbarButton icon={<ZoomOut className="w-4 h-4" />} label="Zoom Out"
          onClick={() => setZoomLevel(zoomLevel - 0.25)} disabled={zoomLevel <= 0.5} />
        <button
          className="px-1.5 py-0.5 text-xs font-mono text-white/50 hover:text-white rounded transition-colors min-w-[40px] text-center shrink-0"
          onClick={() => setZoomLevel(1)} title="Reset zoom"
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <ToolbarButton icon={<ZoomIn className="w-4 h-4" />} label="Zoom In"
          onClick={() => setZoomLevel(zoomLevel + 0.25)} disabled={zoomLevel >= 4} />

        <Divider />

        <ToolbarButton
          icon={isBlackScreen ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          label={isBlackScreen ? 'Show Slide' : 'Black Screen'} shortcut="B"
          onClick={() => setIsBlackScreen(!isBlackScreen)} active={isBlackScreen}
        />
        <ToolbarButton
          icon={<Lock className="w-4 h-4" />}
          label={isFrozen ? 'Unfreeze Canvas' : 'Freeze Canvas'} shortcut="Z"
          onClick={() => setIsFrozen(!isFrozen)} active={isFrozen}
        />
        <ToolbarButton
          icon={<Layout className="w-4 h-4" />}
          label="Add Popup Slide"
          onClick={() => {
            const vs = currentSession?.slides.filter(s => !s.hidden) || [];
            const slide = vs[currentSlideIndex];
            if (slide) useStore.getState().addPopupSlide(slide.id, {});
          }}
        />

        <Divider />

        {/* Timer trigger — portal popup */}
        <button
          ref={timerBtnRef}
          onClick={openTimer}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0',
            timer.running ? 'bg-green-500/20 text-green-400' : 'text-white/50 hover:text-white hover:bg-white/[0.08]'
          )}
        >
          <Timer className="w-3.5 h-3.5" />
          <span className={td.color}>{td.text}</span>
        </button>

        <Divider />

        <ToolbarButton icon={<BookOpen className="w-4 h-4" />} label="Speaker Notes"
          onClick={() => onToggleNotes?.()} />
        <ToolbarButton icon={<PanelLeft className="w-4 h-4" />} label="Toggle Side Panel" shortcut="Ctrl+P"
          onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} active={isSidePanelOpen} />
        <ToolbarButton icon={<Settings className="w-4 h-4" />} label="Settings"
          onClick={() => setShowSettings(true)} />

        {isPresenting && (
          <>
            <Divider />
            <button
              onClick={handleEndSession}
              className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300 text-xs font-medium transition-all shrink-0"
            >
              End Session
            </button>
          </>
        )}
      </div>

      {/* ── Portal: Draw Tools panel ─────────────────────────────────── */}
      {activeSection === 'draw' && createPortal(
        <motion.div
          drag
          dragControls={drawDragControls}
          dragListener={false}
          dragMomentum={false}
          onDragEnd={(_e, info) => {
            setDrawPos(prev => ({ x: prev.x + info.offset.x, y: prev.y + info.offset.y }));
          }}
          className="fixed glass rounded-2xl p-3 shadow-2xl border border-white/[0.08] animate-fade-in flex flex-col gap-1"
          style={{ left: drawPos.x, bottom: drawPos.y, zIndex: 9990 }}
        >
          {/* Drag Handle */}
          <div
            className="w-full flex justify-center pb-2 cursor-grab active:cursor-grabbing hover:bg-white/[0.05] rounded-t-lg transition-colors -mt-1 pt-1"
            onPointerDown={(e) => drawDragControls.start(e)}
          >
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>

          <div className="flex gap-1 mb-2">
            {drawTools.map((t) => (
              <ToolbarButton key={t.tool} icon={t.icon} label={t.label} shortcut={t.shortcut}
                onClick={() => setCurrentTool(t.tool)} active={currentTool === t.tool} />
            ))}
          </div>
          {/* Color Row */}
          <div className="flex items-center gap-2 px-1">
            <div className="flex items-center gap-1.5">
              {QUICK_COLORS.map((c) => (
                <ColorSwatch key={c} color={c} active={drawColor === c} onClick={() => setDrawColor(c)} />
              ))}
            </div>
            <div className="relative">
              <div className="w-5 h-5 rounded-full border-2 border-white/30 cursor-pointer overflow-hidden">
                <input
                  type="color" value={drawColor}
                  onChange={(e) => setDrawColor(e.target.value)}
                  className="absolute inset-0 w-8 h-8 -translate-x-1 -translate-y-1 cursor-pointer opacity-0"
                  title="Custom color"
                />
                <div className="w-full h-full" style={{ background: drawColor }} />
              </div>
            </div>
          </div>
          {/* Size + Opacity */}
          <div className="mt-3 px-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs w-12">Size</span>
              <input type="range" min="1" max="50" value={drawSize}
                onChange={(e) => setDrawSize(Number(e.target.value))}
                className="flex-1 h-1 accent-indigo-500" />
              <span className="text-white/40 text-xs w-6 text-right">{drawSize}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs w-12">Opacity</span>
              <input type="range" min="0.1" max="1" step="0.1" value={drawOpacity}
                onChange={(e) => setDrawOpacity(Number(e.target.value))}
                className="flex-1 h-1 accent-indigo-500" />
              <span className="text-white/40 text-xs w-6 text-right">{Math.round(drawOpacity * 100)}%</span>
            </div>
          </div>
          {/* Undo/Redo/Clear */}
          <div className="flex items-center gap-1 mt-3 pt-2 border-t border-white/[0.06]">
            <ToolbarButton icon={<Undo2 className="w-4 h-4" />} label="Undo" shortcut="Ctrl+Z" onClick={handleUndo} />
            <ToolbarButton icon={<Redo2 className="w-4 h-4" />} label="Redo" shortcut="Ctrl+Y" onClick={handleRedo} />
            <div className="flex-1" />
            <ToolbarButton
              icon={<Trash2 className="w-4 h-4" />}
              label="Clear This Slide" shortcut="Ctrl+D" danger
              onClick={() => {
                const slide = slides[currentSlideIndex];
                if (slide) clearSlideAnnotation(slide.id);
              }}
            />
            <div className="relative">
              <ToolbarButton
                icon={<Bomb className="w-4 h-4" />}
                label={confirmClearAll ? 'Confirm? Click again' : 'Clear All Slides'}
                shortcut="Ctrl+Shift+D"
                danger
                onClick={handleClearAll}
                active={confirmClearAll}
              />
              {confirmClearAll && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-red-500 text-white text-[10px] rounded whitespace-nowrap">
                  Click again to confirm
                </div>
              )}
            </div>
          </div>
        </motion.div>,
        document.body
      )}

      {/* ── Portal: Pointer Modes panel ──────────────────────────────── */}
      {activeSection === 'pointer' && createPortal(
        <motion.div
          drag
          dragControls={pointerDragControls}
          dragListener={false}
          dragMomentum={false}
          onDragEnd={(_e, info) => {
            setPointerPos(prev => ({ x: prev.x + info.offset.x, y: prev.y + info.offset.y }));
          }}
          className="fixed glass rounded-2xl p-3 shadow-2xl border border-white/[0.08] animate-fade-in flex flex-col gap-1"
          style={{ left: pointerPos.x, bottom: pointerPos.y, zIndex: 9990 }}
        >
          {/* Drag Handle */}
          <div
            className="w-full flex justify-center pb-2 cursor-grab active:cursor-grabbing hover:bg-white/[0.05] rounded-t-lg transition-colors -mt-1 pt-1"
            onPointerDown={(e) => pointerDragControls.start(e)}
          >
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>

          <div className="flex gap-1 mb-3">
            {pointerModes.map((p) => (
              <ToolbarButton key={p.mode} icon={p.icon} label={p.label} shortcut={p.shortcut}
                onClick={() => setPointerMode(p.mode)} active={pointerMode === p.mode} />
            ))}
          </div>
          {pointerMode === 'laser' && (
            <div className="space-y-2 px-1 mt-1 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs w-16">Laser Size</span>
                <input type="range" min="6" max="32" value={settings.laserSize}
                  onChange={(e) => useStore.getState().updateSettings({ laserSize: Number(e.target.value) })}
                  className="flex-1 h-1 accent-red-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs w-16">Glow</span>
                <input type="range" min="0" max="100" value={settings.laserGlow}
                  onChange={(e) => useStore.getState().updateSettings({ laserGlow: Number(e.target.value) })}
                  className="flex-1 h-1 accent-red-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs w-16">Color</span>
                <div className="flex gap-1">
                  {['#ff3232', '#32ff32', '#3232ff', '#ffff00', '#ffffff'].map((c) => (
                    <div key={c}
                      className={cn('w-4 h-4 rounded-full cursor-pointer border-2 transition-all',
                        settings.laserColor === c ? 'border-white scale-110' : 'border-transparent')}
                      style={{ background: c }}
                      onClick={() => useStore.getState().updateSettings({ laserColor: c })}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          {(pointerMode === 'spotlight' || pointerMode === 'squarelight') && (
            <div className="space-y-2 px-1 mt-1 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs w-16">Size</span>
                <input type="range" min="80" max="400" value={settings.spotlightSize}
                  onChange={(e) => useStore.getState().updateSettings({ spotlightSize: Number(e.target.value) })}
                  className="flex-1 h-1 accent-indigo-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs w-16">Dim Level</span>
                <input type="range" min="30" max="95" value={settings.spotlightDimLevel}
                  onChange={(e) => useStore.getState().updateSettings({ spotlightDimLevel: Number(e.target.value) })}
                  className="flex-1 h-1 accent-indigo-500" />
              </div>
            </div>
          )}
        </motion.div>,
        document.body
      )}

      {/* ── Portal: Timer panel ──────────────────────────────────────── */}
      {showTimerPanel && createPortal(
        <div
          className="fixed glass rounded-2xl p-4 shadow-2xl border border-white/[0.08] animate-fade-in w-56"
          style={{ left: timerPos.x, bottom: timerPos.y, zIndex: 9990 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Timer</span>
            <button
              onClick={() => setTimerMode(timer.mode === 'countdown' ? 'countup' : 'countdown')}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {timer.mode === 'countdown' ? 'Countdown' : 'Count Up'}
            </button>
          </div>
          <div className={cn('text-3xl font-mono text-center mb-4', td.color)}>{td.text}</div>
          {timer.mode === 'countdown' && (
            <div className="mb-3">
              <label className="text-white/40 text-xs">Target (minutes)</label>
              <input
                type="number" min="1" max="300"
                value={Math.floor(timer.target / 60)}
                onChange={(e) => useStore.getState().setTimerTarget(Number(e.target.value) * 60)}
                className="w-full mt-1 px-3 py-1.5 bg-white/[0.05] rounded-lg text-white text-sm border border-white/[0.08] focus:outline-none focus:border-indigo-500"
              />
              <div className="mt-1 progress-bar">
                <div className="progress-fill" style={{
                  width: `${Math.min(100, (timer.elapsed / timer.target) * 100)}%`,
                  background: timer.elapsed / timer.target > 1 ? '#ef4444' : timer.elapsed / timer.target > 0.8 ? '#f59e0b' : undefined,
                }} />
              </div>
            </div>
          )}
          <div className="flex gap-1.5">
            {timer.running ? (
              <button onClick={pauseTimer}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-medium transition-colors">
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            ) : (
              <button onClick={startTimer}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-medium transition-colors">
                <Play className="w-3.5 h-3.5" /> {timer.elapsed > 0 ? 'Resume' : 'Start'}
              </button>
            )}
            <button onClick={resetTimer}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/[0.1] text-xs transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Backdrop: close popups when clicking outside — sits below the panels */}
      {activeSection && <div className="fixed inset-0" style={{ zIndex: 9989 }} onClick={() => setActiveSection(null)} />}
      {showTimerPanel && <div className="fixed inset-0" style={{ zIndex: 9989 }} onClick={() => setShowTimerPanel(false)} />}
    </>
    </Tooltip.Provider>
  );
}
