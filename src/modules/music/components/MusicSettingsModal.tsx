import React, { useState } from 'react';
import { 
  X, Settings, Plus, Trash2, Check, ExternalLink, ShieldCheck, 
  Layers, Radio, Sparkles, Sliders, Music2, MessageSquare, Disc
} from 'lucide-react';
import { getInstalledAddons, saveInstalledAddons, fetchAddonManifest } from '../api/addons';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

interface MusicSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MusicSettingsModal: React.FC<MusicSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'addons' | 'integrations' | 'lyrics'>('general');
  const [addons, setAddons] = useState(getInstalledAddons());
  const [newAddonUrl, setNewAddonUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Settings states
  const [lossless, setLossless] = useState(true);
  const [discordRpc, setDiscordRpc] = useState(true);
  const [spotifyCanvas, setSpotifyCanvas] = useState(true);

  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);

  if (!isOpen) return null;

  const handleAddAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
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
    } catch (err: any) {
      setErrorMsg('Failed to fetch addon manifest. Check the URL and network.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveAddon = (index: number) => {
    const updated = addons.filter((_, i) => i !== index);
    setAddons(updated);
    saveInstalledAddons(updated);
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-white/5 bg-[#18181b] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2 rounded-t-xl transition-colors cursor-pointer border-b-2 ${
              activeTab === 'general'
                ? 'border-white text-white bg-white/5'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            General & Audio
          </button>
          <button
            onClick={() => setActiveTab('addons')}
            className={`px-3.5 py-2 rounded-t-xl transition-colors cursor-pointer border-b-2 ${
              activeTab === 'addons'
                ? 'border-white text-white bg-white/5'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            HTTP Addons ({addons.length})
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-3.5 py-2 rounded-t-xl transition-colors cursor-pointer border-b-2 ${
              activeTab === 'integrations'
                ? 'border-white text-white bg-white/5'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            Integrations
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 am-scrollbar">
          
          {activeTab === 'general' && (
            <div className="space-y-5">
              
              {/* Audio Quality Tier */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Preferred Audio Streaming Tier
                </label>
                <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-xs font-bold text-white">Lossless / High-Res (FLAC / Opus 251)</p>
                      <p className="text-[11px] text-white/50">Streams best audio rendition up to 24-bit / 192kHz</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={lossless} 
                      onChange={e => setLossless(e.target.checked)}
                      className="accent-white w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Extension Status */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Xainy Music Extension Status
                </label>
                <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${extensionConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <div>
                      <p className="text-xs font-bold text-white">
                        {extensionConnected ? 'Companion Connected' : 'Extension Standby'}
                      </p>
                      <p className="text-[11px] text-white/50">
                        {extensionConnected ? 'Full YouTube Music engine active' : 'Install companion extension for signed-in sessions'}
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://chromewebstore.google.com/detail/bitchord-companion/pkddffeebcmhhanjcigilehaeonkkfih"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition-colors flex items-center gap-1"
                  >
                    <span>Store</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
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
                    <span>{isAdding ? 'Testing...' : 'Add'}</span>
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-xs text-white/60 mt-1">{errorMsg}</p>
                )}
              </form>

              {/* Installed List */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Active Addons ({addons.length})
                </label>
                <div className="space-y-2">
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
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Discord Rich Presence</h4>
                  <p className="text-[11px] text-white/50">Shows "Listening to Xainy Music" with track & album artwork</p>
                </div>
                <input
                  type="checkbox"
                  checked={discordRpc}
                  onChange={e => setDiscordRpc(e.target.checked)}
                  className="accent-white w-4 h-4 cursor-pointer"
                />
              </div>

              {/* Spotify Canvas */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Spotify Canvas Video Backgrounds</h4>
                  <p className="text-[11px] text-white/50">Plays looping artist visualizer behind now-playing artwork</p>
                </div>
                <input
                  type="checkbox"
                  checked={spotifyCanvas}
                  onChange={e => setSpotifyCanvas(e.target.checked)}
                  className="accent-white w-4 h-4 cursor-pointer"
                />
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
