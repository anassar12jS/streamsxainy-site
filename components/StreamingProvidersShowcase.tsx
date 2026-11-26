import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play, Star, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { TMDBResult, MediaType } from '../types';
import { getProviderMedia } from '../services/tmdb';
import { TMDB_IMAGE_BASE, TMDB_BACKDROP_W780 } from '../constants';
import { Reveal } from './Reveal';

export interface StreamingProvider {
  id: number;
  name: string;
  logoPath: string;
  brandColor: string;
}

export const STREAMING_PROVIDERS: StreamingProvider[] = [
  { id: 8, name: 'Netflix', logoPath: '/rK1KljqmbvO9HQa1PBFLILWah72.png', brandColor: '#E50914' },
  { id: 9, name: 'Prime Video', logoPath: '/gMZdpavHmxFNnLpMHwVxfqeux2g.png', brandColor: '#00A8E1' },
  { id: 350, name: 'Apple TV+', logoPath: '/9icYBfYFcwgCbky5VdGUIKJ4C5i.png', brandColor: '#FFFFFF' },
  { id: 337, name: 'Disney+', logoPath: '/5eZ872CghnHFLB1j8grszbrx0dx.png', brandColor: '#113CCF' },
  { id: 1899, name: 'Max', logoPath: '/skypuy7SXuugIQeYg0IglmzoKaS.png', brandColor: '#002BE7' },
  { id: 15, name: 'Hulu', logoPath: '/44uAnmSqvA4yBOdbPWN8YgQHjWm.png', brandColor: '#1CE783' },
  { id: 531, name: 'Paramount+', logoPath: '/pkx3klJlwW5JdtaulvDx6hDNtch.png', brandColor: '#0064FF' },
  { id: 386, name: 'Peacock', logoPath: '/a1UIdq5BrkcAxnxcUhFsNbXnxeu.png', brandColor: '#F59E0B' },
  { id: 283, name: 'Crunchyroll', logoPath: '/uFL3c4Cq8M6WoLymlC5Y8bmGytV.png', brandColor: '#F47521' },
  { id: 43, name: 'Starz', logoPath: '/h25xjouKmiSmFiiqw0aDXbxGZo7.png', brandColor: '#FFFFFF' },
  { id: 528, name: 'AMC+', logoPath: '/tg5ufQ1GkYDCMxSSxemfeKWcvRe.png', brandColor: '#0D7B64' },
  { id: 11, name: 'MUBI', logoPath: '/k7iSlvgWzZuO4zU5PcBjhABMuia.png', brandColor: '#0066FF' },
  { id: 99, name: 'Shudder', logoPath: '/58O6yqUFM6qoOiBNAddJs7xNKc.png', brandColor: '#EF4444' },
  { id: 520, name: 'Discovery+', logoPath: '/tHseJEgZaUdVlLtBpOGmKPfzbQ8.png', brandColor: '#06B6D4' },
  { id: 73, name: 'Tubi', logoPath: '/9dEuvA8wg5TSeFBZlPxSVxFdimJ.png', brandColor: '#F97316' },
  { id: 300, name: 'Pluto TV', logoPath: '/fN4czqaMQNLeF6sSSIjGbAWzvwK.png', brandColor: '#FACC15' },
];

const MOVIE_GENRES = [
  { id: 0, name: 'All' },
  { id: 28, name: 'Action' },
  { id: 35, name: 'Comedy' },
  { id: 878, name: 'Sci-Fi' },
  { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' },
  { id: 53, name: 'Thriller' },
  { id: 16, name: 'Animation' },
];

const TV_GENRES = [
  { id: 0, name: 'All' },
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

  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ['provider-media', selectedProvider.id, mediaType, selectedGenre, sortBy],
    queryFn: () => getProviderMedia(
      selectedProvider.id,
      mediaType,
      1,
      selectedGenre > 0 ? selectedGenre : undefined,
      sortBy
    ),
    staleTime: 1000 * 60 * 30,
  });

  const scrollProviders = (dir: 'left' | 'right') => {
    providerScrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  const scrollContent = (dir: 'left' | 'right') => {
    contentScrollRef.current?.scrollBy({ left: dir === 'left' ? -380 : 380, behavior: 'smooth' });
  };

  const handleViewAll = () => {
    const genreParam = selectedGenre > 0 ? `&genre=${selectedGenre}` : '';
    navigate(`/discover?type=${mediaType}&provider=${selectedProvider.id}&providerName=${encodeURIComponent(selectedProvider.name)}${genreParam}`);
  };

  const handleQuickPlay = (e: React.MouseEvent, item: TMDBResult) => {
    e.stopPropagation();
    const type = item.media_type === 'tv' || mediaType === MediaType.TV ? MediaType.TV : MediaType.MOVIE;
    navigate(type === MediaType.MOVIE ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}/1/1`);
  };

  const currentGenres = mediaType === MediaType.MOVIE ? MOVIE_GENRES : TV_GENRES;

  return (
    <Reveal as="section" className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)] mb-1">
            By platform
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">
            Streaming Channels
          </h2>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="flex items-center bg-[var(--bg-card)] p-1 rounded-lg border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => {
                setMediaType(MediaType.MOVIE);
                setSelectedGenre(0);
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                mediaType === MediaType.MOVIE
                  ? 'bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Movies
            </button>
            <button
              type="button"
              onClick={() => {
                setMediaType(MediaType.TV);
                setSelectedGenre(0);
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                mediaType === MediaType.TV
                  ? 'bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              TV Shows
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollProviders('left')}
              className="p-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              aria-label="Previous platforms"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollProviders('right')}
              className="p-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              aria-label="Next platforms"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Platform Selector Strip */}
      <div
        ref={providerScrollRef}
        className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1 scroll-smooth snap-x"
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
              className="group/item flex flex-col items-center shrink-0 snap-start cursor-pointer focus:outline-none py-1"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center p-2.5 transition-all duration-200 ${
                  isSelected
                    ? 'bg-zinc-900 scale-105'
                    : 'border border-[var(--border-subtle)] hover:border-white/30 bg-[var(--bg-card)] opacity-75 hover:opacity-100 hover:-translate-y-0.5'
                }`}
                style={isSelected ? {
                  border: `2px solid ${prov.brandColor}`,
                  boxShadow: `0 8px 24px -6px ${prov.brandColor}66`,
                } : undefined}
              >
                <img
                  src={`https://image.tmdb.org/t/p/original${prov.logoPath}`}
                  alt={prov.name}
                  className="w-full h-full object-contain rounded-lg pointer-events-none"
                  loading="lazy"
                />
              </div>
              <span
                className={`text-[11px] tracking-tight text-center truncate max-w-[72px] mt-1.5 transition-colors ${
                  isSelected
                    ? 'text-[var(--text-main)] font-bold'
                    : 'text-[var(--text-muted)] group-hover/item:text-[var(--text-main)]'
                }`}
              >
                {prov.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Platform Filter Bar with Dynamic Brand Lighting */}
      <div
        className="relative overflow-hidden rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4 shadow-xl"
        style={{
          backgroundImage: `radial-gradient(ellipse at top left, ${selectedProvider.brandColor}1f, transparent 58%)`,
          borderColor: `${selectedProvider.brandColor}40`,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-11 h-11 rounded-xl p-1.5 shrink-0 bg-zinc-950 border flex items-center justify-center shadow-md"
              style={{ borderColor: `${selectedProvider.brandColor}55` }}
            >
              <img
                src={`https://image.tmdb.org/t/p/original${selectedProvider.logoPath}`}
                alt={selectedProvider.name}
                className="w-full h-full object-contain rounded"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">
                Streaming {mediaType === MediaType.MOVIE ? 'films' : 'series'} on
              </p>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[var(--text-main)] tracking-tight truncate">
                {selectedProvider.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setSortBy(s => s === 'popularity.desc' ? 'vote_average.desc' : 'popularity.desc')}
              className="px-3.5 py-2 rounded-xl bg-[var(--bg-main)]/75 hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs font-semibold transition-colors cursor-pointer"
            >
              Sort: {sortBy === 'popularity.desc' ? 'Popular' : 'Top Rated'}
            </button>

            <button
              type="button"
              onClick={handleViewAll}
              className="px-4 py-2 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 text-white font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg shadow-[rgb(var(--primary-color))]/30"
            >
              <span>Explore All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Genre Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 border-t border-[var(--border-subtle)]">
          {currentGenres.map((g) => {
            const isGActive = selectedGenre === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGenre(g.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isGActive
                    ? 'bg-[var(--bg-hover)] text-[var(--text-main)] font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]/50'
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Widescreen Previews */}
      <div className="relative group/content">
        <button
          type="button"
          onClick={() => scrollContent('left')}
          className="hidden sm:flex absolute left-2 top-1/3 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/75 hover:bg-black border border-white/15 text-white items-center justify-center opacity-0 group-hover/content:opacity-100 transition-opacity cursor-pointer"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => scrollContent('right')}
          className="hidden sm:flex absolute right-2 top-1/3 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/75 hover:bg-black border border-white/15 text-white items-center justify-center opacity-0 group-hover/content:opacity-100 transition-opacity cursor-pointer"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div
          ref={contentScrollRef}
          className="flex items-start gap-4 overflow-x-auto no-scrollbar pb-2 scroll-smooth snap-x"
        >
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-64 sm:w-80 shrink-0 space-y-2">
                <div className="aspect-video rounded-xl bg-[var(--bg-card)] animate-pulse border border-[var(--border-subtle)]" />
                <div className="h-4 bg-[var(--bg-card)] rounded w-3/4 animate-pulse" />
              </div>
            ))
          ) : mediaItems.length === 0 ? (
            <div className="w-full py-10 text-center text-[var(--text-muted)] text-xs">
              No titles found for {selectedProvider.name} with this filter.
            </div>
          ) : (
            mediaItems.map((item) => {
              const year = (item.release_date || item.first_air_date)?.split('-')[0] || '';
              const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
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
                  className="w-64 sm:w-80 shrink-0 group/card cursor-pointer snap-start flex flex-col"
                >
                  <div className="aspect-video w-full rounded-xl overflow-hidden relative bg-zinc-900 border border-[var(--border-subtle)] group-hover/card:border-[rgb(var(--primary-color))]/60 transition-all duration-200 shadow-lg shadow-black/30">
                    {backdropUrl ? (
                      <img
                        src={backdropUrl}
                        alt={title}
                        className="w-full h-full object-cover object-center group-hover/card:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-500 text-xs">
                        No preview available
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/15 pointer-events-none" />

                    {rating && (
                      <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md text-[11px] font-semibold text-amber-400 flex items-center gap-1 font-mono tabular-nums border border-white/10">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{rating}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleQuickPlay(e, item)}
                      className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[rgb(var(--primary-color))] text-white flex items-center justify-center shadow-xl shadow-[rgb(var(--primary-color))]/40 opacity-0 group-hover/card:opacity-100 scale-90 group-hover/card:scale-100 transition-all duration-200 cursor-pointer"
                      title="Play now"
                      aria-label={`Play ${title}`}
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </button>
                  </div>

                  <div className="pt-2.5 px-0.5 space-y-0.5">
                    <h4 className="font-semibold text-sm text-[var(--text-main)] truncate group-hover/card:text-[rgb(var(--primary-color))] transition-colors">
                      {title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <span>{mediaType === MediaType.MOVIE ? 'Movie' : 'Series'}</span>
                      {year && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{year}</span>
                        </>
                      )}
                      {rating && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium font-mono tabular-nums">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{rating}</span>
                          </span>
                        </>
                      )}
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
