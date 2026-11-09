import React, { useState } from 'react';
import { 
  X, Check, RefreshCw, Link as LinkIcon, ExternalLink, 
  Music, ListMusic, Sparkles, Youtube, CheckCircle2, AlertCircle
} from 'lucide-react';
import { 
  getLinkedYouTubeAccount, saveLinkedYouTubeAccount, 
  syncUserYouTubeMusicLibrary, importPlaylistFromYouTube,
  LinkedYouTubeAccount
} from '../api/youtubeAuth';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

interface YouTubeMusicLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const YouTubeMusicLinkModal: React.FC<YouTubeMusicLinkModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [account, setAccount] = useState<LinkedYouTubeAccount>(() => getLinkedYouTubeAccount());
  const [playlistInput, setPlaylistInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportingPlaylist, setIsImportingPlaylist] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);

  if (!isOpen) return null;

  const handleSyncLibrary = async () => {
    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const { likedTracks, playlists } = await syncUserYouTubeMusicLibrary(account);
      const updated = getLinkedYouTubeAccount();
      setAccount(updated);

      // Add imported tracks to liked tracks in store
      likedTracks.forEach(t => {
        if (!useMusicPlayerStore.getState().isLiked(t.id)) {
          useMusicPlayerStore.getState().toggleLike(t.id);
        }
      });

      setStatusMessage({
        type: 'success',
        text: `Successfully synced ${likedTracks.length} tracks & ${playlists.length} playlists from YouTube Music!`,
      });
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to sync YouTube Music library. Check connection.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistInput.trim()) return;

    setIsImportingPlaylist(true);
    setStatusMessage(null);
    try {
      const res = await importPlaylistFromYouTube(playlistInput.trim());
      const updated = getLinkedYouTubeAccount();
      setAccount(updated);
      setPlaylistInput('');
      setStatusMessage({
        type: 'success',
        text: `Imported "${res.title}" with ${res.tracks.length} songs into your Library!`,
      });
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to import playlist. Check the URL.',
      });
    } finally {
      setIsImportingPlaylist(false);
    }
  };

  const handleToggleLink = () => {
    const nextState = !account.isLinked;
    const updated = {
      ...account,
      isLinked: nextState,
      lastSynced: nextState ? Date.now() : undefined,
    };
    saveLinkedYouTubeAccount(updated);
    setAccount(updated);
    if (nextState) {
      handleSyncLibrary();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-lg bg-[#18181b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-red-950/40 via-[#18181b] to-[#18181b]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/30">
              <Youtube className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>Link YouTube Music</span>
                {account.isLinked && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </h3>
              <p className="text-[11px] text-white/50">
                Import playlists, liked songs, and listening preferences
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

        {/* Status Alert */}
        {statusMessage && (
          <div className={`px-6 py-3 text-xs flex items-center gap-2 border-b ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border-red-500/30 text-red-300'
          }`}>
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="p-6 space-y-6">
          
          {/* Account Profile Card */}
          <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <img 
                src={account.avatar} 
                alt={account.name} 
                className="w-12 h-12 rounded-full object-cover ring-2 ring-red-500/30 shrink-0" 
              />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">
                  {account.name}
                </h4>
                <p className="text-xs text-white/50 truncate">
                  {account.email}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-mono">
                  <span className={`px-2 py-0.5 rounded-full ${
                    account.isLinked 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-white/10 text-white/60'
                  }`}>
                    {account.isLinked ? 'Connected' : 'Not Linked'}
                  </span>
                  {account.lastSynced && (
                    <span className="text-white/40">
                      Synced {new Date(account.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleLink}
              disabled={isSyncing}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                account.isLinked
                  ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                  : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
              }`}
            >
              {account.isLinked ? 'Unlink' : 'Link Account'}
            </button>
          </div>

          {/* Sync Stats & Instant Sync Button */}
          {account.isLinked && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#141416] border border-white/5">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider font-semibold">
                    Synced Tracks
                  </span>
                  <p className="text-xl font-black text-white mt-0.5">
                    {account.importedTracksCount}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#141416] border border-white/5">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider font-semibold">
                    Imported Playlists
                  </span>
                  <p className="text-xl font-black text-white mt-0.5">
                    {account.importedPlaylistsCount}
                  </p>
                </div>
              </div>

              <button
                onClick={handleSyncLibrary}
                disabled={isSyncing}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-red-400' : ''}`} />
                <span>{isSyncing ? 'Synchronizing YouTube Music Library...' : 'Sync Full Library Now'}</span>
              </button>
            </div>
          )}

          {/* Import via Playlist Link / ID */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ListMusic className="w-3.5 h-3.5 text-red-400" />
              <span>Import Any YouTube Music Playlist</span>
            </label>
            <p className="text-[11px] text-white/50">
              Paste a YouTube Music or YouTube playlist link to instantly add all songs to your Xainy Music Library.
            </p>

            <form onSubmit={handleImportPlaylist} className="flex gap-2 pt-1">
              <input
                type="text"
                value={playlistInput}
                onChange={(e) => setPlaylistInput(e.target.value)}
                placeholder="https://music.youtube.com/playlist?list=..."
                className="flex-1 bg-[#141416] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500 font-medium"
              />
              <button
                type="submit"
                disabled={isImportingPlaylist || !playlistInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition-colors shrink-0 flex items-center gap-1.5"
              >
                {isImportingPlaylist ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LinkIcon className="w-3.5 h-3.5" />
                )}
                <span>Import</span>
              </button>
            </form>
          </div>

          {/* Extension Note */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between text-xs text-white/60">
            <span>Xainy Music Companion Bridge:</span>
            <span className={`font-mono text-[11px] font-bold ${
              extensionConnected ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {extensionConnected ? 'Active (Private Sessions Enabled)' : 'Standby'}
            </span>
          </div>

        </div>

      </div>
    </div>
  );
};
