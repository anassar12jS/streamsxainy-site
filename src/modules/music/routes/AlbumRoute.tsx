import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Shuffle, Disc, Clock, Heart, MoreHorizontal, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAlbumDetails } from '../api/innertube';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { MusicTrack } from '../types';

export const AlbumRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const likedTrackIds = useMusicPlayerStore(state => state.likedTrackIds);
  const toggleLike = useMusicPlayerStore(state => state.toggleLike);

  const { data: album, isLoading, error, refetch } = useQuery({
    queryKey: ['music-album', id],
    queryFn: () => getAlbumDetails(id || ''),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handlePlayAll = (shuffle = false) => {
    if (!album?.tracks || album.tracks.length === 0) return;
    let list = [...album.tracks];
    if (shuffle) {
      list.sort(() => Math.random() - 0.5);
    }
    playTrack(list[0], list);
  };

  const handleTrackClick = (track: MusicTrack) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      playTrack(track, album?.tracks || [track]);
    }
  };

  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-2 pb-6 border-b border-white/10">
            <div className="w-48 h-48 sm:w-56 sm:h-56 lg:w-60 lg:h-60 rounded-xl bg-[#1a1a1a] shrink-0" />
            <div className="space-y-3 w-full max-w-lg">
              <div className="w-20 h-4 bg-[#1a1a1a] rounded-full" />
              <div className="w-3/4 h-8 bg-[#1a1a1a] rounded-lg" />
              <div className="w-1/2 h-5 bg-[#1a1a1a] rounded-md" />
              <div className="w-1/3 h-4 bg-[#1a1a1a] rounded-md" />
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
      ) : album ? (
        <>
          {/* ========================================================================= */}
          {/* 1. ALBUM HEADER LOCKUP                                                    */}
          {/* ========================================================================= */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-2 pb-8 border-b border-white/10">
            
            {/* Aspect Square, Rounded 8px Album Cover */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-60 lg:h-60 rounded-[8px] overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.8)] border border-white/10 shrink-0 bg-[#121212]">
              <img 
                src={album.artwork} 
                alt={album.title} 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80';
                }}
                className="w-full h-full object-cover" 
              />
            </div>

            {/* Metadata & Actions */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 space-y-2 flex-1">
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                {album.title}
              </h1>

              {/* Artist link underneath title */}
              <p className="text-base sm:text-lg">
                {album.artistId ? (
                  <Link 
                    to={`/music/artist/${album.artistId}`}
                    className="font-semibold text-white/90 hover:text-white hover:underline transition-colors"
                  >
                    {album.artist}
                  </Link>
                ) : (
                  <span className="font-semibold text-white/90">{album.artist}</span>
                )}
              </p>

              <p className="text-xs text-[#98989d] font-normal">
                Album • {album.genre ? `${album.genre} • ` : ''}{album.year ? `${album.year} • ` : ''}{album.tracks.length} Songs
              </p>

              {/* Action Buttons: Shuffle (Circle), Play (Pill), + (Circle) */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => handlePlayAll(true)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer border border-white/10"
                  title="Shuffle album"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handlePlayAll(false)}
                  className="px-8 py-2.5 rounded-full bg-white hover:bg-white/95 text-black font-semibold text-sm shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play</span>
                </button>

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

          {/* ========================================================================= */}
          {/* 2. TRACKLIST TABLE                                                        */}
          {/* ========================================================================= */}
          <div className="space-y-0.5">
            <div className="grid grid-cols-12 px-3 sm:px-4 py-2 text-[12px] font-semibold text-[#98989d] border-b border-white/[0.08] mb-1 select-none">
              <div className="col-span-12 sm:col-span-6 md:col-span-5 text-left">Song</div>
              <div className="hidden sm:block sm:col-span-3 md:col-span-3 text-left">Artist</div>
              <div className="hidden md:block md:col-span-3 text-left">Album</div>
              <div className="hidden sm:block sm:col-span-3 md:col-span-1 text-right">Time</div>
            </div>

            {album.tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const isPlaying = isCurrent && playbackStatus === 'playing';
              const isLiked = likedTrackIds.includes(track.id);

              return (
                <div
                  key={track.id || idx}
                  onClick={() => handleTrackClick(track)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors duration-150 cursor-pointer select-none ${
                    isCurrent
                      ? 'bg-[rgba(255,255,255,0.08)] text-white'
                      : 'hover:bg-[#1a1a1a] text-white/90'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="w-6 text-center text-xs text-[#b3b3b3] font-medium group-hover:hidden">
                      {idx + 1}
                    </span>
                    <button
                      type="button"
                      className="w-6 h-6 items-center justify-center hidden group-hover:flex text-white"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <span className={`text-sm font-semibold truncate block ${
                        isCurrent ? 'text-white font-bold' : 'text-white/90'
                      }`}>
                        {track.title}
                      </span>
                      <span className="md:hidden text-xs text-[#b3b3b3] truncate block mt-0.5">
                        {track.artistId ? (
                          <Link
                            to={`/music/artist/${track.artistId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-white hover:underline"
                          >
                            {track.artist}
                          </Link>
                        ) : (
                          <span>{track.artist}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-xs text-[#b3b3b3]">
                    <span className="hidden md:inline min-w-[120px] truncate text-right">
                      {track.artistId ? (
                        <Link
                          to={`/music/artist/${track.artistId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-white hover:underline"
                        >
                          {track.artist}
                        </Link>
                      ) : (
                        <span>{track.artist}</span>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track.id);
                      }}
                      className={`p-1 transition-colors ${
                        isLiked ? 'text-amber-400' : 'text-white/30 hover:text-white opacity-0 group-hover:opacity-100'
                      }`}
                      title={isLiked ? 'Liked' : 'Like'}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                    </button>

                    <span className="w-10 text-right font-mono text-[11px]">
                      {formatDuration(track.duration)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Release info footer */}
          <div className="pt-6 text-xs text-[#b3b3b3] space-y-1">
            {album.year && <p>© {album.year}</p>}
          </div>
        </>
      ) : (
        <div className="py-20 text-center text-white/50">
          <Disc className="w-10 h-10 mx-auto mb-2 text-white/30" />
          <p className="text-base font-semibold text-white">Album Not Found</p>
          <p className="text-xs text-[#b3b3b3] mt-1">
            {error ? (error as Error).message : `Unable to locate album data for ID "${id}".`}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 text-xs font-semibold text-white underline underline-offset-4 cursor-pointer hover:text-white/80"
          >
            Try again
          </button>
        </div>
      )}

    </div>
  );
};
export default AlbumRoute;
