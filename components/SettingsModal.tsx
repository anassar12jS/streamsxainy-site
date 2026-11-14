import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, CheckCircle, Palette, Settings, Download, Upload, 
  Trash2, Plus, Moon, Sun, Tv, Play, HardDrive, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { 
  setTheme, getTheme, setMode, getMode, exportData, importData, 
  getStreamProviders, saveStreamProviders, getDefaultServer, setDefaultServer,
  getAutoplayNext, setAutoplayNext, clearAllWatchData
} from '../services/storage';
import { StreamProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEME_OPTIONS = [
  { id: 'purple', name: 'Royal Purple', hex: '#9333ea', rgb: '147, 51, 234' },
  { id: 'red', name: 'Crimson Red', hex: '#dc2626', rgb: '220, 38, 38' },
  { id: 'blue', name: 'Electric Blue', hex: '#2563eb', rgb: '37, 99, 235' },
  { id: 'green', name: 'Emerald Green', hex: '#16a34a', rgb: '22, 163, 74' },
  { id: 'orange', name: 'Sunset Orange', hex: '#ea580c', rgb: '234, 88, 12' },
];

const SERVER_OPTIONS = [
  { id: 'ishowstream', name: 'iShowStream (Ultra Fast ⚡ · Default)' },
  { id: 'vidy', name: 'Vidy Prime (Fast Multi-Audio)' },
  { id: 'vidlypro', name: 'Vidly Pro (4K · Ultra)' },
  { id: 'vidlink', name: 'VidLink (Adaptive 4K)' },
  { id: 'vidsrc-wtf', name: 'VidSrc WTF' },
  { id: 'cinemaos', name: 'CinemaOS' },
  { id: 'vidfastpro', name: 'VidFast' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'streaming' | 'data' | 'providers'>('appearance');
  
  const [activeTheme, setActiveTheme] = useState('purple');
  const [customHex, setCustomHex] = useState('#a855f7');
  const [currentMode, setCurrentMode] = useState<'dark' | 'light'>('dark');
  const [defaultServer, setDefServerState] = useState('ishowstream');
  const [autoplayNext, setAutoplayState] = useState(true);
  
  const [providers, setProviders] = useState<StreamProvider[]>([]);
  const [newProviderName, setNewProviderName] = useState('');
  const [newProviderUrl, setNewProviderUrl] = useState('');
  
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTheme(getTheme());
      const stored = getTheme();
      setCustomHex(stored.startsWith('#') ? stored : '#a855f7');
      setCurrentMode(getMode());
      setDefServerState(getDefaultServer());
      setAutoplayState(getAutoplayNext());
      setProviders(getStreamProviders());
      setConfirmClear(false);
      setNotice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setTheme(activeTheme);
    setMode(currentMode);
    setDefaultServer(defaultServer);
    setAutoplayNext(autoplayNext);
    saveStreamProviders(providers);

    // Apply instantly — App listens for this event and re-reads stored prefs
    document.documentElement.setAttribute('data-theme', currentMode);
    window.dispatchEvent(new Event('streamhub:settings-changed'));

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  const handleAddProvider = () => {
    if (!newProviderName.trim() || !newProviderUrl.trim()) return;
    let cleanUrl = newProviderUrl.trim();
    if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
    cleanUrl = cleanUrl.replace('/manifest.json', '').replace(/\/$/, '');

    setProviders([...providers, { name: newProviderName.trim(), url: cleanUrl }]);
    setNewProviderName('');
    setNewProviderUrl('');
  };

  const handleRemoveProvider = (idx: number) => {
    const next = [...providers];
    next.splice(idx, 1);
    setProviders(next);
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `streamhub-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice({ message: 'Backup file generated and downloaded.', type: 'success' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const json = event.target?.result as string;
      if (importData(json)) {
        setNotice({ message: 'Data imported successfully! Reloading...', type: 'success' });
        setTimeout(() => window.location.reload(), 900);
      } else {
        setNotice({ message: 'Invalid backup file format.', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const handleClearHistory = () => {
    clearAllWatchData();
    setConfirmClear(false);
    setNotice({ message: 'Watch history, continue watching progress, and favorites cleared.', type: 'success' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-[var(--bg-card)] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[var(--bg-main)]/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[rgb(var(--primary-color))]/15 text-[rgb(var(--primary-color))]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[var(--text-main)]">Preferences & Settings</h2>
              <p className="text-xs text-[var(--text-muted)]">Configure styling, streaming mirrors, and local backups</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* In-Modal Notice Banner */}
        {notice && (
          <div className={`mx-6 mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-fade-in ${
            notice.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span>{notice.message}</span>
            <button onClick={() => setNotice(null)} className="p-1 hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-6 bg-[var(--bg-main)]/30 overflow-x-auto">
          {[
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'streaming', label: 'Playback', icon: Play },
            { id: 'data', label: 'Data & Backup', icon: HardDrive },
            { id: 'providers', label: 'Addons', icon: Tv },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3.5 px-4 text-xs font-bold border-b-2 transition-all shrink-0 ${
                  isActive
                    ? 'border-[rgb(var(--primary-color))] text-[rgb(var(--primary-color))]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* TAB 1: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              
              {/* Dark / Light Theme Toggle */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-3">
                  Color Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentMode('dark')}
                    className={`p-4 rounded-2xl border flex items-center gap-3 transition-all text-left ${
                      currentMode === 'dark'
                        ? 'border-[rgb(var(--primary-color))] bg-[rgb(var(--primary-color))]/10 ring-1 ring-[rgb(var(--primary-color))]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-black text-white shadow-inner">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-main)]">OLED Dark</p>
                      <p className="text-xs text-[var(--text-muted)]">Pure cinema blacks</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentMode('light')}
                    className={`p-4 rounded-2xl border flex items-center gap-3 transition-all text-left ${
                      currentMode === 'light'
                        ? 'border-[rgb(var(--primary-color))] bg-[rgb(var(--primary-color))]/10 ring-1 ring-[rgb(var(--primary-color))]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-white text-zinc-900 shadow-md">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-main)]">Crisp Light</p>
                      <p className="text-xs text-[var(--text-muted)]">Clean Apple contrast</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Accent Color Palette */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-3">
                  Accent Color
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {THEME_OPTIONS.map(theme => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setActiveTheme(theme.id)}
                      className={`p-3 rounded-2xl border flex items-center gap-3 transition-all text-left ${
                        activeTheme === theme.id
                          ? 'border-[rgb(var(--primary-color))] bg-[rgb(var(--primary-color))]/10 ring-1 ring-[rgb(var(--primary-color))]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-input)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <span 
                        className="w-5 h-5 rounded-full shrink-0 shadow-md"
                        style={{ backgroundColor: theme.hex }}
                      />
                      <span className="text-xs font-bold text-[var(--text-main)]">{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Accent Color */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-3">
                  Custom Accent Color
                </label>
                <div
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                    activeTheme.startsWith('#')
                      ? 'border-[rgb(var(--primary-color))] bg-[rgb(var(--primary-color))]/10 ring-1 ring-[rgb(var(--primary-color))]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-input)]'
                  }`}
                >
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => {
                      const hex = e.target.value;
                      setCustomHex(hex);
                      setActiveTheme(hex);
                    }}
                    className="w-9 h-9 rounded-xl cursor-pointer border border-white/10 bg-transparent p-0.5 shrink-0"
                  />
                  <input
                    type="text"
                    value={customHex}
                    onChange={(e) => {
                      let v = e.target.value.trim();
                      if (!v.startsWith('#')) v = '#' + v;
                      setCustomHex(v);
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) setActiveTheme(v);
                    }}
                    placeholder="#a855f7"
                    maxLength={7}
                    className="flex-1 bg-transparent text-xs font-mono font-bold text-[var(--text-main)] uppercase focus:outline-none"
                  />
                  <span
                    className="w-6 h-6 rounded-full border border-white/20 shrink-0 shadow-inner"
                    style={{ backgroundColor: activeTheme.startsWith('#') ? activeTheme : customHex }}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-2">
                  Pick any color — applied instantly across the whole site on save.
                </p>
              </div>

            </div>
          )}

          {/* TAB 2: STREAMING & PLAYBACK */}
          {activeTab === 'streaming' && (
            <div className="space-y-6">
              
              {/* Default Server */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1">
                  Default Streaming Server
                </label>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  Preferred player mirror loaded on initial launch.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SERVER_OPTIONS.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDefServerState(s.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all text-left ${
                        defaultServer === s.id
                          ? 'border-[rgb(var(--primary-color))] bg-[rgb(var(--primary-color))]/15 text-[rgb(var(--primary-color))]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      <span>{s.name}</span>
                      {defaultServer === s.id && <CheckCircle className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Autoplay Next Episode */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                <div>
                  <p className="text-sm font-bold text-[var(--text-main)]">Autoplay Next Episode</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Automatically advance to next episode when series ends
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoplayState(!autoplayNext)}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    autoplayNext ? 'bg-[rgb(var(--primary-color))]' : 'bg-zinc-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${autoplayNext ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

            </div>
          )}

          {/* TAB 3: DATA & STORAGE */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              
              {/* Backup & Export */}
              <div className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[var(--text-main)]">Export Watchlist & History</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Download a portable JSON backup file to import on other devices
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  className="px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-xs font-bold text-[var(--text-main)] flex items-center gap-2 shadow-sm shrink-0"
                >
                  <Download className="w-4 h-4 text-[rgb(var(--primary-color))]" />
                  <span>Download Backup</span>
                </button>
              </div>

              {/* Restore / Import */}
              <div className="p-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[var(--text-main)]">Restore from File</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Import previously saved StreamHub JSON backup
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-xs font-bold text-[var(--text-main)] flex items-center gap-2 shadow-sm shrink-0"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Import File</span>
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".json" 
                  className="hidden" 
                />
              </div>

              {/* Clear History */}
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-red-400">Clear Watch History & Progress</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Resets continue watching row and bookmarks on this device
                  </p>
                </div>
                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClearHistory}
                      className="px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md"
                    >
                      Confirm Reset
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      className="px-3 py-2 rounded-xl bg-[var(--bg-card)] text-xs text-[var(--text-muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-2 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Data</span>
                  </button>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: ADDON PROVIDERS */}
          {activeTab === 'providers' && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--text-muted)]">
                Connect external Torrentio / Stremio manifest URLs for torrent streams:
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Provider Name (e.g. Torrentio)"
                  value={newProviderName}
                  onChange={e => setNewProviderName(e.target.value)}
                  className="w-1/3 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)]"
                />
                <input
                  type="text"
                  placeholder="Manifest URL (https://...)"
                  value={newProviderUrl}
                  onChange={e => setNewProviderUrl(e.target.value)}
                  className="flex-1 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)]"
                />
                <button
                  type="button"
                  onClick={handleAddProvider}
                  className="px-4 py-2 rounded-xl bg-[rgb(var(--primary-color))] text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              <div className="space-y-2 pt-2">
                {providers.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                    <div>
                      <p className="text-xs font-bold text-[var(--text-main)]">{p.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono truncate max-w-sm">{p.url}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveProvider(idx)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-main)]/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={saved}
            className="px-6 py-2.5 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-[rgb(var(--primary-color))]/20 transition-all flex items-center gap-2"
          >
            {saved ? (
              <>
                <CheckCircle className="w-4 h-4 text-white" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
