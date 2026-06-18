import { useState, useRef } from 'react';
import {
  X, Link, Film, Image, Upload,
  AlertCircle, CheckCircle, Loader
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { detectMediaType, isStreamingService } from '../utils/mediaDetector';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

interface MediaInsertPanelProps {
  onClose: () => void;
  insertAfterIndex?: number;
}

type InsertTab = 'url' | 'upload' | 'blank';

export default function MediaInsertPanel({ onClose, insertAfterIndex }: MediaInsertPanelProps) {
  const { addSlide, currentSlideIndex, settings, audioReminderShown, setAudioReminderShown } = useStore();
  const [activeTab, setActiveTab] = useState<InsertTab>('url');
  const [url, setUrl] = useState('');
  const [detected, setDetected] = useState<ReturnType<typeof detectMediaType> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const afterIndex = insertAfterIndex ?? currentSlideIndex;

  const handleURLChange = (value: string) => {
    setUrl(value);
    if (value.trim()) {
      setDetected(detectMediaType(value.trim()));
    } else {
      setDetected(null);
    }
  };

  const showAudioReminder = () => {
    if (!audioReminderShown && settings.audioRoutingReminder) {
      setAudioReminderShown(true);
      return true;
    }
    return false;
  };

  const handleInsertURL = () => {
    if (!detected || !url.trim()) return;
    addSlide({ type: detected.type as any, mediaUrl: url.trim(), mediaType: detected.type as any }, afterIndex);
    const needsReminder = showAudioReminder();
    if (needsReminder) {
      toast((t) => (
        <div className="flex items-start gap-3 max-w-xs">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Audio Routing Reminder</p>
            <p className="text-xs text-gray-600 mt-0.5">
              To share audio from this video, enable "Share audio" in your meeting app.
            </p>
            <button onClick={() => toast.dismiss(t.id)} className="text-indigo-600 text-xs mt-1 font-medium">Got it</button>
          </div>
        </div>
      ), { duration: 10000 });
    }
    toast.success(`Added ${detected.type} slide`);
    onClose();
  };

  // Fix: use FileReader.readAsDataURL instead of createObjectURL
  // Blob URLs die on page reload; base64 data URLs persist in the session
  const handleUploadVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      toast('Large video file — may affect performance', { icon: '⚠️' });
    }

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataURL = ev.target?.result as string;
      addSlide({ type: 'video', mediaUrl: dataURL, mediaType: 'video' }, afterIndex);
      const needsReminder = showAudioReminder();
      if (needsReminder) {
        toast.success('Video slide added. Remember to share audio in your meeting app!', { duration: 6000 });
      } else {
        toast.success('Video slide added');
      }
      setIsLoading(false);
      onClose();
    };
    reader.onerror = () => {
      toast.error('Failed to read video file');
      setIsLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataURL = ev.target?.result as string;
      addSlide({ type: 'image', mediaUrl: dataURL, mediaType: 'image' }, afterIndex);
      toast.success('Image slide added');
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const platformIcon = (type: string) => {
    const icons: Record<string, string> = {
      youtube: '🎥', vimeo: '🎬', loom: '📹', googledrive: '💾',
      dropbox: '📦', onedrive: '☁️', 'direct-mp4': '🎞️', image: '🖼️', iframe: '🌐',
    };
    return icons[type] || '🔗';
  };

  const platformLabel = (type: string) => {
    const labels: Record<string, string> = {
      youtube: 'YouTube Video', vimeo: 'Vimeo Video', loom: 'Loom Recording',
      googledrive: 'Google Drive File', dropbox: 'Dropbox Link', onedrive: 'OneDrive File',
      'direct-mp4': 'Direct Video (MP4)', image: 'Image', iframe: 'Web Page / iFrame',
    };
    return labels[type] || type;
  };

  const EXAMPLE_URLS = [
    { label: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', icon: '🎥' },
    { label: 'Vimeo', url: 'https://vimeo.com/76979871', icon: '🎬' },
    { label: 'Loom', url: 'https://www.loom.com/share/abc123', icon: '📹' },
    { label: 'Google Drive', url: 'https://drive.google.com/file/d/abc/view', icon: '💾' },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#13151f] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-bold text-base">Insert Media Slide</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-white/[0.06]">
          {[
            { id: 'url' as const, label: 'Paste URL', icon: <Link className="w-3.5 h-3.5" /> },
            { id: 'upload' as const, label: 'Upload File', icon: <Upload className="w-3.5 h-3.5" /> },
            { id: 'blank' as const, label: 'Blank Slide', icon: <Film className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-sm transition-all border-b-2',
                activeTab === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-white/50 hover:text-white/80'
              )}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === 'url' && (
            <div>
              <div className="mb-4">
                <label className="text-white/60 text-xs font-medium uppercase tracking-wider block mb-2">Paste any video or media URL</label>
                <div className="relative">
                  <input
                    type="url" value={url}
                    onChange={(e) => handleURLChange(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-4 py-3 pr-10 bg-white/[0.05] border border-white/[0.1] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all"
                    autoFocus
                  />
                  {url && (
                    <button onClick={() => { setUrl(''); setDetected(null); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {detected && (
                  <div className="mt-3 flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <span className="text-xl">{platformIcon(detected.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm font-medium">{platformLabel(detected.type)} detected</p>
                      <p className="text-white/40 text-xs mt-0.5 truncate">{detected.embedUrl}</p>
                      {isStreamingService(detected.type) && (
                        <div className="mt-2 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-amber-400/80 text-xs">Streaming video gets re-encoded twice. Consider downloading locally for better quality.</p>
                        </div>
                      )}
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                  </div>
                )}
              </div>
              {!url && (
                <div>
                  <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-2">Supported platforms</p>
                  <div className="grid grid-cols-2 gap-2">
                    {EXAMPLE_URLS.map((ex) => (
                      <button key={ex.label} onClick={() => handleURLChange(ex.url)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all text-left">
                        <span>{ex.icon}</span>
                        <span className="text-white/60 text-xs">{ex.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {['Dropbox', 'OneDrive', 'Direct MP4', 'Vimeo', 'Any Webpage', 'Image URL'].map((p) => (
                      <div key={p} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60" />
                        <span className="text-white/40 text-xs">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.1] text-white/60 hover:text-white hover:border-white/20 text-sm transition-all">Cancel</button>
                <button
                  onClick={handleInsertURL}
                  disabled={!detected || !url.trim()}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all',
                    detected && url.trim()
                      ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                      : 'bg-white/[0.05] text-white/30 cursor-not-allowed'
                  )}
                >
                  Insert Slide
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-indigo-500/50 hover:bg-white/[0.02] cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/15 transition-colors">
                  <Film className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-white/80 font-medium text-sm">Upload Local Video</p>
                  <p className="text-white/40 text-xs mt-0.5">MP4, MOV, WebM, AVI · Best quality for remote presenting</p>
                  <div className="mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    <span className="text-green-400/80 text-xs">Single compression pass (better for students)</span>
                  </div>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleUploadVideo} />

              <div
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-indigo-500/50 hover:bg-white/[0.02] cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/15 transition-colors">
                  <Image className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-white/80 font-medium text-sm">Upload Image</p>
                  <p className="text-white/40 text-xs mt-0.5">JPG, PNG, GIF, WebP, SVG — becomes a full slide</p>
                </div>
              </div>
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />

              {isLoading && (
                <div className="flex items-center gap-2 text-white/50 text-sm mt-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  Processing file...
                </div>
              )}
            </div>
          )}

          {activeTab === 'blank' && (
            <div className="space-y-3">
              <p className="text-white/50 text-sm mb-4">Insert a blank slide for drawing or writing from scratch.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { addSlide({ type: 'blank-white' }, afterIndex); toast.success('Blank white slide added'); onClose(); }}
                  className="aspect-video rounded-xl bg-white flex items-center justify-center hover:scale-[1.02] transition-transform border-2 border-white/20 shadow-lg"
                >
                  <span className="text-gray-300 text-sm font-medium">White Slide</span>
                </button>
                <button
                  onClick={() => { addSlide({ type: 'blank-black' }, afterIndex); toast.success('Blank black slide added'); onClose(); }}
                  className="aspect-video rounded-xl bg-[#0a0b0e] flex items-center justify-center hover:scale-[1.02] transition-transform border-2 border-white/[0.08] shadow-lg"
                >
                  <span className="text-gray-600 text-sm font-medium">Black Slide</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
