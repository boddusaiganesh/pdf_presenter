import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Save, Play, Home, Plus, Film, Download,
  Settings, BookOpen, ChevronRight, ChevronDown, Keyboard,
  FileText, Zap, AlertTriangle, Clock, Maximize
} from 'lucide-react';
import { useStore } from '../store/useStore';
import SidePanel from './SidePanel';
import SlideCanvas from './SlideCanvas';
import FloatingToolbar from './FloatingToolbar';
import SettingsPanel from './SettingsPanel';
import MediaInsertPanel from './MediaInsertPanel';
import SpeakerNotePanel from './SpeakerNotePanel';
import PointerOverlay from './PointerOverlay';
import { exportSessionFile } from '../utils/exportUtils';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

export default function EditorView() {
  const {
    currentSession, setCurrentScreen, saveCurrentSession,
    showSettings, setShowSettings, settings, updateSettings,
    currentSlideIndex, setCurrentSlideIndex,
    isToolbarVisible, setIsToolbarVisible,
    isSidePanelOpen, setIsSidePanelOpen,
    pointerMode, setPointerMode, setPointerPosition,
    currentTool, setCurrentTool,
    isBlackScreen, setIsBlackScreen,
    isFrozen, setIsFrozen,
    isOverviewMode, setIsOverviewMode,
    zoomLevel, setZoomLevel,
    timer, startTimer, pauseTimer, resetTimer,
    lastAutoSave, setLastAutoSave,
    clearSlideAnnotation, clearAllAnnotations,
    setPreflightCheck,
    isMediaPanelOpen, openMediaPanel, closeMediaPanel, mediaPanelInsertIndex
  } = useStore();

  const [showNotePanel, setShowNotePanel] = useState(false);
  // Use useRef instead of useState to avoid re-renders on every timer set/clear
  const toolbarHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMouseNearToolbar = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const headerHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMouseNearHeader = useRef(false);

  const slides = currentSession?.slides || [];

  // Auto-save (timer tick is now in App.tsx — no duplicate interval here)
  useEffect(() => {
    if (settings.autoSaveInterval <= 0) return;
    const interval = setInterval(() => {
      saveCurrentSession();
      setLastAutoSave(Date.now());
    }, settings.autoSaveInterval * 1000);
    return () => clearInterval(interval);
  }, [settings.autoSaveInterval, saveCurrentSession]);

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
          clearAllAnnotations();
        } else if (ctrl) {
          e.preventDefault();
          const slide = slides[currentSlideIndex];
          if (slide) clearSlideAnnotation(slide.id);
        }
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
      case 't':
      case 'T':
        if (ctrl) {
          e.preventDefault();
          if (timer.running) pauseTimer(); else startTimer();
        } else {
          setCurrentTool('text');
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
      case 'Escape':
        setIsOverviewMode(false);
        setIsBlackScreen(false);
        setPointerMode('normal');
        setCurrentTool('select');
        break;
    }
  }, [
    currentSlideIndex, slides, isBlackScreen, isFrozen,
    pointerMode, isOverviewMode, zoomLevel,
    setCurrentSlideIndex, setIsBlackScreen, setIsFrozen,
    setPointerMode, setCurrentTool, setIsOverviewMode,
    setZoomLevel, saveCurrentSession,
    clearSlideAnnotation, clearAllAnnotations
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      setIsHeaderVisible(!isFull);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen?.();
    }
  };

  // Track mouse position for pointer overlay
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setPointerPosition({ x: e.clientX, y: e.clientY });

    if (document.fullscreenElement) {
      const isOverSidePanel = isSidePanelOpen && e.clientX < 224;
      if (e.clientY < 60 && !isOverSidePanel) {
        setIsHeaderVisible(true);
        if (headerHideTimer.current) clearTimeout(headerHideTimer.current);
        headerHideTimer.current = setTimeout(() => {
          if (!isMouseNearHeader.current) setIsHeaderVisible(false);
        }, settings.toolbarAutoHideDelay || 3000);
      }
    }
  }, [setPointerPosition, settings.toolbarAutoHideDelay, isSidePanelOpen]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  // Toolbar auto-hide — using ref to avoid re-renders
  const handleMouseNearBottom = useCallback((e: React.MouseEvent) => {
    const threshold = 120;
    const distFromBottom = window.innerHeight - e.clientY;
    if (distFromBottom < threshold) {
      setIsToolbarVisible(true);
      if (toolbarHideTimerRef.current) clearTimeout(toolbarHideTimerRef.current);
      toolbarHideTimerRef.current = setTimeout(() => {
        if (!isMouseNearToolbar.current) setIsToolbarVisible(false);
      }, settings.toolbarAutoHideDelay);
    }
  }, [settings.toolbarAutoHideDelay, setIsToolbarVisible]);

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
    <div className="h-screen bg-[#0f1117] flex flex-col overflow-hidden relative">
      {/* Top Header Bar */}
      <header
        className={cn(
          'border-b border-white/[0.06] flex items-center px-4 gap-3 shrink-0 z-50 transition-all duration-300',
          isFullscreen ? 'absolute top-0 left-0 right-0 bg-[#0f1117]' : 'relative',
          isFullscreen
            ? (isHeaderVisible ? 'translate-y-0 opacity-100 h-12' : '-translate-y-full opacity-0 h-12')
            : 'translate-y-0 opacity-100 h-12'
        )}
        onMouseEnter={() => { isMouseNearHeader.current = true; setIsHeaderVisible(true); }}
        onMouseLeave={() => {
          isMouseNearHeader.current = false;
          if (isFullscreen) {
            if (headerHideTimer.current) clearTimeout(headerHideTimer.current);
            headerHideTimer.current = setTimeout(() => setIsHeaderVisible(false), settings.toolbarAutoHideDelay || 3000);
          }
        }}
      >
        {/* Logo */}
        <button onClick={() => setCurrentScreen('home')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="./icon.png" alt="ApexPresenter Logo" className="w-7 h-7 rounded-lg shadow-sm" />
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
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          {lastAutoSave > 0 && (
            <span className="text-white/20 text-xs flex items-center gap-1 mr-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
              Saved
            </span>
          )}

          {/* Resolution Selector */}
          <div className="relative group mr-2">
            <select
              value={String(settings.renderingQuality)}
              onChange={(e) => updateSettings({ renderingQuality: Number(e.target.value) as 1 | 2 | 4 })}
              className="appearance-none bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 hover:text-white text-xs px-2.5 py-1.5 rounded-lg pr-7 outline-none cursor-pointer transition-colors"
              title="Change Resolution"
            >
              <option value="1" className="bg-slate-800">1x Res (Fast)</option>
              <option value="2" className="bg-slate-800">2x Res (Sharp)</option>
              <option value="4" className="bg-slate-800">4x Res (Ultra)</option>
            </select>
            <ChevronDown className="w-3 h-3 text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-white/70" />
          </div>

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


          <div className="w-px h-5 bg-white/[0.08] mx-1" />

          <button
            onClick={toggleFullScreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/70 hover:text-white text-xs font-semibold transition-all"
            title="Toggle Full Screen"
          >
            <Maximize className="w-3.5 h-3.5" />
            Full Screen
          </button>

          <button
            onClick={() => {
              if (settings.autoCloseSidePanel) setIsSidePanelOpen(false);
              setPreflightCheck('toolbarAutoHide', true);
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              }
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
        <SidePanel />

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
                toolbarHideTimerRef.current = setTimeout(
                  () => setIsToolbarVisible(false),
                  settings.toolbarAutoHideDelay
                );
              }}
            >
              <FloatingToolbar onToggleNotes={() => setShowNotePanel(!showNotePanel)} />
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

          {/* Speaker Notes Panel */}
          {showNotePanel && (
            <div className="h-36 border-t border-white/[0.06] bg-[#0f1117] shrink-0">
              <SpeakerNotePanel onClose={() => setShowNotePanel(false)} />
            </div>
          )}

          <PointerOverlay />
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
