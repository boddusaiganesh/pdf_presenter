import { useState } from 'react';
import {
  CheckCircle, Circle, Shield, Monitor, Bell, Eye,
  ChevronRight, AlertTriangle, Play, X
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

interface CheckItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  howTo: string;
  required: boolean;
}

const CHECK_ITEMS: CheckItem[] = [
  {
    id: 'sidePanelClosed',
    title: 'Side Panel Closed',
    description: 'The slide panel is hidden so it won\'t appear in your screen share.',
    icon: <Monitor className="w-5 h-5" />,
    howTo: 'Click the side panel icon in the toolbar or press Ctrl+P to close it.',
    required: true,
  },
  {
    id: 'toolbarAutoHide',
    title: 'Toolbar Set to Auto-hide',
    description: 'The floating toolbar fades away so students only see your slides.',
    icon: <Eye className="w-5 h-5" />,
    howTo: 'Go to Settings → Appearance and set Toolbar Auto-hide Delay to any value.',
    required: true,
  },
  {
    id: 'notificationsSilenced',
    title: 'Notifications Silenced',
    description: 'OS notification banners are disabled so they don\'t pop up during your session.',
    icon: <Bell className="w-5 h-5" />,
    howTo: 'Mac: System Preferences → Notifications → Focus Mode. Windows: Settings → System → Focus Assist.',
    required: false,
  },
  {
    id: 'overlayTested',
    title: 'Audio Share Configured',
    description: 'If using video slides with audio, confirm your meeting app is set to share audio.',
    icon: <Shield className="w-5 h-5" />,
    howTo: 'Google Meet: Share screen → Also share audio checkbox. Zoom: Share Screen → Share computer audio.',
    required: false,
  },
];

export default function PreflightCheck() {
  const {
    preflightChecks, setPreflightCheck,
    setCurrentScreen, setIsPresenting, isSidePanelOpen, setIsSidePanelOpen,
    settings, currentSession
  } = useStore();

  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const allRequired = CHECK_ITEMS.filter((c) => c.required).every((c) => preflightChecks[c.id as keyof typeof preflightChecks]);

  const handleStartPresenting = () => {
    if (isSidePanelOpen) setIsSidePanelOpen(false);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setIsPresenting(true);
    setCurrentScreen('presenting');
    toast.success('Presenting! Share your screen in Meet/Zoom/Teams now.', { duration: 4000 });
  };

  const completedCount = CHECK_ITEMS.filter((c) => preflightChecks[c.id as keyof typeof preflightChecks]).length;

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-white text-2xl font-bold mb-2">Safe to Share</h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm mx-auto">
            Before you share your screen, confirm these items. Unlike a second monitor, once you share — everyone sees everything.
          </p>

          {/* Progress */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(completedCount / CHECK_ITEMS.length) * 100}%` }}
              />
            </div>
            <span className="text-white/40 text-xs whitespace-nowrap">{completedCount}/{CHECK_ITEMS.length}</span>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2 mb-6">
          {CHECK_ITEMS.map((item) => {
            const isChecked = preflightChecks[item.id as keyof typeof preflightChecks];
            const isExpanded = expandedItem === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-xl border transition-all overflow-hidden',
                  isChecked
                    ? 'bg-emerald-500/[0.06] border-emerald-500/30'
                    : 'bg-white/[0.03] border-white/[0.08]'
                )}
              >
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreflightCheck(item.id, !isChecked);
                    }}
                    className={cn(
                      'shrink-0 mt-0.5 transition-all',
                      isChecked ? 'text-emerald-400' : 'text-white/20 hover:text-white/40'
                    )}
                  >
                    {isChecked
                      ? <CheckCircle className="w-5 h-5" />
                      : <Circle className="w-5 h-5" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('font-medium text-sm', isChecked ? 'text-white' : 'text-white/70')}>
                        {item.title}
                      </p>
                      {!item.required && (
                        <span className="text-white/30 text-xs px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                  <div className={cn('shrink-0 transition-transform', isExpanded ? 'rotate-90' : '')}>
                    <ChevronRight className="w-4 h-4 text-white/30" />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-white/50 text-xs font-medium mb-0.5">How to do it:</p>
                        <p className="text-white/40 text-xs leading-relaxed">{item.howTo}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPreflightCheck(item.id, true)}
                      className="mt-2 w-full py-2 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-white/[0.06] transition-all"
                    >
                      Mark as done
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Session Info */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div>
            <p className="text-white/80 text-sm font-medium">{currentSession?.name}</p>
            <p className="text-white/40 text-xs">
              {currentSession?.slides.filter((s) => !s.hidden).length} slides · Ready to present
            </p>
          </div>
          <div className={cn(
            'w-3 h-3 rounded-full',
            allRequired ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400 shadow-sm shadow-amber-400/50 animate-pulse'
          )} />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setCurrentScreen('editor')}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/[0.1] text-white/60 hover:text-white hover:border-white/20 text-sm transition-all"
          >
            <X className="w-4 h-4" />
            Back to Editor
          </button>
          <button
            onClick={handleStartPresenting}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
              allRequired
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.01]'
                : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.01]'
            )}
          >
            <Play className="w-4 h-4" />
            {allRequired ? 'Start Presenting' : 'Start Anyway'}
          </button>
        </div>

        {!allRequired && (
          <p className="text-center text-amber-400/60 text-xs mt-3">
            ⚠️ Complete required items above for the safest screen share experience
          </p>
        )}
      </div>
    </div>
  );
}
