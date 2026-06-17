import { useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import SlideCanvas from './SlideCanvas';
import FloatingToolbar from './FloatingToolbar';
import PointerOverlay from './PointerOverlay';
import SettingsPanel from './SettingsPanel';
import { cn } from '../utils/cn';

export default function PresentingView() {
  const {
    currentSession, currentSlideIndex, setCurrentSlideIndex,
    isToolbarVisible, setIsToolbarVisible,
    isSidePanelOpen, setIsSidePanelOpen,
    pointerMode, setPointerMode, setPointerPosition,
    currentTool, setCurrentTool,
    isBlackScreen, setIsBlackScreen,
    isFrozen, setIsFrozen,
    isOverviewMode, setIsOverviewMode,
    zoomLevel, setZoomLevel,
    timer, tickTimer,
    settings, showSettings,
    clearSlideAnnotation, clearAllAnnotations,
  } = useStore();

  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearToolbarRef = useRef(false);

  const slides = currentSession?.slides || [];

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      if (timer.running) tickTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [timer.running, tickTimer]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const ctrl = e.ctrlKey || e.metaKey;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
      case 'PageDown':
        if (!ctrl) { e.preventDefault(); setCurrentSlideIndex(currentSlideIndex + 1); }
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        if (!ctrl) { e.preventDefault(); setCurrentSlideIndex(currentSlideIndex - 1); }
        break;
      case 'Home':
        setCurrentSlideIndex(0);
        break;
      case 'End':
        setCurrentSlideIndex(slides.length - 1);
        break;
      case 'b':
      case 'B':
        if (!ctrl) setIsBlackScreen(!isBlackScreen);
        break;
      case 'z':
      case 'Z':
        if (!ctrl) setIsFrozen(!isFrozen);
        break;
      case 'l':
      case 'L':
        if (!ctrl) setPointerMode(pointerMode === 'laser' ? 'normal' : 'laser');
        break;
      case 's':
      case 'S':
        if (!ctrl) setPointerMode(pointerMode === 'spotlight' ? 'normal' : 'spotlight');
        break;
      case 'p':
      case 'P':
        if (!ctrl) setCurrentTool('pen');
        break;
      case 'h':
      case 'H':
        if (!ctrl) setCurrentTool('highlighter');
        break;
      case 'e':
      case 'E':
        if (!ctrl) setCurrentTool('eraser');
        break;
      case 't':
      case 'T':
        if (!ctrl) setCurrentTool('text');
        break;
      case 'v':
      case 'V':
        if (!ctrl) setCurrentTool('select');
        break;
      case 'g':
      case 'G':
        if (!ctrl) setIsOverviewMode(!isOverviewMode);
        break;
      case 'd':
        if (ctrl && e.shiftKey) {
          e.preventDefault();
          if (window.confirm('Clear all annotations?')) clearAllAnnotations();
        } else if (ctrl) {
          e.preventDefault();
          const slide = slides[currentSlideIndex];
          if (slide) clearSlideAnnotation(slide.id);
        }
        break;
      // ctrl+p handled separately above to avoid duplicate case
      case '+':
      case '=':
        if (ctrl) { e.preventDefault(); setZoomLevel(zoomLevel + 0.25); }
        break;
      case '-':
        if (ctrl) { e.preventDefault(); setZoomLevel(zoomLevel - 0.25); }
        break;
      case '0':
        if (ctrl) { e.preventDefault(); setZoomLevel(1); }
        break;
      case 'Escape':
        setIsOverviewMode(false);
        if (isBlackScreen) setIsBlackScreen(false);
        if (pointerMode !== 'normal') setPointerMode('normal');
        if (currentTool !== 'select') setCurrentTool('select');
        break;
    }
  }, [
    currentSlideIndex, slides, isBlackScreen, isFrozen,
    pointerMode, isSidePanelOpen, isOverviewMode, zoomLevel, currentTool,
    setCurrentSlideIndex, setIsBlackScreen, setIsFrozen,
    setPointerMode, setCurrentTool, setIsOverviewMode,
    setIsSidePanelOpen, setZoomLevel,
    clearSlideAnnotation, clearAllAnnotations
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Mouse tracking
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPointerPosition({ x: e.clientX, y: e.clientY });

    // Auto-show toolbar when near bottom
    const distFromBottom = window.innerHeight - e.clientY;
    if (distFromBottom < 100) {
      setIsToolbarVisible(true);
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
      if (!isNearToolbarRef.current) {
        toolbarTimerRef.current = setTimeout(() => {
          setIsToolbarVisible(false);
        }, settings.toolbarAutoHideDelay);
      }
    }
  }, [setPointerPosition, setIsToolbarVisible, settings.toolbarAutoHideDelay]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Auto-advance slides
  useEffect(() => {
    if (settings.autoAdvanceSeconds <= 0) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }, settings.autoAdvanceSeconds * 1000);
    return () => clearInterval(interval);
  }, [settings.autoAdvanceSeconds, currentSlideIndex, setCurrentSlideIndex]);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative" style={{ cursor: pointerMode !== 'normal' ? 'none' : 'default' }}>
      {/* Slide Canvas (takes full screen) */}
      <div className="absolute inset-0">
        <SlideCanvas isPresenting />
      </div>

      {/* Pointer overlay — sits above slide, below toolbar */}
      <PointerOverlay />

      {/* Floating Toolbar — centered at bottom, auto-hides */}
      <div
        className={cn(
          'absolute z-50 transition-all duration-300',
          settings.toolbarPosition === 'bottom'
            ? 'bottom-4 left-1/2 -translate-x-1/2'
            : 'top-4 left-1/2 -translate-x-1/2',
          isToolbarVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
        onMouseEnter={() => {
          isNearToolbarRef.current = true;
          setIsToolbarVisible(true);
          if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
        }}
        onMouseLeave={() => {
          isNearToolbarRef.current = false;
          toolbarTimerRef.current = setTimeout(() => {
            setIsToolbarVisible(false);
          }, settings.toolbarAutoHideDelay);
        }}
      >
        <FloatingToolbar />
      </div>

      {/* Settings */}
      {showSettings && <SettingsPanel />}
    </div>
  );
}
