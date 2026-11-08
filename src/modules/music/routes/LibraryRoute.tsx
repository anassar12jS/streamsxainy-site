import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  Heart, Clock, Play, Shuffle, Music2, Users, Disc, 
  Sparkles, Youtube, RefreshCw, Plus, ExternalLink, Mic2, Compass
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { BITCHORD_HOME_TRACKS, BITCHORD_LIBRARY_ALBUMS } from './BrowseRoute';
import { TrackRow } from '../components/TrackRow';
import { 
  getLinkedYouTubeAccount, getImportedYouTubeTracks, 
  getImportedYouTubePlaylists, LinkedYouTubeAccount 
} from '../api/youtubeAuth';
import { YouTubeMusicLinkModal } from '../components/YouTubeMusicLinkModal';
import { MusicTrack, Playlist } from '../types';

export const LibraryRoute: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const likedTrackIds = useMusicPlayerStore(state => state.likedTrackIds);
  const recentlyPlayed = useMusicPlayerStore(state => state.recentlyPlayed);
  const playTrack = useMusicPlayerStore(state => state.playTrack);

  const [isYtModalOpen, setIsYtModalOpen] = useState(false);
  const [ytAccount, setYtAccount] = useState<LinkedYouTubeAccount>(() => getLinkedYouTubeAccount());
  const [importedTracks, setImportedTracks] = useState<MusicTrack[]>(() => getImportedYouTubeTracks());
  const [importedPlaylists, setImportedPlaylists] = useState<Playlist[]>(() => getImportedYouTubePlaylists());

  const handleSyncUpdate = () => {
    setYtAccount(getLinkedYouTubeAccount());
    setImportedTracks(getImportedYouTubeTracks());
    setImportedPlaylists(getImportedYouTubePlaylists());
  };

  // Compile all known songs across library
  const allKnownTracks = [
    ...importedTracks,
    ...BITCHORD_HOME_TRACKS,
    ...APPLE_MUSIC_BROWSE_SECTIONS.topTracks,
    ...recentlyPlayed,
  ];

  // Deduplicate liked tracks
  const likedTracks = allKnownTracks.filter((track, index, self) => 
    likedTrackIds.includes(track.id) && self.findIndex(t => t.id === track.id) === index
  );

  // Group artists
  const artistMap = new Map<string, { name: string; avatar: string; count: number; tracks: MusicTrack[] }>();
  allKnownTracks.forEach(t => {
    const existing = artistMap.get(t.artist) || { name: t.artist, avatar: t.artwork, count: 0, tracks: [] };
    existing.count += 1;
    existing.tracks.push(t);
    artistMap.set(t.artist, existing);
  });
  const libraryArtists = Array.from(artistMap.values());

  const path = location.pathname;
  const activeTab = path.includes('/liked')
    ? 'liked'
    : path.includes('/artists')
      ? 'artists'
      : path.includes('/albums')
        ? 'albums'
        : path.includes('/songs')
          ? 'songs'
          : path.includes('/for-you')
            ? 'for-you'
            : path.includes('/youtube')
              ? 'youtube'
              : 'recent';

  const handlePlayCollection = (tracks: MusicTrack[], shuffle = false) => {
    if (tracks.length === 0) return;
    let list = [...tracks];
    if (shuffle) list.sort(() => Math.random() - 0.5);
    playTrack(list[0], list);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-24 max-w-7xl mx-auto px-1 sm:px-4">
      
      {/* 1. YouTube Music Account Link Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-red-950/40 via-[#18181b] to-[#141416] border border-red-500/20 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-red-600/20 text-red-500 flex items-center justify-center shrink-0 border border-red-500/30">
            <Youtube className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white">
                {ytAccount.isLinked ? 'YouTube Music Connected' : 'Link Your YouTube Music Account'}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                ytAccount.isLinked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {ytAccount.isLinked ? 'Active' : 'Sync Available'}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-0.5">
              {ytAccount.isLinked 
                ? `${importedTracks.length} tracks & ${importedPlaylists.length} playlists synced from your YouTube account.`
                : 'Import all your liked songs, private playlists, and favorite artists directly into BitChord.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsYtModalOpen(true)}
          className="px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
        >
          {ytAccount.isLinked ? <RefreshCw className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{ytAccount.isLinked ? 'Manage & Sync Library' : 'Connect YouTube Music'}</span>
        </button>
      </div>

      {/* 2. Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#fa243c] bg-[#fa243c]/15 px-3 py-1 rounded-full border border-[#fa243c]/30">
            Personal Library
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2">
            {activeTab === 'liked'
              ? 'Liked Songs'
              : activeTab === 'artists'
                ? 'Artists'
                : activeTab === 'albums'
                  ? 'Albums'
                  : activeTab === 'songs'
                    ? 'All Songs'
                    : activeTab === 'for-you'
                      ? 'Made for You'
                      : activeTab === 'youtube'
                        ? 'YouTube Music Playlists'
                        : 'Recently Played'}
          </h1>
        </div>

        {/* Tab Selector Pills */}
        <div className="flex items-center gap-1 bg-[#141416] p-1.5 rounded-2xl border border-white/10 overflow-x-auto text-xs font-bold am-scrollbar">
          <Link
            to="/music/library/recent"
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
              activeTab === 'recent' ? 'bg-[#fa243c] text-white shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            Recent
          </Link>
          <Link
            to="/music/library/liked"
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'liked' ? 'bg-[#fa243c] text-white shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Liked ({likedTrackIds.length})</span>
          </Link>
          <Link
            to="/music/library/artists"
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
              activeTab === 'artists' ? 'bg-[#fa243c] text-white shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            Artists
          </Link>
          <Link
            to="/music/library/albums"
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
              activeTab === 'albums' ? 'bg-[#fa243c] text-white shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            Albums
          </Link>
          <Link
            to="/music/library/songs"
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
              activeTab === 'songs' ? 'bg-[#fa243c] text-white shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            Songs
          </Link>
          <Link
            to="/music/library/for-you"
            className={`px-3 py-1.5 rounded-xl transition-all shrink-0 ${
              activeTab === 'for-you' ? 'bg-[#fa243c] text-white shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            Made for You
          </Link>
        </div>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB: LIKED SONGS */}
      {activeTab === 'liked' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
              {likedTracks.length} Songs Favorited
            </span>
            {likedTracks.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlayCollection(likedTracks, false)}
                  className="px-4 py-1.5 rounded-xl bg-[#fa243c] text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer hover:bg-[#ff3b50]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play
                </button>
                <button
                  onClick={() => handlePlayCollection(likedTracks, true)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 cursor-pointer hover:bg-white/15"
                >
                  <Shuffle className="w-3.5 h-3.5" /> Shuffle
                </button>
              </div>
            )}
          </div>

          {likedTracks.length > 0 ? (
            <div className="bg-[#141416] p-3 rounded-3xl border border-white/5 space-y-0.5 shadow-xl">
              {likedTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  playlistContext={likedTracks}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-white/40 bg-[#141416] rounded-3xl border border-white/10 p-8 max-w-md mx-auto space-y-3">
              <Heart className="w-10 h-10 text-[#fa243c]/50 mx-auto" />
              <h3 className="text-base font-bold text-white">No Liked Songs Yet</h3>
              <p className="text-xs text-white/40">
                Star any track or import your YouTube Music library to see all your favorites here.
              </p>
              <button
                onClick={() => setIsYtModalOpen(true)}
                className="mt-2 px-5 py-2.5 rounded-2xl bg-red-600 text-white text-xs font-bold cursor-pointer hover:bg-red-500"
              >
                Import from YouTube Music
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: RECENTLY PLAYED */}
      {activeTab === 'recent' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
              {recentlyPlayed.length} Recent Tracks
            </span>
            {recentlyPlayed.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlayCollection(recentlyPlayed, false)}
                  className="px-4 py-1.5 rounded-xl bg-[#fa243c] text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer hover:bg-[#ff3b50]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play
                </button>
                <button
                  onClick={() => handlePlayCollection(recentlyPlayed, true)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 cursor-pointer hover:bg-white/15"
                >
                  <Shuffle className="w-3.5 h-3.5" /> Shuffle
                </button>
              </div>
            )}
          </div>

          {recentlyPlayed.length > 0 ? (
            <div className="bg-[#141416] p-3 rounded-3xl border border-white/5 space-y-0.5 shadow-xl">
              {recentlyPlayed.map((track, idx) => (
                <TrackRow
                  key={`${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  playlistContext={recentlyPlayed}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-white/40 bg-[#141416] rounded-3xl border border-white/10 p-8 max-w-md mx-auto space-y-3">
              <Clock className="w-10 h-10 text-white/20 mx-auto" />
              <h3 className="text-base font-bold text-white">Your Listening History is Fresh</h3>
              <p className="text-xs text-white/40">
                Play any track from Home, Search, or Albums to start tracking your history.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB: ARTISTS */}
      {activeTab === 'artists' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {libraryArtists.map(a => (
              <div
                key={a.name}
                onClick={() => navigate(`/music/artist/${encodeURIComponent(a.name)}`)}
                className="group p-4 rounded-3xl bg-[#141416] hover:bg-[#1f1f23] border border-white/5 cursor-pointer transition-all flex flex-col items-center text-center shadow-lg"
              >
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden mb-3 bg-[#242426] shadow-xl ring-2 ring-white/10 group-hover:scale-105 transition-transform">
                  <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors truncate max-w-full">
                  {a.name}
                </h4>
                <p className="text-xs text-white/50 mt-0.5 font-mono">
                  {a.count} {a.count === 1 ? 'Track' : 'Tracks'} in Library
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: ALBUMS */}
      {activeTab === 'albums' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {BITCHORD_LIBRARY_ALBUMS.map(alb => (
              <div
                key={alb.id}
                onClick={() => navigate(`/music/album/${alb.id}`)}
                className="group p-3 rounded-2xl bg-[#141416] hover:bg-[#1f1f23] border border-white/5 cursor-pointer transition-all shadow-lg"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[#242426]">
                  <img src={alb.artwork} alt={alb.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
                <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                  {alb.title}
                </h4>
                <p className="text-[11px] text-white/50 truncate mt-0.5">
                  {alb.artist}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: SONGS */}
      {activeTab === 'songs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
              {allKnownTracks.length} Total Tracks
            </span>
            <button
              onClick={() => handlePlayCollection(allKnownTracks, true)}
              className="px-4 py-1.5 rounded-xl bg-[#fa243c] text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer hover:bg-[#ff3b50]"
            >
              <Shuffle className="w-3.5 h-3.5" /> Shuffle All
            </button>
          </div>

          <div className="bg-[#141416] p-3 rounded-3xl border border-white/5 space-y-0.5 shadow-xl">
            {allKnownTracks.map((track, idx) => (
              <TrackRow
                key={`${track.id}-${idx}`}
                track={track}
                index={idx}
                playlistContext={allKnownTracks}
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB: MADE FOR YOU */}
      {activeTab === 'for-you' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* Daily Chill */}
            <div 
              onClick={() => handlePlayCollection(BITCHORD_HOME_TRACKS, true)}
              className="p-5 rounded-3xl bg-gradient-to-br from-indigo-950/60 to-[#141416] border border-indigo-500/20 cursor-pointer group shadow-xl hover:scale-[1.02] transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                Daily Chill Station
              </h3>
              <p className="text-xs text-white/50 mt-1">
                Personalized ambient beats, Midwest emo, and lo-fi melodies updated daily.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-indigo-300">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Listen Now</span>
              </div>
            </div>

            {/* Heavy Rotation */}
            <div 
              onClick={() => handlePlayCollection(likedTracks.length > 0 ? likedTracks : BITCHORD_HOME_TRACKS, false)}
              className="p-5 rounded-3xl bg-gradient-to-br from-rose-950/60 to-[#141416] border border-rose-500/20 cursor-pointer group shadow-xl hover:scale-[1.02] transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-rose-400 transition-colors">
                Heavy Rotation Mix
              </h3>
              <p className="text-xs text-white/50 mt-1">
                The songs and soundtracks you keep coming back to the most this week.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-rose-300">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Listen Now</span>
              </div>
            </div>

            {/* Replay 2025 */}
            <div 
              onClick={() => navigate('/music/replay')}
              className="p-5 rounded-3xl bg-gradient-to-br from-purple-950/60 to-[#141416] border border-purple-500/20 cursor-pointer group shadow-xl hover:scale-[1.02] transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <Disc className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                Replay '25 Showcase
              </h3>
              <p className="text-xs text-white/50 mt-1">
                Your annual streaming milestones, top songs, and shareable poster.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-purple-300">
                <span>View Replay</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* YouTube Music Link Modal */}
      <YouTubeMusicLinkModal
        isOpen={isYtModalOpen}
        onClose={() => setIsYtModalOpen(false)}
        onSyncComplete={handleSyncUpdate}
      />

    </div>
  );
};
