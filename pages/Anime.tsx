import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  getTrendingAnime, 
  getPopularAnime, 
  getUpcomingAnime, 
  getSeasonAnime, 
  getTopRatedAnime,
  getAnimeByGenre,
  getAiringAnime,
  mapAniListToTMDB 
} from '../services/anilist';
import { searchMedia } from '../services/tmdb';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '../services/storage';
import { TMDBResult, AniListResult, MediaType } from '../types';
import { TMDB_POSTER_BASE, POSTER_FALLBACK_SVG } from '../constants';
import { MediaCard } from '../components/MediaCard';
import { 
  Ghost, TrendingUp, Calendar, Star, Flame, Play, AlertTriangle, 
  RefreshCw, Loader2, Sparkles, ChevronLeft, ChevronRight, 
  Plus, Check, CheckCircle2, Info, Compass, Clapperboard, Layers, Search, X,
  Clock, Mic
} from 'lucide-react';
import { RowSkeleton, Skeleton } from '../components/Skeleton';

interface AnimeProps {
  onSelect: (item: TMDBResult) => void;
}

// Anime Genre Definitions
const ANIME_GENRES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'Action', label: 'Action & Shounen', icon: Flame },
  { id: 'Fantasy', label: 'Fantasy & Isekai', icon: Ghost },
  { id: 'Romance', label: 'Romance', icon: Star },
  { id: 'Sci-Fi', label: 'Sci-Fi & Mecha', icon: Compass },
  { id: 'Psychological', label: 'Psychological', icon: Clapperboard },
  { id: 'Comedy', label: 'Comedy', icon: Sparkles },
  { id: 'Supernatural', label: 'Supernatural', icon: Ghost },
];

// Legendary Anime Studios with real verified TMDB series data
const ANIME_STUDIOS = [
  { 
    name: 'MAPPA', 
    badge: 'Jujutsu Kaisen · Chainsaw Man · Vinland Saga',
    description: 'Pioneers of visceral digital animation, breakneck sakuga, and dark modern shonen.',
    masterpieces: [
      { id: 95479, anilist_id: 113415, title: 'JUJUTSU KAISEN', poster_path: '/6qQzMJG27XOJsyAEEIisoJB45j2.jpg', media_type: MediaType.TV, vote_average: 8.6, first_air_date: '2020-10-03' },
      { id: 114410, anilist_id: 127230, title: 'Chainsaw Man', poster_path: '/npdB6eFzizki0WaZ1OvKcJrWe97.jpg', media_type: MediaType.TV, vote_average: 8.5, first_air_date: '2022-10-12' },
      { id: 88803, anilist_id: 101348, title: 'Vinland Saga', poster_path: '/vUHlpA5c1NXkds59reY3HMb4Abs.jpg', media_type: MediaType.TV, vote_average: 8.5, first_air_date: '2019-07-08' },
      { id: 1429, anilist_id: 16498, title: 'Attack on Titan', poster_path: '/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg', media_type: MediaType.TV, vote_average: 8.7, first_air_date: '2013-04-07' },
      { id: 117465, anilist_id: 128893, title: "Hell's Paradise", poster_path: '/1V9I7SvZbYoMbSvdtnlkkq9SB1k.jpg', media_type: MediaType.TV, vote_average: 8.2, first_air_date: '2023-04-01' }
    ]
  },
  { 
    name: 'Ufotable', 
    badge: 'Demon Slayer · Fate/Zero · Unlimited Blade Works',
    description: 'The pinnacle of digital lighting, 3D camera sweeps, and legendary battle sequences.',
    masterpieces: [
      { id: 85937, anilist_id: 101922, title: 'Demon Slayer: Kimetsu no Yaiba', poster_path: '/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg', media_type: MediaType.TV, vote_average: 8.6, first_air_date: '2019-04-06' },
      { id: 45845, anilist_id: 10087, title: 'Fate/Zero', poster_path: '/chUbHBiMX7buj8TzOEIjHHPCJfF.jpg', media_type: MediaType.TV, vote_average: 8.0, first_air_date: '2011-10-02' },
      { id: 37858, anilist_id: 356, title: 'Fate/stay night', poster_path: '/x7nYPOveHhINREhTtwBHot9ersB.jpg', media_type: MediaType.TV, vote_average: 7.2, first_air_date: '2006-01-07' }
    ]
  },
  { 
    name: 'Wit Studio', 
    badge: 'Attack on Titan · Spy x Family · Ranking of Kings',
    description: 'Masters of kinetic maneuvering, rich world-building, and expressive character acting.',
    masterpieces: [
      { id: 1429, anilist_id: 16498, title: 'Attack on Titan', poster_path: '/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg', media_type: MediaType.TV, vote_average: 8.7, first_air_date: '2013-04-07' },
      { id: 120089, anilist_id: 140960, title: 'SPY x FAMILY', poster_path: '/7NAvPYPAu7MeHwP8E9sn81PqsRh.jpg', media_type: MediaType.TV, vote_average: 8.5, first_air_date: '2022-04-09' },
      { id: 112613, anilist_id: 113717, title: 'Ranking of Kings', poster_path: '/ujMjMUi6z02uOfQEerEDC4rH6aG.jpg', media_type: MediaType.TV, vote_average: 8.0, first_air_date: '2021-10-15' }
    ]
  },
  { 
    name: 'Bones', 
    badge: 'Fullmetal Alchemist · Mob Psycho 100 · My Hero',
    description: 'Legendary studio renowned for fluid hand-drawn mechanics and beloved action epics.',
    masterpieces: [
      { id: 31911, anilist_id: 5114, title: 'Fullmetal Alchemist: Brotherhood', poster_path: '/5ZFUEOULaVml7pQuXxhpR2SmVUw.jpg', media_type: MediaType.TV, vote_average: 8.7, first_air_date: '2009-04-05' },
      { id: 67075, anilist_id: 21507, title: 'Mob Psycho 100', poster_path: '/vR7hwaGQ0ySRoq1WobiNRaPs4WO.jpg', media_type: MediaType.TV, vote_average: 8.5, first_air_date: '2016-07-12' },
      { id: 65930, anilist_id: 21459, title: 'My Hero Academia', poster_path: '/phuYuzqWW9ru8EA3HVjE9W2Rr3M.jpg', media_type: MediaType.TV, vote_average: 8.6, first_air_date: '2016-04-03' }
    ]
  },
  { 
    name: 'Madhouse', 
    badge: 'Frieren · Hunter x Hunter · Death Note · Monster',
    description: 'The historic cornerstone of Japanese animation history spanning 50 years of timeless classics.',
    masterpieces: [
      { id: 209867, anilist_id: 154587, title: "Frieren: Beyond Journey's End", poster_path: '/dqZENchTd7lp5zht7BdlqM7RBhD.jpg', media_type: MediaType.TV, vote_average: 8.8, first_air_date: '2023-09-29' },
      { id: 46298, anilist_id: 11061, title: 'Hunter x Hunter', poster_path: '/eobAuhCJA8oRp814V67WhezVXtQ.jpg', media_type: MediaType.TV, vote_average: 8.9, first_air_date: '2011-10-02' },
      { id: 13916, anilist_id: 1535, title: 'Death Note', poster_path: '/tCZFfYTIwrR7n94J6G14Y4hAFU6.jpg', media_type: MediaType.TV, vote_average: 8.6, first_air_date: '2006-10-04' }
    ]
  },
  { 
    name: 'CloverWorks', 
    badge: 'Bocchi the Rock! · Horimiya · Wind Breaker',
    description: 'Creators of youth culture icons, infectious musical comedy, and heartfelt character dramas.',
    masterpieces: [
      { id: 119100, anilist_id: 130003, title: 'BOCCHI THE ROCK!', poster_path: '/Af4tZ3eKjKWXG4vfiQ8R1NJomAP.jpg', media_type: MediaType.TV, vote_average: 8.4, first_air_date: '2022-10-09' },
      { id: 110070, anilist_id: 124080, title: 'Horimiya', poster_path: '/iSOKGl5KIeOCAtigUDCfFZe2cOi.jpg', media_type: MediaType.TV, vote_average: 8.5, first_air_date: '2021-01-10' },
      { id: 223500, anilist_id: 163270, title: 'WIND BREAKER', poster_path: '/h9IHHVR6piicaaWOgNLSsvRSC3r.jpg', media_type: MediaType.TV, vote_average: 8.1, first_air_date: '2024-04-05' }
    ]
  },
];

// Interactive Anime Row with Desktop Scroll Arrows
const AnimeRow = React.memo(({ 
  title, 
  items, 
  icon: Icon, 
  badge,
  onClick 
}: { 
  title: string; 
  items: TMDBResult[]; 
  icon?: React.ElementType; 
  badge?: string;
  onClick: (item: TMDBResult) => void; 
}) => {
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
    <div className="mb-12 relative group/row">
      <div className="flex items-center justify-between mb-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-1.5 rounded-lg bg-pink-500/10 text-pink-500">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">
            {title}
          </h2>
          {badge && (
            <span className="hidden sm:inline-flex items-center text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              {badge}
            </span>
          )}
        </div>

        {/* Desktop Arrow Controls */}
        <div className="hidden sm:flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
            className="p-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            aria-label="Scroll right"
            className="p-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex overflow-x-auto overflow-y-hidden overscroll-x-contain space-x-4 px-4 sm:px-6 pb-4 custom-scrollbar scroll-smooth snap-x snap-proximity"
      >
        {items.map((item, idx) => (
          <div key={idx} className="snap-start shrink-0">
             <MediaCard item={item} onClick={onClick} />
          </div>
        ))}
        <div className="w-4 shrink-0" />
      </div>
    </div>
  );
});

export const Anime: React.FC<AnimeProps> = ({ onSelect }) => {
  const navigate = useNavigate();

  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);
  const [loadingHero, setLoadingHero] = useState(false);
  const [activeGenre, setActiveGenre] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [matchCandidateDialog, setMatchCandidateDialog] = useState<{
    query: string;
    candidates: TMDBResult[];
    aniListId: number;
  } | null>(null);

  const [selectedStudio, setSelectedStudio] = useState<typeof ANIME_STUDIOS[0] | null>(null);
  const [audioMode, setAudioMode] = useState<'all' | 'sub' | 'dub'>('all');

  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2500);
  };

  // Queries for AniList
  const { data: airingRaw } = useQuery({
    queryKey: ['anime', 'airing'],
    queryFn: getAiringAnime,
    staleTime: 1000 * 60 * 15
  });
  const { data: trendingRaw, isLoading: l1, isError: e1, refetch: r1 } = useQuery({ 
    queryKey: ['anime', 'trending'], 
    queryFn: getTrendingAnime,
    staleTime: 1000 * 60 * 30 
  });
  const { data: popularRaw, isLoading: l2, isError: e2, refetch: r2 } = useQuery({ 
    queryKey: ['anime', 'popular'], 
    queryFn: getPopularAnime,
    staleTime: 1000 * 60 * 30 
  });
  const { data: seasonRaw, isLoading: l3, isError: e3, refetch: r3 } = useQuery({ 
    queryKey: ['anime', 'season'], 
    queryFn: getSeasonAnime,
    staleTime: 1000 * 60 * 30 
  });
  const { data: upcomingRaw, isLoading: l4, isError: e4, refetch: r4 } = useQuery({ 
    queryKey: ['anime', 'upcoming'], 
    queryFn: getUpcomingAnime,
    staleTime: 1000 * 60 * 30 
  });
  const { data: topRatedRaw } = useQuery({
    queryKey: ['anime', 'topRated'],
    queryFn: getTopRatedAnime,
    staleTime: 1000 * 60 * 60
  });

  // Dynamic Genre Query
  const { data: genreRaw, isLoading: loadingGenre } = useQuery({
    queryKey: ['anime', 'genre', activeGenre],
    queryFn: () => getAnimeByGenre(activeGenre),
    enabled: activeGenre !== 'all',
    staleTime: 1000 * 60 * 30
  });

  const loading = l1 || l2 || l3 || l4;
  const isError = e1 || e2 || e3 || e4;

  const handleRetry = () => {
    r1(); r2(); r3(); r4();
  };

  // Memoize mapped results
  const airing = useMemo(() => airingRaw?.map(mapAniListToTMDB) || [], [airingRaw]);
  const trending = useMemo(() => trendingRaw?.map(mapAniListToTMDB) || [], [trendingRaw]);
  const popular = useMemo(() => popularRaw?.map(mapAniListToTMDB) || [], [popularRaw]);
  const season = useMemo(() => seasonRaw?.map(mapAniListToTMDB) || [], [seasonRaw]);
  const upcoming = useMemo(() => upcomingRaw?.map(mapAniListToTMDB) || [], [upcomingRaw]);
  const topRated = useMemo(() => topRatedRaw?.map(mapAniListToTMDB) || [], [topRatedRaw]);
  const genreItems = useMemo(() => genreRaw?.map(mapAniListToTMDB) || [], [genreRaw]);

  // Audio filter helper (All / Japanese Sub / English Dub)
  const filterByAudio = (list: TMDBResult[]) => {
    if (audioMode === 'all') return list;
    if (audioMode === 'dub') return list.filter(i => i.is_dubbed);
    return list.filter(i => !i.is_dubbed);
  };

  // Featured Carousel List (Top 5 Trending Anime)
  const featuredAnime = useMemo(() => trendingRaw?.slice(0, 5) || [], [trendingRaw]);
  const currentHero = featuredAnime[heroIndex] || trendingRaw?.[0] || null;

  // Auto-advance hero carousel
  useEffect(() => {
    if (featuredAnime.length <= 1 || isHeroHovered) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % featuredAnime.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [featuredAnime.length, isHeroHovered]);

  // Clean HTML from AniList descriptions
  const cleanDescription = (html?: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  };

  // Format time remaining for next episode
  const formatCountdown = (airingAt?: number) => {
    if (!airingAt) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = airingAt - now;
    if (diff <= 0) return 'Airing soon';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  // Smart Select: Bridges AniList ID to TMDB ID WITHOUT any alert()
  const handleAnimeSelect = async (item: TMDBResult) => {
    if (item.poster_path && !item.poster_path.startsWith('http')) {
      onSelect(item);
      return;
    }

    setLoadingHero(true);
    try {
      const allRaw = [
        ...(trendingRaw || []), 
        ...(popularRaw || []), 
        ...(seasonRaw || []), 
        ...(upcomingRaw || []),
        ...(topRatedRaw || []),
        ...(genreRaw || [])
      ];
      const raw = allRaw.find(r => r.id === item.id);
      
      const year = raw?.seasonYear || (item.first_air_date ? parseInt(item.first_air_date) : null);
      const isUpcoming = raw?.status === 'NOT_YET_RELEASED';
      
      // If the anime is upcoming or unreleased (e.g. Steel Ball Run), DO NOT bridge to an older released TMDB series!
      // Navigate directly using its authoritative AniList identity so upcoming episodes are correctly locked.
      if (isUpcoming) {
        onSelect({
          ...item,
          id: item.id,
          anilist_id: raw?.id ?? item.id,
          media_type: MediaType.TV,
        });
        return;
      }

      const cleanTitle = (t: string) => {
        return t.replace(/Season \d+|Part \d+|Cour \d+|Arc|Chapter \d+/gi, '').trim();
      };

      let queries: string[] = [];
      if (raw?.title?.english) {
        queries.push(raw.title.english);
        queries.push(cleanTitle(raw.title.english));
      }
      if (raw?.title?.romaji) {
        queries.push(raw.title.romaji);
        queries.push(cleanTitle(raw.title.romaji));
      }
      if (queries.length === 0) queries.push(item.title || item.name || '');
      queries = [...new Set(queries.filter(Boolean))];

      let bestMatch: TMDBResult | null = null;
      let highestScore = -1;
      let allFoundResults: TMDBResult[] = [];

      for (const q of queries) {
        if (!q) continue;
        const results = await searchMedia(q);
        allFoundResults.push(...results);
        
        for (const r of results) {
          let score = 0;
          if (r.genre_ids?.includes(16)) score += 10;
          
          const rYear = r.first_air_date?.split('-')[0] || r.release_date?.split('-')[0];
          if (year && rYear) {
            const diff = Math.abs(parseInt(rYear) - year);
            if (diff === 0) score += 5;
            else if (diff <= 1) score += 2;
            else if (isUpcoming && diff <= 2) score += 2;
          } else if (isUpcoming && !rYear) {
            score += 3;
          }

          const rTitle = (r.title || r.name || '').toLowerCase();
          if (rTitle === q.toLowerCase()) score += 5;
          else if (rTitle.includes(q.toLowerCase())) score += 2;

          if (score > highestScore) {
            highestScore = score;
            bestMatch = r;
          }
        }

        if (highestScore >= 12) break;
      }
      
      if (bestMatch && highestScore >= 10) {
        onSelect({ ...bestMatch, anilist_id: raw?.id ?? item.id });
      } else if (allFoundResults.length > 0) {
        // Remove duplicates and show friendly in-app modal instead of browser alert
        const unique = Array.from(new Map(allFoundResults.map(i => [i.id, i])).values()).slice(0, 6);
        setMatchCandidateDialog({
          query: raw?.title?.english || item.title || item.name || '',
          candidates: unique,
          aniListId: raw?.id ?? item.id
        });
      } else {
        // Direct search navigation without browser alert
        const term = raw?.title?.english || item.title || item.name || '';
        showToast(`Searching for "${term}" on TMDB...`);
        navigate(`/search?q=${encodeURIComponent(term)}`);
      }
    } catch (e) {
      const term = item.title || item.name || '';
      navigate(`/search?q=${encodeURIComponent(term)}`);
    } finally {
      setLoadingHero(false);
    }
  };

  const currentSeasonName = useMemo(() => {
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    if (month >= 2 && month <= 4) return `Spring ${year}`;
    if (month >= 5 && month <= 7) return `Summer ${year}`;
    if (month >= 8 && month <= 10) return `Fall ${year}`;
    return `Winter ${year}`;
  }, []);

  if (isError) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">AniList Network Hiccup</h2>
        <p className="text-[var(--text-muted)] mb-6 text-sm max-w-md">
          Unable to synchronize anime feeds. This could be due to rate limits or connectivity.
        </p>
        <button 
          onClick={handleRetry}
          className="flex items-center gap-2 bg-[rgb(var(--primary-color))] text-white px-6 py-2.5 rounded-xl font-bold hover:brightness-110 transition-all shadow-lg"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pb-20 bg-[var(--bg-main)]">
        <div className="h-[75vh] w-full bg-[var(--bg-card)] relative mb-12 animate-pulse">
          <Skeleton className="w-full h-full" />
          <div className="absolute bottom-0 left-0 w-full px-6 pb-16 max-w-7xl mx-auto space-y-4">
            <Skeleton width={180} height={32} className="rounded-full" />
            <Skeleton width="55%" height={64} className="rounded-xl" />
            <Skeleton width="40%" height={24} className="rounded-md" />
            <div className="flex gap-4 pt-2">
              <Skeleton width={160} height={48} variant="rectangular" className="rounded-xl" />
              <Skeleton width={140} height={48} variant="rectangular" className="rounded-xl" />
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
    <div className="min-h-screen pb-24 bg-[var(--bg-main)] text-[var(--text-main)] overflow-x-hidden transition-colors duration-300 relative selection:bg-pink-500/30">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#18181b] border border-white/15 text-white px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Match Candidate Modal Dialog (Eliminates all native alerts) */}
      {matchCandidateDialog && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in"
          onClick={() => setMatchCandidateDialog(null)}
        >
          <div 
            className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">Select TMDB Release</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Multiple matches found for "{matchCandidateDialog.query}". Choose the correct title:
                </p>
              </div>
              <button 
                onClick={() => setMatchCandidateDialog(null)}
                className="p-1.5 rounded-lg bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {matchCandidateDialog.candidates.map(candidate => (
                <div
                  key={candidate.id}
                  onClick={() => {
                    setMatchCandidateDialog(null);
                    onSelect({ ...candidate, anilist_id: matchCandidateDialog.aniListId });
                  }}
                  className="flex items-center gap-3 p-2.5 bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] rounded-xl border border-[var(--border-subtle)] cursor-pointer transition-all hover:border-pink-500/50 group"
                >
                  <img 
                    src={candidate.poster_path ? `${TMDB_POSTER_BASE}${candidate.poster_path}` : POSTER_FALLBACK_SVG} 
                    alt="" 
                    className="w-12 h-16 object-cover rounded-lg shrink-0 group-hover:scale-105 transition-transform" 
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-[var(--text-main)] group-hover:text-pink-400 transition-colors truncate">
                      {candidate.title || candidate.name}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {(candidate.first_air_date || candidate.release_date)?.split('-')[0]} · {candidate.media_type === 'movie' ? 'Movie' : 'TV'}
                    </p>
                    {candidate.vote_average ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 mt-1">
                        <Star className="w-2.5 h-2.5 fill-current" /> {candidate.vote_average.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex justify-end">
              <button
                onClick={() => {
                  const q = matchCandidateDialog.query;
                  setMatchCandidateDialog(null);
                  navigate(`/search?q=${encodeURIComponent(q)}`);
                }}
                className="text-xs font-semibold text-pink-400 hover:underline inline-flex items-center gap-1"
              >
                <Search className="w-3.5 h-3.5" /> Search manually instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cinematic Anime Hero Carousel */}
      {currentHero && (
        <div 
          className="relative h-[80vh] min-h-[560px] max-h-[800px] w-full mb-10 group/hero"
          onMouseEnter={() => setIsHeroHovered(true)}
          onMouseLeave={() => setIsHeroHovered(false)}
        >
          {/* Backdrop Images with Smooth Fade */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            {featuredAnime.map((item, idx) => (
              <div
                key={item.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  idx === heroIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <img 
                  src={item.bannerImage || item.coverImage.extraLarge} 
                  alt={item.title.english || item.title.romaji} 
                  className="w-full h-full object-cover object-center transform scale-100 group-hover/hero:scale-105 transition-transform duration-[12s] ease-out filter brightness-95"
                />
              </div>
            ))}

            {/* Seamless Top Vignette into Navbar Background */}
            <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[var(--bg-main)] via-[var(--bg-main)]/60 to-transparent pointer-events-none z-10" />

            {/* Left Vignette for Perfect Contrast */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-main)] via-[var(--bg-main)]/85 to-transparent w-full lg:w-3/5 z-10" />

            {/* Bottom Seamless Fade */}
            <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/80 to-transparent pointer-events-none z-10" />

            {/* Pink / Purple Ambient Theme Glow */}
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-pink-500/15 rounded-full blur-[110px] pointer-events-none z-10" />
          </div>

          {/* Hero Content Body */}
          <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-end pb-16 sm:pb-20">
            <div className="max-w-2xl flex flex-col gap-3.5">
              
              {/* Eyebrow Kicker with Native Kanji */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider uppercase animate-fade-in">
                <span className="flex items-center gap-1.5 text-pink-400">
                  <Ghost className="w-3.5 h-3.5" />
                  <span>AniList Trending #{heroIndex + 1}</span>
                </span>
                {currentHero.title.native && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="text-pink-200/80 font-medium normal-case font-sans tracking-wide">
                      {currentHero.title.native}
                    </span>
                  </>
                )}
              </div>

              {/* Main Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight drop-shadow-2xl animate-fade-in line-clamp-2">
                {currentHero.title.english || currentHero.title.romaji}
              </h1>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-medium text-white/80 animate-fade-in">
                {currentHero.averageScore && (
                  <span className="flex items-center gap-1.5 text-pink-400 font-bold">
                    <Star className="w-3.5 h-3.5 fill-pink-400 shrink-0" />
                    <span>{(currentHero.averageScore / 10).toFixed(1)} / 10</span>
                  </span>
                )}
                {currentHero.nextAiringEpisode && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>EP {currentHero.nextAiringEpisode.episode} ({formatCountdown(currentHero.nextAiringEpisode.airingAt)})</span>
                    </span>
                  </>
                )}
                <span className="text-white/30">·</span>
                <span className="text-white/90 font-semibold">{currentHero.status || 'ANIME'}</span>
                {currentHero.genres?.slice(0, 3).map(genre => (
                  <React.Fragment key={genre}>
                    <span className="text-white/30">·</span>
                    <span className="text-white/70">{genre}</span>
                  </React.Fragment>
                ))}
              </div>

              {/* Synopsis */}
              <p className="text-zinc-200/90 text-sm sm:text-base line-clamp-3 max-w-xl drop-shadow-sm font-normal leading-relaxed animate-fade-in">
                {cleanDescription(currentHero.description)}
              </p>

              {/* CTA Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-3 animate-fade-in">
                
                {/* Watch Now Button */}
                <button
                  onClick={() => handleAnimeSelect(mapAniListToTMDB(currentHero))}
                  disabled={loadingHero}
                  className="flex items-center gap-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:brightness-110 text-white px-7 py-3.5 rounded-xl font-bold text-sm sm:text-base shadow-xl shadow-pink-600/30 hover:-translate-y-0.5 transition-all group disabled:opacity-50"
                >
                  {loadingHero ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current transition-transform group-hover:scale-110" />
                  )}
                  <span>{loadingHero ? 'Connecting...' : 'Watch Anime'}</span>
                </button>

                {/* More Details Button */}
                <button
                  onClick={() => handleAnimeSelect(mapAniListToTMDB(currentHero))}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white px-5 py-3.5 rounded-xl font-semibold text-sm backdrop-blur-md transition-all"
                >
                  <Info className="w-4 h-4" />
                  <span>Anime Details</span>
                </button>
              </div>
            </div>

            {/* Desktop Carousel Thumbnail Switcher */}
            <div className="hidden lg:flex items-center gap-2.5 absolute bottom-16 right-8 z-20 bg-black/40 p-2 rounded-2xl border border-white/15 backdrop-blur-md">
              {featuredAnime.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setHeroIndex(idx)}
                  className={`relative w-20 h-12 rounded-xl overflow-hidden border-2 transition-all group ${
                    idx === heroIndex 
                      ? 'border-pink-500 scale-105 shadow-lg' 
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  title={item.title.english || item.title.romaji}
                >
                  <img 
                    src={item.coverImage.large || item.bannerImage} 
                    alt="" 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-transparent transition-colors" />
                  {idx === heroIndex && (
                    <div className="absolute bottom-1 left-1.5 w-1.5 h-1.5 rounded-full bg-pink-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Mobile Pager Dots */}
            <div className="flex lg:hidden items-center justify-center gap-1.5 pt-4">
              {featuredAnime.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setHeroIndex(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === heroIndex ? 'w-6 bg-pink-500' : 'w-2 bg-white/40'
                  }`}
                />
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Main Anime Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 relative z-10 -mt-6">

        {/* Anime Controls Bar: Genre Navigation & Dubbed/Subbed Audio Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-card)] p-3 rounded-2xl border border-[var(--border-subtle)] shadow-lg">
          
          {/* Genre Pills */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 md:pb-0 flex-1">
            {ANIME_GENRES.map(genre => {
              const Icon = genre.icon;
              const isActive = activeGenre === genre.id;
              return (
                <button
                  key={genre.id}
                  onClick={() => setActiveGenre(genre.id)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20' 
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{genre.label}</span>
                </button>
              );
            })}
          </div>

          {/* Subbed vs Dubbed Audio Mode Switcher */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 shrink-0 self-start md:self-auto">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] px-2 font-bold flex items-center gap-1">
              <Mic className="w-3 h-3 text-pink-400" /> Audio:
            </span>
            <button
              type="button"
              onClick={() => setAudioMode('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                audioMode === 'all'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setAudioMode('sub')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                audioMode === 'sub'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              🇯🇵 Sub
            </button>
            <button
              type="button"
              onClick={() => setAudioMode('dub')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                audioMode === 'dub'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              🎙️ Dubbed
            </button>
          </div>

        </div>

        {/* Selected Genre Highlights (If active) */}
        {activeGenre !== 'all' && (
          <div className="animate-fade-in">
            {loadingGenre ? (
              <RowSkeleton />
            ) : (
              <AnimeRow 
                title={`${activeGenre} Anime Picks`} 
                badge="FILTERED"
                items={filterByAudio(genreItems)} 
                icon={Flame} 
                onClick={handleAnimeSelect} 
              />
            )}
          </div>
        )}

        {/* Live Airing Schedule & Episode Countdowns Row */}
        {airing && airing.length > 0 && (
          <AnimeRow 
            title="⚡ Live Airing Schedule & Episode Countdowns" 
            badge="DROPPING TODAY"
            items={filterByAudio(airing)} 
            icon={Clock} 
            onClick={handleAnimeSelect} 
          />
        )}

        {/* Seasonal Anime Broadcast Row */}
        {season && (
          <AnimeRow 
            title={`Broadcasting This Season (${currentSeasonName})`} 
            badge="ONGOING"
            items={filterByAudio(season)} 
            icon={Calendar} 
            onClick={handleAnimeSelect} 
          />
        )}

        {/* Trending Anime Row */}
        {trending && (
          <AnimeRow 
            title="Trending Anime Series" 
            badge="VIRAL"
            items={filterByAudio(trending)} 
            icon={TrendingUp} 
            onClick={handleAnimeSelect} 
          />
        )}

        {/* All-Time Fan Favorites */}
        {popular && (
          <AnimeRow 
            title="All-Time Most Popular Anime" 
            badge="HALL OF FAME"
            items={filterByAudio(popular)} 
            icon={Star} 
            onClick={handleAnimeSelect} 
          />
        )}

        {/* Top Rated Masterpieces */}
        {topRated && topRated.length > 0 && (
          <AnimeRow 
            title="Top Rated Masterpieces" 
            badge="CRITICS"
            items={filterByAudio(topRated)} 
            icon={Ghost} 
            onClick={handleAnimeSelect} 
          />
        )}

        {/* Legendary Studios Spotlight Section */}
        <div className="bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-card)]/80 to-[var(--bg-main)] p-6 rounded-3xl border border-[var(--border-subtle)] shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-500">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--text-main)]">Legendary Anime Studios</h3>
              <p className="text-xs text-[var(--text-muted)]">Explore masterworks created by world-renowned animation powerhouses</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ANIME_STUDIOS.map(studio => {
              const isSelected = selectedStudio?.name === studio.name;
              return (
                <div
                  key={studio.name}
                  onClick={() => setSelectedStudio(isSelected ? null : studio)}
                  className={`p-4 rounded-2xl bg-[var(--bg-main)] border transition-all cursor-pointer group hover:-translate-y-1 shadow-md ${
                    isSelected ? 'border-pink-500 shadow-pink-500/20 ring-1 ring-pink-500' : 'border-[var(--border-subtle)] hover:border-pink-500/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-base font-black text-[var(--text-main)] group-hover:text-pink-400 transition-colors">
                      {studio.name}
                    </h4>
                    <span className="text-[10px] uppercase font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                      {studio.masterpieces.length} Hits
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                    {studio.badge}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Interactive Studio Masterworks Showcase */}
          {selectedStudio && (
            <div 
              ref={(el) => {
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }}
              className="mt-6 pt-5 border-t border-[var(--border-subtle)] animate-fade-in"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h4 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-sm" />
                    <span>{selectedStudio.name} Masterworks</span>
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{selectedStudio.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/search?q=${encodeURIComponent(selectedStudio.name)}`)}
                    className="px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <span>Search all {selectedStudio.name}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSelectedStudio(null)}
                    className="p-1.5 rounded-lg bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white"
                    title="Close showcase"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                {selectedStudio.masterpieces.map((anime: any) => (
                  <div
                    key={anime.id}
                    onClick={() => onSelect(anime as TMDBResult)}
                    className="group cursor-pointer flex flex-col gap-1.5"
                  >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-main)] border border-[var(--border-subtle)] group-hover:border-pink-500 transition-all shadow-md group-hover:shadow-pink-500/20 relative">
                      <img 
                        src={`https://image.tmdb.org/t/p/w342${anime.poster_path}`} 
                        alt={anime.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22450%22%20viewBox%3D%220%200%20300%20450%22%3E%3Crect%20fill%3D%22%2318181b%22%20width%3D%22300%22%20height%3D%22450%22%2F%3E%3Ctext%20fill%3D%22%23ec4899%22%20font-family%3D%22sans-serif%22%20font-size%3D%2214%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3E' + encodeURIComponent(anime.title) + '%3C%2Ftext%3E%3C%2Fsvg%3E';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-pink-500 text-white flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.2 rounded bg-black/80 backdrop-blur-sm text-[10px] font-bold text-amber-400 font-mono">
                        ★ {anime.vote_average}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--text-main)] truncate group-hover:text-pink-400 transition-colors">
                      {anime.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming Anime Seasons */}
        {upcoming && (
          <AnimeRow 
            title="Highly Anticipated Upcoming Anime" 
            badge="COMING SOON"
            items={upcoming} 
            icon={Calendar} 
            onClick={handleAnimeSelect} 
          />
        )}

      </div>
    </div>
  );
};
