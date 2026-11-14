import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, Shuffle, ArrowLeft, Disc, Loader2, AlertTriangle, Music2 } from 'lucide-react';
import {
  getSpotifyAuthState,
  getSpotifyPlaylistInfo,
  getAllSpotifyPlaylistTracks,
  spotifyToMusicTrack,
} from '../data/spotify';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { TrackRow } from '../components/TrackRow';
import { MusicTrack } from '../types';
import { ARTWORK_PLACEHOLDER } from '../api/ytmParse';

const FALLBACK_ART = ARTWORK_PLACEHOLDER;

export const SpotifyPlaylistRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);

  const authQuery = useQuery({
    queryKey: ['spotify-auth'],
    queryFn: getSpotifyAuthState,
    enabled: extensionConnected,
    staleTime: 1000 * 30,
    retry: 1,
  });

  const infoQuery = useQuery({
    queryKey: ['spotify-playlist-info', id],
    queryFn: () => getSpotifyPlaylistInfo(id || ''),
    enabled: Boolean(id) && authQuery.data?.authenticated === true,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  const tracksQuery = useQuery({
    queryKey: ['spotify-playlist-tracks', id],
    queryFn: async () => {
      const raw = await getAllSpotifyPlaylistTracks(id || '');
      return raw.map(spotifyToMusicTrack);
    },
    enabled: Boolean(id) && authQuery.data?.authenticated === true,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  const tracks: MusicTrack[] = tracksQuery.data || [];
  const info = infoQuery.data;
  const title = info?.name || (id === 'liked' ? 'Liked Songs' : 'Spotify Playlist');
  const artwork = info?.imageUrl || FALLBACK_ART;
  const owner = info?.owner || 'Spotify';
  const totalCount = info?.total ?? tracks.length;

  const handlePlayAll = (shuffle = false) => {
    if (tracks.length === 0) return;
    const list = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
    playTrack(list[0], list);
  };

  const isLoading = authQuery.isLoading || (authQuery.data?.authenticated && (infoQuery.isLoading || tracksQuery.isLoading));

  return (
    <div className="space-y-8 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4">
      <Link
        to="/music/spotify"
        className="inline-flex items-center gap-1.5 text-xs text-[#b3b3b3] hover:text-white transition-colors pt-1 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Spotify Playlists</span>
      </Link>

      {isLoading ? (
        <div className="space-y-8 animate-pulse">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-2 pb-8 border-b border-white/10">
            <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl bg-[#1a1a1a] shrink-0" />
            <div className="space-y-3 w-full max-w-lg">
              <div className="w-24 h-4 bg-[#1a1a1a] rounded-full" />
              <div className="w-3/4 h-8 bg-[#1a1a1a] rounded-lg" />
              <div className="w-1/2 h-5 bg-[#1a1a1a] rounded-md" />
            </div>
          </div>
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-[#141414] rounded-xl" />
            ))}
          </div>
        </div>
      ) : !extensionConnected || authQuery.data?.authenticated !== true ? (
        <div className="py-20 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400/70" />
          <p className="text-base font-semibold text-white">
            {!extensionConnected ? 'Extension required' : 'Spotify not connected'}
          </p>
          <p className="text-xs text-[#b3b3b3] mt-1">
            {!extensionConnected
              ? 'Install the Xainy Music companion extension to load Spotify playlists.'
              : 'Head to Spotify Playlists and sign in first.'}
          </p>
          <Link
            to="/music/spotify"
            className="inline-block mt-4 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            Go to Spotify Playlists →
          </Link>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-2 pb-8 border-b border-white/10">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-xl overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.8)] border border-white/10 shrink-0 bg-[#121212]">
              {id === 'liked' ? (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-900 flex items-center justify-center">
                  <Music2 className="w-20 h-20 text-white/80" />
                </div>
              ) : (
                <img
                  src={artwork}
                  alt={title}
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_ART; }}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 space-y-2 flex-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                Spotify Playlist
              </span>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                {title}
              </h1>
              <p className="text-xs text-[#98989d] font-normal">
                Playlist • {owner} • {totalCount} songs
                {tracksQuery.data ? ` • ${tracks.length} loaded` : ''}
              </p>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => handlePlayAll(true)}
                  disabled={tracks.length === 0}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer border border-white/10"
                  title="Shuffle playlist"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handlePlayAll(false)}
                  disabled={tracks.length === 0}
                  className="px-8 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold text-sm shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tracklist */}
          {tracksQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-sm text-[#b3b3b3]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading tracks…</span>
            </div>
          ) : tracks.length > 0 ? (
            <div className="space-y-0.5">
              <div className="grid grid-cols-12 px-3 sm:px-4 py-2 text-[12px] font-semibold text-[#98989d] border-b border-white/[0.08] mb-1 select-none">
                <div className="col-span-12 sm:col-span-6 md:col-span-5 text-left">Song</div>
                <div className="hidden sm:block sm:col-span-3 md:col-span-3 text-left">Artist</div>
                <div className="hidden md:block md:col-span-3 text-left">Album</div>
                <div className="hidden sm:block sm:col-span-3 md:col-span-1 text-right">Time</div>
              </div>
              {tracks.map((track, idx) => (
                <TrackRow
                  key={`${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  showArtwork={true}
                  playlistContext={tracks}
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Disc className="w-10 h-10 mx-auto mb-2 text-white/30" />
              <p className="text-base font-semibold text-white">No tracks found</p>
              <p className="text-xs text-[#b3b3b3] mt-1">This playlist might be empty or still syncing from Spotify.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SpotifyPlaylistRoute;
