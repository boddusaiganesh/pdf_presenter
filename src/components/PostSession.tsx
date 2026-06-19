import { useState, useEffect } from 'react';
import {
  Download, FileText, Image, Clock, BarChart2,
  MessageSquare, Share2, Home, ArrowRight, Check, Layers
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { exportAnnotatedPDF, exportAllSlidesAsZip, exportSpeakerNotes, exportPostSessionPackage } from '../utils/exportUtils';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// Collect PNG snapshots from all mounted AnnotationCanvas instances via custom events.
// Each canvas listens for 'annotation:snapshot' and responds with 'annotation:snapshot:result'.
async function collectFabricSnapshots(slideIds: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  for (const slideId of slideIds) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 120); // skip if canvas not mounted
      const handler = (e: Event) => {
        const { slideId: sid, png } = (e as CustomEvent).detail || {};
        if (sid === slideId && png) {
          results[slideId] = png;
          clearTimeout(timeout);
          document.removeEventListener('annotation:snapshot:result' as any, handler);
          resolve();
        }
      };
      document.addEventListener('annotation:snapshot:result' as any, handler);
      document.dispatchEvent(new CustomEvent('annotation:snapshot', { detail: { slideId } }));
    });
  }
  return results;
}

export default function PostSession() {
  const {
    currentSession, postSessionStats, setCurrentScreen,
    renderedPages, timer, setIsPresenting
  } = useStore();

  const [exported, setExported] = useState<Record<string, boolean>>({});

  // Fix: never call setState during render — use useEffect instead
  useEffect(() => {
    if (!currentSession) setCurrentScreen('home');
  }, [currentSession, setCurrentScreen]);

  if (!currentSession) return null;

  const stats = postSessionStats || {
    slideTimings: timer.slideTimings,
    totalDuration: timer.elapsed,
    annotationsCount: currentSession.slides.filter((s) => s.annotation.fabricJSON).length,
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const totalSlides = currentSession.slides.filter((s) => !s.hidden).length;

  const handleExport = async (action: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      setExported((prev) => ({ ...prev, [action]: true }));
      toast.success(`${action} exported successfully`);
    } catch (e) {
      toast.error(`Failed to export ${action}`);
    }
  };

  const exportActions = [
    {
      id: 'annotated-pdf',
      label: 'Annotated PDF',
      description: 'All slides with your drawings baked in',
      icon: <FileText className="w-5 h-5" />,
      color: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/30',
      iconColor: 'text-indigo-400',
      action: async () => {
        const slideIds = currentSession.slides.filter(s => !s.hidden).map(s => s.id);
        const fabricCanvases = await collectFabricSnapshots(slideIds);
        return exportAnnotatedPDF(currentSession, renderedPages, fabricCanvases, true);
      },
      recommended: true,
    },
    {
      id: 'clean-pdf',
      label: 'Clean PDF',
      description: 'Original slides without any annotations',
      icon: <FileText className="w-5 h-5" />,
      color: 'from-slate-500/20 to-slate-500/10 border-slate-500/30',
      iconColor: 'text-slate-400',
      action: () => exportAnnotatedPDF(currentSession, renderedPages, {}, false),
    },
    {
      id: 'all-images',
      label: 'All Slides as Images',
      description: 'ZIP file with every slide as PNG',
      icon: <Image className="w-5 h-5" />,
      color: 'from-violet-500/20 to-purple-500/10 border-violet-500/30',
      iconColor: 'text-violet-400',
      action: async () => {
        const slideIds = currentSession.slides.filter(s => !s.hidden).map(s => s.id);
        const fabricCanvases = await collectFabricSnapshots(slideIds);
        return exportAllSlidesAsZip(currentSession, renderedPages, fabricCanvases);
      },
    },
    {
      id: 'notes',
      label: 'Speaker Notes',
      description: 'All your notes as a plain text file',
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30',
      iconColor: 'text-amber-400',
      action: () => exportSpeakerNotes(currentSession),
    },
    {
      id: 'post-session',
      label: 'Post-Session Package',
      description: 'Annotated PDF + timing report — share with students',
      icon: <Share2 className="w-5 h-5" />,
      color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30',
      iconColor: 'text-emerald-400',
      action: () => exportPostSessionPackage(currentSession, stats.slideTimings),
      recommended: true,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">Session Complete</h1>
          <p className="text-white/40 text-sm mt-0.5">{currentSession.name} · {format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
        </div>
        <button
          onClick={() => { setIsPresenting(false); setCurrentScreen('home'); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 hover:text-white text-sm transition-all"
        >
          <Home className="w-4 h-4" />
          Return Home
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Duration', value: formatTime(stats.totalDuration), icon: <Clock className="w-5 h-5" />, color: 'text-indigo-400' },
            { label: 'Slides Presented', value: `${totalSlides}`, icon: <Layers className="w-5 h-5" />, color: 'text-violet-400' },
            { label: 'Annotated Slides', value: `${stats.annotationsCount}`, icon: <FileText className="w-5 h-5" />, color: 'text-amber-400' },
            { label: 'Avg. per Slide', value: totalSlides > 0 ? formatTime(stats.totalDuration / totalSlides) : '—', icon: <BarChart2 className="w-5 h-5" />, color: 'text-emerald-400' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5">
              <div className={cn('mb-2', stat.color)}>{stat.icon}</div>
              <p className="text-white text-2xl font-bold">{stat.value}</p>
              <p className="text-white/40 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Export Options */}
          <div>
            <h2 className="text-white font-bold text-lg mb-4">Export & Share</h2>
            <div className="space-y-2">
              {exportActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleExport(action.id, action.action)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r border text-left transition-all hover:scale-[1.01] active:scale-[0.99]',
                    action.color
                  )}
                >
                  <div className={cn('w-10 h-10 rounded-xl bg-white/[0.07] flex items-center justify-center shrink-0', action.iconColor)}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white/80 font-medium text-sm">{action.label}</p>
                      {action.recommended && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Recommended</span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">{action.description}</p>
                  </div>
                  {exported[action.id] ? (
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <Download className="w-5 h-5 text-white/30 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Slide Timing Breakdown */}
          <div>
            <h2 className="text-white font-bold text-lg mb-4">Time per Slide</h2>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-hidden max-h-96 overflow-y-auto">
              {currentSession.slides.filter((s) => !s.hidden).map((slide, i) => {
                const time = stats.slideTimings[slide.id] || 0;
                const pct = stats.totalDuration > 0 ? Math.min(100, (time / stats.totalDuration) * 100) : 0;
                return (
                  <div key={slide.id} className={cn('flex items-center gap-3 px-4 py-3', i > 0 ? 'border-t border-white/[0.05]' : '')}>
                    <span className="text-white/30 text-xs font-mono w-6">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/60 text-xs capitalize">
                          {slide.type === 'pdf' ? `Page ${(slide.pdfPageIndex ?? 0) + 1}` : slide.type}
                        </span>
                        <span className="text-white/50 text-xs font-mono">{formatTime(time)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {slide.annotation.fabricJSON && (
                      <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Has annotations" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Next Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setCurrentScreen('editor')}
            className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all text-left group"
          >
            <div>
              <p className="text-white/70 font-medium text-sm">Continue Editing</p>
              <p className="text-white/30 text-xs mt-0.5">Return to slide editor</p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
          </button>
          <button
            onClick={() => setCurrentScreen('preflight')}
            className="flex items-center justify-between p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/25 hover:bg-indigo-500/15 transition-all text-left group"
          >
            <div>
              <p className="text-indigo-300 font-medium text-sm">Present Again</p>
              <p className="text-indigo-400/50 text-xs mt-0.5">Run pre-flight check</p>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-400/30 group-hover:text-indigo-400 transition-colors" />
          </button>
          <button
            onClick={() => { setIsPresenting(false); setCurrentScreen('home'); }}
            className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all text-left group"
          >
            <div>
              <p className="text-white/70 font-medium text-sm">Return Home</p>
              <p className="text-white/30 text-xs mt-0.5">Open another presentation</p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
