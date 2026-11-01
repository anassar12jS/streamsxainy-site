import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchMedia } from '../services/tmdb';
import { searchAnimeList, mapAniListToTMDB } from '../services/anilist';
import { categorizeResults, rankSearchResults } from '../services/searchUtils';
import { MediaCard } from '../components/MediaCard';
import { TMDBResult, MediaType } from '../types';
import { 
  Search as SearchIcon, Loader2, Ghost, Film, Tv, User, 
  X, Sparkles, Filter, SlidersHorizontal, ArrowUpDown
} from 'lucide-react';

interface SearchProps {
  onSelect: (item: TMDBResult) => void;
}

type FilterTab = 'all' | 'movie' | 'tv' | 'anime' | 'person';

export const Search: React.FC<SearchProps> = ({ onSelect }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const navigate = useNavigate();

  const [inputVal, setInputVal] = useState(query);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Keep inputVal in sync with query parameter
  useEffect(() => {
    setInputVal(query);
  }, [query]);

  // Query for TMDB media results
  const { data: tmdbResults, isLoading: isTmdbLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchMedia(query),
    enabled: !!query.trim(),
    staleTime: 1000 * 60 * 5,
  });

  // Query for AniList anime results in parallel
  const { data: animeRawResults, isLoading: isAnimeLoading } = useQuery({
    queryKey: ['search-anilist', query],
    queryFn: () => searchAnimeList(query),
    enabled: !!query.trim(),
    staleTime: 1000 * 60 * 5,
  });

  // Map AniList results to standard TMDBResult
  const animeResults: TMDBResult[] = useMemo(() => {
    if (!animeRawResults || animeRawResults.length === 0) return [];
    return animeRawResults.map(mapAniListToTMDB);
  }, [animeRawResults]);

  // Categorize TMDB results
  const categorized = useMemo(() => {
    if (!tmdbResults) return { movies: [], tvShows: [], people: [] };
    return categorizeResults(tmdbResults);
  }, [tmdbResults]);

  // Combined Results (De-duplicated & Globally Ranked)
  const combinedAll = useMemo(() => {
    const list: TMDBResult[] = [];
    const seenTitles = new Set<string>();

    // Add AniList anime first so they are preferred if deduplicated by title
    for (const a of animeResults) {
      const key = (a.title || a.name || '').toLowerCase().trim();
      if (key) {
        seenTitles.add(key);
        list.push(a);
      }
    }

    // Add TMDB results
    if (tmdbResults) {
      for (const item of tmdbResults) {
        const key = (item.title || item.name || '').toLowerCase().trim();
        // If it's already present from AniList, keep the AniList one (which has direct anilist_id)
        if (!seenTitles.has(key)) {
          if (key) {
            seenTitles.add(key);
          }
          list.push(item);
        }
      }
    }

    // Rank the entire combined list of both TMDB and AniList together based on relevance and popularity!
    return rankSearchResults(list, query);
  }, [animeResults, tmdbResults, query]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'movie') return categorized.movies;
    if (activeTab === 'tv') return categorized.tvShows;
    if (activeTab === 'anime') return animeResults;
    if (activeTab === 'person') return categorized.people;
    return combinedAll;
  }, [activeTab, categorized, animeResults, combinedAll]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (trimmed) {
      setSearchParams({ q: trimmed });
    } else {
      setSearchParams({});
    }
  };

  const clearSearch = () => {
    setInputVal('');
    setSearchParams({});
  };

  const quickSearches = ['The Outlaws', 'AKA', 'Unstoppable', 'Havoc', 'The Judge from Hell', 'Demon Slayer', 'Solo Leveling', 'Jujutsu Kaisen'];

  const isLoading = isTmdbLoading || isAnimeLoading;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen animate-fade-in text-[var(--text-main)]">
      
      {/* Search Bar Input Container */}
      <div className="mb-8">
        <form onSubmit={handleSearchSubmit} className="relative max-w-3xl">
          <div className="relative flex items-center">
            <SearchIcon className="absolute left-4 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Search movies, TV shows, anime, K-dramas, actors..."
              className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] placeholder-[var(--text-muted)] rounded-2xl pl-12 pr-28 py-3.5 sm:py-4 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))] shadow-lg transition-all"
            />
            {inputVal && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-20 p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2.5 px-4 py-2 bg-[rgb(var(--primary-color))] hover:brightness-110 text-white font-semibold text-sm rounded-xl transition-all shadow-md"
            >
              Search
            </button>
          </div>
        </form>

        {/* Popular / Quick Search Tags */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 text-xs text-[var(--text-muted)] custom-scrollbar">
          <span className="shrink-0 flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Popular:
          </span>
          {quickSearches.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                setInputVal(term);
                setSearchParams({ q: term });
              }}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* Header and Filter Tabs Bar */}
      {query && (
        <div className="mb-8 border-b border-[var(--border-subtle)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] flex items-center gap-2">
              <span>Results for</span>
              <span className="text-[rgb(var(--primary-color))] truncate max-w-sm sm:max-w-md">"{query}"</span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
              Found {combinedAll.length} titles across movies, series, and AniList anime.
            </p>
          </div>

          {/* Filter Pills */}
          {combinedAll.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold self-start sm:self-auto overflow-x-auto">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'all'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                All ({combinedAll.length})
              </button>
              <button
                onClick={() => setActiveTab('movie')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'movie'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Film className="w-3 h-3 text-cyan-400" />
                <span>Movies ({categorized.movies.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('tv')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === 'tv'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Tv className="w-3 h-3 text-purple-400" />
                <span>Series ({categorized.tvShows.length})</span>
              </button>
              {animeResults.length > 0 && (
                <button
                  onClick={() => setActiveTab('anime')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'anime'
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-pink-400'
                  }`}
                >
                  <Ghost className="w-3 h-3 text-pink-400" />
                  <span>Anime ({animeResults.length})</span>
                </button>
              )}
              {categorized.people.length > 0 && (
                <button
                  onClick={() => setActiveTab('person')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                    activeTab === 'person'
                      ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <User className="w-3 h-3 text-orange-400" />
                  <span>People ({categorized.people.length})</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && !tmdbResults && !animeRawResults ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-12 h-12 text-[rgb(var(--primary-color))] animate-spin mb-4" />
          <p className="text-[var(--text-muted)] text-sm animate-pulse">
            Deep-searching TMDB and AniList for matching movies, shows, and anime...
          </p>
        </div>
      ) : filteredItems && filteredItems.length > 0 ? (
        /* Results Grid */
        <div className="animate-in fade-in slide-in-from-bottom-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {filteredItems.map(item => (
              <div key={`${item.media_type || 'media'}_${item.id}`} className="flex flex-col">
                <MediaCard item={item} onClick={onSelect} />
              </div>
            ))}
          </div>
        </div>
      ) : query ? (
        /* No Results Empty State */
        <div className="flex flex-col items-center justify-center py-28 text-center text-[var(--text-muted)]">
          <div className="w-20 h-20 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center mb-6">
            <Ghost className="w-10 h-10 text-[var(--text-muted)] opacity-50" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">No matching titles found</h2>
          <p className="max-w-md text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
            We couldn't find any titles matching <span className="text-[var(--text-main)] font-semibold">"{query}"</span>. 
            Try verifying your spelling or checking alternative English and Romanized anime titles.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button 
              onClick={() => navigate('/discover')}
              className="px-6 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors font-bold text-sm text-[var(--text-main)]"
            >
              Explore Discover
            </button>
            <button 
              onClick={() => navigate('/anime')}
              className="px-6 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-hover)] transition-colors font-bold text-sm text-pink-400"
            >
              Browse Anime
            </button>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-[rgb(var(--primary-color))] rounded-xl hover:brightness-110 transition-all font-bold text-sm text-white shadow-lg"
            >
              Back to Home
            </button>
          </div>
        </div>
      ) : (
        /* Initial Empty Search State */
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[rgb(var(--primary-color))]/10 text-[rgb(var(--primary-color))] flex items-center justify-center mb-4">
            <SearchIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">Search the Infinite Library</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-sm">
            Search across movies, television series, and high-accuracy AniList anime database.
          </p>
        </div>
      )}
    </div>
  );
};
