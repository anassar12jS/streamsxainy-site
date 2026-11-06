import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TMDBResult, MediaType } from '../types';
import { discoverMedia, getGenres } from '../services/tmdb';
import { MediaCard } from '../components/MediaCard';
import { TMDB_POSTER_BASE, POSTER_FALLBACK_SVG } from '../constants';
import { STREAMING_PROVIDERS } from '../components/StreamingProvidersShowcase';
import { 
  Filter, Dices, X, Loader2, Play, RefreshCw, Star, 
  Sparkles, Film, Tv, Calendar, ArrowUpDown, AlertCircle
} from 'lucide-react';

interface DiscoverProps {
  onSelect: (item: TMDBResult) => void;
}

export const Discover: React.FC<DiscoverProps> = ({ onSelect }) => {
  const [searchParams] = useSearchParams();
  const initialProvider = searchParams.get('provider') ? Number(searchParams.get('provider')) : undefined;
  const initialType = searchParams.get('type') === 'tv' ? MediaType.TV : MediaType.MOVIE;

  const [items, setItems] = useState<TMDBResult[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>(initialType);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | undefined>(undefined);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedProvider, setSelectedProvider] = useState<number | undefined>(initialProvider);
  const [sortBy, setSortBy] = useState('popularity.desc');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rouletteError, setRouletteError] = useState<string | null>(null);

  // Roulette State
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rouletteWinner, setRouletteWinner] = useState<TMDBResult | null>(null);
  const [displayItem, setDisplayItem] = useState<TMDBResult | null>(null);

  const years = Array.from({ length: 35 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    getGenres(mediaType).then(setGenres);
    setCurrentPage(1);
  }, [mediaType]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await discoverMedia(mediaType, sortBy, selectedGenre, selectedYear, currentPage, selectedProvider);
        if (currentPage === 1) {
          setItems(res);
        } else {
          setItems(prev => {
            const existingIds = new Set(prev.map(i => i.id));
            const newOnes = res.filter(i => !existingIds.has(i.id));
            return [...prev, ...newOnes];
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [mediaType, sortBy, selectedGenre, selectedYear, currentPage, selectedProvider]);

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleSpin = async () => {
    setSpinning(true);
    setRouletteWinner(null);
    setDisplayItem(null);
    setRouletteError(null);

    try {
      const randomPage = Math.floor(Math.random() * 15) + 1;
      const results = await discoverMedia(
        mediaType, 
        'popularity.desc', 
        selectedGenre,
        selectedYear,
        randomPage
      );

      if (results.length > 0) {
        let steps = 0;
        const maxSteps = 18;
        const intervalTime = 110;

        const interval = setInterval(() => {
          const randomIdx = Math.floor(Math.random() * results.length);
          setDisplayItem(results[randomIdx]);
          steps++;

          if (steps >= maxSteps) {
            clearInterval(interval);
            const finalWinner = results[Math.floor(Math.random() * results.length)];
            setDisplayItem(finalWinner);
            setRouletteWinner(finalWinner);
            setSpinning(false);
          }
        }, intervalTime);
      } else {
        setSpinning(false);
        setRouletteError('No titles found for these exact filters. Try choosing "All Genres" or any year.');
      }
    } catch {
      setSpinning(false);
      setRouletteError('Roulette encountered a network error. Please try spinning again.');
    }
  };

  const handleRouletteClose = () => {
    setIsRouletteOpen(false);
    setRouletteWinner(null);
    setDisplayItem(null);
    setRouletteError(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen animate-fade-in relative text-[var(--text-main)]">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] mb-2 flex items-center gap-3 tracking-tight">
            <span>Explore Discovery</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Curate and filter through millions of blockbusters, indie gems, and binge-worthy shows.
          </p>
        </div>

        {/* Media Type Segmented Switcher */}
        <div className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-subtle)] shadow-sm">
          <button
            onClick={() => { setMediaType(MediaType.MOVIE); setSelectedGenre(undefined); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              mediaType === MediaType.MOVIE
                ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Movies</span>
          </button>
          <button
            onClick={() => { setMediaType(MediaType.TV); setSelectedGenre(undefined); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              mediaType === MediaType.TV
                ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>TV Shows</span>
          </button>
        </div>
      </div>

      {/* Filter Selectors Bar */}
      <div className="bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-subtle)] shadow-lg mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Genre Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Genre</label>
            <select 
              value={selectedGenre || ''}
              onChange={(e) => { setSelectedGenre(e.target.value ? Number(e.target.value) : undefined); handleFilterChange(); }}
              className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:border-[rgb(var(--primary-color))] outline-none font-medium cursor-pointer"
            >
              <option value="">All Genres</option>
              {genres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {/* Streaming Provider Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Streaming Platform</label>
            <select 
              value={selectedProvider || ''}
              onChange={(e) => { setSelectedProvider(e.target.value ? Number(e.target.value) : undefined); handleFilterChange(); }}
              className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:border-[rgb(var(--primary-color))] outline-none font-medium cursor-pointer"
            >
              <option value="">All Platforms</option>
              {STREAMING_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Release Year Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Release Year</label>
            <select 
              value={selectedYear || ''}
              onChange={(e) => { setSelectedYear(e.target.value ? Number(e.target.value) : undefined); handleFilterChange(); }}
              className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:border-[rgb(var(--primary-color))] outline-none font-medium cursor-pointer"
            >
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Sort Order</label>
            <select 
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); handleFilterChange(); }}
              className="w-full bg-[var(--bg-main)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs sm:text-sm rounded-xl px-3.5 py-2.5 focus:border-[rgb(var(--primary-color))] outline-none font-medium cursor-pointer"
            >
              <option value="popularity.desc">Most Popular</option>
              <option value="vote_average.desc">Highest Rated (Critics)</option>
              <option value="primary_release_date.desc">Newest Releases</option>
              <option value="revenue.desc">Worldwide Box Office</option>
            </select>
          </div>

        </div>

        {/* Quick Genre Chips */}
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
          <span className="shrink-0 text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mr-1">
            Quick:
          </span>
          <button
            onClick={() => { setSelectedGenre(undefined); handleFilterChange(); }}
            className={`shrink-0 px-3 py-1 rounded-lg font-medium transition-all ${
              selectedGenre === undefined 
                ? 'bg-[rgb(var(--primary-color))] text-white shadow-xs' 
                : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            All
          </button>
          {genres.slice(0, 8).map(g => (
            <button
              key={g.id}
              onClick={() => { setSelectedGenre(g.id); handleFilterChange(); }}
              className={`shrink-0 px-3 py-1 rounded-lg font-medium transition-all ${
                selectedGenre === g.id 
                  ? 'bg-[rgb(var(--primary-color))] text-white shadow-xs' 
                  : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Results */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-main)]">
              {selectedGenre ? genres.find(g => g.id === selectedGenre)?.name : 'Curated'} {mediaType === MediaType.TV ? 'Series' : 'Films'}
            </h2>
            <span className="text-xs text-[var(--text-muted)] font-medium">({items.length} titles loaded)</span>
          </div>
        </div>

        {loading && currentPage === 1 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {[...Array(18)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-[var(--bg-card)] rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 text-[var(--text-muted)] bg-[var(--bg-card)] rounded-3xl border border-[var(--border-subtle)] p-8">
            <Filter className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">No matching titles</h3>
            <p className="text-sm max-w-sm mx-auto">
              No titles match this combination of filters. Try choosing "All Genres" or broadening the release year.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {items.map(item => (
                <MediaCard key={item.id} item={item} onClick={onSelect} />
              ))}
            </div>
            
            {/* Load More Button */}
            <div className="flex justify-center mt-12 mb-6">
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={loading}
                className="px-8 py-3.5 bg-[rgb(var(--primary-color))] hover:brightness-110 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-xl shadow-[rgb(var(--primary-color))]/25 hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading Titles...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Load More Results</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Floating Movie Roulette FAB */}
      <button 
        onClick={() => setIsRouletteOpen(true)}
        className="fixed bottom-8 right-8 z-40 bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 text-white p-4 rounded-2xl shadow-2xl hover:scale-105 transition-all border border-white/20 group hover:shadow-pink-500/25"
        title="Spin the Movie Roulette"
        aria-label="Spin Movie Roulette"
      >
        <Dices className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
      </button>

      {/* Movie Roulette Modal */}
      {isRouletteOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={handleRouletteClose}
        >
          <div 
            className="bg-[#121216] border border-white/15 w-full max-w-md rounded-3xl p-6 relative shadow-2xl flex flex-col items-center text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={handleRouletteClose} 
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Modal Header */}
            <div className="text-center mb-5">
              <h3 className="text-xl sm:text-2xl font-black text-white flex items-center justify-center gap-2 tracking-tight">
                <Dices className="w-6 h-6 text-pink-500" /> 
                {spinning ? 'SPINNING ROULETTE...' : rouletteWinner ? 'WE FOUND A MATCH!' : 'MOVIE ROULETTE'}
              </h3>
              <p className="text-white/60 text-xs mt-1">
                {spinning 
                  ? 'Searching through thousands of curated titles...' 
                  : rouletteWinner 
                    ? 'Your lucky pick is ready to stream!' 
                    : 'Unsure what to watch? Let destiny choose for you.'}
              </p>
            </div>

            {/* Error Message */}
            {rouletteError && (
              <div className="w-full mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{rouletteError}</span>
              </div>
            )}

            {/* Poster Carousel Display Box */}
            <div className="w-full aspect-[2/3] max-h-[360px] bg-black/60 rounded-2xl mb-5 relative overflow-hidden border border-white/15 shadow-2xl flex items-center justify-center group">
              
              {/* Idle State */}
              {!spinning && !displayItem && !rouletteWinner && (
                <div className="text-center p-6 opacity-60">
                  <Dices className="w-14 h-14 mx-auto mb-3 text-pink-400" />
                  <p className="font-bold text-sm text-white">Press Spin to Start</p>
                  <p className="text-xs text-white/50 mt-1">Uses your currently selected filters</p>
                </div>
              )}

              {/* Displaying Poster */}
              {displayItem && (
                <>
                  <img 
                    src={displayItem.poster_path ? `${TMDB_POSTER_BASE}${displayItem.poster_path}` : POSTER_FALLBACK_SVG} 
                    alt="Poster" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  
                  {/* Title & Metadata Overlay */}
                  <div className="absolute bottom-0 left-0 w-full p-4 text-center">
                    <h2 className="text-white text-lg sm:text-xl font-black leading-tight drop-shadow-md mb-1 line-clamp-2">
                      {displayItem.title || displayItem.name}
                    </h2>
                    <div className="flex justify-center items-center gap-2 text-xs text-white/80 font-medium">
                      {typeof displayItem.vote_average === 'number' && displayItem.vote_average > 0 && (
                        <span className="text-amber-400 flex items-center gap-1 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" /> 
                          {displayItem.vote_average.toFixed(1)}
                        </span>
                      )}
                      <span>·</span>
                      <span>{(displayItem.release_date || displayItem.first_air_date)?.split('-')[0]}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-2.5">
              {!rouletteWinner ? (
                <button 
                  onClick={handleSpin}
                  disabled={spinning}
                  className="w-full py-3.5 bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 text-white rounded-xl font-bold text-base shadow-xl hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                >
                  {spinning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Dices className="w-5 h-5" />}
                  <span>{spinning ? 'Finding title...' : 'SPIN THE ROULETTE'}</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 animate-in fade-in slide-in-from-bottom-2">
                  <button 
                    onClick={handleSpin}
                    className="py-3 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Spin Again
                  </button>
                  <button 
                    onClick={() => {
                      handleRouletteClose();
                      onSelect(rouletteWinner);
                    }}
                    className="py-3 bg-[rgb(var(--primary-color))] hover:brightness-110 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[rgb(var(--primary-color))]/25 transition-transform hover:scale-105"
                  >
                    <Play className="w-4 h-4 fill-current" /> Watch Now
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
