import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  Heart, Clock, Play, Shuffle, Music2, Users, Disc, 
  Sparkles, Youtube, RefreshCw, Plus, ExternalLink, Mic2, Compass
} from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { useQuery } from '@tanstack/react-query';
import { getLibrarySection, getHomeShelves, getPlaylistDetails } from '../api/innertube';
import { useSessionStore } from '../store/useSessionStore';
import { MediaShelf } from '../components/MediaShelf';
import { TrackRow } from '../components/TrackRow';
import { 
  getLinkedYouTubeAccount, getImportedYouTubeTracks, YT_LIBRARY_UPDATED_EVENT, 
  getImportedYouTubePlaylists, LinkedYouTubeAccount 
} from '../api/youtubeAuth';
import { YouTubeAccountModal } from '../components/YouTubeAccountModal';
import { MusicTrack, Playlist } from '../types';

interface LibraryRouteProps {
  defaultTab?: 'recent' | 'songs' | 'artists' | 'albums' | 'for-you' | 'liked';
}

export const LibraryRoute: React.FC<LibraryRouteProps> = ({ defaultTab }) => {
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

  // Re-read imported data whenever a sync / account switch / playlist import finishes
  useEffect(() => {
    window.addEventListener(YT_LIBRARY_UPDATED_EVENT, handleSyncUpdate);
    return () => window.removeEventListener(YT_LIBRARY_UPDATED_EVENT, handleSyncUpdate);
  }, []);

  // Compile all known songs across library
  const allKnownTracks = [...importedTracks, ...recentlyPlayed];

  const activeChannelId = useSessionStore(state => state.activeChannelId);
  const path = location.pathname;
  const activeTab = defaultTab || (path.includes('/liked')
    ? 'liked'
    : path.includes('/artists')
      ? 'artists'
      : path.includes('/albums')
        ? 'albums'
        : path.includes('/songs')
          ? 'songs'
          : path.includes('/for-you')
            ? 'for-you'
            : 'recent');

  // Live library sections (only fetched when their tab is open)
  const albumsQ = useQuery({
    queryKey: ['ytm-library-albums', activeChannelId || 'default'],
    queryFn: () => getLibrarySection('Albums'),
    enabled: activeTab === 'albums',
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const artistsQ = useQuery({
    queryKey: ['ytm-library-artists', activeChannelId || 'default'],
    queryFn: () => getLibrarySection('Artists'),
    enabled: activeTab === 'artists',
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const homeQ = useQuery({
    queryKey: ['ytm-home', activeChannelId || 'default'],
    queryFn: () => getHomeShelves(),
    enabled: activeTab === 'for-you',
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  // YouTube Music's own Liked Music playlist — the source of truth for liked songs
  const likedQ = useQuery({
    queryKey: ['ytm-liked-music', activeChannelId || 'default'],
    queryFn: () => getPlaylistDetails('LM'),
    enabled: activeTab === 'liked',
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Liked songs = YouTube's Liked Music (full metadata) + locally-starred tracks we know about
  const likedTracks = useMemo(() => {
    const seen = new Set<string>();
    const out: MusicTrack[] = [];
    for (const t of likedQ.data?.tracks ?? []) {
      if (!seen.has(t.id)) { seen.add(t.id); out.push(t); }
    }
    for (const t of allKnownTracks) {
      if (likedTrackIds.includes(t.id) && !seen.has(t.id)) { seen.add(t.id); out.push(t); }
    }
    return out;
  }, [likedQ.data, likedTrackIds, importedTracks, recentlyPlayed]);

  const statusBox = (q: { isLoading: boolean; error: unknown }, empty: boolean, what: string) =>
    q.isLoading ? (
      <p className="text-sm text-[#b3b3b3] py-10 text-center">Loading your {what}…</p>
    ) : q.error ? (
      <p className="text-sm text-white/60 py-10 text-center">
        Couldn't load your {what}: {(q.error as Error).message}
      </p>
    ) : empty ? (
      <p className="text-sm text-[#b3b3b3] py-10 text-center">No {what} in your YouTube Music library yet.</p>
    ) : null;

  const handlePlayCollection = (tracks: MusicTrack[], shuffle = false) => {
    if (tracks.length === 0) return;
    let list = [...tracks];
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    playTrack(list[0], list);
  };

  return (
    <div 
      className="space-y-8 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      
      {/* 1. YouTube Music Account Link Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#141414] border border-white/5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="w-11 h-11 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/15">
            <Youtube className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                {ytAccount.isLinked ? 'YouTube Music Session Connected' : 'YouTube Music Library Sync'}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                ytAccount.isLinked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/10 text-white/70'
              }`}>
                {ytAccount.isLinked ? 'Active Session' : 'Ready to Sync'}
              </span>
            </div>
            <p className="text-xs text-[#b3b3b3] mt-0.5 font-normal">
              {ytAccount.isLinked 
                ? `${importedTracks.length} tracks & ${importedPlaylists.length} playlists synced from your YouTube account.`
                : 'Import liked tracks, private playlists, and subscribed artists directly into Xainy Music.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsYtModalOpen(true)}
          className="px-5 py-2.5 rounded-full bg-white hover:bg-white/90 text-black text-xs font-semibold shadow-lg flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
        >
          {ytAccount.isLinked ? <RefreshCw className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{ytAccount.isLinked ? 'Switch YouTube Account' : 'Connect YouTube Account'}</span>
        </button>
      </div>

      {/* 2. Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
            Personal Library
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
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
                      : 'Recently Played'}
          </h1>
        </div>

        {/* Tab Selector Pills */}
        <div className="flex items-center gap-1.5 bg-[#121212] p-1.5 rounded-2xl border border-white/5 overflow-x-auto text-xs font-semibold am-scrollbar">
          <Link
            to="/music/library/recent"
            className={`px-3 py-1.5 rounded-xl transition-colors duration-150 shrink-0 ${
              activeTab === 'recent' ? 'bg-[#282828] text-white shadow-sm' : 'text-[#b3b3b3] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            Recently Played
          </Link>
          <Link
            to="/music/library/songs"
            className={`px-3 py-1.5 rounded-xl transition-colors duration-150 shrink-0 ${
              activeTab === 'songs' ? 'bg-[#282828] text-white shadow-sm' : 'text-[#b3b3b3] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            Songs
          </Link>
          <Link
            to="/music/library/artists"
            className={`px-3 py-1.5 rounded-xl transition-colors duration-150 shrink-0 ${
              activeTab === 'artists' ? 'bg-[#282828] text-white shadow-sm' : 'text-[#b3b3b3] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            Artists
          </Link>
          <Link
            to="/music/library/albums"
            className={`px-3 py-1.5 rounded-xl transition-colors duration-150 shrink-0 ${
              activeTab === 'albums' ? 'bg-[#282828] text-white shadow-sm' : 'text-[#b3b3b3] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            Albums
          </Link>
          <Link
            to="/music/library/liked"
            className={`px-3 py-1.5 rounded-xl transition-colors duration-150 flex items-center gap-1.5 shrink-0 ${
              activeTab === 'liked' ? 'bg-[#282828] text-white shadow-sm' : 'text-[#b3b3b3] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Liked ({likedTrackIds.length})</span>
          </Link>
          <Link
            to="/music/library/for-you"
            className={`px-3 py-1.5 rounded-xl transition-colors duration-150 shrink-0 ${
              activeTab === 'for-you' ? 'bg-[#282828] text-white shadow-sm' : 'text-[#b3b3b3] hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            Made for You
          </Link>
        </div>
      </div>

      {/* 3. Tab Contents */}

      {/* ========================================================================= */}
      {/* TAB: RECENTLY PLAYED & SONGS (Full-width list view table layout)           */}
      {/* Columns: Track Info (Artwork, Play Overlay, Title, E badge), Artist, Album, Duration */}
      {/* ========================================================================= */}
      {(activeTab === 'recent' || activeTab === 'songs' || activeTab === 'liked') && (() => {
        const currentList = activeTab === 'recent' 
          ? recentlyPlayed 
          : activeTab === 'liked' 
            ? likedTracks 
            : allKnownTracks;

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#b3b3b3] uppercase tracking-wider">
                {currentList.length} Tracks
              </span>
              {currentList.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlayCollection(currentList, false)}
                    className="px-4 py-1.5 rounded-full bg-white hover:bg-white/90 text-black text-xs font-semibold flex items-center gap-1.5 shadow cursor-pointer transition-all hover:scale-105"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePlayCollection(currentList, true)}
                    className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 cursor-pointer transition-all hover:scale-105"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Shuffle</span>
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'liked' && likedQ.isLoading ? (
              <p className="text-sm text-[#b3b3b3] py-10 text-center">Loading your Liked Music…</p>
            ) : activeTab === 'liked' && likedQ.error && likedTracks.length === 0 ? (
              <p className="text-sm text-white/60 py-10 text-center">
                Couldn't load Liked Music from YouTube: {(likedQ.error as Error).message}
              </p>
            ) : currentList.length > 0 ? (
              <div className="space-y-1">
                {/* Table Header Columns */}
                <div className="flex items-center justify-between px-3.5 py-2 text-[11px] font-semibold text-[#b3b3b3] uppercase tracking-wider border-b border-white/10 mb-2">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span className="w-6 text-center">#</span>
                    <span>Title</span>
                  </div>
                  <div className="hidden md:block w-1/4 px-4 text-left">
                    <span>Album</span>
                  </div>
                  <div className="w-20 text-right pr-2">
                    <span>Time</span>
                  </div>
                </div>

                {/* Rows with Track Title playing and Artist Name linking to /music/artist/:id */}
                {currentList.map((track, idx) => (
                  <TrackRow
                    key={`${track.id}-${idx}`}
                    track={track}
                    index={idx}
                    showArtwork={true}
                    showAlbum={true}
                    playlistContext={currentList}
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-white/50 bg-[#121212] rounded-2xl border border-white/5 p-8 max-w-md mx-auto space-y-2">
                <Clock className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <h3 className="text-base font-semibold text-white">No Tracks in this Shelf</h3>
                <p className="text-xs text-[#b3b3b3]">
                  Play tracks or synchronize your YouTube Music library to populate this list.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB: ARTISTS (Flex-grid of large circular avatars with name centered)     */}
      {/* ========================================================================= */}
      {activeTab === 'artists' && (() => {
        const artists = (artistsQ.data ?? []).flatMap(i => (i.kind === 'artist' ? [i.artist] : []));
        return (
          <div className="space-y-4">
            {statusBox(artistsQ, artists.length === 0, 'artists')}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {artists.map(a => (
                <div
                  key={a.id}
                  onClick={() => navigate(`/music/artist/${a.id}`)}
                  className="group p-4 rounded-2xl bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 cursor-pointer transition-colors duration-150 flex flex-col items-center text-center shadow-lg"
                >
                  <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full overflow-hidden mb-3.5 bg-[#1e1e1e] shadow-xl ring-2 ring-white/10 group-hover:scale-105 transition-transform duration-300">
                    {a.artwork && <img src={a.artwork} alt={a.name} className="w-full h-full object-cover" />}
                  </div>
                  <h4 className="text-sm font-semibold text-white group-hover:underline transition-colors truncate max-w-full">
                    {a.name}
                  </h4>
                  {a.subtitle && <p className="text-xs text-[#b3b3b3] mt-1 font-normal truncate max-w-full">{a.subtitle}</p>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB: ALBUMS (Flex-grid of square artwork with Title and Album • Artist • Year) */}
      {/* ========================================================================= */}
      {activeTab === 'albums' && (() => {
        const albums = (albumsQ.data ?? []).flatMap(i => (i.kind === 'album' ? [i.album] : []));
        return (
          <div className="space-y-4">
            {statusBox(albumsQ, albums.length === 0, 'albums')}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {albums.map(alb => (
                <div
                  key={alb.id}
                  onClick={() => navigate(`/music/album/${alb.id}`)}
                  className="group p-2.5 rounded-[10px] bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 cursor-pointer transition-colors duration-150 shadow-md text-left"
                >
                  <div className="relative aspect-square rounded-[8px] overflow-hidden mb-2 bg-[#1e1e1e] border border-white/5">
                    {alb.artwork && (
                      <img src={alb.artwork} alt={alb.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    )}
                  </div>
                  <h4 className="font-semibold text-xs sm:text-sm text-white truncate text-left group-hover:underline">{alb.title}</h4>
                  <p className="text-xs text-[#98989d] truncate mt-0.5 text-left font-normal">
                    {alb.genre} •{' '}
                    {alb.artistId ? (
                      <Link
                        to={`/music/artist/${alb.artistId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-white hover:underline"
                      >
                        {alb.artist}
                      </Link>
                    ) : (
                      <span>{alb.artist}</span>
                    )}
                    {alb.year ? ` • ${alb.year}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* TAB: MADE FOR YOU                                                         */}
      {/* ========================================================================= */}
      {activeTab === 'for-you' && (() => {
        const shelves = (homeQ.data ?? []).filter(sh => sh.items.some(i => i.kind === 'playlist'));
        return (
          <div className="space-y-8">
            {statusBox(homeQ, shelves.length === 0, 'personalised mixes')}
            {shelves.map(sh => (
              <MediaShelf
                key={sh.id}
                title={sh.title}
                subtitle={sh.subtitle}
                items={sh.items.flatMap(i =>
                  i.kind === 'playlist'
                    ? [{
                        id: i.playlist.id,
                        title: i.playlist.title,
                        subtitle: i.playlist.subtitle || 'Playlist',
                        artwork: i.playlist.artwork,
                        onClick: () => navigate(`/music/playlist/${i.playlist.id}`),
                      }]
                    : []
                )}
              />
            ))}
            <div
              onClick={() => navigate('/music/replay')}
              className="p-5 rounded-2xl bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 cursor-pointer group shadow-xl transition-colors duration-150 max-w-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-4">
                <Disc className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white group-hover:underline">Replay '25</h3>
              <p className="text-xs text-[#b3b3b3] mt-1 font-normal">Your listening milestones and top songs.</p>
            </div>
          </div>
        );
      })()}

      {/* YouTube Music Link Modal */}
      <YouTubeAccountModal
        isOpen={isYtModalOpen}
        onClose={() => setIsYtModalOpen(false)}
        onAccountSelected={handleSyncUpdate}
      />

    </div>
  );
};
export default LibraryRoute;
