import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  getTrending, 
  getTrendingWeek,
  getPopularMovies, 
  getPopularTV, 
  getTopRatedMovies, 
  getTopRatedTV,
  getNowPlayingMovies,
  getUpcomingMovies,
  getVideos
} from '../services/tmdb';
import { 
  getProgress, 
  removeFromWatchlist, 
  addToWatchlist, 
  isInWatchlist, 
  saveProgress,
  removeFromProgress 
} from '../services/storage';
import { TMDBResult, MediaType, ContinueWatchingItem } from '../types';
import { MediaCard } from '../components/MediaCard';
import { StreamingProvidersShowcase } from '../components/StreamingProvidersShowcase';
import { TMDB_BACKDROP_W1280, TMDB_BACKDROP_W780, TMDB_BACKDROP_W300, TMDB_POSTER_BASE, BACKDROP_FALLBACK_SVG } from '../constants';
import { 
  Play, Info, Star, ChevronLeft, ChevronRight, 
  Plus, Check, Youtube, X, Film, Tv, 
  CheckCircle2, ArrowRight, Pause, Flame, Rocket,
  Clapperboard, Smile, Ghost, ShieldAlert, Globe,
  LayoutGrid, TrendingUp, Award, Ticket, Clock, Trophy
} from 'lucide-react';
import { RowSkeleton, Skeleton } from '../components/Skeleton';
import { Reveal } from '../components/Reveal';

interface HomeProps {
  onSelect?: (item: TMDBResult) => void;
}

const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics'
};

const POPULAR_GENRE_HUBS = [
  { id: 28, name: 'Action', sub: 'High stakes', icon: Flame, gradient: 'from-orange-600/85 via-red-600/80 to-rose-900/90', glow: 'group-hover:shadow-orange-500/25' },
  { id: 878, name: 'Sci-Fi & Fantasy', sub: 'New worlds', icon: Rocket, gradient: 'from-cyan-500/80 via-blue-600/85 to-indigo-900/90', glow: 'group-hover:shadow-cyan-500/25' },
  { id: 18, name: 'Drama', sub: 'Character driven', icon: Clapperboard, gradient: 'from-amber-500/80 via-amber-700/85 to-stone-900/95', glow: 'group-hover:shadow-amber-500/25' },
  { id: 35, name: 'Comedy', sub: 'Feel-good hits', icon: Smile, gradient: 'from-yellow-500/80 via-orange-500/80 to-rose-900/90', glow: 'group-hover:shadow-yellow-500/25' },
  { id: 27, name: 'Horror', sub: 'Late-night chills', icon: Ghost, gradient: 'from-rose-700/85 via-red-900/90 to-zinc-950', glow: 'group-hover:shadow-red-600/30' },
  { id: 53, name: 'Crime & Thriller', sub: 'Edge of seat', icon: ShieldAlert, gradient: 'from-emerald-500/80 via-teal-700/85 to-slate-900/95', glow: 'group-hover:shadow-emerald-500/25' },
  { id: 16, name: 'Animation', sub: 'Worlds in motion', icon: Film, gradient: 'from-violet-500/85 via-purple-700/85 to-indigo-950', glow: 'group-hover:shadow-violet-500/25' },
  { id: 99, name: 'Documentary', sub: 'True stories', icon: Globe, gradient: 'from-sky-500/80 via-blue-700/85 to-slate-900/95', glow: 'group-hover:shadow-sky-500/25' },
];

// Interactive Horizontal Row with Desktop Left/Right Chevron Controls & Optional View All Link
const InteractiveRow = React.memo(({ 
  title, 
  items, 
  icon: Icon,
  viewAllLink,
  onSelect 
}: { 
  title: string; 
  items: TMDBResult[]; 
  icon?: React.ElementType; 
  badge?: string;
  viewAllLink?: string;
  onSelect: (item: TMDBResult) => void; 
}) => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 20);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -offset : offset,
        behavior: 'smooth'
      });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <Reveal className="mb-12 relative group/row cv-row">
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 rounded-full bg-[rgb(var(--primary-color))] shrink-0" />
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary-color))]/12 border border-[rgb(var(--primary-color))]/25 flex items-center justify-center text-[rgb(var(--primary-color))] shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--text-main)] tracking-tight">
            {title}
          </h2>
        </div>

        {/* Right Controls: View All + Desktop Arrow Controls */}
        <div className="flex items-center gap-2.5">
          {viewAllLink && (
            <button
              onClick={() => navigate(viewAllLink)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5 text-[rgb(var(--primary-color))]" />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className="p-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              className="p-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Row Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex overflow-x-auto overflow-y-hidden overscroll-x-contain space-x-4 px-4 sm:px-6 pb-4 custom-scrollbar scroll-smooth snap-x snap-proximity"
      >
        {items.map(item => (
          <div key={item.id} className="snap-start shrink-0">
            <MediaCard item={item} onClick={onSelect} />
          </div>
        ))}
        <div className="w-4 shrink-0" />
      </div>
    </Reveal>
  );
});

// Editorial Top 10 Showcase with clean photography and crisp tabular index below frame
const Top10Showcase = React.memo(({ 
  allTop, 
  moviesTop, 
  seriesTop, 
  onSelect 
}: { 
  allTop: TMDBResult[]; 
  moviesTop: TMDBResult[]; 
  seriesTop: TMDBResult[]; 
  onSelect: (item: TMDBResult) => void; 
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'series'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayItems = useMemo(() => {
    if (activeTab === 'movies') return moviesTop.slice(0, 10);
    if (activeTab === 'series') return seriesTop.slice(0, 10);
    return allTop.slice(0, 10);
  }, [activeTab, allTop, moviesTop, seriesTop]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -380 : 380,
        behavior: 'smooth'
      });
    }
  };

  return (
    <Reveal className="mb-12 relative group/top10 z-10 cv-row">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[rgb(var(--primary-color))] to-rose-700 flex items-center justify-center text-white shadow-lg shadow-[rgb(var(--primary-color))]/30 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--primary-color))] block">
              Daily Charts
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">
              Top 10 Today
            </h2>
          </div>
        </div>

        {/* Tab Switcher & Navigation Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold shadow-sm">
            {([
              { id: 'all', label: 'All' },
              { id: 'movies', label: 'Movies' },
              { id: 'series', label: 'Series' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-md shadow-[rgb(var(--primary-color))]/25'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => scroll('left')}
              className="p-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Sculpted Top 10 Poster Cards */}
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto overflow-y-hidden overscroll-x-contain space-x-5 px-4 sm:px-6 pb-4 custom-scrollbar scroll-smooth snap-x snap-proximity"
      >
        {displayItems.map((item, index) => {
          const itemKey = `${item.media_type || (item.title ? 'movie' : 'tv')}-${item.id}`;
          const posterSrc = item.poster_path
            ? `${TMDB_POSTER_BASE}${item.poster_path}`
            : item.backdrop_path
              ? `${TMDB_BACKDROP_W780}${item.backdrop_path}`
              : BACKDROP_FALLBACK_SVG;
          const rankNum = index + 1;
          const year = (item.first_air_date || item.release_date)?.split('-')[0];
          const score = item.vote_average ? item.vote_average.toFixed(1) : null;

          return (
            <button
              key={itemKey}
              type="button"
              onClick={() => onSelect(item)}
              className="snap-start shrink-0 flex items-end text-left group cursor-pointer pt-2 pl-1"
            >
              {/* Sculpted Rank Numeral (cleanly anchored beside poster without colliding) */}
              <div className="relative z-10 -mr-2.5 pb-11 select-none pointer-events-none">
                <span
                  className="font-display font-black leading-[0.8] tracking-tighter text-[76px] sm:text-[92px] text-transparent bg-clip-text bg-gradient-to-b from-[var(--text-main)] via-[var(--text-muted)]/75 to-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)] group-hover:from-[rgb(var(--primary-color))] group-hover:via-[rgb(var(--primary-color))]/75 transition-all duration-300"
                  style={{ WebkitTextStroke: '1.5px rgba(161, 161, 170, 0.35)' }}
                >
                  {rankNum}
                </span>
              </div>

              {/* Poster Column */}
              <div className="w-[144px] sm:w-[168px]">
                <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] group-hover:border-[rgb(var(--primary-color))]/70 shadow-xl shadow-black/40 group-hover:shadow-[0_14px_32px_-8px_rgba(var(--primary-color),0.4)] group-hover:-translate-y-1 transition-all duration-300">
                  <img
                    src={posterSrc}
                    alt={item.name || item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = BACKDROP_FALLBACK_SVG;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/15 pointer-events-none" />

                  {score && (
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[11px] font-semibold text-amber-400 flex items-center gap-1 font-mono tabular-nums border border-white/10">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{score}</span>
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-[rgb(var(--primary-color))] text-white flex items-center justify-center shadow-lg shadow-[rgb(var(--primary-color))]/45">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 px-0.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-main)] truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">
                    {item.name || item.title}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5 tabular-nums">
                    <span>{item.media_type === 'tv' ? 'Series' : 'Movie'}</span>
                    {year && <span>· {year}</span>}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
        <div className="w-4 shrink-0" />
      </div>
    </Reveal>
  );
});

export const Home: React.FC<HomeProps> = ({ onSelect }) => {
  const navigate = useNavigate();

  // Queries
  const { data: trending, isLoading: loadingTrending } = useQuery({ 
    queryKey: ['trending'], 
    queryFn: getTrending,
    staleTime: 1000 * 60 * 15
  });
  const { data: trendingWeek } = useQuery({ 
    queryKey: ['trending', 'week'], 
    queryFn: getTrendingWeek,
    staleTime: 1000 * 60 * 30
  });
  const { data: movies, isLoading: loadingMovies } = useQuery({ 
    queryKey: ['movies', 'popular'], 
    queryFn: getPopularMovies,
    staleTime: 1000 * 60 * 30
  });
  const { data: series, isLoading: loadingSeries } = useQuery({ 
    queryKey: ['series', 'popular'], 
    queryFn: getPopularTV,
    staleTime: 1000 * 60 * 30
  });
  const { data: topRatedMovies } = useQuery({ 
    queryKey: ['movies', 'top'], 
    queryFn: getTopRatedMovies,
    staleTime: 1000 * 60 * 60
  });
  const { data: topRatedSeries } = useQuery({ 
    queryKey: ['series', 'top'], 
    queryFn: getTopRatedTV,
    staleTime: 1000 * 60 * 60
  });
  const { data: nowPlaying } = useQuery({ 
    queryKey: ['movies', 'nowPlaying'], 
    queryFn: getNowPlayingMovies,
    staleTime: 1000 * 60 * 30
  });
  const { data: upcomingMovies } = useQuery({ 
    queryKey: ['movies', 'upcoming'], 
    queryFn: getUpcomingMovies,
    staleTime: 1000 * 60 * 60
  });

  // Local State
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  const [continueWatchingList, setContinueWatchingList] = useState<ContinueWatchingItem[]>([]);
  const [selectedTrailerKey, setSelectedTrailerKey] = useState<string | null>(null);
  const [selectedTrailerTitle, setSelectedTrailerTitle] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [inWatchlistState, setInWatchlistState] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const toastTimerRef = useRef<number | null>(null);
  const SLIDE_DURATION_MS = 8000;
  const heroRemainingRef = useRef<number>(SLIDE_DURATION_MS);
  const heroDeadlineRef = useRef<number>(0);

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2500);
  };

  const formatTime = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Sync Continue Watching live across tabs and playback sessions
  useEffect(() => {
    const syncProgress = () => {
      setContinueWatchingList(getProgress());
    };
    syncProgress();
    window.addEventListener('streamhub_storage_update', syncProgress);
    window.addEventListener('storage', syncProgress);
    return () => {
      window.removeEventListener('streamhub_storage_update', syncProgress);
      window.removeEventListener('storage', syncProgress);
    };
  }, []);

  const featuredList = useMemo(() => {
    return trending?.slice(0, 6) || [];
  }, [trending]);

  const currentHero = featuredList[heroIndex] || trending?.[0];

  // Sync Watchlist state for current hero
  useEffect(() => {
    if (currentHero) {
      setInWatchlistState(isInWatchlist(currentHero.id));
    }
  }, [currentHero, heroIndex]);

  // Auto-advance hero: single timeout instead of a 100ms interval re-rendering
  // the whole page. Remaining time is tracked so hover/pause resumes correctly.
  useEffect(() => {
    if (featuredList.length <= 1) return;

    const paused = isHeroHovered || isHeroPaused;
    if (paused) {
      heroRemainingRef.current = Math.max(0, heroDeadlineRef.current - Date.now());
      return;
    }

    heroDeadlineRef.current = Date.now() + heroRemainingRef.current;
    const timer = window.setTimeout(() => {
      heroRemainingRef.current = SLIDE_DURATION_MS;
      setHeroIndex(curr => (curr + 1) % featuredList.length);
    }, heroRemainingRef.current);

    return () => window.clearTimeout(timer);
  }, [featuredList.length, isHeroHovered, isHeroPaused, heroIndex]);

  const resetHeroTimer = () => {
    heroRemainingRef.current = SLIDE_DURATION_MS;
    heroDeadlineRef.current = Date.now() + SLIDE_DURATION_MS;
  };

  const goToNextHero = () => {
    if (featuredList.length <= 1) return;
    resetHeroTimer();
    setHeroIndex(prev => (prev + 1) % featuredList.length);
  };

  const goToPrevHero = () => {
    if (featuredList.length <= 1) return;
    resetHeroTimer();
    setHeroIndex(prev => (prev - 1 + featuredList.length) % featuredList.length);
  };

  // Keyboard navigation for Hero Spotlight (Left/Right Arrows)
  useEffect(() => {
    const handleHeroKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      if (window.scrollY < 450) {
        if (e.key === 'ArrowRight') {
          goToNextHero();
        } else if (e.key === 'ArrowLeft') {
          goToPrevHero();
        }
      }
    };
    window.addEventListener('keydown', handleHeroKeyDown);
    return () => window.removeEventListener('keydown', handleHeroKeyDown);
  }, [featuredList.length]);

  const handleSelect = (item: TMDBResult) => {
    if (onSelect) {
      onSelect(item);
      return;
    }
    const state = { item };
    if (item.media_type === 'movie') {
      navigate(`/movie/${item.id}`, { state });
    } else if (item.media_type === 'tv') {
      navigate(`/tv/${item.id}`, { state });
    } else {
      if (item.title) navigate(`/movie/${item.id}`, { state });
      else if (item.name) navigate(`/tv/${item.id}`, { state });
      else navigate(`/movie/${item.id}`, { state });
    }
  };

  const handleQuickPlay = (item: TMDBResult) => {
    const type = item.media_type === 'tv' ? MediaType.TV : MediaType.MOVIE;
    saveProgress({
      id: item.id,
      anilist_id: item.anilist_id,
      media_type: type,
      title: item.title || item.name || '',
      poster_path: item.poster_path || null,
      season: type === MediaType.TV ? 1 : undefined,
      episode: type === MediaType.TV ? 1 : undefined,
    });
    const anilistParam = item.anilist_id ? `?anilistId=${item.anilist_id}` : '';
    if (type === MediaType.MOVIE) {
      navigate(`/watch/movie/${item.id}${anilistParam}`);
    } else {
      navigate(`/watch/tv/${item.id}/1/1${anilistParam}`);
    }
  };

  const handleResumeContinueWatching = (cw: ContinueWatchingItem) => {
    const anilistParam = cw.anilist_id ? `?anilistId=${cw.anilist_id}` : '';
    if (cw.media_type === MediaType.MOVIE) {
      navigate(`/watch/movie/${cw.id}${anilistParam}`);
    } else {
      navigate(`/watch/tv/${cw.id}/${cw.season || 1}/${cw.episode || 1}${anilistParam}`);
    }
  };

  const handleRemoveContinueWatching = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    removeFromProgress(id);
    setContinueWatchingList(prev => prev.filter(i => i.id !== id));
    showToast('Removed from Continue Watching');
  };

  const toggleWatchlistForHero = () => {
    if (!currentHero) return;
    if (inWatchlistState) {
      removeFromWatchlist(currentHero.id);
      setInWatchlistState(false);
      showToast('Removed from Watchlist');
    } else {
      addToWatchlist(currentHero);
      setInWatchlistState(true);
      showToast('Added to Watchlist');
    }
  };

  const handleOpenTrailer = async (item: TMDBResult) => {
    const type = item.media_type === 'tv' ? MediaType.TV : MediaType.MOVIE;
    try {
      const vids = await getVideos(item.id, type);
      const yt = vids.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || vids[0];
      if (yt?.key) {
        setSelectedTrailerKey(yt.key);
        setSelectedTrailerTitle(item.title || item.name || 'Trailer');
      } else {
        showToast('No official trailer found for this title');
      }
    } catch {
      showToast('Unable to load trailer right now');
    }
  };

  const heroGenres = useMemo(() => {
    if (!currentHero?.genre_ids) return '';
    return currentHero.genre_ids
      .slice(0, 3)
      .map(id => TMDB_GENRE_MAP[id])
      .filter(Boolean)
      .join(' · ');
  }, [currentHero?.genre_ids]);

  const isLoadingInitial = loadingTrending && loadingMovies && loadingSeries;

  if (isLoadingInitial) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] pb-20">
        <div className="relative h-[calc(100vh-4.5rem)] min-h-[460px] max-h-[720px] w-full bg-[var(--bg-card)] animate-pulse mb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-end pb-16 space-y-4">
            <Skeleton width={180} height={24} variant="rectangular" className="rounded-md" />
            <Skeleton width={380} height={60} variant="rectangular" className="rounded-xl" />
            <Skeleton width={260} height={20} variant="rectangular" className="rounded-md" />
            <Skeleton width={520} height={70} variant="rectangular" className="rounded-xl" />
            <div className="flex gap-4 pt-2">
              <Skeleton width={160} height={50} variant="rectangular" className="rounded-xl" />
              <Skeleton width={140} height={50} variant="rectangular" className="rounded-xl" />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-[var(--bg-main)] text-[var(--text-main)] overflow-x-hidden transition-colors duration-300 relative selection:bg-[rgb(var(--primary-color))]/30">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#18181b] border border-white/15 text-white px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-[rgb(var(--primary-color))]" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Trailer Modal */}
      {selectedTrailerKey && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in"
          onClick={() => setSelectedTrailerKey(null)}
        >
          <div 
            className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 bg-zinc-950 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-white text-sm sm:text-base truncate max-w-md">{selectedTrailerTitle}</h3>
              </div>
              <button 
                onClick={() => setSelectedTrailerKey(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                aria-label="Close trailer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${selectedTrailerKey}?autoplay=1&rel=0`}
                title="Trailer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Cinematic Hero Spotlight Carousel */}
      {currentHero && (
        <div 
          className="relative h-[clamp(440px,76vh,640px)] lg:h-[clamp(480px,80vh,680px)] w-full mb-8 sm:mb-10 group/hero overflow-hidden bg-[#09090b]"
          onMouseEnter={() => setIsHeroHovered(true)}
          onMouseLeave={() => setIsHeroHovered(false)}
        >
          {/* Backdrop Images with Smooth Cross-Fade & Gentle Ken Burns Effect */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            {featuredList.map((item, idx) => (
              <div
                key={item.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  idx === heroIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <img 
                  src={`${TMDB_BACKDROP_W1280}${item.backdrop_path}`} 
                  srcSet={item.backdrop_path ? `${TMDB_BACKDROP_W780}${item.backdrop_path} 780w, ${TMDB_BACKDROP_W1280}${item.backdrop_path} 1280w` : undefined}
                  sizes="100vw"
                  alt={item.title || item.name} 
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  {...(idx === 0 ? ({ fetchpriority: 'high' } as any) : {})}
                  className="w-full h-full object-cover object-center transform scale-100 group-hover/hero:scale-105 transition-transform duration-[12s] ease-out"
                />
              </div>
            ))}

            {/* Top Scrim */}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#09090b]/80 via-[#09090b]/35 to-transparent pointer-events-none z-10" />

            {/* Left Scrim for Text Contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/95 via-[#09090b]/70 to-transparent w-full lg:w-3/5 z-10" />

            {/* Bottom Scrim */}
            <div className="absolute inset-x-0 bottom-0 h-44 sm:h-52 bg-gradient-to-t from-[#09090b] via-[#09090b]/75 to-transparent pointer-events-none z-10" />
          </div>

          {/* Desktop Direct Hero Chevrons */}
          <button
            type="button"
            onClick={goToPrevHero}
            className="flex absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 text-white items-center justify-center opacity-70 sm:opacity-0 sm:group-hover/hero:opacity-100 transition-all cursor-pointer"
            aria-label="Previous Spotlight"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={goToNextHero}
            className="flex absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/50 hover:bg-black/80 border border-white/15 text-white items-center justify-center opacity-70 sm:opacity-0 sm:group-hover/hero:opacity-100 transition-all cursor-pointer"
            aria-label="Next Spotlight"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Hero Content Body */}
          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-12 sm:pb-14 lg:pb-16">
            <div className="max-w-2xl flex flex-col gap-3">
              
              {/* Editorial Eyebrow Pill */}
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase animate-fade-in flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[rgb(var(--primary-color))] text-white shadow-md shadow-[rgb(var(--primary-color))]/35">
                  <Flame className="w-3 h-3 fill-current" />
                  <span>Featured</span>
                </span>
                {heroGenres && (
                  <span className="px-2.5 py-1 rounded-md bg-black/55 backdrop-blur-md border border-white/15 text-white/90 tracking-wider">
                    {heroGenres}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsHeroPaused(p => !p)}
                  className="p-1.5 rounded-md bg-black/50 hover:bg-black/75 border border-white/15 text-white/70 hover:text-white transition-colors cursor-pointer backdrop-blur-md"
                  title={isHeroPaused ? 'Resume slideshow' : 'Pause slideshow'}
                  aria-label={isHeroPaused ? 'Resume slideshow' : 'Pause slideshow'}
                >
                  {isHeroPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
                </button>
              </div>

              {/* Title with Cinematic Drop Shadow */}
              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.06] tracking-tight animate-fade-in line-clamp-2 max-w-2xl drop-shadow-[0_6px_24px_rgba(0,0,0,0.75)]" style={{ textWrap: 'balance' }}>
                {currentHero.title || currentHero.name}
              </h1>

              {/* Metadata Pills */}
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-white/90 animate-fade-in tabular-nums">
                {typeof currentHero.vote_average === 'number' && currentHero.vote_average > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-300 backdrop-blur-md">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                    <span>{currentHero.vote_average.toFixed(1)}</span>
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 backdrop-blur-md text-white">
                  {currentHero.media_type === 'tv' ? 'TV Series' : 'Feature Film'}
                </span>
                {(currentHero.first_air_date || currentHero.release_date) && (
                  <span className="px-2.5 py-1 rounded-lg bg-black/45 border border-white/15 backdrop-blur-md text-white/85 font-mono">
                    {(currentHero.first_air_date || currentHero.release_date)?.split('-')[0]}
                  </span>
                )}
              </div>

              {/* Synopsis */}
              <p className="text-zinc-200/90 text-xs sm:text-sm line-clamp-2 max-w-xl font-normal leading-relaxed animate-fade-in drop-shadow">
                {currentHero.overview}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 animate-fade-in shrink-0 relative z-30">
                <button
                  onClick={() => handleQuickPlay(currentHero)}
                  className="flex items-center gap-2 bg-[rgb(var(--primary-color))] hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] text-white px-6 py-3 rounded-xl font-bold text-xs sm:text-sm shadow-xl shadow-[rgb(var(--primary-color))]/40 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Watch Now</span>
                </button>

                <button
                  onClick={() => handleOpenTrailer(currentHero)}
                  className="flex items-center gap-2 bg-black/60 hover:bg-black/80 border border-white/20 text-white px-4 py-3 rounded-xl font-semibold text-xs sm:text-sm backdrop-blur-md transition-all cursor-pointer"
                >
                  <Youtube className="w-4 h-4 text-red-500" />
                  <span>Trailer</span>
                </button>

                <button
                  onClick={() => handleSelect(currentHero)}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-4 py-3 rounded-xl font-semibold text-xs sm:text-sm backdrop-blur-md transition-all cursor-pointer"
                >
                  <Info className="w-4 h-4" />
                  <span>Details</span>
                </button>

                <button
                  onClick={toggleWatchlistForHero}
                  className={`p-3 rounded-xl border backdrop-blur-md transition-all flex items-center justify-center cursor-pointer ${
                    inWatchlistState
                      ? 'bg-[rgb(var(--primary-color))]/25 border-[rgb(var(--primary-color))] text-white shadow-lg shadow-[rgb(var(--primary-color))]/25'
                      : 'bg-black/60 hover:bg-black/80 border-white/20 text-white/85 hover:text-white'
                  }`}
                  title={inWatchlistState ? 'In Watchlist' : 'Add to Watchlist'}
                  aria-label={inWatchlistState ? 'In Watchlist' : 'Add to Watchlist'}
                >
                  {inWatchlistState ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Carousel Thumbnail Strip (Bottom Right) */}
            <div className="hidden xl:flex items-center gap-2 absolute bottom-8 right-8 z-20 bg-black/50 p-1.5 rounded-xl border border-white/10 backdrop-blur-md">
              {featuredList.map((item, idx) => {
                const isActive = idx === heroIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      resetHeroTimer();
                      setHeroIndex(idx);
                    }}
                    className={`relative w-16 h-10 rounded-lg overflow-hidden border transition-all cursor-pointer ${
                      isActive 
                        ? 'border-white opacity-100' 
                        : 'border-transparent opacity-50 hover:opacity-90'
                    }`}
                    title={item.title || item.name}
                  >
                    <img 
                      src={`${TMDB_BACKDROP_W300}${item.backdrop_path}`} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                    {isActive && (
                      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/50 overflow-hidden">
                        <div
                          key={heroIndex}
                          className="h-full w-full bg-[rgb(var(--primary-color))] origin-left"
                          style={{
                            animation: `heroProgress ${SLIDE_DURATION_MS}ms linear forwards`,
                            animationPlayState: (isHeroHovered || isHeroPaused) ? 'paused' : 'running',
                          }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile Pager Dots */}
            <div className="flex lg:hidden items-center justify-center gap-1.5 pt-4">
              {featuredList.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    resetHeroTimer();
                    setHeroIndex(idx);
                  }}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === heroIndex ? 'w-6 bg-[rgb(var(--primary-color))]' : 'w-2 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 relative z-20">

        {/* Floating Glass Category Filter Bar */}
        <div className="-mt-12 sm:-mt-14 mb-4 flex justify-start">
          <div className="inline-flex items-center gap-1.5 bg-[var(--bg-card)]/90 backdrop-blur-xl border border-[var(--border-subtle)] p-1.5 rounded-2xl shadow-2xl overflow-x-auto max-w-full custom-scrollbar">
            {[
              { id: 'all', label: 'All', icon: LayoutGrid },
              { id: 'movies', label: 'Movies', icon: Film },
              { id: 'series', label: 'TV Shows', icon: Tv },
              { id: 'theaters', label: 'In Theaters', icon: Ticket },
              { id: 'top', label: 'Top Rated', icon: Award },
            ].map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-[rgb(var(--primary-color))] text-white shadow-lg shadow-[rgb(var(--primary-color))]/30'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Continue Watching Row */}
        {continueWatchingList.length > 0 && activeCategory === 'all' && (
          <Reveal className="mb-10 animate-fade-in cv-row">
            <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <span className="w-1 h-5 rounded-full bg-[rgb(var(--primary-color))]" />
                <div className="w-8 h-8 rounded-lg bg-[rgb(var(--primary-color))]/12 border border-[rgb(var(--primary-color))]/25 flex items-center justify-center text-[rgb(var(--primary-color))]">
                  <Clock className="w-4 h-4" />
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--text-main)] tracking-tight">
                  Continue Watching
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-[var(--text-muted)] bg-[var(--bg-card)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
                {continueWatchingList.length} saved
              </span>
            </div>

            <div className="flex overflow-x-auto space-x-4 px-4 sm:px-6 pb-4 custom-scrollbar scroll-smooth">
              {continueWatchingList.map(cw => {
                const percent = Math.min(100, Math.max(5, Math.round(cw.progress || 10)));
                const timeText = formatTime(cw.currentTime);

                return (
                  <div
                    key={`${cw.media_type}_${cw.id}_${cw.season || 0}_${cw.episode || 0}`}
                    onClick={() => handleResumeContinueWatching(cw)}
                    className="relative w-64 sm:w-72 shrink-0 bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/60 rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 flex flex-col"
                  >
                    <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
                      <img
                        src={cw.poster_path ? `${TMDB_BACKDROP_W300}${cw.poster_path}` : ''}
                        alt={cw.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      <button
                        type="button"
                        onClick={(e) => handleRemoveContinueWatching(e, cw.id)}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/65 hover:bg-black/90 text-white/75 hover:text-white border border-white/15 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 z-20 cursor-pointer"
                        title="Remove from Continue Watching"
                        aria-label="Remove from Continue Watching"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-11 h-11 rounded-full bg-[rgb(var(--primary-color))] text-white flex items-center justify-center shadow-xl shadow-[rgb(var(--primary-color))]/45">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      </div>

                      {cw.media_type === 'tv' && cw.episode && (
                        <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-mono font-semibold text-white uppercase tracking-wider">
                          S{cw.season || 1} : E{cw.episode}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 flex flex-col justify-between flex-grow">
                      <div>
                        <h4 className="font-semibold text-sm text-[var(--text-main)] truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">
                          {cw.title}
                        </h4>
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1 tabular-nums">
                          <span>{percent}% watched</span>
                          {timeText && <span className="font-mono">{timeText}</span>}
                        </div>
                      </div>

                      <div className="w-full bg-[var(--bg-hover)] h-1.5 rounded-full mt-2.5 overflow-hidden">
                        <div 
                          className="bg-[rgb(var(--primary-color))] h-full rounded-full transition-all duration-300" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* Top 10 Showcase */}
        {trending && trending.length > 0 && activeCategory === 'all' && (
          <Top10Showcase 
            allTop={trending} 
            moviesTop={trending.filter(i => i.media_type !== 'tv')} 
            seriesTop={trending.filter(i => i.media_type === 'tv')} 
            onSelect={handleSelect} 
          />
        )}

        {/* Trending This Week Row */}
        {trendingWeek && (activeCategory === 'all' || activeCategory === 'movies' || activeCategory === 'series') && (
          <InteractiveRow 
            title="Trending This Week" 
            icon={TrendingUp}
            items={trendingWeek} 
            viewAllLink="/discover?type=movie"
            onSelect={handleSelect} 
          />
        )}

        {/* Streaming Providers ("By platform") Showcase */}
        {(activeCategory === 'all' || activeCategory === 'movies' || activeCategory === 'series') && (
          <StreamingProvidersShowcase onSelect={handleSelect} />
        )}

        {/* Vibrant Cinema Genre Hubs */}
        {activeCategory === 'all' && (
          <Reveal className="mb-12 cv-row">
            <div className="flex items-center justify-between mb-5 px-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <span className="w-1 h-5 rounded-full bg-[rgb(var(--primary-color))]" />
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--primary-color))] block">
                    Curated Worlds
                  </span>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-[var(--text-main)] tracking-tight">
                    Browse by Genre
                  </h2>
                </div>
              </div>

              <button
                onClick={() => navigate('/discover')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              >
                <span>All genres</span>
                <ArrowRight className="w-3.5 h-3.5 text-[rgb(var(--primary-color))]" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6">
              {POPULAR_GENRE_HUBS.map(hub => {
                const Icon = hub.icon;
                return (
                  <button
                    key={hub.id}
                    onClick={() => navigate(`/discover?type=movie&genre=${hub.id}&genreName=${encodeURIComponent(hub.name)}`)}
                    className={`relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${hub.gradient} ring-1 ring-white/15 hover:ring-white/30 hover:-translate-y-1 transition-all duration-300 text-left group cursor-pointer shadow-lg ${hub.glow} flex flex-col justify-between h-28 sm:h-32`}
                  >
                    <div className="absolute -right-4 -bottom-4 opacity-15 group-hover:opacity-25 group-hover:scale-110 transition-all duration-300 pointer-events-none">
                      <Icon className="w-24 h-24 text-white" />
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="relative z-10 flex items-end justify-between w-full gap-2">
                      <div className="min-w-0">
                        <span className="font-display text-sm sm:text-base font-bold text-white block truncate">
                          {hub.name}
                        </span>
                        <span className="text-[11px] text-white/75 block truncate">
                          {hub.sub}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-white/75 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* Popular Blockbusters */}
        {movies && (activeCategory === 'all' || activeCategory === 'movies') && (
          <InteractiveRow 
            title="Popular Movies" 
            icon={Film}
            items={movies} 
            viewAllLink="/discover?type=movie&sort=popularity.desc"
            onSelect={handleSelect} 
          />
        )}

        {/* Popular TV Series */}
        {series && (activeCategory === 'all' || activeCategory === 'series') && (
          <InteractiveRow 
            title="Popular Series" 
            icon={Tv}
            items={series} 
            viewAllLink="/discover?type=tv&sort=popularity.desc"
            onSelect={handleSelect} 
          />
        )}

        {/* In Theaters / Now Playing */}
        {nowPlaying && nowPlaying.length > 0 && (activeCategory === 'all' || activeCategory === 'movies' || activeCategory === 'theaters') && (
          <InteractiveRow 
            title="Now in Theaters" 
            icon={Ticket}
            items={nowPlaying} 
            viewAllLink="/discover?type=movie"
            onSelect={handleSelect} 
          />
        )}

        {/* Top Rated Films */}
        {topRatedMovies && (activeCategory === 'all' || activeCategory === 'movies' || activeCategory === 'top') && (
          <InteractiveRow 
            title="Top Rated Films" 
            icon={Award}
            items={topRatedMovies} 
            viewAllLink="/discover?type=movie&sort=vote_average.desc"
            onSelect={handleSelect} 
          />
        )}

        {/* Upcoming Releases */}
        {upcomingMovies && upcomingMovies.length > 0 && (activeCategory === 'all' || activeCategory === 'theaters') && (
          <InteractiveRow 
            title="Upcoming Releases" 
            icon={Clapperboard}
            items={upcomingMovies} 
            viewAllLink="/discover?type=movie"
            onSelect={handleSelect} 
          />
        )}

        {/* Top Rated Series */}
        {topRatedSeries && (activeCategory === 'all' || activeCategory === 'series' || activeCategory === 'top') && (
          <InteractiveRow 
            title="Top Rated Series" 
            icon={Star}
            items={topRatedSeries} 
            viewAllLink="/discover?type=tv&sort=vote_average.desc"
            onSelect={handleSelect} 
          />
        )}

      </div>
    </div>
  );
};
