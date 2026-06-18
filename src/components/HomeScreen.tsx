import React, { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload, FileText, Clock, Trash2, Play, Settings,
  Plus, FolderOpen, AlertCircle, BookOpen, Zap,
  Monitor, ChevronRight, Star, Download
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { loadPDF, renderPage } from '../utils/pdfRenderer';
import { importSessionFile } from '../utils/exportUtils';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export default function HomeScreen() {
  const {
    sessions, createSession, loadSession, deleteSession,
    setCurrentScreen, importSession, settings, setShowSettings,
    clearRenderedPages, addRenderedPage, updateSession
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingFileName, setLoadingFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionInputRef = useRef<HTMLInputElement>(null);

  const handlePDFLoad = useCallback(async (file: File) => {
    setIsLoading(true);
    setLoadingFileName(file.name);
    setLoadingProgress(0);
    clearRenderedPages();

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Use native browser FileReader for base64 encoding (prevents Javascript out-of-memory crash)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const totalPages = await loadPDF(arrayBuffer);
      setLoadingProgress(10);

      const session = createSession(file.name, totalPages);
      
      // Store raw PDF data separately from the Zustand store to prevent state tree bloat and memory leaks
      const { set: idbSet } = await import('idb-keyval');
      await idbSet(`pdf_data_${session.id}`, base64);

      // Render first 5 pages immediately
      const preloadCount = Math.min(5, totalPages);
      for (let i = 0; i < preloadCount; i++) {
        try {
          const dataURL = await renderPage(i, settings.renderingQuality, settings.compressionContrastBoost, settings.contrastBoostStrength);
          addRenderedPage(i, dataURL);
          if (i === 0) {
            updateSession({ thumbnail: dataURL });
          }
          setLoadingProgress(10 + (i + 1) * (80 / preloadCount));
        } catch (e) {
          console.error('Error rendering page', i, e);
        }
      }

      setLoadingProgress(100);
      setCurrentScreen('editor');
      toast.success(`Loaded "${file.name}" — ${totalPages} slides ready`);
    } catch (error) {
      console.error('PDF load error:', error);
      toast.error('Failed to load PDF. Please try a different file.');
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  }, [createSession, setCurrentScreen, settings, clearRenderedPages, addRenderedPage]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) handlePDFLoad(file);
  }, [handlePDFLoad]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    noClick: true,
  });

  const handleSessionClick = async (sessionId: string) => {
    console.log(`[HomeScreen] Opening session ID: ${sessionId}`);
    const session = sessions.find(s => s.id === sessionId);
    
    if (session) {
      setIsLoading(true);
      setLoadingFileName(session.name);
      setLoadingProgress(50);
      clearRenderedPages();
      
      try {
        const { get: idbGet } = await import('idb-keyval');
        const base64 = await idbGet(`pdf_data_${session.id}`);
        
        if (base64 || session.pdfData) {
          const data = base64 || session.pdfData;
          // Use native fetch to convert base64 to arraybuffer without blocking the main thread
          const res = await fetch(`data:application/pdf;base64,${data}`);
          const arrayBuffer = await res.arrayBuffer();
          await loadPDF(arrayBuffer);
        }
      } catch (e) {
        console.error('Failed to parse saved PDF data:', e);
        toast.error('Failed to read PDF data from session.');
      }
      setIsLoading(false);
    }
    
    loadSession(sessionId);
    setCurrentScreen('editor');
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this session? This cannot be undone.')) {
      deleteSession(sessionId);
      toast.success('Session deleted');
    }
  };

  const handleImportSession = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const session = await importSessionFile(file);
      importSession(session);
      setCurrentScreen('editor');
      toast.success('Session imported successfully');
    } catch {
      toast.error('Invalid session file');
    }
  };

  const handleCreateBlankPresentation = () => {
    createSession('New Presentation', 0);
    setCurrentScreen('editor');
  };

  return (
    <div className="h-screen bg-[#0f1117] flex flex-col" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Header */}
      <header className="border-b border-white/[0.06] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="./icon.png" alt="ApexPresenter Logo" className="w-9 h-9 rounded-xl shadow-lg shadow-indigo-500/20" />
          <div>
            <h1 className="text-white font-bold text-lg leading-none">ApexPresenter</h1>
            <p className="text-white/40 text-xs mt-0.5">Remote Edition</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => sessionInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.06] transition-all text-sm"
          >
            <Download className="w-4 h-4" />
            Import Session
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className="w-72 border-r border-white/[0.06] flex flex-col p-6 gap-4 overflow-y-auto">
          {/* Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`group relative border-2 border-dashed rounded-2xl p-6 cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-white/[0.1] hover:border-indigo-500/60 hover:bg-white/[0.03]'
            }`}
          >
            <div className="text-center">
              <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center transition-all ${
                isDragActive ? 'bg-indigo-500/20' : 'bg-white/[0.05] group-hover:bg-indigo-500/10'
              }`}>
                <Upload className={`w-6 h-6 transition-colors ${isDragActive ? 'text-indigo-400' : 'text-white/40 group-hover:text-indigo-400'}`} />
              </div>
              <p className="text-white/70 font-medium text-sm">
                {isDragActive ? 'Drop PDF here' : 'Open PDF File'}
              </p>
              <p className="text-white/30 text-xs mt-1">
                {isDragActive ? 'Release to load' : 'Click or drag & drop'}
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePDFLoad(file);
              e.target.value = '';
            }}
          />

          <input
            ref={sessionInputRef}
            type="file"
            accept=".pdfpro"
            className="hidden"
            onChange={handleImportSession}
          />

          <button
            onClick={handleCreateBlankPresentation}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/[0.12] transition-all text-sm text-white/70 hover:text-white"
          >
            <Plus className="w-4 h-4" />
            New Blank Presentation
          </button>

          {/* Quick Tips */}
          <div className="mt-auto rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 p-4">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white/80 text-xs font-semibold mb-1">Remote Teaching Tips</p>
                <ul className="text-white/40 text-xs space-y-1">
                  <li>• Use "Share Entire Screen" in Meet/Zoom</li>
                  <li>• Enable laser pointer for remote pointing</li>
                  <li>• Spotlight dims focus areas clearly</li>
                  <li>• Annotations show instantly to students</li>
                </ul>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {isLoading && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="glass rounded-2xl p-8 w-80 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-indigo-400 animate-pulse" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-1">Loading PDF</h3>
                <p className="text-white/50 text-sm mb-4 truncate">{loadingFileName}</p>
                <div className="progress-bar mb-2">
                  <div className="progress-fill" style={{ width: `${loadingProgress}%` }} />
                </div>
                <p className="text-white/30 text-xs">{Math.round(loadingProgress)}%</p>
              </div>
            </div>
          )}

          {/* Welcome Banner */}
          {sessions.length === 0 && (
            <div className="mb-8 rounded-2xl bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-transparent border border-indigo-500/20 p-8">
              <div className="flex items-start gap-6">
                <img src="./icon.png" alt="ApexPresenter Logo" className="w-16 h-16 rounded-2xl shadow-lg shadow-indigo-500/30 shrink-0" />
                <div>
                  <h2 className="text-white text-2xl font-bold mb-2">Welcome to ApexPresenter</h2>
                  <p className="text-white/60 text-sm leading-relaxed max-w-2xl">
                    The world's most powerful PDF presentation tool for remote educators. Built for screen-sharing with Google Meet, Zoom, and Teams. 
                    Laser pointer, spotlight, live annotation, media slides — everything designed for what students actually see on their screens.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {['Laser Pointer', 'Spotlight Mode', 'Live Annotation', 'Media Slides', 'Per-slide Notes', 'Export Annotated PDF'].map((f) => (
                      <span key={f} className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-medium">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Sessions */}
          {sessions.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white text-xl font-bold">Recent Sessions</h2>
                <span className="text-white/30 text-sm">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSessionClick(session.id)}
                    className="group relative rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.15] hover:bg-white/[0.05] transition-all cursor-pointer overflow-hidden"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
                      {session.thumbnail ? (
                        <img src={session.thumbnail} alt={session.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="w-12 h-12 text-white/20" />
                          <span className="text-white/20 text-xs">{session.totalPages} slides</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center shadow-xl shadow-indigo-500/40">
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-white font-semibold text-sm leading-tight line-clamp-1">{session.name}</h3>
                        <button
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/0 group-hover:text-white/30 hover:!text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-white/30 text-xs">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {session.totalPages + (session.slides?.length - session.totalPages || 0)} slides
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(session.updatedAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>

                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all">
                      <ChevronRight className="w-4 h-4 text-white/40" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Feature Highlights */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              {
                icon: <Star className="w-5 h-5" />,
                title: 'Laser Pointer & Spotlight',
                desc: 'Red/green/blue laser with trail effects. Spotlight dims everything except your focus area.',
                color: 'from-red-500/20 to-orange-500/10 border-red-500/20',
                iconColor: 'text-red-400',
              },
              {
                icon: <FileText className="w-5 h-5" />,
                title: 'Live PDF Annotation',
                desc: 'Draw, highlight, add text and shapes directly on your slides. All saved per-slide.',
                color: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/20',
                iconColor: 'text-indigo-400',
              },
              {
                icon: <Monitor className="w-5 h-5" />,
                title: 'Screen-Share Optimized',
                desc: 'Auto-hiding toolbar, compression-aware contrast boost, remote-safe UI by design.',
                color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/20',
                iconColor: 'text-emerald-400',
              },
              {
                icon: <Play className="w-5 h-5" />,
                title: 'Media Slides',
                desc: 'YouTube, Vimeo, Loom, Google Drive, local video — paste any link as a slide.',
                color: 'from-violet-500/20 to-purple-500/10 border-violet-500/20',
                iconColor: 'text-violet-400',
              },
              {
                icon: <AlertCircle className="w-5 h-5" />,
                title: 'Pre-flight Checklist',
                desc: 'Safe-to-share checklist before every session ensures nothing leaks to students.',
                color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/20',
                iconColor: 'text-amber-400',
              },
              {
                icon: <FolderOpen className="w-5 h-5" />,
                title: 'Session Management',
                desc: 'Auto-save, session history, annotated PDF export, and post-class share packages.',
                color: 'from-cyan-500/20 to-sky-500/10 border-cyan-500/20',
                iconColor: 'text-cyan-400',
              },
            ].map((feature) => (
              <div key={feature.title} className={`rounded-xl bg-gradient-to-br ${feature.color} border p-5`}>
                <div className={`w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center mb-3 ${feature.iconColor}`}>
                  {feature.icon}
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{feature.title}</h3>
                <p className="text-white/50 text-xs leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
