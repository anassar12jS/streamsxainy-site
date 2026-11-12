import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Shuffle, Heart, Music2, Share2, Sparkles, ArrowLeft, Disc, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { TrackRow } from '../components/TrackRow';
import { getPlaylistDetails } from '../api/innertube';
import { MusicTrack, Playlist } from '../types';

export const PlaylistRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const playTrack = useMusicPlayerStore(state => state.playTrack);

  const { data: playlist, isLoading, error } = useQuery<Playlist | null>({
    queryKey: ['music-playlist', id],
    queryFn: () => getPlaylistDetails(id || ''),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const tracks: MusicTrack[] = playlist?.tracks || [];

  const handlePlayAll = (shuffle = false) => {
    if (tracks.length === 0) return;
    let list = [...tracks];
    if (shuffle) list.sort(() => Math.random() - 0.5);
    playTrack(list[0], list);
  };

  return (
    <div 
      className="space-y-8 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      {/* Back button */}
      <Link 
        to="/music" 
        className="inline-flex items-center gap-1.5 text-xs text-[#b3b3b3] hover:text-white transition-colors pt-1 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Music Home</span>
      </Link>

      {/* SKELETON LOADER */}
      {isLoading ? (
        <div className="space-y-8 animate-pulse">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-2 pb-8 border-b border-white/10">
            <div className="w-48 h-48 sm:w-56 sm:h-56 lg:w-60 lg:h-60 rounded-xl bg-[#1a1a1a] shrink-0" />
            <div className="space-y-3 w-full max-w-lg">
              <div className="w-24 h-4 bg-[#1a1a1a] rounded-full" />
              <div className="w-3/4 h-8 bg-[#1a1a1a] rounded-lg" />
              <div className="w-1/2 h-5 bg-[#1a1a1a] rounded-md" />
              <div className="flex gap-3 pt-2">
                <div className="w-24 h-10 bg-[#1a1a1a] rounded-full" />
                <div className="w-24 h-10 bg-[#1a1a1a] rounded-full" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-[#141414] rounded-xl" />
            ))}
          </div>
        </div>
      ) : playlist ? (
        <>
          {/* 1. Playlist Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-2 pb-8 border-b border-white/10">
            {/* Large 1:1 Artwork */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-60 lg:h-60 rounded-xl overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.8)] border border-white/10 shrink-0 bg-[#121212]">
              <img 
                src={playlist.artwork} 
                alt={playlist.title} 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80';
                }}
                className="w-full h-full object-cover" 
              />
            </div>

            {/* Metadata & Actions */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 space-y-2 flex-1">
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                {playlist.title}
              </h1>

              <p className="text-xs text-[#98989d] font-normal">
                Playlist • {new Date().getFullYear()} • {playlist.curator || 'Curated'} • {tracks.length} tracks • {Math.round(tracks.reduce((acc, t) => acc + (t.duration || 180), 0) / 60)} minutes
              </p>

              {/* Action Buttons: Shuffle (Circle), Play (Pill), + (Circle) */}
              <div className="flex items-center gap-3 pt-3">
                {/* Shuffle Button (Circle) */}
                <button
                  type="button"
                  onClick={() => handlePlayAll(true)}
                  disabled={tracks.length === 0}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer border border-white/10"
                  title="Shuffle playlist"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                {/* Play Button (Pill) */}
                <button
                  type="button"
                  onClick={() => handlePlayAll(false)}
                  disabled={tracks.length === 0}
                  className="px-8 py-2.5 rounded-full bg-white hover:bg-white/95 disabled:opacity-40 text-black font-semibold text-sm shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play</span>
                </button>

                {/* Add to Library Button (Circle) */}
                <button
                  type="button"
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer border border-white/10"
                  title="Add to Library"
                >
                  <span className="text-lg font-light leading-none">+</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Tracklist Table */}
          <div className="space-y-0.5">
            {/* Table Column Headers matching screenshot */}
            <div className="grid grid-cols-12 px-3 sm:px-4 py-2 text-[12px] font-semibold text-[#98989d] border-b border-white/[0.08] mb-1 select-none">
              <div className="col-span-12 sm:col-span-6 md:col-span-5 text-left">Song</div>
              <div className="hidden sm:block sm:col-span-3 md:col-span-3 text-left">Artist</div>
              <div className="hidden md:block md:col-span-3 text-left">Album</div>
              <div className="hidden sm:block sm:col-span-3 md:col-span-1 text-right">Time</div>
            </div>

            {tracks.length > 0 ? (
              tracks.map((track, idx) => (
                <TrackRow
                  key={`${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  showArtwork={true}
                  playlistContext={tracks}
                />
              ))
            ) : (
              <div className="py-12 text-center text-sm text-[#777]">
                No tracks found in this playlist.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-20 text-center text-white/50">
          <Disc className="w-10 h-10 mx-auto mb-2 text-white/30" />
          <p className="text-base font-semibold text-white">Playlist Not Found</p>
          <p className="text-xs text-[#b3b3b3] mt-1">
            {error ? (error as Error).message : `Unable to locate playlist "${id}".`}
          </p>
        </div>
      )}
    </div>
  );
};

export default PlaylistRoute;
