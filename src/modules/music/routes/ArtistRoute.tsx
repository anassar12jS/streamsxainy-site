import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, Shuffle, Disc, Heart, ArrowLeft, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getArtistDetails } from '../api/innertube';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { MusicTrack } from '../types';

export const ArtistRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);
  const likedTrackIds = useMusicPlayerStore(state => state.likedTrackIds);
  const toggleLike = useMusicPlayerStore(state => state.toggleLike);

  const { data: artist, isLoading, error } = useQuery({
    queryKey: ['music-artist', id],
    queryFn: () => getArtistDetails(id || ''),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const handlePlayAll = (shuffle = false) => {
    if (!artist?.topTracks || artist.topTracks.length === 0) return;
    let list = [...artist.topTracks];
    if (shuffle) {
      list.sort(() => Math.random() - 0.5);
    }
    playTrack(list[0], list);
  };

  const handleTrackClick = (track: MusicTrack) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      playTrack(track, artist?.topTracks || [track]);
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
      className="space-y-10 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
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
          <div className="h-64 sm:h-72 rounded-2xl bg-[#141414] p-8 flex items-end gap-6">
            <div className="w-36 h-36 rounded-full bg-[#1a1a1a] shrink-0" />
            <div className="space-y-3 w-full max-w-md">
              <div className="w-24 h-4 bg-[#1a1a1a] rounded-full" />
              <div className="w-2/3 h-8 bg-[#1a1a1a] rounded-lg" />
              <div className="w-1/3 h-4 bg-[#1a1a1a] rounded-md" />
            </div>
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-[#141414] rounded-xl" />
            ))}
          </div>
        </div>
      ) : artist ? (
        <>
          {/* ========================================================================= */}
          {/* 1. ARTIST HERO LOCKUP                                                     */}
          {/* ========================================================================= */}
          <div className="relative rounded-2xl overflow-hidden p-6 sm:p-10 border border-white/10 bg-[#121212] shadow-2xl flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
            {/* Ambient Blurred backdrop */}
            <div 
              className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 scale-125 pointer-events-none"
              style={{ backgroundImage: `url(${artist.avatar})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/80 to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-center gap-6 text-center sm:text-left">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden shadow-2xl ring-4 ring-white/10 shrink-0 bg-[#1a1a1a]">
                <img 
                  src={artist.avatar} 
                  alt={artist.name} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
                  }}
                  className="w-full h-full object-cover" 
                />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                  Artist Profile
                </span>
                <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                  {artist.name}
                </h1>
                <p className="text-xs sm:text-sm text-[#b3b3b3] font-normal">
                  {artist.monthlyListeners || 'Verified Artist'}
                </p>
              </div>
            </div>

            {/* Play & Shuffle Buttons */}
            <div className="relative z-10 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handlePlayAll(false)}
                className="px-6 py-2.5 rounded-full bg-white hover:bg-white/90 text-black font-semibold text-xs shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Play</span>
              </button>
              <button
                type="button"
                onClick={() => handlePlayAll(true)}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. TOP SONGS TABLE                                                        */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Top Songs
            </h2>

            <div className="space-y-1">
              {artist.topTracks.map((track, idx) => {
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
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="w-5 text-center text-xs text-[#b3b3b3] font-medium group-hover:hidden">
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        className="w-5 h-5 items-center justify-center hidden group-hover:flex text-white"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>

                      <img 
                        src={track.artwork || artist.avatar} 
                        alt="" 
                        className="w-10 h-10 rounded-lg object-cover bg-[#1a1a1a] shrink-0" 
                      />

                      <div className="min-w-0 flex-1">
                        <span className={`text-sm font-semibold truncate block ${
                          isCurrent ? 'text-rose-400' : 'text-white'
                        }`}>
                          {track.title}
                        </span>
                        {track.album && (
                          <span className="text-xs text-[#b3b3b3] truncate block mt-0.5">
                            {track.albumId ? (
                              <Link
                                to={`/music/album/${track.albumId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-white hover:underline"
                              >
                                {track.album}
                              </Link>
                            ) : (
                              <span>{track.album}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-xs text-[#b3b3b3]">
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
          </div>

          {/* ========================================================================= */}
          {/* 3. ALBUMS & DISCOGRAPHY SHELF                                             */}
          {/* ========================================================================= */}
          {artist.albums && artist.albums.length > 0 && (
            <div className="space-y-4 pt-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Albums & Discography
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {artist.albums.map((alb) => (
                  <Link
                    key={alb.id}
                    to={`/music/album/${alb.id}`}
                    className="group block p-3 rounded-2xl bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 cursor-pointer transition-colors duration-150 shadow-md"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-[#1e1e1e]">
                      <img 
                        src={alb.artwork || artist.avatar} 
                        alt={alb.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>

                    <h4 className="font-semibold text-xs sm:text-sm text-white truncate group-hover:underline">
                      {alb.title}
                    </h4>
                    <p className="text-[11px] text-[#b3b3b3] truncate mt-0.5">
                      {alb.year || 'Album'}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="py-20 text-center text-white/50">
          <Disc className="w-10 h-10 mx-auto mb-2 text-white/30" />
          <p className="text-base font-semibold text-white">Artist Not Found</p>
          <p className="text-xs text-[#b3b3b3] mt-1">
            {error ? (error as Error).message : `Unable to locate artist profile for "${id}".`}
          </p>
        </div>
      )}

    </div>
  );
};
export default ArtistRoute;
