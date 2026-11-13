import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Loader2, AlertCircle, Heart, Radio, History, ListMusic } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { useSessionStore } from '../store/useSessionStore';
import { getHomeShelves, resolveTrackDurations } from '../api/innertube';
import { GlobalSearchBar } from '../components/GlobalSearchBar';
import { MediaShelf, ShelfItem } from '../components/MediaShelf';
import { TrackRow } from '../components/TrackRow';
import type { HomeItem, HomeShelf } from '../api/ytmParse';
import type { MusicTrack } from '../types';

/** Home: live YouTube Music home feed (personalised when a session is connected). */
const SHELVES_CACHE_PREFIX = 'ytm_home_shelves_v4_'; // v4: duration backfill via getBasicInfo — v3 caches hold duration:0

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

export const BrowseRoute: React.FC = () => {
  const navigate = useNavigate();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const recentlyPlayed = useMusicPlayerStore(state => state.recentlyPlayed);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const activeChannelId = useSessionStore(state => state.activeChannelId);
  const activeChannel = useSessionStore(state => state.activeChannel);
  const cacheKey = activeChannelId || 'default';
  const [, setDurationTick] = React.useState(0);

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

  const renderShelf = (shelf: HomeShelf) => {
    const tracks = shelf.items.flatMap(i => (i.kind === 'track' ? [i.track] : []));
    const allTracks = tracks.length === shelf.items.length;

    // A shelf made only of songs reads best as a list ("Quick picks", "Listen again")
    if (allTracks && tracks.length >= 4) {
      const rows = tracks.slice(0, 8);
      return (
        <section key={shelf.id} className="space-y-3">
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight px-1">{shelf.title}</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
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
        items={shelf.items.map(i => toShelfItem(i, siblings))}
      />
    );
  };

  return (
    <div
      className="relative space-y-10 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4 overflow-x-hidden"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      {/* Ambient tint: now-playing artwork washed over the whole page, feathered on all edges */}
      {currentTrack?.artwork && (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          aria-hidden="true"
        >
          <img
            src={currentTrack.artwork}
            alt=""
            className="w-full h-full object-cover opacity-[0.38] blur-[120px] scale-110"
            style={{
              maskImage:
                'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.28) 65%, transparent 90%), linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.28) 65%, transparent 90%), linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            } as React.CSSProperties}
          />
        </div>
      )}

      <div className="relative">
        <GlobalSearchBar />

        <div className="flex items-end justify-between gap-4 relative mt-1">
        <div className="relative">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {(() => {
              const h = new Date().getHours();
              return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
            })()}
          </h1>
          <p className="text-xs text-[#b3b3b3] mt-1">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {activeChannel ? ` • Picks for ${activeChannel.name}` : ' • YouTube Music home'}
          </p>
        </div>
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
      </div>

      {/* Quick access tiles */}
      <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {([
          { to: '/music/library/liked', label: 'Liked Songs', sub: 'Your favorites', icon: Heart, bg: 'from-rose-500/80 to-pink-700/80' },
          { to: '/music/radio', label: 'Radio', sub: 'Live stations', icon: Radio, bg: 'from-violet-500/80 to-purple-800/80' },
          { to: '/music/replay', label: 'Replay', sub: 'Your year in music', icon: History, bg: 'from-emerald-500/80 to-teal-800/80' },
          { to: '/music/library/playlists', label: 'Playlists', sub: 'Your mixes', icon: ListMusic, bg: 'from-sky-500/80 to-blue-800/80' },
        ] as const).map(({ to, label, sub, icon: Icon, bg }) => (
          <button
            key={to}
            type="button"
            onClick={() => navigate(to)}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bg} p-4 sm:p-5 text-left shadow-lg hover:scale-[1.02] active:scale-[0.99] transition-transform cursor-pointer group`}
          >
            <Icon className="w-6 h-6 text-white/90 mb-6 sm:mb-8 group-hover:scale-110 transition-transform" />
            <p className="text-white font-bold text-sm sm:text-base leading-tight">{label}</p>
            <p className="text-white/70 text-[11px] sm:text-xs mt-0.5">{sub}</p>
          </button>
        ))}
      </div>

      {/* Jump Back In — resume recent listens instantly */}
      {recentlyPlayed.length > 0 && (
        <div className="relative">
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
        <div className="relative flex items-center gap-3 text-[#b3b3b3] text-sm py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading your home feed…
        </div>
      ) : error || !shelves?.length ? (
        <div className="relative rounded-2xl bg-[#141414] border border-white/10 p-6 flex items-start gap-3">
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
              className="text-xs font-semibold text-white underline underline-offset-4 cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="relative space-y-10">
          {shelves.map((shelf, i) => (
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
    </div>
  );
};
