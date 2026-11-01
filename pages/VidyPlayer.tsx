import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, Expand, ExternalLink, RotateCw, 
  Server, ChevronLeft, ChevronRight, AlertCircle, Tv, Film,
  Ghost, Sparkles, Volume2, Globe, Subtitles, Check, Clock,
  Maximize2, Minimize2, Keyboard, Sun, Moon, ListVideo, Zap, X
} from 'lucide-react';
import { getDetails, getSeasonDetails } from '../services/tmdb';
import { searchAnimeByTitle, getAnimeById, mapAniListToTMDBDetail } from '../services/anilist';
import { getProgressForId, getTheme, saveProgress } from '../services/storage';
import { MediaType } from '../types';
import { TMDB_POSTER_BASE, TMDB_IMAGE_BASE } from '../constants';

const getThemeHex = () => {
  const colors: Record<string, string> = {
    purple: '9333ea',
    red: 'dc2626',
    blue: '2563eb',
    green: '16a34a',
    orange: 'ea580c',
  };
  return colors[getTheme()] || '9333ea';
};

export const PROVIDERS = [
  { id: 'vidy', name: 'Vidy Prime', speed: 'Fast ⚡', quality: '1080p', badge: 'Default' },
  { id: 'vidlink', name: 'VidLink Pro', speed: 'Instant 🚀', quality: 'FHD · Audio', badge: 'Top Rated' },
  { id: 'videasy', name: 'Videasy HD', speed: 'Smooth 🎬', quality: '1080p', badge: 'Clean' },
  { id: 'vidsrc-sh', name: 'VidSrc Direct', speed: 'Fast ⚡', quality: '1080p Auto', badge: 'Stable' },
  { id: 'cinemaos', name: 'CinemaOS', speed: 'Fast 💎', quality: 'High Bitrate', badge: 'Cinema' },
  { id: 'vidsrc-wtf', name: 'VidSrc WTF', speed: 'Fast ⚡', quality: '1080p', badge: 'Mirror 1' },
  { id: 'vidora', name: 'Vidora Stream', speed: 'Adaptive 🌐', quality: 'Multi-Res', badge: 'Mirror 2' },
  { id: 'vidfastpro', name: 'VidFast HQ', speed: 'Rapid ⚡', quality: '1080p', badge: 'Mirror 3' },
] as const;

export type ProviderId = typeof PROVIDERS[number]['id'];

export const VidyPlayer: React.FC = () => {
  const { mediaType: mediaTypeParam, id: idParam, season: seasonParam, episode: episodeParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const playerRef = useRef<HTMLIFrameElement>(null);
  const loadingTimeout = useRef<number | undefined>(undefined);
  const lastSavedTime = useRef(0);

  const initialServer = searchParams.get('server') as ProviderId;
  const [provider, setProvider] = useState<ProviderId>(
    PROVIDERS.some(p => p.id === initialServer) ? initialServer : 'vidy'
  );
  const [animeProvider, setAnimeProvider] = useState<'aniembed' | 'megavid'>('aniembed');
  const [animeLang, setAnimeLang] = useState<'sub' | 'dub'>('sub');
  const [retryKey, setRetryKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [isLightsDimmed, setIsLightsDimmed] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showEpisodeDrawer, setShowEpisodeDrawer] = useState<boolean>(true);

  const mediaType = mediaTypeParam === MediaType.TV ? MediaType.TV : MediaType.MOVIE;
  const isEpisode = mediaType === MediaType.TV;
  const id = Number(idParam);
  const season = Math.max(1, Number(seasonParam) || 1);
  const episode = Math.max(1, Number(episodeParam) || 1);
  const anilistIdParam = Number(searchParams.get('anilistId')) || undefined;

  // Query Details from TMDB
  const detailsQuery = useQuery({
    queryKey: ['details', id, mediaType],
    queryFn: () => getDetails(id, mediaType),
    enabled: Number.isSafeInteger(id) && id > 0,
    retry: 1,
    staleTime: 1000 * 60 * 30,
  });

  // Query AniList details if anilistId is present or if this is an anime
  const queryAnilistId = anilistIdParam || (detailsQuery.isError && mediaType === MediaType.TV ? id : undefined);
  const aniListQuery = useQuery({
    queryKey: ['anilist-detail-player', queryAnilistId],
    queryFn: () => getAnimeById(queryAnilistId!),
    enabled: !!queryAnilistId,
    staleTime: 1000 * 60 * 60,
  });

  const aniListConverted = useMemo(() => {
    if (!aniListQuery.data) return null;
    return mapAniListToTMDBDetail(aniListQuery.data);
  }, [aniListQuery.data]);

  const details = detailsQuery.data || aniListConverted;

  // Detect whether this is an Anime title
  const isAnimeDetected = useMemo(() => {
    if (anilistIdParam || aniListConverted) return true;
    if (!details) return false;
    const isAnimation = details.genres?.some(g => g.id === 16 || g.name?.toLowerCase() === 'animation');
    const isJapanese = details.original_language === 'ja' || (details as any).origin_country?.includes('JP');
    return Boolean(isAnimation && isJapanese);
  }, [anilistIdParam, aniListConverted, details]);

  // Lookup AniList ID automatically if missing for an anime title
  const anilistLookupQuery = useQuery({
    queryKey: ['anilist-id-lookup', id, details?.title || details?.name],
    queryFn: () => searchAnimeByTitle(details?.title || details?.name || ''),
    enabled: !anilistIdParam && isAnimeDetected && !!(details?.title || details?.name),
    staleTime: 1000 * 60 * 60,
  });

  const effectiveAnilistId = anilistIdParam || aniListConverted?.id || anilistLookupQuery.data || (isAnimeDetected ? id : undefined);
  const isAnime = Boolean(anilistIdParam || isAnimeDetected || aniListConverted);

  // Query Season Details for TV episodes navigation
  const seasonQuery = useQuery({
    queryKey: ['season', id, season],
    queryFn: () => getSeasonDetails(id, season),
    enabled: isEpisode && Number.isSafeInteger(id) && id > 0 && !aniListConverted,
    staleTime: 1000 * 60 * 30,
  });

  const totalEpisodesInSeason = useMemo(() => {
    if (details?.season_detail_fallback?.episodes) {
      return details.season_detail_fallback.episodes.length;
    }
    if (seasonQuery.data?.episodes && seasonQuery.data.episodes.length > 0) {
      return seasonQuery.data.episodes.length;
    }
    const seasonsList = (details as any)?.seasons;
    if (Array.isArray(seasonsList)) {
      const match = seasonsList.find((s: any) => s.season_number === season);
      if (match?.episode_count) return match.episode_count;
    }
    return details?.number_of_episodes || 24;
  }, [seasonQuery.data, details, season]);

  const title = details?.title || details?.name || 'Now playing';
  const poster = details?.poster_path 
    ? (details.poster_path.startsWith('http') ? details.poster_path : `${TMDB_POSTER_BASE}${details.poster_path}`) 
    : undefined;

  const isEpisodeUpcoming = useMemo(() => {
    if (!details) return false;
    const showStatus = (details.status || '').toLowerCase();
    if (showStatus === 'not_yet_released' || showStatus === 'upcoming' || showStatus === 'planned') {
      return true;
    }
    const fallbackEps = details.season_detail_fallback?.episodes;
    if (fallbackEps && fallbackEps.length > 0) {
      const match = fallbackEps.find(e => e.episode_number === episode);
      if (match?.is_upcoming) return true;
    }
    const seasonEps = seasonQuery.data?.episodes;
    if (seasonEps && seasonEps.length > 0) {
      const match = seasonEps.find(e => e.episode_number === episode);
      if (match?.is_upcoming) return true;
      if (match?.air_date) {
        const air = new Date(match.air_date).getTime();
        if (!isNaN(air) && air > Date.now()) return true;
      }
    }
    return false;
  }, [details, episode, seasonQuery.data]);
  const savedProgress = Number.isSafeInteger(id) ? getProgressForId(id) : undefined;
  const progressMatchesSelection = isAnime
    ? savedProgress?.episode === episode
    : !isEpisode || (savedProgress?.season === season && savedProgress?.episode === episode);
  const progress = progressMatchesSelection ? savedProgress?.currentTime : undefined;

  const themeHex = getThemeHex();
  const externalId = details?.external_ids?.imdb_id || id;

  const vidyParams = new URLSearchParams({ color: themeHex, autoplay: 'true' });
  if (progress && progress > 0) vidyParams.set('progress', String(Math.floor(progress)));
  if (isEpisode || isAnime) {
    vidyParams.set('nextEpisode', 'true');
    vidyParams.set('episodeSelector', 'true');
    vidyParams.set('autoplayNextEpisode', 'true');
  }

  const vidLinkParams = new URLSearchParams({
    primaryColor: themeHex,
    secondaryColor: '18181b',
    autoplay: 'true',
  });

  // Embed URL generation:
  // For ANIME: use AniEmbed (Server 1) or MegaVid (Server 2)
  // For MOVIES / TV: use the 8 standard providers
  const embedUrl = useMemo(() => {
    if (isAnime && effectiveAnilistId) {
      if (animeProvider === 'megavid') {
        return `https://megavid.buzz/ani/${effectiveAnilistId}/${episode}/${animeLang}`;
      }
      const tParam = progress && progress > 0 ? `&t=${Math.floor(progress)}` : '';
      return `https://aniembed.se/e/${effectiveAnilistId}/${episode}?lang=${animeLang}&autoplay=1${tParam}`;
    }

    switch (provider) {
      case 'vidy':
        return isEpisode
          ? `https://vidy.st/tv/${id}/${season}/${episode}?${vidyParams.toString()}`
          : `https://vidy.st/movie/${id}?${vidyParams.toString()}`;
      case 'vidsrc-wtf':
        return isEpisode
          ? `https://vidsrc.wtf/api/1/tv/?id=${id}&s=${season}&e=${episode}`
          : `https://vidsrc.wtf/api/1/movie/?id=${id}`;
      case 'vidsrc-sh': {
        const vidsrcParams = new URLSearchParams({ autoplay: '1' });
        if (progress && progress > 0) vidsrcParams.set('startAt', String(Math.floor(progress)));
        if (isEpisode) vidsrcParams.set('autonext', '1');
        return isEpisode
          ? `https://vidsrc.sh/embed/tv/${externalId}/${season}/${episode}?${vidsrcParams.toString()}`
          : `https://vidsrc.sh/embed/movie/${externalId}?${vidsrcParams.toString()}`;
      }
      case 'videasy':
        return isEpisode
          ? `https://player.videasy.net/tv/${id}/${season}/${episode}`
          : `https://player.videasy.net/movie/${id}`;
      case 'vidora':
        return isEpisode
          ? `https://vidora.su/tv/${id}/${season}/${episode}`
          : `https://vidora.su/movie/${id}`;
      case 'cinemaos':
        return isEpisode
          ? `https://cinemaos.tech/player/${id}/${season}/${episode}`
          : `https://cinemaos.tech/player/${id}`;
      case 'vidlink':
        return isEpisode
          ? `https://vidlink.pro/tv/${id}/${season}/${episode}?${vidLinkParams.toString()}&nextbutton=true`
          : `https://vidlink.pro/movie/${id}?${vidLinkParams.toString()}`;
      case 'vidfastpro':
        return isEpisode
          ? `https://vidfast.pro/tv/${id}/${season}/${episode}?autoPlay=true`
          : `https://vidfast.pro/movie/${id}`;
      default:
        return `https://vidy.st/movie/${id}?${vidyParams.toString()}`;
    }
  }, [isAnime, effectiveAnilistId, episode, animeLang, animeProvider, progress, provider, isEpisode, id, season, vidyParams, externalId, vidLinkParams]);

  const detailsUrl = effectiveAnilistId ? `/tv/${id}?anilistId=${effectiveAnilistId}` : `/${mediaType}/${id}`;

  // Reset loading timeout whenever source, episode, or language changes
  useEffect(() => {
    setIsLoading(true);
    setHasTimedOut(false);
    loadingTimeout.current = window.setTimeout(() => {
      setIsLoading(false);
      setHasTimedOut(true);
    }, 14000);
    return () => window.clearTimeout(loadingTimeout.current);
  }, [embedUrl, retryKey]);

  // Listen for Vidy player timeupdate postMessages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== playerRef.current?.contentWindow || typeof event.data !== 'string') return;

      let payload: { event?: string; currentTime?: number };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!['timeupdate', 'pause'].includes(payload.event || '') || !Number.isFinite(payload.currentTime) || !details) return;
      const currentTime = Math.max(0, payload.currentTime as number);
      if (payload.event === 'timeupdate' && currentTime - lastSavedTime.current < 15 && currentTime >= lastSavedTime.current) return;

      lastSavedTime.current = currentTime;
      const duration = (typeof (payload as any).duration === 'number' && (payload as any).duration > 0)
        ? (payload as any).duration
        : undefined;

      saveProgress({
        id: details.id,
        anilist_id: effectiveAnilistId,
        media_type: mediaType,
        title: details.title || details.name || '',
        poster_path: details.poster_path || null,
        season: isEpisode && !isAnime ? season : undefined,
        episode: (isEpisode || isAnime) ? episode : undefined,
        currentTime,
        duration,
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [details, mediaType, isEpisode, isAnime, season, episode, effectiveAnilistId]);

  // Ensure item is tracked in Continue Watching upon starting playback
  useEffect(() => {
    if (details && id > 0) {
      saveProgress({
        id: details.id,
        anilist_id: effectiveAnilistId,
        media_type: mediaType,
        title: details.title || details.name || '',
        poster_path: details.poster_path || null,
        season: isEpisode && !isAnime ? season : undefined,
        episode: (isEpisode || isAnime) ? episode : undefined,
        currentTime: savedProgress?.currentTime || 30,
        progress: savedProgress?.progress || 10,
      });
    }
  }, [details?.id, effectiveAnilistId, season, episode]);

  const retryPlayer = () => {
    setIsLoading(true);
    setHasTimedOut(false);
    setRetryKey(current => current + 1);
  };

  const openFullscreen = () => {
    void playerRef.current?.requestFullscreen?.();
  };

  const handleEpisodeChange = (newEp: number) => {
    if (newEp < 1) return;
    const anilistParam = effectiveAnilistId ? `?anilistId=${effectiveAnilistId}` : '';
    if (isEpisode || isAnime) {
      navigate(`/watch/tv/${id}/${season}/${newEp}${anilistParam}`);
    } else {
      navigate(`/watch/movie/${id}${anilistParam}`);
    }
  };

  const switchNextServer = () => {
    const currentIndex = PROVIDERS.findIndex(p => p.id === provider);
    const nextProvider = PROVIDERS[(currentIndex + 1) % PROVIDERS.length];
    setProvider(nextProvider.id);
    setIsLoading(true);
  };

  // Keyboard Shortcuts: F (fullscreen), T (theater), L (lights), N (next), P (prev), R (reload)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName || '';
      if (['INPUT', 'TEXTAREA'].includes(activeTag)) return;

      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openFullscreen();
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setIsTheaterMode(prev => !prev);
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsLightsDimmed(prev => !prev);
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        retryPlayer();
      } else if (e.key.toLowerCase() === 'n' && (isEpisode || isAnime)) {
        e.preventDefault();
        if (episode < totalEpisodesInSeason) handleEpisodeChange(episode + 1);
      } else if (e.key.toLowerCase() === 'p' && (isEpisode || isAnime)) {
        e.preventDefault();
        if (episode > 1) handleEpisodeChange(episode - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [episode, totalEpisodesInSeason, isEpisode, isAnime]);

  return (
    <main className="min-h-screen bg-[#070709] text-white flex flex-col font-sans selection:bg-[rgb(var(--primary-color))]/30">
      
      {/* Top Header */}
      <header className="border-b border-white/10 bg-[#0c0c0e]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button" 
              onClick={() => navigate(detailsUrl)} 
              className="p-2 rounded-xl text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10" 
              aria-label="Back to details" 
              title="Back to details"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            {poster && <img src={poster} alt="" className="w-8 h-11 rounded-lg object-cover hidden sm:block border border-white/10 shadow" />}
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base text-white truncate max-w-sm sm:max-w-md md:max-w-lg">{title}</h1>
              <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
                <span className="text-[rgb(var(--primary-color))] font-semibold">
                  {isAnime ? `Episode ${episode} (${animeLang.toUpperCase()})` : isEpisode ? `Season ${season} · Episode ${episode}` : 'Movie'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isAnime 
                    ? (animeProvider === 'aniembed' ? 'AniEmbed (Server 1)' : 'MegaVid (Server 2)') 
                    : (PROVIDERS.find(p => p.id === provider)?.name || provider)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Dim Lights Toggle */}
            <button
              type="button"
              onClick={() => setIsLightsDimmed(prev => !prev)}
              className={`p-2 rounded-xl transition-colors border ${
                isLightsDimmed 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                  : 'text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
              }`}
              title="Dim Lights (L)"
              aria-label="Dim Lights"
            >
              {isLightsDimmed ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Theater Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsTheaterMode(prev => !prev)}
              className={`p-2 rounded-xl transition-colors border hidden sm:block ${
                isTheaterMode 
                  ? 'bg-[rgb(var(--primary-color))]/20 text-[rgb(var(--primary-color))] border-[rgb(var(--primary-color))]/40' 
                  : 'text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border-white/10'
              }`}
              title="Theater Mode (T)"
              aria-label="Theater Mode"
            >
              {isTheaterMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Keyboard Shortcuts Dialog Trigger */}
            <button
              type="button"
              onClick={() => setShowShortcutsModal(true)}
              className="p-2 rounded-xl text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10 hidden md:block"
              title="Keyboard Shortcuts (?)"
              aria-label="Keyboard Shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* Reload Stream */}
            <button
              type="button"
              onClick={retryPlayer}
              className="p-2 rounded-xl text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
              title="Reload player (R)"
              aria-label="Reload player"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Open in External Tab */}
            <a 
              href={embedUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 rounded-xl text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10" 
              aria-label="Open in new tab" 
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Fullscreen */}
            <button 
              type="button" 
              onClick={openFullscreen} 
              className="p-2 rounded-xl text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10" 
              aria-label="Fullscreen (F)" 
              title="Fullscreen (F)"
            >
              <Expand className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Dimmed Lights Overlay */}
      {isLightsDimmed && (
        <div 
          onClick={() => setIsLightsDimmed(false)}
          className="fixed inset-0 bg-black/85 z-20 transition-opacity duration-500 cursor-pointer"
          title="Click to restore lights"
        />
      )}

      {/* Main Body */}
      <div className={`flex-1 w-full ${isTheaterMode ? 'max-w-none px-2 sm:px-6' : 'max-w-[1440px]'} mx-auto py-4 flex flex-col space-y-4 transition-all duration-300`}>
        
        {/* ========================================================================= */}
        {/* IF ANIME: SHOW EXCLUSIVE ANIME PLAYER CONTROLS (ANIEMBED & MEGAVID)       */}
        {/* ========================================================================= */}
        {isAnime ? (
          <div className="bg-[#111115] border border-pink-500/20 rounded-2xl p-3.5 sm:p-4 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              
              {/* Anime Server Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 mr-1">
                  <div className="p-2 rounded-xl bg-pink-500/15 text-pink-400 shrink-0">
                    <Ghost className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Anime Players
                    </h2>
                    <p className="text-[11px] text-white/50">
                      Switch if stream or episode isn't found
                    </p>
                  </div>
                </div>

                <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAnimeProvider('aniembed');
                      setIsLoading(true);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      animeProvider === 'aniembed'
                        ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>Server 1: AniEmbed</span>
                    {animeProvider === 'aniembed' && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnimeProvider('megavid');
                      setIsLoading(true);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      animeProvider === 'megavid'
                        ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>Server 2: MegaVid</span>
                    {animeProvider === 'megavid' && <Check className="w-3 h-3 text-white" />}
                  </button>
                </div>
              </div>

              {/* Sub / Dub Selector + Episode Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Audio Language: Sub vs Dub */}
                <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setAnimeLang('sub');
                      setIsLoading(true);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      animeLang === 'sub'
                        ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    <Subtitles className="w-3.5 h-3.5" />
                    <span>Sub (JP)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnimeLang('dub');
                      setIsLoading(true);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      animeLang === 'dub'
                        ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Dub (EN)</span>
                  </button>
                </div>

                {/* Episode Prev / Next Navigation */}
                <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10">
                  <button
                    disabled={episode <= 1}
                    onClick={() => handleEpisodeChange(episode - 1)}
                    className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Previous Episode"
                    aria-label="Previous Episode"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 text-white">
                    Ep {episode}
                  </span>
                  <button
                    disabled={totalEpisodesInSeason > 0 && episode >= totalEpisodesInSeason}
                    onClick={() => handleEpisodeChange(episode + 1)}
                    className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Next Episode"
                    aria-label="Next Episode"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

              </div>

            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* IF REGULAR MOVIE / TV: SHOW THE 8 SELECTABLE PLAYER SERVERS               */
          /* ========================================================================= */
          <div className="bg-[#111115] border border-white/10 rounded-2xl p-3 sm:p-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[rgb(var(--primary-color))]/15 text-[rgb(var(--primary-color))]">
                  <Server className="w-4 h-4" />
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Select Player Source
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-white/80">
                  {PROVIDERS.length} Servers
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-white/50">
                Switch provider below if playback buffers or is unavailable
              </p>
            </div>

            {/* Provider Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {PROVIDERS.map((p, idx) => {
                const isActive = provider === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProvider(p.id);
                      setIsLoading(true);
                    }}
                    className={`flex flex-col items-start text-left p-2.5 rounded-xl border transition-all relative overflow-hidden group ${
                      isActive
                        ? 'bg-[rgb(var(--primary-color))]/20 border-[rgb(var(--primary-color))] ring-1 ring-[rgb(var(--primary-color))]/50 shadow-lg shadow-[rgb(var(--primary-color))]/15'
                        : 'bg-black/40 hover:bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-[10px] font-mono uppercase text-white/50 group-hover:text-white/70">
                        Server {idx + 1}
                      </span>
                      {isActive && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Active
                        </span>
                      )}
                    </div>
                    <h3 className={`text-xs font-bold truncate w-full ${isActive ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                      {p.name}
                    </h3>
                    <div className="mt-1 flex items-center justify-between w-full">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isActive 
                          ? 'bg-[rgb(var(--primary-color))] text-white font-bold' 
                          : 'bg-white/10 text-white/60'
                      }`}>
                        {p.id === 'vidy' ? 'Default' : 'Online'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular TV Episode Navigation (Only for non-anime TV series) */}
        {!isAnime && isEpisode && (
          <div className="bg-[#111115] border border-white/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-[rgb(var(--primary-color))]" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Season {season} · Episode {episode}
              </span>
            </div>

            {/* Quick Prev / Next Buttons */}
            <div className="flex items-center gap-2">
              <button
                disabled={episode <= 1}
                onClick={() => handleEpisodeChange(episode - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Prev Ep
              </button>

              <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-black/60 text-white border border-white/10">
                Ep {episode} / {totalEpisodesInSeason}
              </span>

              <button
                disabled={episode >= totalEpisodesInSeason}
                onClick={() => handleEpisodeChange(episode + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 text-white text-xs font-bold transition-all shadow-md disabled:opacity-30 disabled:pointer-events-none"
              >
                Next Ep <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* The Video Iframe Viewport Container or Unreleased Episode Notice */}
        {isEpisodeUpcoming ? (
          <div className="relative w-full aspect-video bg-[#111115] rounded-2xl overflow-hidden ring-1 ring-amber-500/30 shadow-2xl flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-4 text-amber-400 shadow-inner">
              <Clock className="w-8 h-8" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono mb-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/25">
              Episode Not Yet Released
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white max-w-lg mb-2">
              {title} {isEpisode || isAnime ? `– Episode ${episode}` : ''}
            </h3>
            <p className="text-xs sm:text-sm text-white/60 max-w-md mb-6 leading-relaxed">
              This episode has not yet aired on television or broadcast services. Please check back when it officially premieres.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {episode > 1 && (
                <button
                  type="button"
                  onClick={() => handleEpisodeChange(episode - 1)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/10"
                >
                  Watch Episode {episode - 1}
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate(detailsUrl)}
                className="px-5 py-2 rounded-xl bg-[rgb(var(--primary-color))] text-white text-xs font-bold transition-all hover:brightness-110 shadow-lg"
              >
                Back to Show Details
              </button>
            </div>
          </div>
        ) : (
          <div className="relative w-full group/cinema">
            {/* Ambient Reactive Cinema Glow */}
            <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-r from-[rgb(var(--primary-color))]/20 via-pink-500/10 to-blue-500/20 blur-3xl opacity-50 group-hover/cinema:opacity-75 transition-opacity duration-700 pointer-events-none rounded-3xl" />

            <div className={`relative w-full ${isTheaterMode ? 'aspect-[21/9] min-h-[480px] max-h-[84vh]' : 'aspect-video max-h-[78vh]'} bg-black rounded-2xl overflow-hidden ring-1 ring-white/15 shadow-2xl z-30 transition-all duration-300`}>
              <iframe
                key={`${isAnime ? animeProvider : provider}_${retryKey}_${season}_${episode}_${animeLang}`}
                ref={playerRef}
                src={embedUrl}
                title={`${title} player`}
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
                allow="encrypted-media; autoplay *; fullscreen *; picture-in-picture *"
                referrerPolicy="origin"
                onLoad={() => {
                  window.clearTimeout(loadingTimeout.current);
                  setIsLoading(false);
                  setHasTimedOut(false);
                }}
              />

              {/* Loading Indicator Overlay */}
              {isLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border-2 border-white/10 border-t-[rgb(var(--primary-color))] animate-spin" />
                    {isAnime ? (
                      <Ghost className="w-6 h-6 text-pink-400 absolute inset-0 m-auto" />
                    ) : (
                      <Server className="w-6 h-6 text-white absolute inset-0 m-auto" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">
                      {isAnime 
                        ? `Connecting to ${animeProvider === 'aniembed' ? 'AniEmbed (Server 1)' : 'MegaVid (Server 2)'}...` 
                        : `Connecting to ${PROVIDERS.find(p => p.id === provider)?.name || provider}...`}
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                      {isAnime ? `Loading Episode ${episode} (${animeLang.toUpperCase()})` : 'Establishing high-speed stream connection'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Episode Selection Strip for Series & Anime */}
        {(isEpisode || isAnime) && (
          <div className="bg-[#111115] border border-white/10 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <ListVideo className="w-4 h-4 text-[rgb(var(--primary-color))]" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  Episode Quick Jump {isAnime ? `(All ${totalEpisodesInSeason} Episodes)` : `(Season ${season})`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEpisodeDrawer(prev => !prev)}
                className="text-xs text-[rgb(var(--primary-color))] hover:underline font-semibold cursor-pointer"
              >
                {showEpisodeDrawer ? 'Collapse' : 'Expand Episodes'}
              </button>
            </div>

            {showEpisodeDrawer && (
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar momentum-scroll">
                {seasonQuery.data?.episodes && seasonQuery.data.episodes.length > 0 ? (
                  seasonQuery.data.episodes.map(epItem => {
                    const isCur = episode === epItem.episode_number;
                    const epThumb = epItem.still_path ? `${TMDB_IMAGE_BASE}${epItem.still_path}` : poster;
                    return (
                      <button
                        key={epItem.id}
                        type="button"
                        onClick={() => handleEpisodeChange(epItem.episode_number)}
                        className={`w-44 sm:w-52 shrink-0 p-2 rounded-xl border text-left transition-all group flex flex-col cursor-pointer ${
                          isCur
                            ? 'bg-[rgb(var(--primary-color))]/20 border-[rgb(var(--primary-color))] ring-1 ring-[rgb(var(--primary-color))] shadow-lg'
                            : 'bg-black/40 hover:bg-white/5 border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black/60 mb-2">
                          {epThumb ? (
                            <img src={epThumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white/40 font-mono text-xs">
                              Ep {epItem.episode_number}
                            </div>
                          )}
                          {isCur && (
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[rgb(var(--primary-color))] text-white text-[9px] font-bold shadow">
                              Playing
                            </span>
                          )}
                          {epItem.runtime && (
                            <span className="absolute bottom-1.5 right-1.5 px-1 py-0.5 rounded bg-black/80 text-white text-[9px] font-mono">
                              {epItem.runtime}m
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <span className={`font-bold font-mono ${isCur ? 'text-[rgb(var(--primary-color))]' : 'text-white/70'}`}>
                            Ep {epItem.episode_number}
                          </span>
                          {epItem.vote_average ? (
                            <span className="text-amber-400 font-semibold text-[10px]">
                              ★ {epItem.vote_average.toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs font-semibold text-white truncate w-full">
                          {epItem.name || `Episode ${epItem.episode_number}`}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  [...Array(totalEpisodesInSeason || 24)].map((_, idx) => {
                    const epNum = idx + 1;
                    const isCur = episode === epNum;
                    return (
                      <button
                        key={epNum}
                        type="button"
                        onClick={() => handleEpisodeChange(epNum)}
                        className={`w-14 h-12 shrink-0 rounded-xl font-mono font-bold text-xs flex flex-col items-center justify-center border transition-all cursor-pointer ${
                          isCur
                            ? 'bg-[rgb(var(--primary-color))] text-white border-transparent shadow-lg scale-105'
                            : 'bg-black/50 text-white/70 hover:text-white hover:bg-white/10 border-white/10'
                        }`}
                      >
                        <span className="text-[9px] opacity-60">EP</span>
                        <span>{epNum}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Player Bottom Bar & Troubleshooting Actions */}
        <div className="bg-[#111115] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5 text-white/70 border border-white/10 shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-white/80">
                {hasTimedOut 
                  ? isAnime
                    ? `Stream taking longer than expected. Switch to ${animeProvider === 'aniembed' ? 'Server 2 (MegaVid)' : 'Server 1 (AniEmbed)'} or try Next Server.`
                    : 'Server taking longer than expected. Try switching to the next provider below.'
                  : isAnime 
                    ? `Streaming anime with ${animeProvider === 'aniembed' ? 'AniEmbed (Server 1)' : 'MegaVid (Server 2)'} (${animeLang.toUpperCase()}).`
                    : `Currently streaming via ${PROVIDERS.find(p => p.id === provider)?.name}.`}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">
                {isAnime 
                  ? 'If AniEmbed cannot find this anime or episode, switch to MegaVid (Server 2).' 
                  : 'If audio or video does not load, click any other provider in the list above.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
            {!isAnime && (
              <button
                type="button"
                onClick={switchNextServer}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs sm:text-sm font-semibold transition-colors border border-amber-500/30 cursor-pointer"
                title="Switch to next provider"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Next Server</span>
              </button>
            )}
            {isAnime && (
              <button
                type="button"
                onClick={() => {
                  setAnimeProvider(prev => prev === 'aniembed' ? 'megavid' : 'aniembed');
                  setIsLoading(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 text-xs sm:text-sm font-semibold transition-colors border border-pink-500/30 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" /> 
                <span>Switch to {animeProvider === 'aniembed' ? 'MegaVid (S2)' : 'AniEmbed (S1)'}</span>
              </button>
            )}
            <button 
              type="button" 
              onClick={retryPlayer} 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold transition-colors border border-white/10 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" /> Reload
            </button>
            <a 
              href={embedUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 text-white text-xs sm:text-sm font-bold transition-all shadow-md"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
            </a>
          </div>
        </div>

      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setShowShortcutsModal(false)}
        >
          <div 
            className="bg-[#141418] border border-white/15 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-[rgb(var(--primary-color))]" />
                <h3 className="font-bold text-white text-base">Cinema Player Shortcuts</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowShortcutsModal(false)} 
                className="text-white/60 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Toggle Fullscreen</span>
                <kbd className="px-2 py-1 rounded bg-black/60 border border-white/20 font-mono text-xs text-white">F</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Toggle Theater Cinema Mode</span>
                <kbd className="px-2 py-1 rounded bg-black/60 border border-white/20 font-mono text-xs text-white">T</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Dim Lights (Cinema Mode)</span>
                <kbd className="px-2 py-1 rounded bg-black/60 border border-white/20 font-mono text-xs text-white">L</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Next Episode</span>
                <kbd className="px-2 py-1 rounded bg-black/60 border border-white/20 font-mono text-xs text-white">N</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Previous Episode</span>
                <kbd className="px-2 py-1 rounded bg-black/60 border border-white/20 font-mono text-xs text-white">P</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Reload Stream Player</span>
                <kbd className="px-2 py-1 rounded bg-black/60 border border-white/20 font-mono text-xs text-white">R</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
