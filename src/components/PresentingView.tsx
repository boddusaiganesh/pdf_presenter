import { useEffect, useCallback, useRef } from 'react';
import { useStore } from '../store/useStore';
import SlideCanvas from './SlideCanvas';
import FloatingToolbar from './FloatingToolbar';
import PointerOverlay from './PointerOverlay';
import SettingsPanel from './SettingsPanel';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

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
    settings, showSettings,
    clearSlideAnnotation, clearAllAnnotations,
    saveCurrentSession,
    timer, startTimer, pauseTimer,
  } = useStore();

  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearToolbarRef = useRef(false);

  // Use a ref for the auto-hide delay so handleMouseMove doesn't need to
  // be recreated every time settings change (avoids re-adding mousemove listener)
  const autoHideDelayRef = useRef(settings.toolbarAutoHideDelay);
  useEffect(() => {
    autoHideDelayRef.current = settings.toolbarAutoHideDelay;
  }, [settings.toolbarAutoHideDelay]);

  const slides = currentSession?.slides || [];

  // NOTE: Timer tick is handled globally in App.tsx — no duplicate interval here

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.contentEditable === 'true') return;

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
        if (ctrl) {
          e.preventDefault();
          saveCurrentSession();
          toast.success('Session saved');
        } else {
          setPointerMode(pointerMode === 'spotlight' ? 'normal' : 'spotlight');
        }
        break;
      case 'p':
      case 'P':
        if (ctrl) {
          e.preventDefault();
          setIsSidePanelOpen(!isSidePanelOpen);
        } else {
          setCurrentTool('pen');
        }
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
        if (ctrl) {
          e.preventDefault();
          if (timer.running) pauseTimer(); else startTimer();
        } else {
          setCurrentTool('text');
        }
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
      case 'D':
        if (ctrl && e.shiftKey) {
          e.preventDefault();
          clearAllAnnotations();
        } else if (ctrl) {
          e.preventDefault();
          const slide = slides[currentSlideIndex];
          if (slide) clearSlideAnnotation(slide.id);
        }
        break;
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
      case 'Escape': {
        const hadOverlay = isOverviewMode || isBlackScreen || pointerMode !== 'normal' || currentTool !== 'select';
        setIsOverviewMode(false);
        if (isBlackScreen) setIsBlackScreen(false);
        if (pointerMode !== 'normal') setPointerMode('normal');
        if (currentTool !== 'select') setCurrentTool('select');
        // If nothing was active, Escape acts as "exit presenting" so user is never trapped
        if (!hadOverlay) {
          useStore.getState().setCurrentScreen('editor');
        }
        break;
      }
    }
  }, [
    currentSlideIndex, slides, isBlackScreen, isFrozen,
    pointerMode, isOverviewMode, zoomLevel, currentTool,
    isSidePanelOpen, timer,
    setCurrentSlideIndex, setIsBlackScreen, setIsFrozen,
    setPointerMode, setCurrentTool, setIsOverviewMode,
    setIsSidePanelOpen, setZoomLevel,
    saveCurrentSession, startTimer, pauseTimer,
    clearSlideAnnotation, clearAllAnnotations,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Mouse tracking — stable callback, reads delay from ref
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPointerPosition({ x: e.clientX, y: e.clientY });
    const distFromBottom = window.innerHeight - e.clientY;
    if (distFromBottom < 100) {
      setIsToolbarVisible(true);
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
      if (!isNearToolbarRef.current) {
        toolbarTimerRef.current = setTimeout(
          () => setIsToolbarVisible(false),
          autoHideDelayRef.current
        );
      }
    }
  }, [setPointerPosition, setIsToolbarVisible]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Auto-advance slides
  // Use a ref for currentSlideIndex so the interval doesn't restart on every slide change
  const currentSlideIndexRef = useRef(currentSlideIndex);
  useEffect(() => { currentSlideIndexRef.current = currentSlideIndex; }, [currentSlideIndex]);

  useEffect(() => {
    if (settings.autoAdvanceSeconds <= 0) return;
    const interval = setInterval(() => {
      setCurrentSlideIndex(currentSlideIndexRef.current + 1);
    }, settings.autoAdvanceSeconds * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoAdvanceSeconds, setCurrentSlideIndex]);

  return (
    <div
      className="h-screen w-screen bg-black overflow-hidden relative"
      style={{ cursor: pointerMode !== 'normal' ? 'none' : 'default' }}
    >
      {/* Slide Canvas */}
      <div className="absolute inset-0">
        <SlideCanvas isPresenting />
      </div>

      <PointerOverlay />

      {/* Floating Toolbar */}
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
          toolbarTimerRef.current = setTimeout(
            () => setIsToolbarVisible(false),
            autoHideDelayRef.current
          );
        }}
      >
        <FloatingToolbar />
      </div>

      {/* Always-visible exit button — ensures user can never be trapped in PresentingView */}
      <button
        onClick={() => useStore.getState().setCurrentScreen('editor')}
        className="fixed top-3 right-3 z-[9998] w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:bg-black/70 transition-all"
        title="Exit Presenting (Esc)"
      >
        <X className="w-4 h-4" />
      </button>

      {showSettings && <SettingsPanel />}
    </div>
  );
}
