import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Star, ChevronLeft, ChevronRight, ExternalLink, 
  Film, Tv, Bookmark, Plus, Check, Sparkles
} from 'lucide-react';
import { TMDBResult, MediaType } from '../types';
import { getProviderMedia } from '../services/tmdb';
import { TMDB_IMAGE_BASE, TMDB_BACKDROP_W780 } from '../constants';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '../services/storage';
import { Reveal } from './Reveal';

export interface StreamingProvider {
  id: number;
  name: string;
  logoPath: string;
  brandColor: string;
}

export const STREAMING_PROVIDERS: StreamingProvider[] = [
  {
    id: 8,
    name: 'Netflix',
    logoPath: '/rK1KljqmbvO9HQa1PBFLILWah72.png',
    brandColor: '#E50914',
  },
  {
    id: 9,
    name: 'Prime Video',
    logoPath: '/gMZdpavHmxFNnLpMHwVxfqeux2g.png',
    brandColor: '#00A8E1',
  },
  {
    id: 350,
    name: 'Apple TV+',
    logoPath: '/9icYBfYFcwgCbky5VdGUIKJ4C5i.png',
    brandColor: '#FFFFFF',
  },
  {
    id: 337,
    name: 'Disney+',
    logoPath: '/5eZ872CghnHFLB1j8grszbrx0dx.png',
    brandColor: '#113CCF',
  },
  {
    id: 1899,
    name: 'Max',
    logoPath: '/skypuy7SXuugIQeYg0IglmzoKaS.png',
    brandColor: '#002BE7',
  },
  {
    id: 15,
    name: 'Hulu',
    logoPath: '/44uAnmSqvA4yBOdbPWN8YgQHjWm.png',
    brandColor: '#1CE783',
  },
  {
    id: 531,
    name: 'Paramount+',
    logoPath: '/pkx3klJlwW5JdtaulvDx6hDNtch.png',
    brandColor: '#0064FF',
  },
  {
    id: 386,
    name: 'Peacock',
    logoPath: '/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png',
    brandColor: '#F59E0B',
  },
  {
    id: 283,
    name: 'Crunchyroll',
    logoPath: '/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png',
    brandColor: '#F47521',
  },
  {
    id: 43,
    name: 'Starz',
    logoPath: '/h25xjouKmiSmFiiqw0aDXbxGZo7.png',
    brandColor: '#FFFFFF',
  },
  {
    id: 528,
    name: 'AMC+',
    logoPath: '/tg5ufQ1GkYDCMxSSxemfeKWcvRe.png',
    brandColor: '#0D7B64',
  },
  {
    id: 11,
    name: 'MUBI',
    logoPath: '/k7iSlvgWzZuO4zU5PcBjhABMuia.png',
    brandColor: '#0066FF',
  },
  {
    id: 99,
    name: 'Shudder',
    logoPath: '/58O6yqUFM6qoOiBNAddJs7xNKc.png',
    brandColor: '#EF4444',
  },
  {
    id: 520,
    name: 'Discovery+',
    logoPath: '/tHseJEgZaUdVlLtBpOGmKPfzbQ8.png',
    brandColor: '#06B6D4',
  },
  {
    id: 73,
    name: 'Tubi',
    logoPath: '/9dEuvA8wg5TSeFBZlPxSVxFdimJ.png',
    brandColor: '#F97316',
  },
  {
    id: 300,
    name: 'Pluto TV',
    logoPath: '/fN4czqaMQNLeF6sSSIjGbAWzvwK.png',
    brandColor: '#FACC15',
  },
];

const MOVIE_GENRES = [
  { id: 0, name: 'All Popular' },
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comedy' },
  { id: 878, name: 'Sci-Fi' },
  { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' },
  { id: 53, name: 'Thriller' },
  { id: 16, name: 'Animation' },
];

const TV_GENRES = [
  { id: 0, name: 'All Popular' },
  { id: 10759, name: 'Action & Adventure' },
  { id: 35, name: 'Comedy' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 18, name: 'Drama' },
  { id: 9648, name: 'Mystery' },
  { id: 16, name: 'Animation' },
];

interface StreamingProvidersShowcaseProps {
  onSelect: (item: TMDBResult) => void;
}

export const StreamingProvidersShowcase: React.FC<StreamingProvidersShowcaseProps> = ({ onSelect }) => {
  const navigate = useNavigate();
  const [selectedProvider, setSelectedProvider] = useState<StreamingProvider>(STREAMING_PROVIDERS[0]);
  const [mediaType, setMediaType] = useState<MediaType>(MediaType.MOVIE);
  const [selectedGenre, setSelectedGenre] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('popularity.desc');

  const providerScrollRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Fetch popular media for selected provider, mediaType, genre, and sort
  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ['provider-media', selectedProvider.id, mediaType, selectedGenre, sortBy],
    queryFn: () => getProviderMedia(
      selectedProvider.id, 
      mediaType, 
      1, 
      selectedGenre > 0 ? selectedGenre : undefined,
      sortBy
    ),
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  const scrollProviders = (dir: 'left' | 'right') => {
    if (providerScrollRef.current) {
      providerScrollRef.current.scrollBy({
        left: dir === 'left' ? -280 : 280,
        behavior: 'smooth'
      });
    }
  };

  const scrollContent = (dir: 'left' | 'right') => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollBy({
        left: dir === 'left' ? -380 : 380,
        behavior: 'smooth'
      });
    }
  };

  const handleViewAll = () => {
    const genreParam = selectedGenre > 0 ? `&genre=${selectedGenre}` : '';
    navigate(`/discover?type=${mediaType}&provider=${selectedProvider.id}&providerName=${encodeURIComponent(selectedProvider.name)}${genreParam}`);
  };

  const handleQuickPlay = (e: React.MouseEvent, item: TMDBResult) => {
    e.stopPropagation();
    const type = item.media_type === 'tv' || mediaType === MediaType.TV ? MediaType.TV : MediaType.MOVIE;
    if (type === MediaType.MOVIE) {
      navigate(`/watch/movie/${item.id}`);
    } else {
      navigate(`/watch/tv/${item.id}/1/1`);
    }
  };

  const currentGenres = mediaType === MediaType.MOVIE ? MOVIE_GENRES : TV_GENRES;

  return (
    <Reveal as="section" className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          {/* Eyebrow Kicker */}
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-white/50 uppercase mb-1">
            <span className="w-1 h-3.5 bg-gradient-to-b from-red-500 to-amber-500 rounded-full" />
            <span>WHERE TO WATCH</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Streaming providers</span>
          </h2>
        </div>

        {/* Right Toggle Controls (Movies / TV Shows / All / Chevrons) */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Movies / TV Segmented Control */}
          <div className="flex items-center bg-black/60 p-1 rounded-2xl border border-white/10 backdrop-blur-md shadow-sm">
            <button
              type="button"
              onClick={() => {
                setMediaType(MediaType.MOVIE);
                setSelectedGenre(0);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mediaType === MediaType.MOVIE
                  ? 'bg-white text-zinc-950 shadow-md font-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Movies</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMediaType(MediaType.TV);
                setSelectedGenre(0);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                mediaType === MediaType.TV
                  ? 'bg-white text-zinc-950 shadow-md font-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>TV Shows</span>
            </button>
          </div>

          {/* All Link Button */}
          <button
            type="button"
            onClick={handleViewAll}
            className="flex items-center gap-1 px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white/80 hover:text-white transition-all shadow-sm cursor-pointer"
          >
            <span>All</span>
            <ExternalLink className="w-3 h-3" />
          </button>

          {/* Ribbon Scroll Chevrons in Header */}
          <div className="hidden sm:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => scrollProviders('left')}
              className="p-1 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Previous providers"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollProviders('right')}
              className="p-1 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Next providers"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Streaming Providers Horizontal Ribbon (Pristine TMDB logos with clean white active styling, no scuffed glow) */}
      <div className="relative py-1 group/ribbon">
        <button
          type="button"
          onClick={() => scrollProviders('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-20 w-8 h-8 rounded-full bg-black/80 hover:bg-black border border-white/20 text-white items-center justify-center opacity-0 group-hover/ribbon:opacity-100 transition-opacity shadow-xl cursor-pointer"
          aria-label="Scroll providers left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollProviders('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-20 w-8 h-8 rounded-full bg-black/80 hover:bg-black border border-white/20 text-white items-center justify-center opacity-0 group-hover/ribbon:opacity-100 transition-opacity shadow-xl cursor-pointer"
          aria-label="Scroll providers right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div
          ref={providerScrollRef}
          className="flex items-center gap-4 sm:gap-5 overflow-x-auto custom-scrollbar py-3 px-1 scroll-smooth snap-x"
        >
          {STREAMING_PROVIDERS.map((prov) => {
            const isSelected = selectedProvider.id === prov.id;
            return (
              <button
                key={prov.id}
                type="button"
                onClick={() => {
                  setSelectedProvider(prov);
                  setSelectedGenre(0);
                }}
                className="group/item relative flex flex-col items-center shrink-0 snap-start transition-all duration-200 focus:outline-none cursor-pointer"
              >
                {/* Tile Container - Clean, crisp, NO colored glow */}
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center p-2.5 transition-all duration-200 relative select-none ${
                    isSelected
                      ? 'scale-105 -translate-y-1 border-2 border-white ring-2 ring-white/25 bg-zinc-800/95 shadow-xl shadow-black/80'
                      : 'border border-white/15 hover:border-white/40 hover:scale-105 hover:-translate-y-0.5 bg-zinc-900/80 shadow-md shadow-black/40'
                  }`}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/original${prov.logoPath}`}
                    alt={prov.name}
                    className="w-full h-full object-contain rounded-xl drop-shadow-sm pointer-events-none"
                    loading="lazy"
                  />
                </div>

                {/* Provider Name */}
                <span
                  className={`text-[11px] tracking-tight text-center truncate max-w-[75px] mt-2 transition-colors ${
                    isSelected 
                      ? 'text-white font-bold' 
                      : 'text-white/60 font-medium group-hover/item:text-white'
                  }`}
                >
                  {prov.name}
                </span>

                {/* Subtle active pip indicator */}
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white mt-1 shadow-sm" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Provider Showcase Banner with Genre Quick Filters */}
      <div 
        className="rounded-2xl border border-white/15 p-4 sm:p-5 shadow-xl transition-all duration-300 relative overflow-hidden space-y-4"
        style={{
          background: `linear-gradient(90deg, ${selectedProvider.brandColor}26 0%, #15151ef5 45%, #0f0f16f5 100%)`,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            {/* Provider App Icon */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl p-2 shrink-0 bg-zinc-900/90 border border-white/20 flex items-center justify-center shadow-md">
              <img
                src={`https://image.tmdb.org/t/p/original${selectedProvider.logoPath}`}
                alt={selectedProvider.name}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-mono tracking-widest text-white/50 uppercase block font-semibold">
                POPULAR {mediaType === MediaType.MOVIE ? 'MOVIES' : 'TV SHOWS'} ON
              </span>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                  {selectedProvider.name}
                </h3>
                <span className="hidden md:inline-flex text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-white/70 border border-white/10">
                  US Catalog
                </span>
              </div>
            </div>
          </div>

          {/* Right Action: Sort toggle + View All Button */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setSortBy(s => s === 'popularity.desc' ? 'vote_average.desc' : 'popularity.desc')}
              className="px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/15 text-white/80 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <span>Sort: {sortBy === 'popularity.desc' ? 'Most Popular' : 'Top Rated'}</span>
            </button>

            <button
              type="button"
              onClick={handleViewAll}
              className="px-4 sm:px-5 py-2 rounded-full bg-white hover:bg-white/90 text-zinc-950 font-black text-xs transition-all shadow-lg flex items-center gap-1.5 shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>View all</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Genre Chips under Provider Banner */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar pt-1 border-t border-white/10">
          {currentGenres.map((g) => {
            const isGActive = selectedGenre === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGenre(g.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isGActive
                    ? 'bg-white text-zinc-950 font-bold shadow-md'
                    : 'bg-black/40 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Widescreen Media Cards Showcase Row */}
      <div className="relative group/content">
        {/* Scroll Left Button */}
        <button
          type="button"
          onClick={() => scrollContent('left')}
          className="hidden sm:flex absolute left-0 top-1/3 -translate-y-1/2 -translate-x-3 z-20 w-10 h-10 rounded-full bg-black/80 hover:bg-black border border-white/20 text-white items-center justify-center shadow-xl opacity-0 group-hover/content:opacity-100 transition-opacity cursor-pointer"
          aria-label="Scroll movies left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Scroll Right Button */}
        <button
          type="button"
          onClick={() => scrollContent('right')}
          className="hidden sm:flex absolute right-0 top-1/3 -translate-y-1/2 translate-x-3 z-20 w-10 h-10 rounded-full bg-black/80 hover:bg-black border border-white/20 text-white items-center justify-center shadow-xl opacity-0 group-hover/content:opacity-100 transition-opacity cursor-pointer"
          aria-label="Scroll movies right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div
          ref={contentScrollRef}
          className="flex items-start gap-4 sm:gap-5 overflow-x-auto custom-scrollbar pb-3 pt-1 scroll-smooth snap-x"
        >
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-64 sm:w-80 md:w-96 shrink-0 space-y-2">
                <div className="aspect-video rounded-2xl bg-white/5 animate-pulse border border-white/5" />
                <div className="h-4 bg-white/10 rounded-md w-3/4 animate-pulse" />
                <div className="flex justify-between">
                  <div className="h-3 bg-white/5 rounded-md w-1/4 animate-pulse" />
                  <div className="h-3 bg-white/5 rounded-md w-1/6 animate-pulse" />
                </div>
              </div>
            ))
          ) : mediaItems.length === 0 ? (
            <div className="w-full py-12 text-center text-white/50 text-xs">
              No popular titles found for {selectedProvider.name} with this filter. Try selecting "All Popular".
            </div>
          ) : (
            mediaItems.map((item) => {
              const year = (item.release_date || item.first_air_date)?.split('-')[0] || '2026';
              const rating = item.vote_average ? item.vote_average.toFixed(1) : '7.0';
              const title = item.title || item.name || 'Untitled';
              const backdropUrl = item.backdrop_path 
                ? `${TMDB_BACKDROP_W780}${item.backdrop_path}` 
                : item.poster_path 
                  ? `${TMDB_IMAGE_BASE}${item.poster_path}` 
                  : '';

              return (
                <div
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="w-64 sm:w-80 md:w-96 shrink-0 group/card cursor-pointer snap-start flex flex-col"
                >
                  {/* 16:9 Widescreen Image Stage with Title Typography Artwork */}
                  <div className="aspect-video w-full rounded-2xl overflow-hidden relative bg-zinc-900 border border-white/10 shadow-xl group-hover/card:border-white/30 group-hover/card:shadow-2xl transition-all duration-300">
                    {backdropUrl ? (
                      <img
                        src={backdropUrl}
                        alt={title}
                        className="w-full h-full object-cover object-center transform group-hover/card:scale-105 transition-transform duration-500 ease-out"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white/40 text-xs">
                        No Preview Available
                      </div>
                    )}

                    {/* Dark Cinematic Vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />

                    {/* Stylized Centered Title Overlay Artwork */}
                    <div className="absolute inset-0 flex items-center justify-center p-4 text-center pointer-events-none">
                      <h4 className="text-white font-black tracking-wider uppercase text-base sm:text-lg md:text-xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] line-clamp-2 max-w-[85%] font-sans opacity-95 group-hover/card:scale-105 transition-transform">
                        {title}
                      </h4>
                    </div>

                    {/* Quick Play Hover Indicator (Launches directly into player) */}
                    <button
                      type="button"
                      onClick={(e) => handleQuickPlay(e, item)}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[rgb(var(--primary-color))] hover:brightness-110 text-white flex items-center justify-center shadow-xl opacity-0 group-hover/card:opacity-100 group-hover/card:scale-110 transition-all duration-300 z-10 cursor-pointer"
                      title="Quick Play"
                      aria-label="Quick Play"
                    >
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </button>
                  </div>

                  {/* Card Bottom Meta */}
                  <div className="pt-2.5 px-0.5 space-y-1">
                    {/* Title */}
                    <h4 className="font-bold text-sm sm:text-base text-white truncate max-w-full group-hover/card:text-[rgb(var(--primary-color))] transition-colors">
                      {title}
                    </h4>

                    {/* Info Row: Badge + Year + Rating */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-white/20 text-white/90 bg-black/40 uppercase tracking-wider">
                          {mediaType === MediaType.MOVIE ? 'MOVIE' : 'TV SHOW'}
                        </span>
                        <span className="text-white/60 font-medium text-[11px] font-mono">
                          {year}
                        </span>
                      </div>

                      {/* Yellow Star Rating */}
                      <div className="flex items-center gap-1 font-bold text-amber-400 text-xs">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </Reveal>
  );
};
