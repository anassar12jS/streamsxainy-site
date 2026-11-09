import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings, Youtube, Music, Radio, Sparkles, CheckCircle2, 
  XCircle, ExternalLink, ArrowLeft, RefreshCw, AlertCircle
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { extensionBridge, BitChordExtensionBridge } from '../extension/bridge';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

export const SettingsRoute: React.FC = () => {
  const queryClient = useQueryClient();
  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);
  const activeAccount = useMusicPlayerStore(state => state.activeAccount);
  const setActiveAccount = useMusicPlayerStore(state => state.setActiveAccount);

  const [isConnectingSpotify, setIsConnectingSpotify] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<{ name?: string; email?: string } | null>(null);

  // Check Spotify auth state
  useEffect(() => {
    const checkSpotify = async () => {
      try {
        const res = await extensionBridge.sendExtensionMessage('spotify.authState');
        if (res && res.user) {
          setSpotifyUser(res.user);
        } else if (res && res.name) {
          setSpotifyUser({ name: res.name });
        }
      } catch {}
    };
    checkSpotify();
  }, [extensionConnected]);

  const handleConnectSpotify = async () => {
    setIsConnectingSpotify(true);
    try {
      await extensionBridge.sendExtensionMessage('spotify.signIn');
      const res = await extensionBridge.sendExtensionMessage('spotify.authState');
      if (res && (res.user || res.name)) {
        setSpotifyUser(res.user || { name: res.name });
        queryClient.invalidateQueries({ queryKey: ['spotifyPlaylists'] });
      }
    } catch (e) {
      console.warn('Spotify connect error:', e);
    } finally {
      setIsConnectingSpotify(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    try {
      await extensionBridge.sendExtensionMessage('spotify.signOut');
      setSpotifyUser(null);
      queryClient.invalidateQueries({ queryKey: ['spotifyPlaylists'] });
    } catch {}
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
            <p className="text-xs text-[#a3a3a3] mt-0.5">Manage your BitChord music engine integrations and accounts</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[#a3a3a3]">
          <span>Version</span>
          <span className="font-mono text-white font-semibold">0.4.4</span>
        </div>
      </div>

      {/* Integrations Card */}
      <div className="bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Service Integrations</span>
          </h2>
          <p className="text-xs text-[#a3a3a3] mt-1">
            Connect your streaming services for unified playback, library syncing, and Discord presence.
          </p>
        </div>

        <div className="divide-y divide-white/5">
          
          {/* 1. YouTube Music */}
          <div className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
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

            <div className="shrink-0 flex items-center gap-2">
              <span className="text-xs text-[#a3a3a3] hidden sm:inline">Engine Ready</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          {/* 2. Spotify */}
          <div className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
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
                    : 'Sync your Spotify playlists and Canvas videos'}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              {spotifyUser ? (
                <button
                  type="button"
                  onClick={handleDisconnectSpotify}
                  className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 transition-all cursor-pointer"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectSpotify}
                  disabled={isConnectingSpotify}
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isConnectingSpotify && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Connect</span>
                </button>
              )}
            </div>
          </div>

          {/* 3. Discord RPC */}
          <div className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Radio className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-white">Discord</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-[#a3a3a3]">
                    {extensionConnected ? 'Auto Broadcast' : 'Not Connected'}
                  </span>
                </div>
                <p className="text-xs text-[#a3a3a3] truncate mt-0.5">
                  Rich Presence displays currently playing tracks and album art in Discord
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${extensionConnected ? 'bg-emerald-400' : 'bg-[#555555]'}`} />
            </div>
          </div>

          {/* 4. BitChord Companion Extension */}
          <div className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-white">BitChord Extension</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-[#a3a3a3]">
                    v0.4.4
                  </span>
                </div>
                <p className="text-xs text-[#a3a3a3] truncate mt-0.5">
                  ID: <code className="text-white/80 font-mono text-[10px]">pkddffeebcmhhanjcigilehaeonkkfih</code>
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <a
                href="https://chromewebstore.google.com/detail/bitchord-companion/pkddffeebcmhhanjcigilehaeonkkfih"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-all border border-white/10"
              >
                <span>Store</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default SettingsRoute;
