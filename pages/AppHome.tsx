import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Play, Star, ChevronLeft, ChevronRight, Clapperboard,
  Tv, Home as HomeIcon, ListVideo, Loader2, PlayCircle,
} from 'lucide-react';
import {
  getTrendingWeek, getPopularMovies, getPopularTV, getTopRatedMovies,
  getTopRatedTV, getNowPlayingMovies, getUpcomingMovies, getAiringTodayTV,
  searchMedia,
} from '../services/tmdb';
import { TMDBResult, MediaType, ContinueWatchingItem } from '../types';
import { TMDB_BACKDROP_W1280, TMDB_POSTER_BASE } from '../constants';
import { MediaCard } from '../components/MediaCard';
import { getWatchlist, getProgress } from '../services/storage';
import { Skeleton } from '../components/Skeleton';

const BACKDROP_FALLBACK =
  'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221280%22 height=%22720%22%3E%3Crect fill=%22%2318181b%22 width=%221280%22 height=%22720%22/%3E%3C/svg%3E';

type AppTab = 'home' | 'search' | 'list';

const Row = ({ title, items, onSelect, icon }: {
  title: string;
  items: TMDBResult[];
  onSelect: (item: TMDBResult) => void;
  icon?: React.ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  if (!items?.length) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 sm:px-6 mb-3">
        <h2 className="text-[15px] font-bold text-white flex items-center gap-2 tracking-tight">
          <span className="w-1 h-4 rounded-full bg-[rgb(var(--primary-color))]" />
          {icon}
          {title}
        </h2>
        <div className="hidden sm:flex gap-1">
          <button onClick={() => ref.current?.scrollBy({ left: -400, behavior: 'smooth' })}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer">
            <ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => ref.current?.scrollBy({ left: 400, behavior: 'smooth' })}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer">
            <ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div ref={ref} className="flex gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 sm:px-6 pb-2 custom-scrollbar scroll-smooth snap-x snap-proximity">
        {items.map(item => (
          <div key={`${item.media_type}-${item.id}`} className="snap-start shrink-0">
            <MediaCard item={item} onClick={onSelect} />
          </div>
        ))}
      </div>
    </section>
  );
};

const ContinueCard = ({ item, onClick }: { item: ContinueWatchingItem; onClick: () => void }) => {
  const pct = Math.min(100, Math.max(0, item.progress ?? 0));
  return (
    <button onClick={onClick}
      className="relative shrink-0 w-[150px] text-left group cursor-pointer">
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] relative">
        <img src={item.poster_path?.startsWith('http') ? item.poster_path : item.poster_path ? `${TMDB_POSTER_BASE}${item.poster_path}` : BACKDROP_FALLBACK}
          alt={item.title} loading="lazy" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-[rgb(var(--primary-color))] flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 text-white fill-current ml-0.5" />
          </div>
        </div>
        {item.season && item.episode && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur text-[9px] font-bold text-white font-mono">
            S{item.season}E{item.episode}
          </span>
        )}
        <div className="absolute bottom-0 inset-x-0 p-2.5">
          <p className="text-[11px] font-bold text-white truncate">{item.title}</p>
          <div className="mt-1.5 h-1 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-[rgb(var(--primary-color))] rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </button>
  );
};

export const AppHome: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AppTab>('home');
  const [heroIndex, setHeroIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const trendingQ = useQuery({ queryKey: ['app-trending'], queryFn: getTrendingWeek, staleTime: 30 * 60e3 });
  const popularMoviesQ = useQuery({ queryKey: ['app-pop-movies'], queryFn: getPopularMovies, staleTime: 30 * 60e3 });
  const popularTvQ = useQuery({ queryKey: ['app-pop-tv'], queryFn: getPopularTV, staleTime: 30 * 60e3 });
  const topMoviesQ = useQuery({ queryKey: ['app-top-movies'], queryFn: getTopRatedMovies, staleTime: 60 * 60e3 });
  const topTvQ = useQuery({ queryKey: ['app-top-tv'], queryFn: getTopRatedTV, staleTime: 60 * 60e3 });
  const nowPlayingQ = useQuery({ queryKey: ['app-now'], queryFn: getNowPlayingMovies, staleTime: 30 * 60e3 });
  const upcomingQ = useQuery({ queryKey: ['app-upcoming'], queryFn: getUpcomingMovies, staleTime: 60 * 60e3 });
  const airingQ = useQuery({ queryKey: ['app-airing'], queryFn: getAiringTodayTV, staleTime: 30 * 60e3 });
  const searchQ = useQuery({
    queryKey: ['app-search', debounced],
    queryFn: () => searchMedia(debounced),
    enabled: tab === 'search' && debounced.length >= 2,
    staleTime: 5 * 60e3,
  });

  const goDetails = (item: TMDBResult) => {
    const isTv = item.media_type === 'tv' || (!item.media_type && !!item.name && !item.title);
    navigate(isTv ? `/app/tv/${item.id}` : `/app/movie/${item.id}`);
  };

  const goWatch = (item: ContinueWatchingItem) => {
    if (item.media_type === MediaType.TV) {
      navigate(`/app/watch/tv/${item.id}/${item.season || 1}/${item.episode || 1}`);
    } else {
      navigate(`/app/watch/movie/${item.id}`);
    }
  };

  // Hero rotates through trending titles
  const heroItems = useMemo(() => (trendingQ.data || []).filter(i => i.backdrop_path).slice(0, 6), [trendingQ.data]);
  useEffect(() => {
    if (heroItems.length < 2) return;
    const t = setInterval(() => setHeroIndex(i => (i + 1) % heroItems.length), 8000);
    return () => clearInterval(t);
  }, [heroItems.length]);
  const hero = heroItems[heroIndex];

  const [watchlist, setWatchlist] = useState<TMDBResult[]>([]);
  const [progress, setProgress] = useState<ContinueWatchingItem[]>([]);
  useEffect(() => {
    if (tab === 'list') {
      setWatchlist(getWatchlist());
      setProgress(getProgress().sort((a, b) => b.timestamp - a.timestamp).slice(0, 20));
    }
  }, [tab]);

  const isLoading = trendingQ.isLoading || popularMoviesQ.isLoading;

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-main)] text-white pb-24">
      {/* App header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 h-14 bg-[var(--bg-main)]/85 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[rgb(var(--primary-color))] to-blue-600 flex items-center justify-center">
            <Clapperboard className="w-4 h-4 text-white" />
          </div>
          <span className="font-black tracking-tight text-[15px]">STREAMSXAINY</span>
        </div>
        <div className="flex-1" />
        <button onClick={() => setTab('search')}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
          aria-label="Search">
          <Search className="w-5 h-5" />
        </button>
      </header>

      {tab === 'home' && (
        <>
          {/* Hero spotlight */}
          {hero && (
            <div className="relative h-[46vh] min-h-[300px] max-h-[480px] overflow-hidden">
              <img key={hero.id} src={`${TMDB_BACKDROP_W1280}${hero.backdrop_path}`}
                alt={hero.title || hero.name}
                className="absolute inset-0 w-full h-full object-cover animate-fade-in" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-main)] via-black/30 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-white/60 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-[rgb(var(--primary-color))] text-white">Trending #{heroIndex + 1}</span>
                  <span>{hero.media_type === 'tv' ? 'Series' : 'Movie'}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{hero.vote_average?.toFixed(1)}</span>
                  <span>·</span>
                  <span>{(hero.release_date || hero.first_air_date || '').split('-')[0]}</span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight drop-shadow-lg max-w-xl leading-tight">
                  {hero.title || hero.name}
                </h1>
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={() => goDetails(hero)}
                    className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-bold flex items-center gap-2 hover:bg-white/90 active:scale-95 transition-all shadow-xl cursor-pointer">
                    <Play className="w-4 h-4 fill-current" /> Details
                  </button>
                  <button onClick={() => navigate(hero.media_type === 'tv' ? `/app/watch/tv/${hero.id}/1/1` : `/app/watch/movie/${hero.id}`)}
                    className="px-6 py-2.5 rounded-full bg-[rgb(var(--primary-color))] text-white text-sm font-bold flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-xl cursor-pointer">
                    <PlayCircle className="w-4 h-4" /> Watch Now
                  </button>
                </div>
              </div>
              {/* dots */}
              <div className="absolute top-4 right-4 flex gap-1.5">
                {heroItems.map((_, i) => (
                  <button key={i} onClick={() => setHeroIndex(i)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${i === heroIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} />
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="px-4 sm:px-6 space-y-8 mt-6">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="pt-6">
              <Row title="Trending This Week" icon={<FlameIcon />} items={trendingQ.data || []} onSelect={goDetails} />
              <Row title="Now Playing in Cinemas" items={nowPlayingQ.data || []} onSelect={goDetails} />
              <Row title="Popular Movies" icon={<Clapperboard className="w-4 h-4 text-[rgb(var(--primary-color))]" />} items={popularMoviesQ.data || []} onSelect={goDetails} />
              <Row title="Popular Series" icon={<Tv className="w-4 h-4 text-[rgb(var(--primary-color))]" />} items={popularTvQ.data || []} onSelect={goDetails} />
              <Row title="Top Rated Movies" items={topMoviesQ.data || []} onSelect={goDetails} />
              <Row title="Top Rated Series" items={topTvQ.data || []} onSelect={goDetails} />
              <Row title="Coming Soon" items={upcomingQ.data || []} onSelect={goDetails} />
              <Row title="Airing Today" items={airingQ.data || []} onSelect={goDetails} />
            </div>
          )}
        </>
      )}

      {tab === 'search' && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 h-12 focus-within:border-[rgb(var(--primary-color))]/60 transition-colors">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search movies & series..."
              className="flex-1 bg-transparent outline-none text-sm placeholder-white/30"
            />
            {searchQ.isFetching && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mt-5">
            {(searchQ.data || []).map(item => (
              <MediaCard key={`${item.media_type}-${item.id}`} item={item} onClick={goDetails} />
            ))}
            {debounced.length >= 2 && !searchQ.isFetching && (searchQ.data || []).length === 0 && (
              <p className="col-span-full text-center text-sm text-white/40 py-10">No results for "{debounced}"</p>
            )}
            {debounced.length < 2 && (
              <p className="col-span-full text-center text-sm text-white/30 py-10">Type to search movies and series</p>
            )}
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="px-4 pt-4 space-y-8">
          {progress.length > 0 && (
            <section>
              <h2 className="text-[15px] font-bold mb-3 flex items-center gap-2 px-0">
                <span className="w-1 h-4 rounded-full bg-[rgb(var(--primary-color))]" /> Continue Watching
              </h2>
              <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 snap-x">
                {progress.map(item => (
                  <ContinueCard key={`${item.media_type}-${item.id}-${item.season}-${item.episode}`} item={item} onClick={() => goWatch(item)} />
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="text-[15px] font-bold mb-3 flex items-center gap-2 px-0">
              <span className="w-1 h-4 rounded-full bg-[rgb(var(--primary-color))]" /> My Watchlist
            </h2>
            {watchlist.length === 0 ? (
              <p className="text-sm text-white/40 py-8 text-center">Nothing saved yet — tap the bookmark on any poster.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {watchlist.map(item => (
                  <MediaCard key={`${item.media_type}-${item.id}`} item={item} onClick={goDetails} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Bottom tab bar — app style */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-main)]/90 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-lg mx-auto flex items-center justify-around h-16">
          {([
            { id: 'home', label: 'Home', icon: HomeIcon },
            { id: 'search', label: 'Search', icon: Search },
            { id: 'list', label: 'My List', icon: ListVideo },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-colors cursor-pointer ${
                tab === t.id ? 'text-[rgb(var(--primary-color))]' : 'text-white/40 hover:text-white/70'
              }`}>
              <t.icon className="w-5 h-5" />
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

const FlameIcon = () => (
  <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c-4.97 0-9-3.58-9-8 0-4 2.5-7.5 5-9.5C9 4 10 2 10 0c3 2 6 5.5 6 9.5 0 1.5-.5 2.5-1 3.5 1-.5 2-1.5 2-3 2.5 2 4 5.5 4 8.5 0 4.42-4.03 8-9 8z"/></svg>
);
