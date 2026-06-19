import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PointerMode = 'normal' | 'laser' | 'spotlight' | 'squarelight' | 'magnifier' | 'crosshair';
export type DrawTool = 'select' | 'pen' | 'highlighter' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'triangle' | 'text' | 'sticky' | 'eraser' | 'lasso';
export type SlideTransition = 'fade' | 'none';
export type AppTheme = 'dark' | 'light' | 'system';
export type AppScreen = 'home' | 'editor' | 'preflight' | 'presenting' | 'post-session';
export type MediaType = 'image' | 'video' | 'youtube' | 'vimeo' | 'loom' | 'googledrive' | 'iframe' | 'blank-white' | 'blank-black';

export interface SlideAnnotation {
  id: string;
  fabricJSON: string;
  visible: boolean;
  locked: boolean;
}

export interface SpeakerNote {
  id: string;
  content: string; // rich text HTML
}

export interface SlideSection {
  id: string;
  name: string;
  color: string;
  afterSlideIndex: number;
}

export interface PopupSlide {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  targetSlideId?: string; // If mirroring another slide
  mediaType?: MediaType;
  mediaUrl?: string;
  annotation?: SlideAnnotation;
}

export interface Slide {
  id: string;
  type: 'pdf' | MediaType;
  pdfPageIndex?: number; // 0-based
  mediaUrl?: string;
  mediaType?: MediaType;
  annotation: SlideAnnotation;
  note: SpeakerNote;
  hidden: boolean;
  duration?: number; // seconds spent on slide
  popups?: PopupSlide[];
}

export interface Session {
  id: string;
  name: string;
  pdfPath?: string;
  pdfName?: string;
  pdfData?: string; // base64 - for browser storage
  slides: Slide[];
  sections: SlideSection[];
  totalPages: number;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string; // base64 data URL of first slide
  annotationsEnabled: boolean;
}

export interface DrawStylePreset {
  id: string;
  name: string;
  color: string;
  size: number;
  opacity: number;
  tool: DrawTool;
}

export interface TimerState {
  mode: 'countdown' | 'countup';
  running: boolean;
  elapsed: number; // seconds
  target: number; // seconds for countdown
  startedAt?: number;
  slideTimings: Record<string, number>; // slideId -> seconds
  currentSlideStart?: number;
}

export interface AppSettings {
  theme: AppTheme;
  accentColor: string;
  thumbnailSize: 'small' | 'medium' | 'large';
  toolbarPosition: 'bottom' | 'top';
  toolbarAutoHideDelay: number; // ms
  autoSaveInterval: number; // seconds, 0 = off
  defaultAnnotationColor: string;
  defaultPointerMode: PointerMode;
  autoCloseSidePanel: boolean;
  renderingQuality: 1 | 2 | 4;
  preloadSlides: number;
  hardwareAcceleration: boolean;
  confirmBeforeDelete: boolean;
  slideTransition: SlideTransition;
  compressionContrastBoost: boolean;
  contrastBoostStrength: number; // 0-100
  minBrushSizeFloor: boolean;
  minBrushSizeThreshold: number; // px
  highContrastPresets: boolean;
  audioRoutingReminder: boolean;
  autoAdvanceSeconds: number; // 0 = off
  laserColor: string;
  laserSize: number;
  laserGlow: number;
  laserTrail: boolean;
  laserTrailLength: 'short' | 'medium' | 'long';
  spotlightShape: 'circle' | 'oval' | 'rectangle';
  spotlightSize: number;
  spotlightDimLevel: number; // 30-90
  spotlightDimColor: string;
  spotlightSoftEdge: boolean;
  keyboardShortcuts: Record<string, string>;
}

// ─── Default Settings ─────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accentColor: '#6366f1',
  thumbnailSize: 'medium',
  toolbarPosition: 'bottom',
  toolbarAutoHideDelay: 3000,
  autoSaveInterval: 30,
  defaultAnnotationColor: '#ef4444',
  defaultPointerMode: 'laser',
  autoCloseSidePanel: true,
  renderingQuality: 2,
  preloadSlides: 5,
  hardwareAcceleration: true,
  confirmBeforeDelete: true,
  slideTransition: 'fade',
  compressionContrastBoost: false,
  contrastBoostStrength: 20,
  minBrushSizeFloor: true,
  minBrushSizeThreshold: 3,
  highContrastPresets: false,
  audioRoutingReminder: true,
  autoAdvanceSeconds: 0,
  laserColor: '#ff3232',
  laserSize: 12,
  laserGlow: 70,
  laserTrail: true,
  laserTrailLength: 'medium',
  spotlightShape: 'circle',
  spotlightSize: 200,
  spotlightDimLevel: 70,
  spotlightDimColor: '#000000',
  spotlightSoftEdge: true,
  keyboardShortcuts: {
    nextSlide: 'ArrowRight',
    prevSlide: 'ArrowLeft',
    firstSlide: 'Home',
    lastSlide: 'End',
    blackScreen: 'b',
    freezeCanvas: 'z',
    laserPointer: 'l',
    spotlight: 's',
    penTool: 'p',
    highlighter: 'h',
    eraser: 'e',
    textTool: 't',
    undo: 'ctrl+z',
    redo: 'ctrl+y',
    clearSlide: 'ctrl+d',
    clearAll: 'ctrl+shift+d',
    save: 'ctrl+s',
    toggleSidePanel: 'ctrl+p',
    startTimer: 'ctrl+t',
    slideOverview: 'g',
  },
};

export const HIGH_CONTRAST_COLORS = [
  '#ff3232', // Red
  '#00cc44', // Green
  '#3399ff', // Blue
  '#ffcc00', // Yellow
  '#ff6600', // Orange
  '#cc00cc', // Magenta
  '#ffffff', // White
  '#000000', // Black
];

export const STANDARD_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#ffffff', '#94a3b8', '#475569', '#000000',
];

// ─── Store Interface ──────────────────────────────────────────────────────────

interface AppStore {
  // ── Screen ──
  currentScreen: AppScreen;
  setCurrentScreen: (screen: AppScreen) => void;

  // ── Sessions ──
  sessions: Session[];
  currentSession: Session | null;
  createSession: (pdfName?: string, totalPages?: number) => Session;
  loadSession: (sessionId: string) => void;
  updateSession: (updates: Partial<Session>) => void;
  deleteSession: (sessionId: string) => void;
  saveCurrentSession: () => void;
  importSession: (session: Session) => void;

  // ── Slides ──
  currentSlideIndex: number;
  setCurrentSlideIndex: (index: number) => void;
  addSlide: (slide: Partial<Slide>, afterIndex?: number) => void;
  removeSlide: (index: number) => void;
  reorderSlide: (fromIndex: number, toIndex: number) => void;
  toggleHideSlide: (index: number) => void;
  duplicateSlide: (index: number) => void;
  updateSlide: (index: number, updates: Partial<Slide>) => void;
  updateAnnotation: (slideId: string, fabricJSON: string, popupId?: string) => void;
  updateNote: (slideId: string, content: string) => void;
  clearSlideAnnotation: (slideId: string) => void;
  clearAllAnnotations: () => void;

  // ── Popups ──
  addPopupSlide: (slideId: string, popup: Partial<PopupSlide>) => void;
  updatePopupSlide: (slideId: string, popupId: string, updates: Partial<PopupSlide>) => void;
  removePopupSlide: (slideId: string, popupId: string) => void;

  // ── Sections ──
  sections: SlideSection[];
  addSection: (name: string, afterIndex: number, color?: string) => void;
  removeSection: (id: string) => void;
  updateSection: (id: string, updates: Partial<SlideSection>) => void;

  // ── Presentation State ──
  isPresenting: boolean;
  isBlackScreen: boolean;
  isFrozen: boolean;
  isSidePanelOpen: boolean;
  isOverviewMode: boolean;
  isToolbarVisible: boolean;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  setIsPresenting: (v: boolean) => void;
  setIsBlackScreen: (v: boolean) => void;
  setIsFrozen: (v: boolean) => void;
  setIsSidePanelOpen: (v: boolean) => void;
  setIsOverviewMode: (v: boolean) => void;
  setIsToolbarVisible: (v: boolean) => void;
  setZoomLevel: (v: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;

  // ── Media Panel ──
  isMediaPanelOpen: boolean;
  mediaPanelInsertIndex?: number;
  openMediaPanel: (insertAfterIndex?: number) => void;
  closeMediaPanel: () => void;

  // ── Drawing ──
  currentTool: DrawTool;
  drawColor: string;
  drawSize: number;
  drawOpacity: number;
  isDashedStroke: boolean;
  isFilled: boolean;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  stylePresets: DrawStylePreset[];
  setCurrentTool: (tool: DrawTool) => void;
  setDrawColor: (color: string) => void;
  setDrawSize: (size: number) => void;
  setDrawOpacity: (opacity: number) => void;
  setIsDashedStroke: (v: boolean) => void;
  setIsFilled: (v: boolean) => void;
  setFontFamily: (f: string) => void;
  setFontSize: (s: number) => void;
  setIsBold: (v: boolean) => void;
  setIsItalic: (v: boolean) => void;
  addStylePreset: (preset: Omit<DrawStylePreset, 'id'>) => void;
  removeStylePreset: (id: string) => void;
  applyStylePreset: (preset: DrawStylePreset) => void;

  // ── Pointer ──
  pointerMode: PointerMode;
  pointerPosition: { x: number; y: number };
  setPointerMode: (mode: PointerMode) => void;
  setPointerPosition: (pos: { x: number; y: number }) => void;

  // ── Timer ──
  timer: TimerState;
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  setTimerMode: (mode: 'countdown' | 'countup') => void;
  setTimerTarget: (seconds: number) => void;
  pauseTimer: () => void;
  tickTimer: () => void;
  recordSlideTime: (slideId: string) => void;

  // ── Settings ──
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // ── PDF Rendering ──
  renderedPages: Record<number, string>; // pageIndex -> dataURL
  renderingPages: number[];
  addRenderedPage: (pageIndex: number, dataURL: string) => void;
  removeRenderedPage: (pageIndex: number) => void;
  addRenderingPage: (pageIndex: number) => void;
  removeRenderingPage: (pageIndex: number) => void;
  clearRenderedPages: () => void;

  // ── Misc ──
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  audioReminderShown: boolean;
  setAudioReminderShown: (v: boolean) => void;
  lastAutoSave: number;
  setLastAutoSave: (t: number) => void;
  preflightChecks: {
    sidePanelClosed: boolean;
    toolbarAutoHide: boolean;
    notificationsSilenced: boolean;
    overlayTested: boolean;
  };
  setPreflightCheck: (key: string, value: boolean) => void;
  postSessionStats: {
    slideTimings: Record<string, number>;
    totalDuration: number;
    annotationsCount: number;
  } | null;
  setPostSessionStats: (stats: AppStore['postSessionStats']) => void;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

const createDefaultSlide = (overrides: Partial<Slide> = {}): Slide => ({
  id: uuidv4(),
  type: 'pdf',
  annotation: { id: uuidv4(), fabricJSON: '', visible: true, locked: false },
  note: { id: uuidv4(), content: '' },
  hidden: false,
  ...overrides,
});

const createDefaultSession = (overrides: Partial<Session> = {}): Session => ({
  id: uuidv4(),
  name: 'Untitled Presentation',
  slides: [],
  sections: [],
  totalPages: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  annotationsEnabled: true,
  ...overrides,
});

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Screen ──
      currentScreen: 'home',
      setCurrentScreen: (screen) => set({ currentScreen: screen }),

      // ── Sessions ──
      sessions: [],
      currentSession: null,

      createSession: (pdfName, totalPages = 0) => {
        const slides: Slide[] = Array.from({ length: totalPages }, (_, i) =>
          createDefaultSlide({ type: 'pdf', pdfPageIndex: i })
        );
        const session = createDefaultSession({
          pdfName,
          pdfPath: pdfName,
          name: pdfName?.replace(/\.pdf$/i, '') || 'Untitled Presentation',
          slides,
          totalPages,
        });
        set((s) => ({ sessions: [session, ...s.sessions], currentSession: session }));
        return session;
      },

      loadSession: (sessionId) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (session) set({ currentSession: session, currentSlideIndex: 0 });
      },

      updateSession: (updates) => {
        set((s) => {
          if (!s.currentSession) return {};
          const updated = { ...s.currentSession, ...updates, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      deleteSession: (sessionId) => {
        // Clean up IDB PDF data asynchronously
        del(`pdf_data_${sessionId}`).catch(() => {});
        set((s) => ({
          sessions: s.sessions.filter((sess) => sess.id !== sessionId),
          currentSession: s.currentSession?.id === sessionId ? null : s.currentSession,
          // Clear rendered pages if we're deleting the active session
          renderedPages: s.currentSession?.id === sessionId ? {} : s.renderedPages,
          renderingPages: s.currentSession?.id === sessionId ? [] : s.renderingPages,
        }));
      },

      saveCurrentSession: () => {
        const { currentSession, sessions } = get();
        if (!currentSession) return;
        const updated = { ...currentSession, updatedAt: new Date().toISOString() };
        set({
          currentSession: updated,
          sessions: sessions.map((s) => (s.id === updated.id ? updated : s)),
          lastAutoSave: Date.now(),
        });
      },

      importSession: (session) => {
        set((s) => ({
          sessions: [session, ...s.sessions.filter((x) => x.id !== session.id)],
          currentSession: session,
        }));
      },

      // ── Slides ──
      currentSlideIndex: 0,
      setCurrentSlideIndex: (index) => {
        const state = get();
        const { currentSession, timer, recordSlideTime } = state;
        if (!currentSession) return;
        const slides = currentSession.slides;
        if (slides.length === 0) return;
        const clampedIndex = Math.max(0, Math.min(index, slides.length - 1));

        // Skip hidden slides — find next visible in the direction of travel
        const direction = index >= state.currentSlideIndex ? 1 : -1;
        let finalIndex = clampedIndex;
        if (slides[clampedIndex]?.hidden) {
          let search = clampedIndex + direction;
          while (search >= 0 && search < slides.length) {
            if (!slides[search].hidden) { finalIndex = search; break; }
            search += direction;
          }
          // If no visible slide found in that direction, stay put
          if (slides[finalIndex]?.hidden) return;
        }

        // Don't trigger a state update if the index hasn't changed
        if (finalIndex === state.currentSlideIndex) return;

        const currentSlide = slides[state.currentSlideIndex];
        if (currentSlide && timer.running) recordSlideTime(currentSlide.id);
        set({ currentSlideIndex: finalIndex });
      },

      addSlide: (slide, afterIndex) => {
        const newSlide = createDefaultSlide(slide);
        set((s) => {
          if (!s.currentSession) return {};
          const slides = [...s.currentSession.slides];
          const insertAt = afterIndex !== undefined ? afterIndex + 1 : slides.length;
          slides.splice(insertAt, 0, newSlide);
          const updated = { ...s.currentSession, slides, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      removeSlide: (index) => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = s.currentSession.slides.filter((_, i) => i !== index);
          const updated = { ...s.currentSession, slides, updatedAt: new Date().toISOString() };
          const newIndex = Math.min(s.currentSlideIndex, Math.max(0, slides.filter(sl => !sl.hidden).length - 1));
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
            currentSlideIndex: newIndex,
          };
        });
      },

      reorderSlide: (fromIndex, toIndex) => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = [...s.currentSession.slides];
          const [moved] = slides.splice(fromIndex, 1);
          slides.splice(toIndex, 0, moved);
          const updated = { ...s.currentSession, slides, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      toggleHideSlide: (index) => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = s.currentSession.slides.map((slide, i) =>
            i === index ? { ...slide, hidden: !slide.hidden } : slide
          );
          const updated = { ...s.currentSession, slides, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      duplicateSlide: (index) => {
        set((s) => {
          if (!s.currentSession) return {};
          const original = s.currentSession.slides[index];
          const duplicate = createDefaultSlide({ ...original, id: uuidv4() });
          const slides = [...s.currentSession.slides];
          slides.splice(index + 1, 0, duplicate);
          const updated = { ...s.currentSession, slides, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      updateSlide: (index, updates) => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = s.currentSession.slides.map((slide, i) =>
            i === index ? { ...slide, ...updates } : slide
          );
          const updated = { ...s.currentSession, slides, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      updateAnnotation: (slideId, fabricJSON, popupId) => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = s.currentSession.slides.map((slide) => {
            if (slide.id !== slideId) return slide;
            if (popupId) {
              const popups = slide.popups?.map(p =>
                p.id === popupId
                  ? { ...p, annotation: { id: p.id, visible: true, locked: false, ...(p.annotation || {}), fabricJSON } }
                  : p
              );
              return { ...slide, popups };
            }
            return { ...slide, annotation: { ...slide.annotation, fabricJSON } };
          });
          // Only update currentSession during active drawing — sessions array is
          // synced on saveCurrentSession() to avoid O(n) map on every stroke.
          return { currentSession: { ...s.currentSession, slides } };
        });
      },

      updateNote: (slideId, content) => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = s.currentSession.slides.map((slide) =>
            slide.id === slideId
              ? { ...slide, note: { ...slide.note, content } }
              : slide
          );
          const updated = { ...s.currentSession, slides };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      clearSlideAnnotation: (slideId) => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = s.currentSession.slides.map((slide) =>
            slide.id === slideId
              ? { 
                  ...slide, 
                  annotation: { ...slide.annotation, fabricJSON: '' },
                  popups: slide.popups?.map(p => ({ 
                    ...p, 
                    annotation: p.annotation ? { ...p.annotation, fabricJSON: '' } : undefined 
                  }))
                }
              : slide
          );
          const updated = { ...s.currentSession, slides };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      clearAllAnnotations: () => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = s.currentSession.slides.map((slide) => ({
            ...slide,
            annotation: { ...slide.annotation, fabricJSON: '' },
            popups: slide.popups?.map(p => ({ 
              ...p, 
              annotation: p.annotation ? { ...p.annotation, fabricJSON: '' } : undefined 
            }))
          }));
          const updated = { ...s.currentSession, slides };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      // ── Popups ──
      addPopupSlide: (slideId, popup) => {
        set((s) => {
          if (!s.currentSession) return {};
          const newPopup: PopupSlide = {
            id: uuidv4(),
            x: 100,
            y: 100,
            width: 400,
            height: 300,
            isMinimized: false,
            ...popup
          };
          const slides = s.currentSession.slides.map((slide) =>
            slide.id === slideId
              ? { ...slide, popups: [...(slide.popups || []), newPopup] }
              : slide
          );
          const updated = { ...s.currentSession, slides, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      updatePopupSlide: (slideId, popupId, updates) => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = s.currentSession.slides.map((slide) =>
            slide.id === slideId && slide.popups
              ? {
                  ...slide,
                  popups: slide.popups.map((p) => (p.id === popupId ? { ...p, ...updates } : p)),
                }
              : slide
          );
          const updated = { ...s.currentSession, slides, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      removePopupSlide: (slideId, popupId) => {
        set((s) => {
          if (!s.currentSession) return {};
          const slides = s.currentSession.slides.map((slide) =>
            slide.id === slideId && slide.popups
              ? {
                  ...slide,
                  popups: slide.popups.filter((p) => p.id !== popupId),
                }
              : slide
          );
          const updated = { ...s.currentSession, slides, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      // ── Sections ──
      sections: [],
      addSection: (name, afterIndex, color = '#6366f1') => {
        set((s) => {
          if (!s.currentSession) return {};
          const section: SlideSection = { id: uuidv4(), name, color, afterSlideIndex: afterIndex };
          const sections = [...s.currentSession.sections, section];
          const updated = { ...s.currentSession, sections };
          return {
            currentSession: updated,
            sections,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },
      removeSection: (id) => {
        set((s) => {
          if (!s.currentSession) return {};
          const sections = s.currentSession.sections.filter((sec) => sec.id !== id);
          const updated = { ...s.currentSession, sections };
          return {
            currentSession: updated,
            sections,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },
      updateSection: (id, updates) => {
        set((s) => {
          if (!s.currentSession) return {};
          const sections = s.currentSession.sections.map((sec) =>
            sec.id === id ? { ...sec, ...updates } : sec
          );
          const updated = { ...s.currentSession, sections };
          return {
            currentSession: updated,
            sections,
            sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          };
        });
      },

      // ── Presentation State ──
      isPresenting: false,
      isBlackScreen: false,
      isFrozen: false,
      isSidePanelOpen: false,
      isOverviewMode: false,
      isToolbarVisible: true,
      zoomLevel: 1,
      panOffset: { x: 0, y: 0 },
      setIsPresenting: (v) => set({ isPresenting: v }),
      setIsBlackScreen: (v) => set({ isBlackScreen: v }),
      setIsFrozen: (v) => set({ isFrozen: v }),
      setIsSidePanelOpen: (v) => set({ isSidePanelOpen: v }),
      setIsOverviewMode: (v) => set({ isOverviewMode: v }),
      setIsToolbarVisible: (v) => set({ isToolbarVisible: v }),
      setZoomLevel: (v) => set({ zoomLevel: Math.max(0.5, Math.min(4, v)) }),
      setPanOffset: (offset) => set({ panOffset: offset }),

      // ── Media Panel ──
      isMediaPanelOpen: false,
      mediaPanelInsertIndex: undefined,
      openMediaPanel: (index) => set({ isMediaPanelOpen: true, mediaPanelInsertIndex: index }),
      closeMediaPanel: () => set({ isMediaPanelOpen: false, mediaPanelInsertIndex: undefined }),

      // ── Drawing ──
      currentTool: 'select',
      drawColor: '#ef4444',
      drawSize: 4,
      drawOpacity: 1,
      isDashedStroke: false,
      isFilled: false,
      fontFamily: 'Inter',
      fontSize: 24,
      isBold: false,
      isItalic: false,
      stylePresets: [
        { id: uuidv4(), name: 'Red Pen', color: '#ef4444', size: 4, opacity: 1, tool: 'pen' },
        { id: uuidv4(), name: 'Yellow Highlight', color: '#fbbf24', size: 20, opacity: 0.5, tool: 'highlighter' },
        { id: uuidv4(), name: 'Blue Arrow', color: '#3b82f6', size: 3, opacity: 1, tool: 'arrow' },
        { id: uuidv4(), name: 'Green Text', color: '#22c55e', size: 4, opacity: 1, tool: 'text' },
      ],
      setCurrentTool: (tool) => set({ currentTool: tool }),
      setDrawColor: (color) => set({ drawColor: color }),
      setDrawSize: (size) => set({ drawSize: size }),
      setDrawOpacity: (opacity) => set({ drawOpacity: opacity }),
      setIsDashedStroke: (v) => set({ isDashedStroke: v }),
      setIsFilled: (v) => set({ isFilled: v }),
      setFontFamily: (f) => set({ fontFamily: f }),
      setFontSize: (s) => set({ fontSize: s }),
      setIsBold: (v) => set({ isBold: v }),
      setIsItalic: (v) => set({ isItalic: v }),
      addStylePreset: (preset) =>
        set((s) => ({ stylePresets: [...s.stylePresets, { ...preset, id: uuidv4() }] })),
      removeStylePreset: (id) =>
        set((s) => ({ stylePresets: s.stylePresets.filter((p) => p.id !== id) })),
      applyStylePreset: (preset) =>
        set({
          currentTool: preset.tool,
          drawColor: preset.color,
          drawSize: preset.size,
          drawOpacity: preset.opacity,
        }),

      // ── Pointer ──
      pointerMode: 'normal',
      pointerPosition: { x: 0, y: 0 },
      setPointerMode: (mode) => set({ pointerMode: mode }),
      // Throttle pointer position updates to one per animation frame (~60fps).
      // Raw mousemove fires at 200+ Hz on some devices; writing to Zustand on
      // every event causes unnecessary re-renders across all subscribers.
      setPointerPosition: (() => {
        let rafPending = false;
        let latestPos = { x: 0, y: 0 };
        return (pos: { x: number; y: number }) => {
          latestPos = pos;
          if (rafPending) return;
          rafPending = true;
          requestAnimationFrame(() => {
            set({ pointerPosition: latestPos });
            rafPending = false;
          });
        };
      })(),

      // ── Timer ──
      timer: {
        mode: 'countup',
        running: false,
        elapsed: 0,
        target: 60 * 60, // 1 hour default
        slideTimings: {},
      },
      startTimer: () =>
        set((s) => ({
          timer: {
            ...s.timer,
            running: true,
            startedAt: Date.now() - s.timer.elapsed * 1000,
          },
        })),
      stopTimer: () =>
        set((s) => ({
          timer: { ...s.timer, running: false },
        })),
      pauseTimer: () =>
        set((s) => ({
          timer: { ...s.timer, running: false },
        })),
      resetTimer: () =>
        set((s) => ({
          timer: { ...s.timer, running: false, elapsed: 0, startedAt: undefined, slideTimings: {} },
        })),
      setTimerMode: (mode) => set((s) => ({ timer: { ...s.timer, mode } })),
      setTimerTarget: (seconds) => set((s) => ({ timer: { ...s.timer, target: seconds } })),
      tickTimer: () =>
        set((s) => {
          if (!s.timer.running) return {};
          return { timer: { ...s.timer, elapsed: s.timer.elapsed + 1 } };
        }),
      recordSlideTime: (slideId) => {
        const { timer } = get();
        if (!timer.currentSlideStart) return;
        const spent = (Date.now() - timer.currentSlideStart) / 1000;
        set((s) => ({
          timer: {
            ...s.timer,
            slideTimings: {
              ...s.timer.slideTimings,
              [slideId]: (s.timer.slideTimings[slideId] || 0) + spent,
            },
            currentSlideStart: Date.now(),
          },
        }));
      },

      // ── Settings ──
      settings: DEFAULT_SETTINGS,
      updateSettings: (updates) =>
        set((s) => {
          const newState: any = { settings: { ...s.settings, ...updates } };
          if (updates.renderingQuality && updates.renderingQuality !== s.settings.renderingQuality) {
            newState.renderedPages = {};
          }
          return newState;
        }),

      // ── PDF Rendering ──
      renderedPages: {},
      renderingPages: [],
      addRenderedPage: (pageIndex, dataURL) =>
        set((s) => ({ renderedPages: { ...s.renderedPages, [pageIndex]: dataURL } })),
      removeRenderedPage: (pageIndex) =>
        set((s) => {
          const next = { ...s.renderedPages };
          delete next[pageIndex];
          return { renderedPages: next };
        }),
      addRenderingPage: (pageIndex) =>
        set((s) => ({
          renderingPages: s.renderingPages.includes(pageIndex)
            ? s.renderingPages
            : [...s.renderingPages, pageIndex],
        })),
      removeRenderingPage: (pageIndex) =>
        set((s) => ({ renderingPages: s.renderingPages.filter((p) => p !== pageIndex) })),
      clearRenderedPages: () => set({ renderedPages: {}, renderingPages: [] }),

      // ── Misc ──
      showSettings: false,
      setShowSettings: (v) => set({ showSettings: v }),
      audioReminderShown: false,
      setAudioReminderShown: (v) => set({ audioReminderShown: v }),
      lastAutoSave: 0,
      setLastAutoSave: (t) => set({ lastAutoSave: t }),
      preflightChecks: {
        sidePanelClosed: false,
        toolbarAutoHide: false,
        notificationsSilenced: false,
        overlayTested: false,
      },
      setPreflightCheck: (key, value) =>
        set((s) => ({ preflightChecks: { ...s.preflightChecks, [key]: value } })),
      postSessionStats: null,
      setPostSessionStats: (stats) => set({ postSessionStats: stats }),
    }),
    {
      name: 'pdf-presenter-pro-v1',
      storage: createJSONStorage(() => ({
        getItem: async (name: string): Promise<string | null> => {
          return (await get(name)) || null;
        },
        setItem: async (name: string, value: string): Promise<void> => {
          await set(name, value);
        },
        removeItem: async (name: string): Promise<void> => {
          await del(name);
        },
      })),
      partialize: (state) => ({
        sessions: state.sessions,
        settings: state.settings,
        stylePresets: state.stylePresets,
        audioReminderShown: state.audioReminderShown,
      }),
    }
  )
);
