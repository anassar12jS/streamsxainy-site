import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchMedia } from '../services/tmdb';
import { searchAnimeList, mapAniListToTMDB } from '../services/anilist';
import { TMDBResult, MediaType } from '../types';
import { TMDB_POSTER_BASE } from '../constants';
import { Search, Film, Tv, Star, X, Loader2, ArrowRight, CornerDownLeft, Sparkles, Ghost } from 'lucide-react';

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: TMDBResult) => void;
}

export const CommandSearchModal: React.FC<CommandSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // TMDB search query hook
  const { data: tmdbResults, isLoading: isTmdbLoading } = useQuery({
    queryKey: ['cmd-search', query],
    queryFn: () => searchMedia(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 3,
  });

  // AniList search query hook
  const { data: animeResultsRaw, isLoading: isAnimeLoading } = useQuery({
    queryKey: ['cmd-search-anime', query],
    queryFn: () => searchAnimeList(query),
    enabled: query.trim().length >= 2,
    staleTime: 1000 * 60 * 3,
  });

  // Combined hybrid results
  const results = useMemo(() => {
    const combined: TMDBResult[] = [];
    const seen = new Set<string>();

    if (animeResultsRaw && animeResultsRaw.length > 0) {
      for (const a of animeResultsRaw.slice(0, 4)) {
        const mapped = mapAniListToTMDB(a);
        const key = (mapped.title || mapped.name || '').toLowerCase().trim();
        seen.add(key);
        combined.push(mapped);
      }
    }

    if (tmdbResults && tmdbResults.length > 0) {
      for (const t of tmdbResults) {
        const key = (t.title || t.name || '').toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(t);
        }
      }
    }

    return combined;
  }, [animeResultsRaw, tmdbResults]);

  const isLoading = (isTmdbLoading || isAnimeLoading) && results.length === 0;

  if (!isOpen) return null;

  const handleItemClick = (item: TMDBResult) => {
    onClose();
    onSelect(item);
  };

  const handleViewAllResults = () => {
    onClose();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/search');
    }
  };

  const trendingTags = ['The Outlaws', 'AKA', 'Unstoppable', 'Havoc', 'Demon Slayer', 'The Judge from Hell', 'Mouse'];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 px-4 pb-6 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[#111115] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3 bg-black/40">
          <Search className="w-5 h-5 text-white/50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleViewAllResults();
              }
            }}
            placeholder="Type a movie, TV series, anime, actor..."
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-white/40 focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-white/40 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-white/40 bg-white/5 px-2 py-0.5 rounded border border-white/10 shrink-0">
            <span>ESC</span> to exit
          </div>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto flex-1 custom-scrollbar p-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/50 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[rgb(var(--primary-color))]" />
              <span className="text-xs">Searching database...</span>
            </div>
          ) : results && results.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                <span>Top Results</span>
                <span>{results.length} found</span>
              </div>

              {results.slice(0, 8).map((item) => {
                const title = item.title || item.name || 'Untitled';
                const year = (item.release_date || item.first_air_date)?.split('-')[0] || '';
                const poster = item.poster_path 
                  ? (item.poster_path.startsWith('http') ? item.poster_path : `${TMDB_POSTER_BASE}${item.poster_path}`)
                  : 'https://via.placeholder.com/60x90?text=No+Cover';

                return (
                  <div
                    key={`${item.media_type || 'media'}_${item.id}`}
                    onClick={() => handleItemClick(item)}
                    className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-all group border border-transparent hover:border-white/10"
                  >
                    <img 
                      src={poster} 
                      alt="" 
                      className="w-10 h-14 rounded-lg object-cover bg-zinc-800 shrink-0 shadow group-hover:scale-105 transition-transform" 
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">
                          {title}
                        </h4>
                        {item.vote_average ? (
                          <span className="flex items-center gap-0.5 text-xs text-amber-400 shrink-0 font-semibold">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {item.vote_average.toFixed(1)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
                        {item.anilist_id ? (
                          <span className="text-pink-400 font-bold flex items-center gap-1">
                            <Ghost className="w-3 h-3" />
                            <span>Anime</span>
                          </span>
                        ) : (
                          <span className="capitalize">{item.media_type === MediaType.TV ? 'Series' : item.media_type === MediaType.MOVIE ? 'Movie' : 'Person'}</span>
                        )}
                        {year && <span>· {year}</span>}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                );
              })}

              {/* View all button */}
              <button
                onClick={handleViewAllResults}
                className="w-full mt-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[rgb(var(--primary-color))] flex items-center justify-center gap-2 transition-colors border border-white/10"
              >
                <span>View all results for "{query}"</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="py-16 text-center text-white/50">
              <p className="text-sm">No titles found matching "{query}"</p>
              <p className="text-xs text-white/40 mt-1">Try another search or browse categories.</p>
            </div>
          ) : (
            /* Quick suggestions */
            <div className="p-3">
              <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Trending Searches</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {trendingTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 hover:text-white transition-colors border border-white/10"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-black/50 border-t border-white/10 text-[11px] text-white/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-mono">↵</kbd> Select</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white/10 text-white font-mono">ESC</kbd> Close</span>
          </div>
          <span className="text-[10px] text-white/30">StreamHub Instant Search</span>
        </div>
      </div>
    </div>
  );
};
