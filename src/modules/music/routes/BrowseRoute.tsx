import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { useSessionStore } from '../store/useSessionStore';
import { getHomeShelves } from '../api/innertube';
import { GlobalSearchBar } from '../components/GlobalSearchBar';
import { MediaShelf, ShelfItem } from '../components/MediaShelf';
import { TrackRow } from '../components/TrackRow';
import type { HomeItem, HomeShelf } from '../api/ytmParse';
import type { MusicTrack } from '../types';

/** Home: live YouTube Music home feed (personalised when a session is connected). */
export const BrowseRoute: React.FC = () => {
  const navigate = useNavigate();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const activeChannelId = useSessionStore(state => state.activeChannelId);
  const activeChannel = useSessionStore(state => state.activeChannel);

  const { data: shelves, isLoading, isFetching, error, refetch } = useQuery({
    // keyed by channel so switching account shows that account's feed
    queryKey: ['ytm-home', activeChannelId || 'default'],
    queryFn: getHomeShelves,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
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
      className="space-y-10 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <GlobalSearchBar />

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Home</h1>
          <p className="text-xs text-[#b3b3b3] mt-1">
            {activeChannel ? `Picks for ${activeChannel.name}` : 'YouTube Music home'}
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

      {isLoading ? (
        <div className="flex items-center gap-3 text-[#b3b3b3] text-sm py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading your home feed…
        </div>
      ) : error || !shelves?.length ? (
        <div className="rounded-2xl bg-[#141414] border border-white/10 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-white font-semibold">Couldn't load the YouTube Music home feed</p>
            <p className="text-xs text-[#b3b3b3]">
              {(error as Error)?.message || 'YouTube returned no shelves.'} Make sure the BitChord extension is installed,
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
        <div className="space-y-10">{shelves.map(renderShelf)}</div>
      )}
    </div>
  );
};
