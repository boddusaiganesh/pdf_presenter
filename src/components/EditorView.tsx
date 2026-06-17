import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save, Play, Home, Plus, Film, Download,
  Settings, BookOpen, ChevronRight, Keyboard,
  FileText, Zap, AlertTriangle, Clock
} from 'lucide-react';
import { useStore } from '../store/useStore';
import SidePanel from './SidePanel';
import SlideCanvas from './SlideCanvas';
import FloatingToolbar from './FloatingToolbar';
import SettingsPanel from './SettingsPanel';
import MediaInsertPanel from './MediaInsertPanel';
import SpeakerNotePanel from './SpeakerNotePanel';
import { exportSessionFile } from '../utils/exportUtils';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

export default function EditorView() {
  const {
    currentSession, setCurrentScreen, saveCurrentSession,
    showSettings, setShowSettings, settings,
    currentSlideIndex, setCurrentSlideIndex,
    isToolbarVisible, setIsToolbarVisible,
    isSidePanelOpen, setIsSidePanelOpen,
    pointerMode, setPointerMode, setPointerPosition,
    currentTool, setCurrentTool,
    isBlackScreen, setIsBlackScreen,
    isFrozen, setIsFrozen,
    isOverviewMode, setIsOverviewMode,
    zoomLevel, setZoomLevel,
    timer, tickTimer, startTimer, pauseTimer, resetTimer,
    lastAutoSave, setLastAutoSave,
    clearSlideAnnotation, clearAllAnnotations,
    setPreflightCheck,
    isMediaPanelOpen, openMediaPanel, closeMediaPanel, mediaPanelInsertIndex
  } = useStore();

  const [showNotePanel, setShowNotePanel] = useState(false);
  const [toolbarHideTimer, setToolbarHideTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const isMouseNearToolbar = useRef(false);

  const slides = currentSession?.slides || [];

  // Auto-save
  useEffect(() => {
    if (settings.autoSaveInterval <= 0) return;
    const interval = setInterval(() => {
      saveCurrentSession();
      setLastAutoSave(Date.now());
    }, settings.autoSaveInterval * 1000);
    return () => clearInterval(interval);
  }, [settings.autoSaveInterval, saveCurrentSession]);

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
      case 'D':
        if (ctrl && e.shiftKey) {
          e.preventDefault();
          if (window.confirm('Clear all annotations from all slides?')) clearAllAnnotations();
        } else if (ctrl) {
          e.preventDefault();
          const slide = slides[currentSlideIndex];
          if (slide) clearSlideAnnotation(slide.id);
        }
        break;
      // Note: 's' and 'p' with ctrl are handled in the default logic
      // below via additional checks to avoid duplicate case warnings
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
        setIsBlackScreen(false);
        setPointerMode('normal');
        setCurrentTool('select');
        break;
    }
  }, [
    currentSlideIndex, slides, isBlackScreen, isFrozen,
    pointerMode, isSidePanelOpen, isOverviewMode, zoomLevel,
    setCurrentSlideIndex, setIsBlackScreen, setIsFrozen,
    setPointerMode, setCurrentTool, setIsOverviewMode,
    setIsSidePanelOpen, setZoomLevel, saveCurrentSession,
    clearSlideAnnotation, clearAllAnnotations
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Track mouse position for pointer
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPointerPosition({ x: e.clientX, y: e.clientY });
  }, [setPointerPosition]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Toolbar auto-hide logic
  const handleMouseNearBottom = useCallback((e: React.MouseEvent) => {
    const threshold = 120;
    const distFromBottom = window.innerHeight - e.clientY;
    if (distFromBottom < threshold) {
      setIsToolbarVisible(true);
      if (toolbarHideTimer) clearTimeout(toolbarHideTimer);
      const timer = setTimeout(() => {
        if (!isMouseNearToolbar.current) {
          setIsToolbarVisible(false);
        }
      }, settings.toolbarAutoHideDelay);
      setToolbarHideTimer(timer);
    }
  }, [settings.toolbarAutoHideDelay, toolbarHideTimer, setIsToolbarVisible]);

  if (!currentSession) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 mb-4">No session loaded</p>
          <button onClick={() => setCurrentScreen('home')} className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0f1117] flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-12 border-b border-white/[0.06] flex items-center px-4 gap-3 shrink-0 z-30 relative">
        {/* Logo */}
        <button
          onClick={() => setCurrentScreen('home')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
        </button>

        {/* Session Name */}
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setCurrentScreen('home')} className="text-white/30 hover:text-white/60 transition-colors">
            <Home className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white/70 font-medium truncate max-w-[200px]">{currentSession.name}</span>
        </div>

        <div className="flex-1" />

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          {/* Auto-save indicator */}
          {lastAutoSave > 0 && (
            <span className="text-white/20 text-xs flex items-center gap-1 mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
              Saved
            </span>
          )}

          <button
            onClick={() => setShowNotePanel(!showNotePanel)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all',
              showNotePanel ? 'bg-blue-500/15 text-blue-400' : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Notes
          </button>

          <button
            onClick={() => openMediaPanel()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Slide
          </button>

          <button
            onClick={() => {
              saveCurrentSession();
              exportSessionFile(currentSession);
              toast.success('Session exported as .pdfpro file');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          <button
            onClick={() => {
              saveCurrentSession();
              toast.success('Saved!', { duration: 1200 });
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>

          <div className="w-px h-5 bg-white/[0.08] mx-1" />

          <button
            onClick={() => {
              if (settings.autoCloseSidePanel) setIsSidePanelOpen(false);
              setPreflightCheck('toolbarAutoHide', true);
              setCurrentScreen('preflight');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            Present
          </button>
        </div>
      </header>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Side Panel */}
        <SidePanel />

        {/* Center: Canvas + Speaker Notes */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Slide Canvas */}
          <div
            className="flex-1 relative overflow-hidden"
            onMouseMove={handleMouseNearBottom}
          >
            <SlideCanvas />

            {/* Floating Toolbar */}
            <div
              className={cn(
                'absolute z-50 transition-all duration-300',
                settings.toolbarPosition === 'bottom'
                  ? 'bottom-4 left-1/2 -translate-x-1/2'
                  : 'top-4 left-1/2 -translate-x-1/2',
                isToolbarVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
              )}
              onMouseEnter={() => { isMouseNearToolbar.current = true; setIsToolbarVisible(true); }}
              onMouseLeave={() => {
                isMouseNearToolbar.current = false;
                const t = setTimeout(() => setIsToolbarVisible(false), settings.toolbarAutoHideDelay);
                setToolbarHideTimer(t);
              }}
            >
              <FloatingToolbar />
            </div>

            {/* Always-visible mini nav */}
            {!isToolbarVisible && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
                <button
                  onClick={() => setIsToolbarVisible(true)}
                  className="px-3 py-1.5 rounded-full glass text-white/20 hover:text-white/50 text-xs transition-all"
                >
                  Show Toolbar
                </button>
              </div>
            )}
          </div>

          {/* Speaker Notes Panel (bottom, collapsible) */}
          {showNotePanel && (
            <div className="h-36 border-t border-white/[0.06] bg-[#0f1117] shrink-0">
              <SpeakerNotePanel onClose={() => setShowNotePanel(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showSettings && <SettingsPanel />}
      {isMediaPanelOpen && (
        <MediaInsertPanel
          onClose={closeMediaPanel}
          insertAfterIndex={mediaPanelInsertIndex}
        />
      )}
    </div>
  );
}
