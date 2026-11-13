import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings, Youtube, Music, Radio, Sparkles, CheckCircle2,
  ExternalLink, ArrowLeft, RefreshCw, Sliders, Download, Upload,
  Plus, Trash2, AlertTriangle, Check, ListMusic, Users
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { extensionBridge } from '../extension/bridge';
import { useMusicPlayerStore, isDiscordRpcEnabled, setDiscordRpcEnabled } from '../store/useMusicPlayerStore';
import { getInstalledAddons, saveInstalledAddons, fetchAddonManifest } from '../api/addons';

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

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${on ? 'bg-white' : 'bg-white/15'}`}
  >
    <div className={`w-5 h-5 rounded-full absolute top-0.5 transition-all ${on ? 'bg-black translate-x-[22px]' : 'bg-white/70 translate-x-0.5'}`} />
  </button>
);

const Section: React.FC<{ icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }> = ({
  icon, title, desc, children,
}) => (
  <div className="bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
    <div className="p-5 border-b border-white/10">
      <h2 className="text-base font-bold text-white flex items-center gap-2">
        {icon}
        <span>{title}</span>
      </h2>
      {desc && <p className="text-xs text-[#a3a3a3] mt-1">{desc}</p>}
    </div>
    <div className="divide-y divide-white/5">
      {children}
    </div>
  </div>
);

const Row: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="p-5 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
    <div className="min-w-0">{children}</div>
    {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
  </div>
);

export const SettingsRoute: React.FC = () => {
  const queryClient = useQueryClient();
  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);
  const activeAccount = useMusicPlayerStore(state => state.activeAccount);
  const audioQuality = useMusicPlayerStore(state => state.audioQuality);
  const setAudioQuality = useMusicPlayerStore(state => state.setAudioQuality);
  const autoplayRadio = useMusicPlayerStore(state => state.autoplayRadio);
  const setAutoplayRadio = useMusicPlayerStore(state => state.setAutoplayRadio);

  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<{ name?: string; email?: string } | null>(null);
  const [spotifyProblem, setSpotifyProblem] = useState<string | null>(null);
  const [discordRpc, setDiscordRpc] = useState(isDiscordRpcEnabled());

  // Addons state
  const [addons, setAddons] = useState(getInstalledAddons());
  const [newAddonUrl, setNewAddonUrl] = useState('');
  const [isAddingAddon, setIsAddingAddon] = useState(false);
  const [addonMsg, setAddonMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Check Spotify auth state
  useEffect(() => {
    const checkSpotify = async () => {
      try {
        const res = await extensionBridge.sendExtensionMessage('spotify.authState');
        if (res && res.user) {
          setSpotifyUser(res.user);
          setSpotifyProblem(null);
        } else if (res && res.name) {
          setSpotifyUser({ name: res.name });
          setSpotifyProblem(null);
        } else if (res && res.problem) {
          setSpotifyProblem(res.problem);
        } else if (res && res.browserSignedIn && !res.connected) {
          setSpotifyProblem('Spotify is disconnected in the extension — click Connect.');
        }
      } catch {}
    };
    checkSpotify();
  }, [extensionConnected]);

  const handleConnectSpotify = async () => {
    setIsConnectingSpotify(true);
    try {
      await extensionBridge.sendExtensionMessage('spotify.setConnected', { connected: true }).catch(() => {});
      await extensionBridge.sendExtensionMessage('spotify.signIn');
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const res = await extensionBridge.sendExtensionMessage('spotify.authState').catch(() => null);
        if (res && (res.user || res.name || res.signedIn)) {
          setSpotifyUser(res.user || { name: res.name });
          queryClient.invalidateQueries({ queryKey: ['spotifyPlaylists'] });
          break;
        }
      }
    } catch (e) {
      console.warn('Spotify connect error:', e);
    } finally {
      setIsConnectingSpotify(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    try {
      await extensionBridge.sendExtensionMessage('spotify.signOut').catch(() =>
        extensionBridge.sendExtensionMessage('spotify.setConnected', { connected: false })
      );
      setSpotifyUser(null);
      queryClient.invalidateQueries({ queryKey: ['spotifyPlaylists'] });
    } catch {}
  };

  const handleDiscordToggle = (on: boolean) => {
    setDiscordRpc(on);
    setDiscordRpcEnabled(on);
  };

  const handleAddAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddonMsg(null);
    const url = newAddonUrl.trim();
    if (!url) return;
    setIsAddingAddon(true);
    try {
      const manifest = await fetchAddonManifest(url);
      const name = manifest?.name || new URL(url).hostname;
      const updated = [...addons, { name, url, manifest: manifest || undefined }];
      setAddons(updated);
      saveInstalledAddons(updated);
      setNewAddonUrl('');
      setAddonMsg({ text: `Connected "${name}" successfully.`, ok: true });
    } catch {
      setAddonMsg({ text: 'That URL did not return a valid addon manifest.', ok: false });
    } finally {
      setIsAddingAddon(false);
    }
  };

  const handleRemoveAddon = (index: number) => {
    const updated = addons.filter((_, i) => i !== index);
    setAddons(updated);
    saveInstalledAddons(updated);
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
    <div
      className="max-w-3xl mx-auto py-8 px-4 space-y-8 animate-fade-in pb-32"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link
            to="/music"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#a3a3a3] hover:text-white transition-colors"
            title="Back to Music"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-xs text-[#a3a3a3] mt-0.5">Playback, integrations, addons, and your music data</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[#a3a3a3]">
          <span>Version</span>
          <span className="font-mono text-white font-semibold">0.5.0</span>
        </div>
      </div>

      {notice && (
        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-fade-in ${
          notice.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="p-1 hover:opacity-75">
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* PLAYBACK & AUDIO */}
      <Section
        icon={<Sliders className="w-4 h-4 text-purple-400" />}
        title="Playback & Audio"
        desc="How Xainy Music sounds and behaves while playing"
      >
        {/* Audio Quality */}
        <div className="p-5">
          <p className="text-xs font-bold text-white uppercase tracking-wider mb-3">Audio Quality</p>
          <div className="grid grid-cols-3 gap-2">
            {QUALITY_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAudioQuality(opt.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  audioQuality === opt.id
                    ? 'border-white/60 bg-white/10 ring-1 ring-white/30'
                    : 'border-white/10 bg-[#1a1a1a] hover:bg-white/5'
                }`}
              >
                <p className="text-xs font-bold text-white">{opt.name}</p>
                <p className="text-[10px] text-white/45 mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/35 mt-2">
            Applies to the next stream resolution — currently playing tracks are unaffected.
          </p>
        </div>

        {/* Autoplay Radio */}
        <Row
          right={<Toggle on={autoplayRadio} onChange={setAutoplayRadio} />}
        >
          <p className="text-sm font-semibold text-white">Autoplay Similar Songs</p>
          <p className="text-xs text-[#a3a3a3] mt-0.5">When the queue ends, keep playing YouTube Music radio</p>
        </Row>
      </Section>

      {/* INTEGRATIONS */}
      <Section
        icon={<Sparkles className="w-4 h-4 text-purple-400" />}
        title="Integrations"
        desc="Connected services powering your music"
      >
        {/* YouTube Music */}
        <Row
          right={
            <>
              <span className="text-xs text-[#a3a3a3] hidden sm:inline">Engine Ready</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </>
          }
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white shrink-0">
              <Youtube className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-white">YouTube Music</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              </div>
              <p className="text-xs text-[#a3a3a3] truncate mt-0.5">
                Connected as: <span className="text-white font-medium">{activeAccount?.name || 'not signed in'}</span>
              </p>
            </div>
          </div>
        </Row>

        {/* Spotify */}
        <Row
          right={
            spotifyUser ? (
              <button
                type="button"
                onClick={handleDisconnectSpotify}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectSpotify}
                disabled={isConnectingSpotify || !extensionConnected}
                className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isConnectingSpotify && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Connect</span>
              </button>
            )
          }
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Music className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-white">Spotify</h3>
                {spotifyUser ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-[#a3a3a3]">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-[#a3a3a3] truncate mt-0.5">
                {spotifyUser
                  ? `Signed in as ${spotifyUser.name || 'Spotify User'}`
                  : spotifyProblem || 'Sync your Spotify playlists — played via YouTube Music'}
              </p>
              {!extensionConnected && (
                <p className="text-[10px] text-amber-400/80 mt-1">Requires the companion extension</p>
              )}
            </div>
          </div>
        </Row>

        {/* Discord RPC */}
        <Row right={<Toggle on={discordRpc} onChange={handleDiscordToggle} />}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-white">Discord Rich Presence</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${extensionConnected ? 'bg-white/10 text-[#a3a3a3]' : 'bg-amber-500/15 text-amber-400'}`}>
                  {extensionConnected ? 'Ready' : 'No Extension'}
                </span>
              </div>
              <p className="text-xs text-[#a3a3a3] truncate mt-0.5">
                Shows the currently playing track and artwork in Discord
              </p>
            </div>
          </div>
        </Row>

        {/* Listen Together */}
        <Row right={<Users className="w-4 h-4 text-purple-400" />}>
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-white">Listen Together</h3>
              <p className="text-xs text-[#a3a3a3] truncate mt-0.5">
                Host a synced party — open it from the sidebar's Listen Together button
              </p>
            </div>
          </div>
        </Row>

        {/* Extension */}
        <Row
          right={
            <a
              href="https://github.com/anassar12jS/bitchord-extension"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-all border border-white/10"
            >
              <span>Get</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          }
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-white">Xainy Music Extension</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${extensionConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/10 text-[#a3a3a3]'}`}>
                  {extensionConnected ? 'Connected' : 'Not Detected'}
                </span>
              </div>
              <p className="text-xs text-[#a3a3a3] truncate mt-0.5">
                Required for YouTube Music, Spotify, and Discord — load unpacked from GitHub
              </p>
            </div>
          </div>
        </Row>
      </Section>

      {/* HTTP ADDONS */}
      <Section
        icon={<ListMusic className="w-4 h-4 text-sky-400" />}
        title="HTTP Addons"
        desc="External catalog addons — each is validated against its manifest before being added"
      >
        <div className="p-5 space-y-3">
          <form onSubmit={handleAddAddon} className="flex gap-2">
            <input
              type="url"
              value={newAddonUrl}
              onChange={(e) => setNewAddonUrl(e.target.value)}
              placeholder="https://example.com/addon"
              className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/40"
            />
            <button
              type="submit"
              disabled={isAddingAddon || !newAddonUrl.trim()}
              className="px-4 py-2 rounded-xl bg-white hover:bg-white/90 disabled:opacity-40 text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingAddon ? 'Checking...' : 'Add'}</span>
            </button>
          </form>
          {addonMsg && (
            <p className={`text-xs flex items-center gap-1.5 ${addonMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
              {addonMsg.ok ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              {addonMsg.text}
            </p>
          )}
        </div>

        <div className="p-5 space-y-2">
          {addons.length === 0 && (
            <p className="text-[11px] text-white/35 text-center py-3">
              No addons installed — the built-in catalog works without any.
            </p>
          )}
          {addons.map((item, idx) => (
            <div
              key={item.url}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-white/10"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{item.name}</p>
                <p className="text-[10px] font-mono text-white/40 truncate">{item.url}</p>
              </div>
              <button
                onClick={() => handleRemoveAddon(idx)}
                className="p-1.5 text-white/30 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                title="Remove addon"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* YOUR DATA */}
      <Section
        icon={<Download className="w-4 h-4 text-emerald-400" />}
        title="Your Music Data"
        desc="Likes, recently played, and preferences stored on this device"
      >
        <Row
          right={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportMusicData}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
              </button>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportMusicData} className="hidden" />
            </div>
          }
        >
          <p className="text-sm font-semibold text-white">Backup & Restore</p>
          <p className="text-xs text-[#a3a3a3] mt-0.5">
            Downloads a JSON file with your Liked Songs, history, and preferences — import reloads the page
          </p>
        </Row>
      </Section>

    </div>
  );
};

export default SettingsRoute;
