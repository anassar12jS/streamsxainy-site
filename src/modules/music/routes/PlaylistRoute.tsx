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
    staleTime: 1000 * 60 * 5,
    retry: 1,
    refetchOnWindowFocus: true,
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
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 space-y-3 flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                Playlist
              </span>

              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {playlist.title}
              </h1>

              {playlist.subtitle && (
                <p className="text-sm text-[#b3b3b3] max-w-xl font-normal">
                  {playlist.subtitle}
                </p>
              )}

              <p className="text-xs text-[#b3b3b3]">
                Curated by <span className="font-semibold text-white/90">{playlist.curator || 'YouTube Music'}</span> • {tracks.length} Songs
              </p>

              {/* Action Buttons: Play & Shuffle */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handlePlayAll(false)}
                  disabled={tracks.length === 0}
                  className="px-6 py-2.5 rounded-full bg-white hover:bg-white/90 disabled:opacity-40 text-black font-semibold text-xs shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePlayAll(true)}
                  disabled={tracks.length === 0}
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-2 border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Tracklist Table */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3.5 py-2 text-[11px] font-semibold text-[#b3b3b3] uppercase tracking-wider border-b border-white/10 mb-2">
              <span># Title</span>
              <span className="hidden md:inline">Album</span>
              <span>Time</span>
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
