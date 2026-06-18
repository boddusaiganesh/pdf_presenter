import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useStore } from './store/useStore';
import HomeScreen from './components/HomeScreen';
import EditorView from './components/EditorView';
import PreflightCheck from './components/PreflightCheck';
import PresentingView from './components/PresentingView';
import PostSession from './components/PostSession';

export default function App() {
  const { currentScreen, settings } = useStore();

  // Apply theme + listen for OS theme changes
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const theme =
        settings.theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : settings.theme;
      root.classList.toggle('dark', theme === 'dark');
      root.style.setProperty('--accent', settings.accentColor);
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [settings.theme, settings.accentColor]);

  // Global timer tick — single source of truth, prevents double-tick bug
  // when both EditorView and PresentingView were each running their own interval
  useEffect(() => {
    const interval = setInterval(() => {
      const { timer, tickTimer } = useStore.getState();
      if (timer.running) tickTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Prevent native browser pinch-to-zoom globally
  useEffect(() => {
    const preventNativeZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    document.addEventListener('wheel', preventNativeZoom, { passive: false });
    return () => {
      document.removeEventListener('wheel', preventNativeZoom);
    };
  }, []);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen />;
      case 'editor':
        return <EditorView />;
      case 'preflight':
        return <PreflightCheck />;
      case 'presenting':
        return <PresentingView />;
      case 'post-session':
        return <PostSession />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      {renderScreen()}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e2130',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            fontSize: '13px',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#1e2130',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#1e2130',
            },
          },
        }}
      />
    </div>
  );
}
