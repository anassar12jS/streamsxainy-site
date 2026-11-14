import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, ChevronLeft, ChevronRight, Sparkles, Video, Disc, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { getExploreNewReleases } from '../api/innertube';
import { MusicTrack, Album } from '../types';
import { CardGridSkeleton, TrackListSkeleton } from '../components/Skeletons';
import { ARTWORK_PLACEHOLDER } from '../api/ytmParse';

export const NewRoute: React.FC = () => {
  const navigate = useNavigate();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);

  const albumsScrollRef = useRef<HTMLDivElement | null>(null);
  const videosScrollRef = useRef<HTMLDivElement | null>(null);

  const { data: explore, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['music-explore-new'],
    queryFn: () => getExploreNewReleases(),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const albums: Album[] = explore?.newAlbums || [];
  const videos: MusicTrack[] = explore?.trendingVideos || [];

  const scrollShelf = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (!ref.current) return;
    const distance = 460;
    ref.current.scrollBy({
      left: direction === 'right' ? distance : -distance,
      behavior: 'smooth',
    });
  };

  const handlePlayVideoAsTrack = (video: MusicTrack) => {
    playTrack(video);
  };

  const featured: Album | undefined = albums[0];

  // No invented "featured" release: show loading / the real error / an honest empty state.
  if (!featured) {
    return (
      <div className="space-y-6 pb-32 pt-2 px-1 sm:px-4 max-w-7xl mx-auto text-white" style={{ fontFamily: 'var(--bitchord-font)' }}>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">New</h1>
        {isLoading ? (
          <div className="space-y-8">
            <CardGridSkeleton count={6} cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" />
            <TrackListSkeleton rows={6} />
          </div>
        ) : (
          <div className="rounded-2xl bg-[#141414] border border-white/10 p-6 space-y-2">
            <p className="text-sm font-semibold">Couldn't load new releases</p>
            <p className="text-xs text-[#b3b3b3]">
              {error ? (error as Error).message : 'YouTube Music returned no new releases.'}
            </p>
            <button type="button" onClick={() => refetch()} disabled={isFetching} className="text-xs font-semibold underline underline-offset-4 cursor-pointer">
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className="space-y-10 animate-fade-in pb-32 pt-2 px-1 sm:px-4 max-w-7xl mx-auto text-white"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            New
          </h1>
          <p className="text-sm text-[#b3b3b3] mt-1 font-normal">
            Latest releases, trending singles, and music videos directly from YouTube Music.
          </p>
        </div>
      </div>

      {/* 2. Hero Release Spotlight */}
      <div className="relative rounded-2xl overflow-hidden p-6 sm:p-10 border border-white/10 bg-[#121212] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div 
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-25 scale-125 pointer-events-none"
          style={{ backgroundImage: `url(${featured.artwork})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#121212] via-[#121212]/90 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 shrink-0 bg-[#1e1e1e]">
            <img 
              src={featured.artwork} 
              alt={featured.title} 
              onError={(e) => {
                (e.target as HTMLImageElement).src = ARTWORK_PLACEHOLDER;
              }}
              className="w-full h-full object-cover" 
            />
          </div>

          <div className="space-y-2 max-w-lg">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/90 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-white" /> Featured New Album
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {featured.title}
            </h2>
            <p className="text-sm text-white/90 font-medium">
              {featured.artist} • {featured.genre || 'New Release'} {featured.year ? ` (${featured.year})` : ''}
            </p>
            <p className="text-xs text-[#a3a3a3] leading-relaxed pt-1">
              Fresh from YouTube Music's new releases.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate(`/music/album/${featured.id}`)}
                className="px-6 py-2.5 rounded-full bg-white hover:bg-white/90 text-black font-semibold text-xs shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>View Album & Tracks</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. New Albums & EPs Shelf */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Disc className="w-5 h-5 text-white/80" />
              <span>New Releases & Albums</span>
            </h3>
            <p className="text-xs text-[#a3a3a3] mt-0.5">
              Fresh albums and EPs on YouTube Music
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollShelf(albumsScrollRef, 'left')}
              className="p-1.5 rounded-full bg-[#1a1a1a] hover:bg-[#252525] text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollShelf(albumsScrollRef, 'right')}
              className="p-1.5 rounded-full bg-[#1a1a1a] hover:bg-[#252525] text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-square bg-[#1a1a1a] rounded-xl" />
                <div className="h-4 bg-[#1a1a1a] rounded w-3/4" />
                <div className="h-3 bg-[#1a1a1a] rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div 
            ref={albumsScrollRef}
            className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2"
          >
            {albums.map((album) => (
              <div
                key={album.id}
                onClick={() => navigate(`/music/album/${album.id}`)}
                className="w-40 sm:w-44 shrink-0 group p-2.5 rounded-[10px] bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 cursor-pointer transition-colors shadow-md select-none text-left"
              >
                <div className="relative aspect-square rounded-[8px] overflow-hidden mb-2 bg-[#1e1e1e] border border-white/5">
                  <img 
                    src={album.artwork} 
                    alt={album.title} 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = ARTWORK_PLACEHOLDER;
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <h4 className="font-semibold text-xs sm:text-sm text-white truncate text-left group-hover:underline">
                  {album.title}
                </h4>
                <p className="text-[11px] text-[#98989d] truncate mt-0.5 text-left font-normal">
                  {album.artist}
                </p>
                <span className="text-[10px] text-[#666666] block mt-0.5 text-left">
                  {album.year || 'Album'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Trending Music Videos Shelf */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-400" />
              <span>Trending Music Videos</span>
            </h3>
            <p className="text-xs text-[#a3a3a3] mt-0.5">
              Popular music videos and audio premieres
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollShelf(videosScrollRef, 'left')}
              className="p-1.5 rounded-full bg-[#1a1a1a] hover:bg-[#252525] text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollShelf(videosScrollRef, 'right')}
              className="p-1.5 rounded-full bg-[#1a1a1a] hover:bg-[#252525] text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div 
          ref={videosScrollRef}
          className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2"
        >
          {videos.map((video) => {
            const isPlaying = currentTrack?.id === video.id && playbackStatus === 'playing';
            const isLoadingThis = currentTrack?.id === video.id && playbackStatus === 'loading';

            return (
              <div
                key={video.id}
                onClick={() => handlePlayVideoAsTrack(video)}
                className="w-64 sm:w-72 shrink-0 group p-3 rounded-2xl bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 cursor-pointer transition-colors shadow-md select-none"
              >
                <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-[#1e1e1e]">
                  <img 
                    src={video.artwork} 
                    alt={video.title} 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = ARTWORK_PLACEHOLDER;
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                  />
                  <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                    isPlaying || isLoadingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    {isLoadingThis ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    )}
                  </div>
                </div>

                <h4 className="font-semibold text-xs sm:text-sm text-white truncate group-hover:underline">
                  {video.title}
                </h4>
                <p className="text-[11px] text-[#a3a3a3] truncate mt-0.5">
                  {video.artist}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NewRoute;
