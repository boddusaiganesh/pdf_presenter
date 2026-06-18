import { useState, useRef } from 'react';
import {
  X, Monitor, Palette, Keyboard, Zap, Sliders, Info,
  Eye, Shield, RotateCcw
} from 'lucide-react';
import { useStore, DEFAULT_SETTINGS, STANDARD_COLORS } from '../store/useStore';
import { cn } from '../utils/cn';
import toast from 'react-hot-toast';

type SettingsTab = 'appearance' | 'behavior' | 'performance' | 'remote' | 'shortcuts' | 'about';

const TAB_ITEMS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
  { id: 'behavior', label: 'Behavior', icon: <Sliders className="w-4 h-4" /> },
  { id: 'performance', label: 'Performance', icon: <Zap className="w-4 h-4" /> },
  { id: 'remote', label: 'Remote Presenting', icon: <Monitor className="w-4 h-4" /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="w-4 h-4" /> },
  { id: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
];

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.05] last:border-0">
      <div>
        <p className="text-white/80 text-sm font-medium">{label}</p>
        {description && <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn('relative shrink-0 w-11 h-6 rounded-full transition-all duration-200', checked ? 'bg-indigo-500' : 'bg-white/[0.1]')}
      >
        <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  description?: string;
}

function SliderRow({ label, value, min, max, step = 1, unit = '', onChange, description }: SliderRowProps) {
  return (
    <div className="py-3 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-white/80 text-sm font-medium">{label}</p>
          {description && <p className="text-white/40 text-xs mt-0.5">{description}</p>}
        </div>
        <span className="text-indigo-400 text-sm font-mono">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500" />
    </div>
  );
}

interface SelectRowProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  description?: string;
}

function SelectRow({ label, value, options, onChange, description }: SelectRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.05] last:border-0">
      <div>
        <p className="text-white/80 text-sm font-medium">{label}</p>
        {description && <p className="text-white/40 text-xs mt-0.5">{description}</p>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/[0.06] border border-white/[0.1] rounded-lg text-white text-sm px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer min-w-[120px]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function SettingsPanel() {
  const { settings, updateSettings, setShowSettings } = useStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  // Two-step reset confirm — no window.confirm
  const [confirmReset, setConfirmReset] = useState(false);
  const confirmResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      confirmResetTimerRef.current = setTimeout(() => setConfirmReset(false), 3000);
    } else {
      if (confirmResetTimerRef.current) clearTimeout(confirmResetTimerRef.current);
      updateSettings(DEFAULT_SETTINGS);
      toast.success('Settings reset to defaults');
      setConfirmReset(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'appearance':
        return (
          <div className="space-y-0">
            <SelectRow label="App Theme" value={settings.theme}
              options={[
                { label: 'Dark (Recommended)', value: 'dark' },
                { label: 'Light', value: 'light' },
                { label: 'System', value: 'system' },
              ]}
              onChange={(v) => updateSettings({ theme: v as any })}
            />
            <SelectRow label="Slide Transition" value={settings.slideTransition}
              options={[
                { label: 'Fade', value: 'fade' },
                { label: 'None', value: 'none' },
              ]}
              onChange={(v) => updateSettings({ slideTransition: v as any })}
            />
            <SelectRow label="Thumbnail Size" value={settings.thumbnailSize}
              options={[
                { label: 'Small', value: 'small' },
                { label: 'Medium', value: 'medium' },
                { label: 'Large', value: 'large' },
              ]}
              onChange={(v) => updateSettings({ thumbnailSize: v as any })}
            />
            <SelectRow label="Toolbar Position" value={settings.toolbarPosition}
              options={[
                { label: 'Bottom', value: 'bottom' },
                { label: 'Top', value: 'top' },
              ]}
              onChange={(v) => updateSettings({ toolbarPosition: v as any })}
            />
            <SliderRow label="Toolbar Auto-hide Delay"
              value={settings.toolbarAutoHideDelay / 1000}
              min={1} max={10} unit="s"
              onChange={(v) => updateSettings({ toolbarAutoHideDelay: v * 1000 })}
              description="Seconds before toolbar fades out"
            />
            <div className="py-3 border-b border-white/[0.05]">
              <p className="text-white/80 text-sm font-medium mb-3">Accent Color</p>
              <div className="flex flex-wrap gap-2">
                {['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#22c55e','#06b6d4','#3b82f6'].map((c) => (
                  <button key={c} onClick={() => updateSettings({ accentColor: c })}
                    className={cn('w-8 h-8 rounded-lg transition-all', settings.accentColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1d2e] scale-110' : 'hover:scale-110')}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="py-3">
              <p className="text-white/80 text-sm font-medium mb-1">Default Annotation Color</p>
              <p className="text-white/40 text-xs mb-3">Starting color when pen tool is activated</p>
              <div className="flex flex-wrap gap-2">
                {STANDARD_COLORS.map((c) => (
                  <button key={c} onClick={() => updateSettings({ defaultAnnotationColor: c })}
                    className={cn('w-7 h-7 rounded-full border-2 transition-all', settings.defaultAnnotationColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-110')}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
        );

      case 'behavior':
        return (
          <div>
            <Toggle checked={settings.confirmBeforeDelete} onChange={(v) => updateSettings({ confirmBeforeDelete: v })}
              label="Confirm Before Deleting Slides" description="Show a confirmation dialog before deleting" />
            <Toggle checked={settings.autoCloseSidePanel} onChange={(v) => updateSettings({ autoCloseSidePanel: v })}
              label="Auto-close Side Panel on Present" description="Automatically closes the panel when entering present mode" />
            <Toggle checked={settings.audioRoutingReminder} onChange={(v) => updateSettings({ audioRoutingReminder: v })}
              label="Audio Routing Reminder" description="Show a reminder about sharing audio when inserting media slides" />
            <SliderRow label="Auto-save Interval" value={settings.autoSaveInterval}
              min={0} max={120} step={10} unit="s"
              onChange={(v) => updateSettings({ autoSaveInterval: v })} description="0 = disabled" />
            <SliderRow label="Auto-advance Slides" value={settings.autoAdvanceSeconds}
              min={0} max={300} step={5} unit="s"
              onChange={(v) => updateSettings({ autoAdvanceSeconds: v })} description="0 = manual navigation only" />
            <SliderRow label="Preload Slides Ahead" value={settings.preloadSlides}
              min={1} max={20}
              onChange={(v) => updateSettings({ preloadSlides: v })} description="How many slides to pre-render in advance" />
          </div>
        );

      case 'performance':
        return (
          <div>
            <SelectRow label="Rendering Quality" value={String(settings.renderingQuality)}
              options={[
                { label: 'Standard (1x) — Fast', value: '1' },
                { label: 'High (2x) — Recommended', value: '2' },
                { label: 'Ultra (4x) — Slowest', value: '4' },
              ]}
              onChange={(v) => updateSettings({ renderingQuality: Number(v) as 1 | 2 | 4 })}
              description="Higher quality = sharper slides but slower initial load"
            />
            <Toggle checked={settings.hardwareAcceleration} onChange={(v) => updateSettings({ hardwareAcceleration: v })}
              label="Hardware Acceleration" description="Use GPU for rendering (recommended)" />
            <div className="py-3 mt-2">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 text-sm font-medium">Performance Tip</p>
                    <p className="text-white/50 text-xs mt-1 leading-relaxed">
                      For very large PDFs (100+ pages), use Standard (1x) quality to ensure smooth navigation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'remote':
        return (
          <div>
            <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-4 mb-4">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-white/60 text-xs leading-relaxed">
                  These settings compensate for how Google Meet, Zoom, and Teams re-encode your shared screen.
                </p>
              </div>
            </div>
            <Toggle checked={settings.compressionContrastBoost} onChange={(v) => updateSettings({ compressionContrastBoost: v })}
              label="Compression-Aware Contrast Boost"
              description="Increases contrast to compensate for video-call compression" />
            {settings.compressionContrastBoost && (
              <SliderRow label="Contrast Boost Strength" value={settings.contrastBoostStrength}
                min={5} max={50} unit="%" onChange={(v) => updateSettings({ contrastBoostStrength: v })} />
            )}
            <Toggle checked={settings.minBrushSizeFloor} onChange={(v) => updateSettings({ minBrushSizeFloor: v })}
              label="Minimum Brush Size Floor"
              description="Warns if brush is set too thin to survive video compression" />
            {settings.minBrushSizeFloor && (
              <SliderRow label="Minimum Threshold" value={settings.minBrushSizeThreshold}
                min={1} max={8} unit="px" onChange={(v) => updateSettings({ minBrushSizeThreshold: v })} />
            )}
            <Toggle checked={settings.highContrastPresets} onChange={(v) => updateSettings({ highContrastPresets: v })}
              label="High-Contrast Color Presets"
              description="Pre-tested colors that stay legible after Meet/Zoom compression" />
            <Toggle checked={settings.audioRoutingReminder} onChange={(v) => updateSettings({ audioRoutingReminder: v })}
              label="Audio Routing Reminder"
              description="Shows a reminder to enable 'Share Audio' when inserting video slides" />
            <div className="py-4 mt-2">
              <p className="text-white/80 text-sm font-medium mb-3">Laser Pointer Configuration</p>
              <SliderRow label="Laser Size" value={settings.laserSize} min={6} max={32} unit="px"
                onChange={(v) => updateSettings({ laserSize: v })} />
              <SliderRow label="Glow Intensity" value={settings.laserGlow} min={0} max={100} unit="%"
                onChange={(v) => updateSettings({ laserGlow: v })} />
              <Toggle checked={settings.laserTrail} onChange={(v) => updateSettings({ laserTrail: v })}
                label="Pointer Trail Effect" description="Shows a fading trail behind the laser pointer" />
              {settings.laserTrail && (
                <SelectRow label="Trail Length" value={settings.laserTrailLength}
                  options={[
                    { label: 'Short', value: 'short' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Long', value: 'long' },
                  ]}
                  onChange={(v) => updateSettings({ laserTrailLength: v as any })} />
              )}
            </div>
            <div className="py-4">
              <p className="text-white/80 text-sm font-medium mb-3">Spotlight Configuration</p>
              <SelectRow label="Spotlight Shape" value={settings.spotlightShape}
                options={[
                  { label: 'Circle', value: 'circle' },
                  { label: 'Oval', value: 'oval' },
                  { label: 'Rectangle', value: 'rectangle' },
                ]}
                onChange={(v) => updateSettings({ spotlightShape: v as any })} />
              <SliderRow label="Spotlight Size" value={settings.spotlightSize} min={80} max={400} unit="px"
                onChange={(v) => updateSettings({ spotlightSize: v })} />
              <SliderRow label="Dim Level" value={settings.spotlightDimLevel} min={30} max={95} unit="%"
                onChange={(v) => updateSettings({ spotlightDimLevel: v })}
                description="How dark the non-spotlighted area gets" />
              <Toggle checked={settings.spotlightSoftEdge} onChange={(v) => updateSettings({ spotlightSoftEdge: v })}
                label="Soft Edge" description="Smooth gradient edge on spotlight (vs hard cutoff)" />
            </div>
          </div>
        );

      case 'shortcuts':
        return (
          <div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] overflow-hidden mb-4">
              {Object.entries(settings.keyboardShortcuts).map(([action, shortcut], i) => (
                <div key={action} className={cn('flex items-center justify-between px-4 py-3', i > 0 ? 'border-t border-white/[0.05]' : '')}>
                  <span className="text-white/60 text-sm capitalize">{action.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <kbd className="px-2 py-0.5 text-xs font-mono bg-white/[0.08] border border-white/[0.1] rounded text-white/70">{shortcut}</kbd>
                </div>
              ))}
            </div>
            <p className="text-white/30 text-xs">Shortcut customization coming in a future update.</p>
          </div>
        );

      case 'about':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
                <Monitor className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-white text-xl font-bold">PDF Presenter Pro</h3>
                <p className="text-white/50 text-sm">Remote Edition — Version 1.0.0</p>
              </div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4 space-y-3">
              {[
                ['Built for', 'Remote educators presenting via Google Meet, Zoom, Teams'],
                ['PDF Engine', 'PDF.js with hardware-accelerated rendering'],
                ['Annotation Engine', 'Fabric.js canvas with per-slide memory'],
                ['Framework', 'React 19 + TypeScript + Tailwind CSS'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start gap-3">
                  <span className="text-white/40 text-xs w-24 shrink-0">{k}</span>
                  <span className="text-white/70 text-xs">{v}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
              <div className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-white/60 text-xs leading-relaxed">
                  Every feature was designed with one question in mind:
                  <em className="text-white/80"> "What does a remote student see when I share my entire screen?"</em>
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
      <div className="relative w-full max-w-3xl bg-[#13151f] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-bold text-lg">Settings</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all',
                confirmReset
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.05]'
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {confirmReset ? 'Confirm Reset?' : 'Reset to Defaults'}
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden min-h-0">
          <nav className="w-48 border-r border-white/[0.06] p-2 shrink-0 overflow-y-auto">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all mb-0.5',
                  activeTab === tab.id
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
