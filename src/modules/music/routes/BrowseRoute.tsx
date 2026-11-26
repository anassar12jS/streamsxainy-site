import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertCircle, Heart, Radio, History, ListMusic, SlidersHorizontal, Eye, EyeOff, Play, Pause, Disc3, Search } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { useSessionStore } from '../store/useSessionStore';
import { getHomeShelves, resolveTrackDurations, getRadioTracks, resolveArtistId, resolveAlbumId } from '../api/innertube';
import { GlobalSearchBar } from '../components/GlobalSearchBar';
import { MediaShelf, ShelfItem } from '../components/MediaShelf';
import { TrackRow } from '../components/TrackRow';
import { FeedSkeleton } from '../components/Skeletons';
import { ARTWORK_PLACEHOLDER, type HomeItem, type HomeShelf } from '../api/ytmParse';
import { getImportedSoundCloudTracks } from '../api/soundcloud';
import type { MusicTrack } from '../types';

/** Home: live YouTube Music home feed (personalised when a session is connected). */
const SHELVES_CACHE_PREFIX = 'ytm_home_shelves_v4_'; // v4: duration backfill via getBasicInfo — v3 caches hold duration:0
const HIDDEN_SHELVES_KEY = 'xainy_hidden_shelves';

const loadHiddenShelves = (): Set<string> => {
  try {
    const raw = localStorage.getItem(HIDDEN_SHELVES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

const loadCachedShelves = (channelId: string): HomeShelf[] | undefined => {
  try {
    const raw = sessionStorage.getItem(`${SHELVES_CACHE_PREFIX}${channelId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return undefined;
};

const saveCachedShelves = (channelId: string, data: HomeShelf[]) => {
  try {
    sessionStorage.setItem(`${SHELVES_CACHE_PREFIX}${channelId}`, JSON.stringify(data));
  } catch {}
};

const QUICK_TILES = [
  { to: '/music/library/liked', label: 'Liked Songs', sub: 'Your favorites', icon: Heart, bg: 'from-rose-500/85 to-pink-700/90' },
  { to: '/music/radio', label: 'Radio', sub: 'Live stations', icon: Radio, bg: 'from-violet-500/85 to-purple-800/90' },
  { to: '/music/replay', label: 'Replay', sub: 'Your year in music', icon: History, bg: 'from-emerald-500/85 to-teal-800/90' },
  { to: '/music/library/playlists', label: 'Playlists', sub: 'Your mixes', icon: ListMusic, bg: 'from-sky-500/85 to-blue-800/90' },
  { to: '/music/new', label: 'New Releases', sub: 'Fresh drops', icon: Disc3, bg: 'from-amber-500/85 to-orange-800/90' },
] as const;

interface BrowseRouteProps {
  onOpenAccountModal?: () => void;
}

export const BrowseRoute: React.FC<BrowseRouteProps> = ({ onOpenAccountModal }) => {
  const navigate = useNavigate();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const recentlyPlayed = useMusicPlayerStore(state => state.recentlyPlayed);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const currentTime = useMusicPlayerStore(state => state.currentTime);
  const duration = useMusicPlayerStore(state => state.duration);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const activeChannelId = useSessionStore(state => state.activeChannelId);
  const activeChannel = useSessionStore(state => state.activeChannel);
  const cacheKey = activeChannelId || 'default';
  const [, setDurationTick] = React.useState(0);
  const [libTick, bumpLibTick] = React.useReducer((x: number) => x + 1, 0);
  const [hiddenShelves, setHiddenShelves] = React.useState<Set<string>>(loadHiddenShelves);
  const [customizing, setCustomizing] = React.useState(false);

  const toggleShelfVisibility = (id: string) => {
    setHiddenShelves(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(HIDDEN_SHELVES_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Re-render when the local music library changes (SC imports etc.)
  React.useEffect(() => {
    const handler = () => bumpLibTick();
    window.addEventListener('bitchord:library-updated', handler);
    return () => window.removeEventListener('bitchord:library-updated', handler);
  }, []);

  // SoundCloud imports for the "Your SoundCloud" shelf
  const scTracks = React.useMemo(
    () => getImportedSoundCloudTracks().slice(0, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [libTick],
  );

  // --- History-derived shelves: top artists, albums, "because you played" ---
  const topArtists = React.useMemo(() => {
    const map = new Map<string, { name: string; plays: number; artwork: string; track: MusicTrack }>();
    recentlyPlayed.forEach(t => {
      const key = `${t.artist}|${t.source === 'soundcloud' ? 'sc' : 'yt'}`;
      const cur = map.get(key);
      if (cur) { cur.plays++; if (!cur.artwork && t.artwork) cur.artwork = t.artwork; }
      else map.set(key, { name: t.artist, plays: 1, artwork: t.artwork, track: t });
    });
    return [...map.values()].sort((a, b) => b.plays - a.plays).slice(0, 12);
  }, [recentlyPlayed]);

  const topAlbums = React.useMemo(() => {
    const map = new Map<string, { title: string; artist: string; artwork: string; plays: number; track: MusicTrack }>();
    recentlyPlayed.forEach(t => {
      if (!t.album) return;
      const key = `${t.album}|${t.artist}`;
      const cur = map.get(key);
      if (cur) { cur.plays++; if (!cur.artwork && t.artwork) cur.artwork = t.artwork; }
      else map.set(key, { title: t.album, artist: t.artist, artwork: t.artwork, plays: 1, track: t });
    });
    return [...map.values()].sort((a, b) => b.plays - a.plays).slice(0, 12);
  }, [recentlyPlayed]);

  const openArtistFromHistory = (t: MusicTrack) => {
    if (t.soundcloudArtistId) { navigate(`/music/soundcloud/artist/${t.soundcloudArtistId}`); return; }
    if (t.artistId) { navigate(`/music/artist/${t.artistId}`); return; }
    void resolveArtistId(t).then(id => {
      if (id) navigate(`/music/artist/${id}`);
      else playTrack(t, recentlyPlayed);
    }).catch(() => playTrack(t, recentlyPlayed));
  };

  const openAlbumFromHistory = (t: MusicTrack) => {
    if (t.albumId) { navigate(`/music/album/${t.albumId}`); return; }
    void resolveAlbumId(t).then(id => {
      if (id) navigate(`/music/album/${id}`);
      else playTrack(t, recentlyPlayed);
    }).catch(() => playTrack(t, recentlyPlayed));
  };

  // "Because you played X" — radio seed from the most recent playable track
  const radioSeed = React.useMemo(
    () => recentlyPlayed.find(t => t.youtubeId && !t.isLive && !t.soundcloudUrl),
    [recentlyPlayed],
  );
  const { data: becauseYouPlayed } = useQuery({
    queryKey: ['music-because-you-played', radioSeed?.youtubeId],
    queryFn: () => getRadioTracks(radioSeed!.youtubeId!, 20),
    enabled: Boolean(radioSeed?.youtubeId),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const { data: shelves, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['ytm-home', cacheKey],
    queryFn: async () => {
      const data = await getHomeShelves();
      if (data && data.length > 0) {
        saveCachedShelves(cacheKey, data);
        // MusicTwoRowItem carries no duration — backfill in the background, then re-render + re-cache
        void resolveTrackDurations(
          data.flatMap(s => s.items.flatMap(i => (i.kind === 'track' ? [i.track] : [])))
        ).then(() => {
          saveCachedShelves(cacheKey, data);
          setDurationTick(t => t + 1);
        });
      }
      return data;
    },
    initialData: () => loadCachedShelves(cacheKey),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const toShelfItem = (item: HomeItem, siblings: MusicTrack[]): ShelfItem => {
    switch (item.kind) {
      case 'track':
        return {
          id: `t-${item.track.id}`,
          title: item.track.title,
          subtitle: item.track.artist,
          artwork: item.track.artwork,
          tracks: [item.track],
          onClick: () => playTrack(item.track, siblings.length ? siblings : [item.track]),
        };
      case 'album':
        return {
          id: `a-${item.album.id}`,
          title: item.album.title,
          subtitle: [item.album.genre, item.album.artist].filter(Boolean).join(' • '),
          artwork: item.album.artwork,
          onClick: () => navigate(`/music/album/${item.album.id}`),
        };
      case 'artist':
        return {
          id: `ar-${item.artist.id}`,
          title: item.artist.name,
          subtitle: item.artist.subtitle || 'Artist',
          artwork: item.artist.artwork,
          onClick: () => navigate(`/music/artist/${item.artist.id}`),
        };
      case 'playlist':
        return {
          id: `p-${item.playlist.id}`,
          title: item.playlist.title,
          subtitle: item.playlist.subtitle || 'Playlist',
          artwork: item.playlist.artwork,
          onClick: () => navigate(`/music/playlist/${item.playlist.id}`),
        };
    }
  };

  const visibleShelves = shelves?.filter(s => !hiddenShelves.has(s.id));

  // Identify the first track-heavy shelf (preferring "Quick picks") for the tall portrait carousel on mobile
  const featuredMobileShelfId = React.useMemo(() => {
    if (!visibleShelves) return undefined;
    const named = visibleShelves.find(s => /quick picks/i.test(s.title) && s.items.some(i => i.kind === 'track'));
    if (named) return named.id;
    const firstAllTracks = visibleShelves.find(s => {
      const tCount = s.items.filter(i => i.kind === 'track').length;
      return tCount === s.items.length && tCount >= 2;
    });
    return firstAllTracks?.id;
  }, [visibleShelves]);

  const renderShelf = (shelf: HomeShelf) => {
    const tracks = shelf.items.flatMap(i => (i.kind === 'track' ? [i.track] : []));
    const allTracks = tracks.length === shelf.items.length;
    const isFeaturedMobile = shelf.id === featuredMobileShelfId && tracks.length > 0;

    if (isFeaturedMobile) {
      const rows = tracks.slice(0, 8);
      return (
        <section key={shelf.id} className="space-y-3">
          <div className="flex items-center justify-between px-0.5 lg:px-1">
            <h3 className="text-[20px] sm:text-2xl font-bold lg:font-black text-white tracking-tight">
              {shelf.title}
            </h3>
            <button
              type="button"
              onClick={() => playTrack(tracks[0], tracks)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#ff5500] text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Play all"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          </div>

          {/* Mobile: Tall featured portrait cards matching Reference 1 */}
          <div className="lg:hidden flex gap-3.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory am-scrollbar">
            {tracks.slice(0, 12).map(t => (
              <button
                key={`mq-${t.id}`}
                type="button"
                onClick={() => playTrack(t, tracks)}
                className="w-[72vw] max-w-[288px] aspect-[4/4.4] rounded-2xl overflow-hidden relative shrink-0 snap-start border border-white/10 bg-[#141416] text-left cursor-pointer group active:scale-[0.99] transition-transform focus-visible:outline-2 focus-visible:outline-white"
              >
                <img
                  src={t.artwork || ARTWORK_PLACEHOLDER}
                  alt={t.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-[18px] font-bold text-white leading-tight truncate">
                    {t.title}
                  </p>
                  <p className="text-[14px] text-white/75 leading-snug truncate mt-0.5">
                    {t.artist}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop: 2-column TrackRow list */}
          <div className="hidden lg:grid lg:grid-cols-2 gap-x-6">
            {rows.map(t => (
              <TrackRow key={t.id} track={t} showAlbum={false} playlistContext={tracks} />
            ))}
          </div>
        </section>
      );
    }

    // Secondary track-only shelf: square horizontal carousel on mobile, 2-col TrackRow grid on desktop
    if (allTracks && tracks.length >= 4) {
      const rows = tracks.slice(0, 8);
      return (
        <section key={shelf.id} className="space-y-3">
          <div className="flex items-center justify-between px-0.5 lg:px-1">
            <h3 className="text-[20px] sm:text-2xl font-bold lg:font-black text-white tracking-tight">{shelf.title}</h3>
            <button
              type="button"
              onClick={() => playTrack(tracks[0], tracks)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#ff5500] text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Play all"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          </div>
          <div className="lg:hidden">
            <MediaShelf
              title=""
              items={tracks.slice(0, 12).map(t => ({
                id: `qt-${t.id}`,
                title: t.title,
                subtitle: t.artist,
                artwork: t.artwork,
                tracks: [t],
                onClick: () => playTrack(t, tracks),
              }))}
            />
          </div>
          <div className="hidden lg:grid lg:grid-cols-2 gap-x-6">
            {rows.map(t => (
              <TrackRow key={t.id} track={t} showAlbum={false} playlistContext={tracks} />
            ))}
          </div>
        </section>
      );
    }

    const siblings = tracks;
    return (
      <MediaShelf
        key={shelf.id}
        title={shelf.title}
        subtitle={shelf.subtitle}
        onPlayAll={tracks.length > 0 ? () => playTrack(tracks[0], tracks) : undefined}
        items={shelf.items.map(i => toShelfItem(i, siblings))}
      />
    );
  };

  return (
    <div
      className="relative space-y-6 lg:space-y-10 animate-fade-in pb-4 max-w-7xl mx-auto px-0.5 sm:px-4"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      {/* Dynamic Artwork Ambient Glow */}
      {currentTrack?.artwork && (
        <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
          <img
            src={currentTrack.artwork}
            alt=""
            className="w-full h-full object-cover opacity-[0.12] lg:opacity-[0.28] blur-[100px] scale-110"
            style={{
              maskImage:
                'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.5) 40%, transparent 85%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.5) 40%, transparent 85%)',
            }}
          />
        </div>
      )}

      <div className="relative">
        {/* Desktop Search Bar */}
        <div className="hidden lg:block">
          <GlobalSearchBar />
        </div>

        {/* Unified responsive H1 + desktop date subtitle & actions */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 lg:gap-4 relative mt-1">
          <div className="relative">
            <h1 className="text-[32px] lg:text-4xl font-extrabold text-white tracking-tight leading-none lg:leading-tight px-0.5 lg:px-0">
              <span className="lg:hidden">Listen Now</span>
              <span className="hidden lg:inline">
                {(() => {
                  const h = new Date().getHours();
                  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
                })()}
              </span>
            </h1>
            <p className="hidden lg:block text-xs text-[#b3b3b3] mt-1">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              {activeChannel ? ` • Picks for ${activeChannel.name}` : ' • Xainy Music'}
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {shelves && shelves.length > 1 && (
              <button
                type="button"
                onClick={() => setCustomizing(prev => !prev)}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  customizing ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Shelves
              </button>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Mobile quick search entry bar */}
          <button
            type="button"
            onClick={() => navigate('/music/search')}
            className="lg:hidden w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-[#161618] border border-white/[0.08] flex items-center gap-2.5 text-left text-[13.5px] text-[#98989d] hover:text-white active:scale-[0.99] transition-all cursor-pointer"
          >
            <Search className="w-4 h-4 text-[#8e8e93] shrink-0" />
            <span className="truncate">Artists, Songs, Lyrics, and More</span>
          </button>
        </div>

        {/* Shelf customization — show/hide home shelves */}
        {customizing && shelves && shelves.length > 0 && (
          <div className="hidden lg:flex mt-3 rounded-2xl bg-[#141414]/90 backdrop-blur border border-white/10 p-3 flex-wrap gap-2">
            {shelves.map(s => {
              const hidden = hiddenShelves.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleShelfVisibility(s.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                    hidden
                      ? 'bg-white/5 border-white/10 text-white/35'
                      : 'bg-white/10 border-white/20 text-white'
                  }`}
                >
                  {hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {s.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile Compact Sign-in Prompt Card matching Reference 1 */}
      {!activeChannel && (
        <div className="lg:hidden relative rounded-2xl bg-[#161618] border border-white/[0.08] px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-white leading-snug">
              Sign in to YouTube Music
            </p>
            <p className="text-[11.5px] text-[#98989d] leading-snug mt-0.5">
              Get personalized recommendations for you
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAccountModal}
            className="px-3.5 py-2 min-h-[38px] rounded-full bg-white text-black text-[13px] font-semibold shrink-0 hover:bg-white/90 active:scale-[0.97] transition-all cursor-pointer whitespace-nowrap"
          >
            Sign in
          </button>
        </div>
      )}

      {/* Resume / Now Playing hero */}
      {(() => {
        const hero = currentTrack || recentlyPlayed[0];
        if (!hero) return null;
        const isCurrent = Boolean(currentTrack);
        const progress = isCurrent && duration > 0 ? Math.min(1, currentTime / duration) : 0;
        return (
          <button
            type="button"
            onClick={() => {
              if (isCurrent) togglePlayPause();
              else playTrack(hero, recentlyPlayed.length ? recentlyPlayed : [hero]);
            }}
            className="relative w-full overflow-hidden rounded-2xl bg-[#141414] border border-white/10 text-left group cursor-pointer"
          >
            {hero.artwork && (
              <img
                src={hero.artwork}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover opacity-40 blur-2xl scale-125 pointer-events-none"
              />
            )}
            <div className="relative flex items-center gap-4 p-4 sm:p-5">
              <img
                src={hero.artwork || ARTWORK_PLACEHOLDER}
                alt={hero.title}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shadow-2xl shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ff8c5a]">
                  {isCurrent
                    ? playbackStatus === 'playing' ? 'Now playing' : playbackStatus === 'loading' ? 'Loading' : 'Paused'
                    : 'Jump back in'}
                </p>
                <h2 className="text-lg sm:text-xl font-bold text-white truncate mt-0.5">{hero.title}</h2>
                <p className="text-sm text-white/60 truncate">{hero.artist}</p>
                {isCurrent && duration > 0 && (
                  <div className="mt-2.5 h-1 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full bg-[#ff5500] rounded-full transition-[width] duration-300"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                )}
              </div>
              <span className="w-12 h-12 rounded-full bg-[#ff5500] hover:bg-[#ff6600] text-white flex items-center justify-center shrink-0 shadow-xl group-hover:scale-105 active:scale-95 transition-transform">
                {isCurrent && playbackStatus === 'playing' ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </span>
            </div>
          </button>
        );
      })()}

      {/* Quick access tiles — horizontal scroll on mobile, grid on desktop */}
      <div className="lg:hidden flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 am-scrollbar">
        {QUICK_TILES.map(({ to, label, sub, icon: Icon, bg }) => (
          <button
            key={to}
            type="button"
            onClick={() => navigate(to)}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bg} ring-1 ring-white/15 w-40 shrink-0 p-4 text-left shadow-lg active:scale-[0.98] transition-transform cursor-pointer`}
          >
            <Icon className="w-5 h-5 text-white/95 mb-6" />
            <p className="text-white font-bold text-sm leading-tight">{label}</p>
            <p className="text-white/75 text-[11px] mt-0.5">{sub}</p>
          </button>
        ))}
      </div>
      <div className="hidden lg:grid relative grid-cols-5 gap-3.5">
        {QUICK_TILES.map(({ to, label, sub, icon: Icon, bg }) => (
          <button
            key={to}
            type="button"
            onClick={() => navigate(to)}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bg} ring-1 ring-white/15 p-4 xl:p-5 text-left shadow-lg hover:scale-[1.02] active:scale-[0.99] transition-all cursor-pointer group`}
          >
            <Icon className="w-6 h-6 text-white/95 mb-7 group-hover:scale-110 transition-transform" />
            <p className="text-white font-bold text-sm xl:text-base leading-tight">{label}</p>
            <p className="text-white/75 text-xs mt-0.5 truncate">{sub}</p>
          </button>
        ))}
      </div>

      {/* SoundCloud shelf — imported tracks playable right here */}
      {scTracks.length > 0 && (
        <MediaShelf
          title="Your SoundCloud"
          subtitle="Imported tracks"
          onPlayAll={() => playTrack(scTracks[0], scTracks)}
          items={scTracks.map(t => ({
            id: `sc-${t.id}`,
            title: t.title,
            subtitle: t.artist,
            artwork: t.artwork,
            badge: 'SC',
            tracks: [t],
            onClick: () => playTrack(t, scTracks),
          }))}
        />
      )}

      {/* Because you played X — radio seed from your most recent track */}
      {radioSeed && becauseYouPlayed && becauseYouPlayed.length > 0 && (
        <MediaShelf
          title={`Because you played ${radioSeed.title}`}
          subtitle={radioSeed.artist}
          items={becauseYouPlayed.slice(0, 12).map(t => ({
            id: `byp-${t.id}`,
            title: t.title,
            subtitle: t.artist,
            artwork: t.artwork,
            badge: 'RADIO',
            tracks: [t],
            onClick: () => playTrack(t, becauseYouPlayed),
          }))}
        />
      )}

      {/* Recently played artists */}
      {topArtists.length > 0 && (
        <MediaShelf
          title="Your Artists"
          subtitle="From your listening history"
          items={topArtists.map(a => ({
            id: `artist-${a.name}`,
            title: a.name,
            subtitle: `${a.plays} play${a.plays === 1 ? '' : 's'}`,
            artwork: a.artwork || ARTWORK_PLACEHOLDER,
            aspectRatio: 'portrait' as const,
            onClick: () => openArtistFromHistory(a.track),
          }))}
        />
      )}

      {/* Recently played albums */}
      {topAlbums.length > 0 && (
        <MediaShelf
          title="Your Albums"
          subtitle="From your listening history"
          items={topAlbums.map(al => ({
            id: `album-${al.title}-${al.artist}`,
            title: al.title,
            subtitle: al.artist,
            artwork: al.artwork || ARTWORK_PLACEHOLDER,
            onClick: () => openAlbumFromHistory(al.track),
          }))}
        />
      )}

      {/* Desktop Jump Back In — resume recent listens instantly */}
      {recentlyPlayed.length > 0 && (
        <div className="hidden lg:block relative">
          <MediaShelf
            title="Jump Back In"
            subtitle="Recently played"
            items={recentlyPlayed.slice(0, 12).map(t => ({
              id: `recent-${t.id}`,
              title: t.title,
              subtitle: t.artist,
              artwork: t.artwork,
              tracks: [t],
              onClick: () => playTrack(t, recentlyPlayed),
            }))}
          />
        </div>
      )}

      {isLoading ? (
        <FeedSkeleton />
      ) : error || !shelves?.length ? (
        <div className="relative rounded-2xl bg-[#141414] border border-white/10 p-5 sm:p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-white/60 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-white font-semibold">Couldn't load the YouTube Music home feed</p>
            <p className="text-xs text-[#b3b3b3]">
              {(error as Error)?.message || 'YouTube returned no shelves.'} Make sure the Xainy Music extension is installed,
              allowed for this site, and you're signed in at music.youtube.com.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center min-h-[44px] lg:min-h-0 text-xs font-semibold text-white underline underline-offset-4 cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="relative space-y-7 lg:space-y-10">
          {(visibleShelves ?? []).map((shelf, i) => (
            <div
              key={shelf.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
            >
              {renderShelf(shelf)}
            </div>
          ))}
        </div>
      )}

      {/* Mobile Jump Back In at bottom when recentlyPlayed has history */}
      {recentlyPlayed.length > 0 && (
        <div className="lg:hidden relative">
          <MediaShelf
            title="Jump Back In"
            items={recentlyPlayed.slice(0, 12).map(t => ({
              id: `recent-m-${t.id}`,
              title: t.title,
              subtitle: t.artist,
              artwork: t.artwork,
              tracks: [t],
              onClick: () => playTrack(t, recentlyPlayed),
            }))}
          />
        </div>
      )}
    </div>
  );
};
