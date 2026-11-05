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
import { TMDB_BACKDROP_W1280, TMDB_BACKDROP_W780, TMDB_BACKDROP_W300, TMDB_POSTER_BASE } from '../constants';
import { 
  Play, Info, TrendingUp, Star, ChevronLeft, ChevronRight, 
  Plus, Check, Youtube, X, Flame, Sparkles, Film, Tv, Compass, 
  CheckCircle2, ArrowRight, Pause, RotateCcw
} from 'lucide-react';
import { RowSkeleton, Skeleton } from '../components/Skeleton';

interface HomeProps {
  onSelect?: (item: TMDBResult) => void;
}

// Interactive Horizontal Row with Desktop Left/Right Chevron Controls & Optional View All Link
const InteractiveRow = React.memo(({ 
  title, 
  items, 
  icon: Icon, 
  badge,
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
    <div className="mb-12 relative group/row content-visibility-auto">
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-1.5 rounded-xl bg-[rgb(var(--primary-color))]/10 text-[rgb(var(--primary-color))]">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">
            {title}
          </h2>
          {badge && (
            <span className="hidden sm:inline-flex items-center text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              {badge}
            </span>
          )}
        </div>

        {/* Right Controls: View All + Desktop Arrow Controls */}
        <div className="flex items-center gap-2">
          {viewAllLink && (
            <button
              onClick={() => navigate(viewAllLink)}
              className="flex items-center gap-1 text-xs font-semibold text-[rgb(var(--primary-color))] hover:brightness-110 transition-colors px-2.5 py-1 rounded-lg hover:bg-[rgb(var(--primary-color))]/10 cursor-pointer"
            >
              <span>Explore all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className="p-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              className="p-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md cursor-pointer"
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
    </div>
  );
});

// Top 10 Showcase with 3D Styled Numbers and Tab Filters
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
    <div className="mb-14 relative group/top10 z-10 content-visibility-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-gradient-to-b from-[rgb(var(--primary-color))] to-pink-500 rounded-full" />
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-main)] tracking-tight uppercase italic flex items-center gap-2">
              <span>Top 10 Today</span>
              <Flame className="w-6 h-6 text-amber-500 fill-amber-500" />
            </h2>
          </div>
        </div>

        {/* Tab Switcher & Navigation Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'all' 
                  ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm font-bold' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('movies')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'movies' 
                  ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm font-bold' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => setActiveTab('series')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'series' 
                  ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm font-bold' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Series
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all shadow cursor-pointer"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-all shadow cursor-pointer"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards List */}
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto overflow-y-hidden overscroll-x-contain space-x-6 px-4 sm:px-6 pb-8 custom-scrollbar scroll-smooth snap-x snap-proximity pt-3"
      >
        {displayItems.map((item, index) => (
          <div 
            key={item.id} 
            className="snap-start relative min-w-[270px] sm:min-w-[340px] aspect-[16/9] rounded-2xl cursor-pointer group transition-all duration-300 hover:scale-[1.03] hover:z-20 shrink-0"
            onClick={() => onSelect(item)}
          >
            {/* Rank 3D Numbers */}
            <div 
              className="absolute -left-3 -bottom-5 z-20 font-black text-[115px] sm:text-[135px] leading-none text-[var(--bg-main)] select-none drop-shadow-2xl font-mono tracking-tighter" 
              style={{ WebkitTextStroke: '3px rgba(255, 255, 255, 0.25)', textShadow: '4px 4px 0px rgba(0,0,0,0.8)' }}
            >
              {index + 1}
            </div>
            <div 
              className="absolute -left-3 -bottom-5 z-30 font-black text-[115px] sm:text-[135px] leading-none text-[var(--bg-main)] select-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-mono tracking-tighter" 
              style={{ WebkitTextStroke: '2.5px rgb(var(--primary-color))' }}
            >
              {index + 1}
            </div>

            {/* Poster Backdrop Box */}
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl relative border border-[var(--border-subtle)] bg-[var(--bg-card)] ml-8 sm:ml-9 group-hover:border-[rgb(var(--primary-color))]/50 transition-all duration-300 group-hover:shadow-[rgb(var(--primary-color))]/10">
              <img 
                src={item.backdrop_path ? `${TMDB_BACKDROP_W300}${item.backdrop_path}` : `${TMDB_POSTER_BASE}${item.poster_path}`} 
                alt={item.name || item.title} 
                className="w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
              
              {/* Play Badge on Hover */}
              <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[rgb(var(--primary-color))] text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>

              {/* Title & Metadata */}
              <div className="absolute bottom-0 left-0 right-0 p-4 pl-12 sm:pl-14">
                <h3 className="text-white font-black text-lg sm:text-xl leading-tight drop-shadow-md uppercase italic truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">
                  {item.name || item.title}
                </h3>
                <div className="flex items-center gap-2.5 mt-1.5 text-xs font-semibold text-gray-300">
                  <span className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {item.vote_average ? item.vote_average.toFixed(1) : '8.2'}
                  </span>
                  <span>·</span>
                  <span className="text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                    {item.media_type === 'tv' ? 'Series' : 'Movie'}
                  </span>
                  <span>·</span>
                  <span>{(item.first_air_date || item.release_date)?.split('-')[0]}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="w-6 shrink-0" />
      </div>
    </div>
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
  const [slideProgress, setSlideProgress] = useState(0);
  const [continueWatchingList, setContinueWatchingList] = useState<ContinueWatchingItem[]>([]);
  const [selectedTrailerKey, setSelectedTrailerKey] = useState<string | null>(null);
  const [selectedTrailerTitle, setSelectedTrailerTitle] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [inWatchlistState, setInWatchlistState] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const toastTimerRef = useRef<number | null>(null);
  const SLIDE_DURATION_MS = 8000;

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

  // Smooth slide timer ticker with visual progress indicator
  useEffect(() => {
    if (featuredList.length <= 1 || isHeroHovered || isHeroPaused) return;

    const intervalTime = 100;
    const increment = (intervalTime / SLIDE_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setSlideProgress(prev => {
        if (prev >= 100) {
          setHeroIndex(curr => (curr + 1) % featuredList.length);
          return 0;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [featuredList.length, isHeroHovered, isHeroPaused, heroIndex]);

  const goToNextHero = () => {
    if (featuredList.length <= 1) return;
    setHeroIndex(prev => (prev + 1) % featuredList.length);
    setSlideProgress(0);
  };

  const goToPrevHero = () => {
    if (featuredList.length <= 1) return;
    setHeroIndex(prev => (prev - 1 + featuredList.length) % featuredList.length);
    setSlideProgress(0);
  };

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

  const isLoadingInitial = loadingTrending && loadingMovies && loadingSeries;

  if (isLoadingInitial) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] pb-20">
        <div className="relative h-[80vh] min-h-[580px] w-full bg-[var(--bg-card)] animate-pulse mb-8">
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
          className="relative h-[84vh] min-h-[600px] max-h-[860px] w-full mb-10 group/hero"
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
                  {...(idx === 0 ? ({ fetchPriority: 'high' } as any) : {})}
                  className="w-full h-full object-cover object-center transform scale-100 group-hover/hero:scale-105 transition-transform duration-[12s] ease-out"
                />
              </div>
            ))}

            {/* Seamless Top Vignette (Blends into Navbar background) */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[var(--bg-main)] via-[var(--bg-main)]/60 to-transparent pointer-events-none z-10" />

            {/* Left Vignette for Text Contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-main)] via-[var(--bg-main)]/85 to-transparent w-full lg:w-3/5 z-10" />

            {/* Bottom Seamless Fade */}
            <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/80 to-transparent pointer-events-none z-10" />
            
            {/* Ambient Primary Glow */}
            <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-[rgb(var(--primary-color))]/15 rounded-full blur-[110px] pointer-events-none z-10" />
          </div>

          {/* Desktop Direct Hero Chevrons (Hover) */}
          <button
            type="button"
            onClick={goToPrevHero}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-all hover:scale-110 shadow-2xl cursor-pointer"
            aria-label="Previous Spotlight"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={goToNextHero}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-all hover:scale-110 shadow-2xl cursor-pointer"
            aria-label="Next Spotlight"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Hero Content Body */}
          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-16 sm:pb-20">
            <div className="max-w-2xl flex flex-col gap-3.5">
              
              {/* Eyebrow Kicker with Auto-Play Status Toggle */}
              <div className="flex items-center gap-2.5 text-xs font-bold tracking-wider uppercase animate-fade-in">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Spotlight #{heroIndex + 1}</span>
                </span>
                <span className="text-white/30">·</span>
                <span className="text-white/70 font-medium tracking-wide">Trending Worldwide</span>
                <span className="text-white/30">·</span>
                <button
                  type="button"
                  onClick={() => setIsHeroPaused(p => !p)}
                  className="flex items-center gap-1 text-[11px] font-mono text-white/50 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded bg-white/5 border border-white/10"
                  title={isHeroPaused ? 'Resume auto-play' : 'Pause auto-play'}
                >
                  {isHeroPaused ? <Play className="w-2.5 h-2.5 fill-current" /> : <Pause className="w-2.5 h-2.5 fill-current" />}
                  <span>{isHeroPaused ? 'Paused' : 'Auto'}</span>
                </button>
              </div>

              {/* Title with Balanced Linebreaks */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight drop-shadow-2xl animate-fade-in line-clamp-2 max-w-xl" style={{ textWrap: 'balance' }}>
                {currentHero.title || currentHero.name}
              </h1>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-medium text-white/80 animate-fade-in">
                <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 shrink-0" />
                  <span>{currentHero.vote_average ? currentHero.vote_average.toFixed(1) : '8.5'}</span>
                </span>
                <span className="text-white/30">·</span>
                <span className="text-white/90 font-semibold">
                  {currentHero.media_type === 'tv' ? 'TV Series' : 'Feature Film'}
                </span>
                <span className="text-white/30">·</span>
                <span className="text-white/70 font-mono">
                  {(currentHero.first_air_date || currentHero.release_date)?.split('-')[0]}
                </span>
                <span className="text-white/30">·</span>
                <span className="text-emerald-400 font-semibold text-xs uppercase tracking-wider font-mono">
                  Ultra HD 4K
                </span>
              </div>

              {/* Synopsis */}
              <p className="text-zinc-200/90 text-sm sm:text-base line-clamp-3 max-w-xl drop-shadow-sm font-normal leading-relaxed animate-fade-in">
                {currentHero.overview}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-3 animate-fade-in">
                
                {/* Watch Now Button */}
                <button
                  onClick={() => handleQuickPlay(currentHero)}
                  className="flex items-center gap-2.5 bg-[rgb(var(--primary-color))] hover:brightness-110 text-white px-7 py-3.5 rounded-xl font-bold text-sm sm:text-base shadow-xl shadow-[rgb(var(--primary-color))]/30 hover:-translate-y-0.5 transition-all group cursor-pointer"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current transition-transform group-hover:scale-110" />
                  <span>Watch Now</span>
                </button>

                {/* Trailer Button */}
                <button
                  onClick={() => handleOpenTrailer(currentHero)}
                  className="flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/20 text-white px-5 py-3.5 rounded-xl font-semibold text-sm backdrop-blur-md transition-all hover:border-red-500/50 hover:text-red-400 group cursor-pointer"
                >
                  <Youtube className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                  <span>Trailer</span>
                </button>

                {/* Details Button */}
                <button
                  onClick={() => handleSelect(currentHero)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white px-5 py-3.5 rounded-xl font-semibold text-sm backdrop-blur-md transition-all cursor-pointer"
                >
                  <Info className="w-4 h-4" />
                  <span>Details</span>
                </button>

                {/* Watchlist Toggle Button */}
                <button
                  onClick={toggleWatchlistForHero}
                  className={`p-3.5 rounded-xl border backdrop-blur-md transition-all flex items-center justify-center cursor-pointer ${
                    inWatchlistState
                      ? 'bg-[rgb(var(--primary-color))]/25 border-[rgb(var(--primary-color))] text-[rgb(var(--primary-color))]'
                      : 'bg-black/40 hover:bg-black/60 border-white/15 text-white/80 hover:text-white'
                  }`}
                  title={inWatchlistState ? 'In Watchlist' : 'Add to Watchlist'}
                  aria-label={inWatchlistState ? 'In Watchlist' : 'Add to Watchlist'}
                >
                  {inWatchlistState ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Carousel Navigation Filmstrip with Active Duration Progress (Bottom Right) */}
            <div className="hidden lg:flex items-center gap-2.5 absolute bottom-16 right-8 z-20 bg-black/50 p-2 rounded-2xl border border-white/15 backdrop-blur-md shadow-2xl">
              {featuredList.map((item, idx) => {
                const isActive = idx === heroIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setHeroIndex(idx);
                      setSlideProgress(0);
                    }}
                    className={`relative w-20 h-12 rounded-xl overflow-hidden border-2 transition-all group cursor-pointer ${
                      isActive 
                        ? 'border-[rgb(var(--primary-color))] scale-105 shadow-lg ring-1 ring-[rgb(var(--primary-color))]/40' 
                        : 'border-transparent opacity-60 hover:opacity-100 hover:scale-102'
                    }`}
                    title={item.title || item.name}
                  >
                    <img 
                      src={`${TMDB_BACKDROP_W300}${item.backdrop_path}`} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors" />
                    
                    {/* Active Slide Timer Line */}
                    {isActive && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50 overflow-hidden">
                        <div 
                          className="h-full bg-[rgb(var(--primary-color))] transition-all duration-100 ease-linear shadow-sm"
                          style={{ width: `${slideProgress}%` }}
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
                    setHeroIndex(idx);
                    setSlideProgress(0);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 relative z-10 -mt-6">

        {/* Quick Category Jumper Segmented Toolbar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {[
            { id: 'all', label: 'All Entertainment', icon: Sparkles },
            { id: 'movies', label: 'Movies', icon: Film },
            { id: 'series', label: 'TV Shows', icon: Tv },
            { id: 'theaters', label: 'In Theaters', icon: Flame },
            { id: 'top', label: 'Critically Acclaimed', icon: Star },
          ].map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                  isActive
                    ? 'bg-[rgb(var(--primary-color))] text-white border-[rgb(var(--primary-color))] shadow-lg shadow-[rgb(var(--primary-color))]/20'
                    : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-white' : 'text-[var(--text-muted)]'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Continue Watching Row */}
        {continueWatchingList.length > 0 && activeCategory === 'all' && (
          <div className="mb-10 animate-fade-in content-visibility-auto">
            <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-xl bg-gradient-to-tr from-[rgb(var(--primary-color))] to-pink-500 text-white shadow-md">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">
                    Continue Watching
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Pick up right where you left off
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono text-[var(--text-muted)]">
                {continueWatchingList.length} in progress
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
                    className="relative w-64 sm:w-72 shrink-0 bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/50 rounded-2xl overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col"
                  >
                    {/* Thumbnail Image Stage with Hover Resume Overlay */}
                    <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
                      <img
                        src={cw.poster_path ? `${TMDB_BACKDROP_W300}${cw.poster_path}` : ''}
                        alt={cw.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                      {/* Floating Remove Button */}
                      <button
                        type="button"
                        onClick={(e) => handleRemoveContinueWatching(e, cw.id)}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white/70 hover:text-white border border-white/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-20 cursor-pointer shadow-lg"
                        title="Remove from Continue Watching"
                        aria-label="Remove from Continue Watching"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Play Button Icon Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-11 h-11 rounded-full bg-[rgb(var(--primary-color))] text-white flex items-center justify-center shadow-2xl transform scale-75 group-hover:scale-100 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Episode Badge if Series */}
                      {cw.media_type === 'tv' && cw.episode && (
                        <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded bg-black/80 border border-white/15 text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                          S{cw.season || 1} : E{cw.episode}
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata & Progress Bar */}
                    <div className="p-3.5 flex flex-col justify-between flex-grow">
                      <div>
                        <h4 className="font-bold text-sm text-[var(--text-main)] truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">
                          {cw.title}
                        </h4>
                        
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1.5 font-medium">
                          <span>{percent}% watched</span>
                          {timeText && <span className="font-mono">{timeText}</span>}
                        </div>
                      </div>

                      {/* Dynamic Progress Bar */}
                      <div className="w-full bg-[var(--bg-hover)] h-1.5 rounded-full mt-2.5 overflow-hidden border border-white/5">
                        <div 
                          className="bg-gradient-to-r from-[rgb(var(--primary-color))] to-pink-500 h-full rounded-full transition-all duration-300 shadow-sm" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top 10 Showcase */}
        {trending && movies && series && activeCategory === 'all' && (
          <Top10Showcase 
            allTop={trending} 
            moviesTop={movies} 
            seriesTop={series} 
            onSelect={handleSelect} 
          />
        )}

        {/* Trending This Week Row */}
        {trendingWeek && (activeCategory === 'all' || activeCategory === 'movies' || activeCategory === 'series') && (
          <InteractiveRow 
            title="Trending This Week" 
            badge="HOT"
            items={trendingWeek} 
            icon={TrendingUp} 
            viewAllLink="/discover?type=movie"
            onSelect={handleSelect} 
          />
        )}

        {/* Streaming Providers ("WHERE TO WATCH") Showcase */}
        {(activeCategory === 'all' || activeCategory === 'movies' || activeCategory === 'series') && (
          <StreamingProvidersShowcase onSelect={handleSelect} />
        )}

        {/* Popular Blockbusters */}
        {movies && (activeCategory === 'all' || activeCategory === 'movies') && (
          <InteractiveRow 
            title="Popular Blockbusters" 
            badge="MOVIES"
            items={movies} 
            icon={Film} 
            viewAllLink="/discover?type=movie&sort=popularity.desc"
            onSelect={handleSelect} 
          />
        )}

        {/* Binge-Worthy TV Series */}
        {series && (activeCategory === 'all' || activeCategory === 'series') && (
          <InteractiveRow 
            title="Binge-Worthy TV Shows" 
            badge="SERIES"
            items={series} 
            icon={Tv} 
            viewAllLink="/discover?type=tv&sort=popularity.desc"
            onSelect={handleSelect} 
          />
        )}

        {/* In Theaters / Now Playing */}
        {nowPlaying && nowPlaying.length > 0 && (activeCategory === 'all' || activeCategory === 'movies' || activeCategory === 'theaters') && (
          <InteractiveRow 
            title="Now In Theaters" 
            badge="PREMIERE"
            items={nowPlaying} 
            icon={Sparkles} 
            viewAllLink="/discover?type=movie"
            onSelect={handleSelect} 
          />
        )}

        {/* Critically Acclaimed Masterpieces */}
        {topRatedMovies && (activeCategory === 'all' || activeCategory === 'movies' || activeCategory === 'top') && (
          <InteractiveRow 
            title="Critically Acclaimed Masterpieces" 
            badge="TOP RATED"
            items={topRatedMovies} 
            icon={Star} 
            viewAllLink="/discover?type=movie&sort=vote_average.desc"
            onSelect={handleSelect} 
          />
        )}

        {/* Highly Anticipated Upcoming */}
        {upcomingMovies && upcomingMovies.length > 0 && (activeCategory === 'all' || activeCategory === 'theaters') && (
          <InteractiveRow 
            title="Coming Soon to Theaters" 
            badge="UPCOMING"
            items={upcomingMovies} 
            icon={Compass} 
            viewAllLink="/discover?type=movie"
            onSelect={handleSelect} 
          />
        )}

        {/* Top Rated Series */}
        {topRatedSeries && (activeCategory === 'all' || activeCategory === 'series' || activeCategory === 'top') && (
          <InteractiveRow 
            title="Award-Winning Series" 
            badge="CRITICS' CHOICE"
            items={topRatedSeries} 
            icon={Star} 
            viewAllLink="/discover?type=tv&sort=vote_average.desc"
            onSelect={handleSelect} 
          />
        )}

      </div>
    </div>
  );
};
