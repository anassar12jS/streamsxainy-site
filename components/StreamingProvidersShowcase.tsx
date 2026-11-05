import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Star, ChevronLeft, ChevronRight, ExternalLink, 
  Film, Tv, Sparkles, Loader2 
} from 'lucide-react';
import { TMDBResult, MediaType } from '../types';
import { getProviderMedia } from '../services/tmdb';
import { TMDB_IMAGE_BASE, TMDB_BACKDROP_W780 } from '../constants';

export interface StreamingProvider {
  id: number;
  name: string;
  brandColor: string;
  logo: string;
  bg: string;
  tagline?: string;
}

export const STREAMING_PROVIDERS: StreamingProvider[] = [
  { id: 8, name: 'Netflix', brandColor: '#E50914', logo: '/rK1KljqmbvO9HQa1PBFLILWah72.png', bg: '#1a0b0d' },
  { id: 9, name: 'Prime Video', brandColor: '#00A8E1', logo: '/gMZdpavHmxFNnLpMHwVxfqeux2g.png', bg: '#0b172a' },
  { id: 350, name: 'Apple TV+', brandColor: '#E5E5E7', logo: '/9icYBfYFcwgCbky5VdGUIKJ4C5i.png', bg: '#18181b' },
  { id: 337, name: 'Disney+', brandColor: '#113CCF', logo: '/5eZ872CghnHFLB1j8grszbrx0dx.png', bg: '#0c1638' },
  { id: 1899, name: 'Max', brandColor: '#002BE7', logo: '/skypuy7SXuugIQeYg0IglmzoKaS.png', bg: '#08123b' },
  { id: 15, name: 'Hulu', brandColor: '#1CE783', logo: '/44uAnmSqvA4yBOdbPWN8YgQHjWm.png', bg: '#0b2014' },
  { id: 531, name: 'Paramount+', brandColor: '#0064FF', logo: '/bxX0YVOCY7bI85BKRlJAAQ2EjUR.png', bg: '#0b1b3d' },
  { id: 386, name: 'Peacock', brandColor: '#00A651', logo: '/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png', bg: '#101712' },
  { id: 283, name: 'Crunchyroll', brandColor: '#F47521', logo: '/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png', bg: '#25160b' },
  { id: 43, name: 'Starz', brandColor: '#E50914', logo: '/h25xjouKmiSmFiiqw0aDXbxGZo7.png', bg: '#18181b' },
  { id: 528, name: 'AMC+', brandColor: '#00843D', logo: '/tg5ufQ1GkYDCMxSSxemfeKWcvRe.png', bg: '#0e1c14' },
  { id: 11, name: 'MUBI', brandColor: '#002446', logo: '/k7iSlvgWzZuO4zU5PcBjhABMuia.png', bg: '#0a1626' },
  { id: 99, name: 'Shudder', brandColor: '#DA291C', logo: '/58O6yqUFM6qoOiBNAddJs7xNKc.png', bg: '#220b0b' },
  { id: 582, name: 'Discovery+', brandColor: '#002E72', logo: '/bxX0YVOCY7bI85BKRlJAAQ2EjUR.png', bg: '#0c1a36' },
  { id: 73, name: 'Tubi', brandColor: '#FA4729', logo: '/9dEuvA8wg5TSeFBZlPxSVxFdimJ.png', bg: '#26120e' },
  { id: 300, name: 'Pluto TV', brandColor: '#FFE000', logo: '/fN4czqaMQNLeF6sSSIjGbAWzvwK.png', bg: '#23200a' },
];

interface StreamingProvidersShowcaseProps {
  onSelect: (item: TMDBResult) => void;
}

export const StreamingProvidersShowcase: React.FC<StreamingProvidersShowcaseProps> = ({ onSelect }) => {
  const navigate = useNavigate();
  const [selectedProvider, setSelectedProvider] = useState<StreamingProvider>(STREAMING_PROVIDERS[0]);
  const [mediaType, setMediaType] = useState<MediaType>(MediaType.MOVIE);

  const providerScrollRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Fetch popular media for selected provider
  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ['provider-media', selectedProvider.id, mediaType],
    queryFn: () => getProviderMedia(selectedProvider.id, mediaType, 1),
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  const scrollProviders = (dir: 'left' | 'right') => {
    if (providerScrollRef.current) {
      providerScrollRef.current.scrollBy({
        left: dir === 'left' ? -260 : 260,
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
    navigate(`/discover?type=${mediaType}&provider=${selectedProvider.id}&providerName=${encodeURIComponent(selectedProvider.name)}`);
  };

  return (
    <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 animate-fade-in">
      
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

        {/* Right Toggle Controls (Movies / TV Shows / All) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Movies / TV Segmented Control */}
          <div className="flex items-center bg-black/60 p-1 rounded-2xl border border-white/10 backdrop-blur-md shadow-sm">
            <button
              type="button"
              onClick={() => setMediaType(MediaType.MOVIE)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mediaType === MediaType.MOVIE
                  ? 'bg-white text-zinc-950 shadow-md scale-100 font-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Movies</span>
            </button>

            <button
              type="button"
              onClick={() => setMediaType(MediaType.TV)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mediaType === MediaType.TV
                  ? 'bg-white text-zinc-950 shadow-md scale-100 font-black'
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
            className="flex items-center gap-1 px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white/80 hover:text-white transition-all shadow-sm"
          >
            <span>All</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Streaming Providers Horizontal Ribbon */}
      <div className="relative group/providers">
        {/* Scroll Left Button */}
        <button
          type="button"
          onClick={() => scrollProviders('left')}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-20 w-8 h-8 rounded-full bg-black/80 hover:bg-black border border-white/20 text-white items-center justify-center shadow-xl opacity-0 group-hover/providers:opacity-100 transition-opacity"
          aria-label="Scroll providers left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scroll Right Button */}
        <button
          type="button"
          onClick={() => scrollProviders('right')}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-20 w-8 h-8 rounded-full bg-black/80 hover:bg-black border border-white/20 text-white items-center justify-center shadow-xl opacity-0 group-hover/providers:opacity-100 transition-opacity"
          aria-label="Scroll providers right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div
          ref={providerScrollRef}
          className="flex items-center gap-3.5 sm:gap-4 overflow-x-auto custom-scrollbar py-2 px-1 scroll-smooth snap-x"
        >
          {STREAMING_PROVIDERS.map((prov) => {
            const isSelected = selectedProvider.id === prov.id;
            return (
              <button
                key={prov.id}
                type="button"
                onClick={() => setSelectedProvider(prov)}
                className="group/item flex flex-col items-center shrink-0 snap-start transition-transform focus:outline-none"
              >
                {/* Provider Logo App Icon Box */}
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center p-2.5 transition-all duration-300 relative border overflow-hidden ${
                    isSelected
                      ? 'scale-105 border-white ring-2 ring-white/60 shadow-2xl'
                      : 'border-white/10 hover:border-white/30 hover:scale-105 bg-zinc-900/90'
                  }`}
                  style={{
                    backgroundColor: prov.bg,
                    boxShadow: isSelected
                      ? `0 12px 28px -6px ${prov.brandColor}99, 0 0 16px ${prov.brandColor}66`
                      : 'none',
                  }}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w154${prov.logo}`}
                    alt={prov.name}
                    className="w-full h-full object-contain filter drop-shadow-md transition-transform group-hover/item:scale-110"
                    loading="lazy"
                  />

                  {/* Active Indicator Glow */}
                  {isSelected && (
                    <div
                      className="absolute inset-0 pointer-events-none opacity-20"
                      style={{ backgroundColor: prov.brandColor }}
                    />
                  )}
                </div>

                {/* Provider Name */}
                <span
                  className={`text-[11px] font-semibold tracking-tight text-center truncate max-w-[70px] mt-2 transition-colors ${
                    isSelected ? 'text-white font-bold' : 'text-white/60 group-hover/item:text-white/90'
                  }`}
                >
                  {prov.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Provider Showcase Banner */}
      <div 
        className="rounded-2xl border border-white/10 p-3.5 sm:p-4 flex items-center justify-between shadow-xl transition-all duration-500 relative overflow-hidden"
        style={{
          background: `linear-gradient(90deg, ${selectedProvider.bg}ee 0%, #111116f5 60%, #0d0d12f5 100%)`,
          boxShadow: `0 8px 30px -10px ${selectedProvider.brandColor}33`,
        }}
      >
        {/* Subtle Ambient Brand Glow */}
        <div 
          className="absolute -left-10 top-0 bottom-0 w-48 opacity-30 pointer-events-none blur-2xl"
          style={{ backgroundColor: selectedProvider.brandColor }}
        />

        <div className="flex items-center gap-3 sm:gap-4 relative z-10 min-w-0">
          {/* Provider App Icon */}
          <div
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl p-2 shrink-0 border border-white/15 flex items-center justify-center shadow-md"
            style={{ backgroundColor: selectedProvider.bg }}
          >
            <img
              src={`https://image.tmdb.org/t/p/w154${selectedProvider.logo}`}
              alt={selectedProvider.name}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono tracking-widest text-white/50 uppercase block">
              POPULAR {mediaType === MediaType.MOVIE ? 'MOVIES' : 'TV SHOWS'} ON
            </span>
            <h3 className="text-base sm:text-xl font-black text-white tracking-tight truncate">
              {selectedProvider.name}
            </h3>
          </div>
        </div>

        {/* View All Button */}
        <button
          type="button"
          onClick={handleViewAll}
          className="relative z-10 px-4 py-2 rounded-full bg-white hover:bg-white/90 text-zinc-950 font-black text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0 hover:scale-105 active:scale-95"
        >
          <span>View all</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Widescreen Media Cards Showcase Row */}
      <div className="relative group/content">
        {/* Scroll Left Button */}
        <button
          type="button"
          onClick={() => scrollContent('left')}
          className="hidden sm:flex absolute left-0 top-1/3 -translate-y-1/2 -translate-x-3 z-20 w-9 h-9 rounded-full bg-black/80 hover:bg-black border border-white/20 text-white items-center justify-center shadow-xl opacity-0 group-hover/content:opacity-100 transition-opacity"
          aria-label="Scroll movies left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Scroll Right Button */}
        <button
          type="button"
          onClick={() => scrollContent('right')}
          className="hidden sm:flex absolute right-0 top-1/3 -translate-y-1/2 translate-x-3 z-20 w-9 h-9 rounded-full bg-black/80 hover:bg-black border border-white/20 text-white items-center justify-center shadow-xl opacity-0 group-hover/content:opacity-100 transition-opacity"
          aria-label="Scroll movies right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div
          ref={contentScrollRef}
          className="flex items-start gap-4 sm:gap-5 overflow-x-auto custom-scrollbar pb-3 pt-1 scroll-smooth snap-x"
        >
          {isLoading ? (
            // Skeleton Loaders matching 16:9 widescreen card layout
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
              No popular titles found for {selectedProvider.name} in this category.
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

                    {/* Stylized Centered / Bottom Title Overlay Artwork (matching user's screenshot) */}
                    <div className="absolute inset-0 flex items-center justify-center p-4 text-center pointer-events-none">
                      <h4 className="text-white font-black tracking-wider uppercase text-base sm:text-lg md:text-xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] line-clamp-2 max-w-[85%] font-sans opacity-95 group-hover/card:scale-105 transition-transform">
                        {title}
                      </h4>
                    </div>

                    {/* Quick Play Hover Indicator */}
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white opacity-0 group-hover/card:opacity-100 group-hover/card:scale-110 transition-all duration-300 shadow-lg">
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Card Bottom Meta */}
                  <div className="pt-2.5 px-0.5 space-y-1">
                    {/* Title */}
                    <h4 className="font-bold text-sm sm:text-base text-white truncate max-w-full group-hover/card:text-cyan-400 transition-colors">
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

    </section>
  );
};
