import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  X, Settings, Plus, Trash2, Check, ExternalLink, ShieldCheck, 
  Layers, Radio, Sparkles, Sliders, Music2, MessageSquare, Disc,
  Download, Upload, AlertTriangle
} from 'lucide-react';
import { getInstalledAddons, saveInstalledAddons, fetchAddonManifest } from '../api/addons';
import { useMusicPlayerStore, isDiscordRpcEnabled, setDiscordRpcEnabled } from '../store/useMusicPlayerStore';

interface MusicSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** localStorage keys that make up "your music data" for export/import */
const MUSIC_DATA_KEYS = [
  'bitchord_music_likes',
  'bitchord_music_recent',
  'bitchord_music_autoplay_radio',
  'bitchord_music_quality',
  'bitchord_music_volume',
  'bitchord_music_muted',
  'xainy_music_discord_rpc',
  'xainy_party_name',
] as const;

const QUALITY_OPTIONS = [
  { id: 'auto' as const, name: 'Auto', desc: 'Balanced quality & data usage' },
  { id: 'high' as const, name: 'High', desc: 'High-bitrate Opus/AAC stream' },
  { id: 'lossless' as const, name: 'Lossless', desc: 'Best available audio rendition' },
];

export const MusicSettingsModal: React.FC<MusicSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'addons' | 'integrations'>('general');
  const [addons, setAddons] = useState(getInstalledAddons());
  const [newAddonUrl, setNewAddonUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Settings states — all persisted
  const audioQuality = useMusicPlayerStore(state => state.audioQuality);
  const setAudioQuality = useMusicPlayerStore(state => state.setAudioQuality);
  const autoplayRadio = useMusicPlayerStore(state => state.autoplayRadio);
  const setAutoplayRadio = useMusicPlayerStore(state => state.setAutoplayRadio);
  const [discordRpc, setDiscordRpc] = useState(isDiscordRpcEnabled());

  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);

  if (!isOpen) return null;

  const handleAddAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    const url = newAddonUrl.trim();
    if (!url) return;

    setIsAdding(true);
    try {
      const manifest = await fetchAddonManifest(url);
      const name = manifest?.name || new URL(url).hostname;
      const updated = [...addons, { name, url, manifest: manifest || undefined }];
      setAddons(updated);
      saveInstalledAddons(updated);
      setNewAddonUrl('');
      setSuccessMsg(`Connected "${name}" successfully.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message?.includes('manifest')
        ? 'That URL did not return a valid addon manifest.'
        : 'Failed to reach that URL — check the link and your connection.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveAddon = (index: number) => {
    const updated = addons.filter((_, i) => i !== index);
    setAddons(updated);
    saveInstalledAddons(updated);
  };

  const handleDiscordToggle = (on: boolean) => {
    setDiscordRpc(on);
    setDiscordRpcEnabled(on);
  };

  const handleExportMusicData = () => {
    const data: Record<string, string | null> = {};
    for (const key of MUSIC_DATA_KEYS) data[key] = localStorage.getItem(key);
    const blob = new Blob([JSON.stringify({ app: 'xainy-music', exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xainy-music-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotice({ message: 'Music data exported — likes, history, and preferences included.', type: 'success' });
  };

  const handleImportMusicData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        let restored = 0;
        for (const key of MUSIC_DATA_KEYS) {
          const v = data?.[key];
          if (typeof v === 'string') {
            localStorage.setItem(key, v);
            restored++;
          }
        }
        if (restored === 0) {
          setNotice({ message: 'No music data found in that file.', type: 'error' });
          return;
        }
        setNotice({ message: `Restored ${restored} settings — reloading…`, type: 'success' });
        setTimeout(() => window.location.reload(), 900);
      } catch {
        setNotice({ message: 'Invalid backup file.', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-xl bg-[#18181b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#1f1f23]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Xainy Music Preferences
              </h3>
              <p className="text-[11px] text-white/50">
                Audio quality, addons, and companion extension integrations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice banner */}
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
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-white/5 bg-[#18181b] text-xs font-semibold">
          {([
            { id: 'general', label: 'General & Audio' },
            { id: 'addons', label: `HTTP Addons (${addons.length})` },
            { id: 'integrations', label: 'Integrations' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-t-xl transition-colors cursor-pointer border-b-2 ${
                activeTab === tab.id
                  ? 'border-white text-white bg-white/5'
                  : 'border-transparent text-white/50 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 am-scrollbar">

          {activeTab === 'general' && (
            <div className="space-y-5">

              {/* Audio Quality Tier */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Audio Quality
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {QUALITY_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAudioQuality(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        audioQuality === opt.id
                          ? 'border-white/60 bg-white/10 ring-1 ring-white/30'
                          : 'border-white/10 bg-[#141416] hover:bg-white/5'
                      }`}
                    >
                      <p className="text-xs font-bold text-white">{opt.name}</p>
                      <p className="text-[10px] text-white/45 mt-0.5 leading-tight">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/35">
                  Applies to the next stream resolution — currently playing tracks are unaffected.
                </p>
              </div>

              {/* Autoplay Radio */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-white">Autoplay Similar Songs</h4>
                  <p className="text-[11px] text-white/50">When the queue ends, keep playing YouTube Music radio</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoplayRadio(!autoplayRadio)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                    autoplayRadio ? 'bg-white' : 'bg-white/15'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full absolute top-0.5 transition-all ${
                    autoplayRadio ? 'bg-black translate-x-[22px]' : 'bg-white/70 translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Extension Status */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Companion Extension
                </label>
                <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${extensionConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white">
                        {extensionConnected ? 'Connected' : 'Not detected'}
                      </p>
                      <p className="text-[11px] text-white/50 truncate">
                        {extensionConnected
                          ? 'Full YouTube Music engine active'
                          : 'Required for search, library, and playback'}
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://github.com/anassar12jS/bitchord-extension"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition-colors flex items-center gap-1 shrink-0"
                  >
                    <span>Get</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Music Data Backup */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Your Music Data
                </label>
                <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-3">
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Exports Liked Songs, recently played, and music preferences as a JSON file.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleExportMusicData}
                      className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </button>
                    <label className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import</span>
                      <input type="file" accept=".json" onChange={handleImportMusicData} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'addons' && (
            <div className="space-y-5">

              {/* Add New Addon */}
              <form onSubmit={handleAddAddon} className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Add HTTP Addon URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newAddonUrl}
                    onChange={(e) => setNewAddonUrl(e.target.value)}
                    placeholder="https://example.com/addon"
                    className="flex-1 bg-[#141416] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                  />
                  <button
                    type="submit"
                    disabled={isAdding || !newAddonUrl.trim()}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-white/90 disabled:opacity-40 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAdding ? 'Checking...' : 'Add'}</span>
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-xs text-rose-400/90 mt-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {errorMsg}
                  </p>
                )}
                {successMsg && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1.5">
                    <Check className="w-3 h-3 shrink-0" />
                    {successMsg}
                  </p>
                )}
              </form>

              {/* Installed List */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Active Addons ({addons.length})
                </label>
                <div className="space-y-2">
                  {addons.length === 0 && (
                    <p className="text-[11px] text-white/35 text-center py-4">
                      No addons installed — the built-in catalog works without any.
                    </p>
                  )}
                  {addons.map((item, idx) => (
                    <div
                      key={item.url}
                      className="p-3.5 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <h5 className="text-xs font-bold text-white truncate">
                          {item.name}
                        </h5>
                        <p className="text-[11px] font-mono text-white/50 truncate">
                          {item.url}
                        </p>
                        {item.manifest?.description && (
                          <p className="text-[10px] text-white/40 mt-0.5 truncate">
                            {item.manifest.description}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveAddon(idx)}
                        className="p-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                        title="Remove addon"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-4">

              {/* Discord RPC */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-white">Discord Rich Presence</h4>
                  <p className="text-[11px] text-white/50">Shows "Listening to Xainy Music" with track & album artwork</p>
                  {!extensionConnected && (
                    <p className="text-[10px] text-amber-400/80 mt-1">Requires the companion extension</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDiscordToggle(!discordRpc)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                    discordRpc ? 'bg-white' : 'bg-white/15'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full absolute top-0.5 transition-all ${
                    discordRpc ? 'bg-black translate-x-[22px]' : 'bg-white/70 translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Listen Together hint */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-white">Listen Together</h4>
                  <p className="text-[11px] text-white/50">Host a synced party — open it from the sidebar</p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white/60 text-[10px] font-mono">Supabase</span>
              </div>

              {/* Account & extension status page */}
              <Link
                to="/music/settings"
                onClick={onClose}
                className="block p-4 rounded-2xl bg-[#141416] border border-white/10 hover:bg-white/5 transition-colors"
              >
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Account & Extension Status
                  <ExternalLink className="w-3 h-3 text-white/40" />
                </h4>
                <p className="text-[11px] text-white/50 mt-0.5">
                  YouTube account switching, Spotify sign-in, and extension diagnostics
                </p>
              </Link>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
