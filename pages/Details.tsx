import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TMDBDetail, MediaType, Stream, TMDBEpisode, TMDBVideo } from '../types';
import { getDetails, getVideos, getRecommendations, getSimilarMedia, getCollection, getSeasonDetails, getWatchProviders, WatchProvidersData } from '../services/tmdb';
import { getAnimeById, mapAniListToTMDBDetail } from '../services/anilist';
import { getStreams, getEpisodeStreams } from '../services/addonService';
import { isInWatchlist, addToWatchlist, removeFromWatchlist, addToHistory, saveProgress, getProgressForId } from '../services/storage';
import { TMDB_IMAGE_BASE, TMDB_POSTER_BASE, TMDB_IMAGE_ORIGINAL, TMDB_BACKDROP_W1280, TMDB_BACKDROP_W780 } from '../constants';
import { PROVIDERS, getHealthBook, healthDotClass } from '../services/streamProviders';
import { StreamList } from '../components/StreamList';
import { MediaCard } from '../components/MediaCard';
import { Skeleton } from '../components/Skeleton';
import { 
  ArrowLeft, Star, Youtube, Play, Tv, X, Server, AlertCircle, Download, 
  Info, Plus, Check, Sparkles, ChevronRight, Layers, Share2, 
  AlertTriangle, Home, Clock, Calendar, Users, Clapperboard, Film, 
  ExternalLink, Image, Copy, Zap, CheckCircle2, ChevronDown, ListFilter,
  DollarSign, Globe, Award, Heart, Ghost, Search, Maximize2
} from 'lucide-react';

export interface GalleryAssetItem {
  id: string;
  file_path: string;
  width: number;
  height: number;
  vote_average?: number;
  type: 'wallpaper' | 'logo' | 'poster';
  title: string;
  badge: string;
  resolutionText: string;
  aspectRatio: string;
  iso_639_1?: string | null;
}

type TabKey = 'overview' | 'episodes' | 'streams' | 'videos' | 'photos';

const AVATAR_FALLBACK_SVG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22120%22%20height%3D%22160%22%20viewBox%3D%220%200%20120%20160%22%3E%3Crect%20fill%3D%22%2318181b%22%20width%3D%22120%22%20height%3D%22160%22%2F%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2226%22%20fill%3D%22%233f3f46%22%2F%3E%3Cpath%20d%3D%22M24%20140c0-20%2016-36%2036-36s36%2016%2036%2036%22%20fill%3D%22%233f3f46%22%2F%3E%3C%2Fsvg%3E';
const POSTER_FALLBACK_SVG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22450%22%20viewBox%3D%220%200%20300%20450%22%3E%3Crect%20fill%3D%22%2318181b%22%20width%3D%22300%22%20height%3D%22450%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20fill%3D%22%2371717a%22%20font-family%3D%22sans-serif%22%20font-size%3D%2216%22%3ENo%20Poster%3C%2Ftext%3E%3C%2Fsvg%3E';

// Fast server picker mirrors the shared provider registry (same list VidyPlayer uses)
const FAST_SERVERS = PROVIDERS.map(p => ({ id: p.id, name: p.name, speed: p.speed, badge: p.badge }));

export const Details: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Optimistic UI: Use state from router for immediate rendering
  const initialItem = location.state?.item;
  const anilistParam = new URLSearchParams(location.search).get('anilistId');
  const anilistId = Number(anilistParam || initialItem?.anilist_id) || undefined;
  
  // Robustly determine media type from URL
  const type = location.pathname.includes('/tv/') ? MediaType.TV : MediaType.MOVIE;
  const tmdbId = parseInt(id || '0');

  // Scroll to top and reset transient state when page loads or id changes
  useEffect(() => {
    setLogoLoadFailed(false);
    setShowServerPicker(false);
    setSelectedAssetIndex(null);
    setIsFullResLoaded(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id, type]);

  // React Query for Basic Details with all appended responses
  const { data: fetchedDetail, isLoading: loadingDetails, isError: isTmdbError } = useQuery({
    queryKey: ['details', tmdbId, type],
    queryFn: () => getDetails(tmdbId, type),
    enabled: !!tmdbId,
    retry: 1,
    staleTime: 1000 * 60 * 10,
  });

  // If TMDB errors or if anilistId is specified, fetch directly from AniList!
  const possibleAniListId = anilistId || (isTmdbError && type === MediaType.TV ? tmdbId : undefined);

  const { data: rawAniListDetail, isLoading: loadingAniList } = useQuery({
    queryKey: ['anilist-detail', possibleAniListId],
    queryFn: () => getAnimeById(possibleAniListId!),
    enabled: !!possibleAniListId,
    staleTime: 1000 * 60 * 60,
  });

  const aniListConvertedDetail = useMemo(() => {
    if (!rawAniListDetail) return null;
    return mapAniListToTMDBDetail(rawAniListDetail);
  }, [rawAniListDetail]);

  const detail = useMemo(() => {
    if (aniListConvertedDetail && (anilistId || rawAniListDetail?.status === 'NOT_YET_RELEASED')) {
      return {
        ...aniListConvertedDetail,
        ...(fetchedDetail?.credits ? { credits: fetchedDetail.credits } : {}),
        ...(fetchedDetail?.videos ? { videos: fetchedDetail.videos } : {})
      };
    }
    return fetchedDetail || aniListConvertedDetail || (initialItem as TMDBDetail | undefined);
  }, [fetchedDetail, aniListConvertedDetail, anilistId, rawAniListDetail, initialItem]);

  const effectiveAnilistId = anilistId || detail?.anilist_id || (rawAniListDetail ? rawAniListDetail.id : undefined);
  const isAnime = Boolean(effectiveAnilistId);

  const isShowUnreleased = useMemo(() => {
    if (rawAniListDetail?.status === 'NOT_YET_RELEASED') return true;
    const status = (detail?.status || fetchedDetail?.status || '').toLowerCase();
    if (status === 'not_yet_released' || status === 'upcoming' || status === 'planned') return true;
    return false;
  }, [rawAniListDetail, detail, fetchedDetail]);

  const isError = isTmdbError && !aniListConvertedDetail && !initialItem;
  const showSkeleton = !detail && (loadingDetails || (!!possibleAniListId && loadingAniList));

  // Videos
  const { data: videos } = useQuery({
    queryKey: ['videos', tmdbId, type],
    queryFn: () => getVideos(tmdbId, type),
    enabled: !!tmdbId,
    staleTime: 1000 * 60 * 30,
  });

  // Recommendations
  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', tmdbId, type],
    queryFn: () => getRecommendations(tmdbId, type),
    enabled: !!tmdbId,
    staleTime: 1000 * 60 * 30,
  });

  // Similar Titles
  const { data: similarMedia } = useQuery({
    queryKey: ['similar', tmdbId, type],
    queryFn: () => getSimilarMedia(tmdbId, type),
    enabled: !!tmdbId,
    staleTime: 1000 * 60 * 30,
  });

  // Collection
  const { data: collection } = useQuery({
    queryKey: ['collection', detail?.belongs_to_collection?.id],
    queryFn: () => getCollection(detail!.belongs_to_collection!.id),
    enabled: !!detail?.belongs_to_collection?.id,
    staleTime: 1000 * 60 * 60,
  });

  // Where to Stream (JustWatch / TMDB Watch Providers)
  const { data: watchProviders } = useQuery({
    queryKey: ['watch-providers', tmdbId, type],
    queryFn: () => getWatchProviders(tmdbId, type),
    enabled: !!tmdbId,
    staleTime: 1000 * 60 * 60 * 12,
  });

  // Local State
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [inLibrary, setInLibrary] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [activeSection, setActiveSection] = useState<'none' | 'player' | 'downloads'>('none');
  const [directUrl, setDirectUrl] = useState<string>('');
  const [videoError, setVideoError] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState<TMDBVideo | null>(null);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [showNextEpButton, setShowNextEpButton] = useState(false);
  const [isAutoPlayingNext, setIsAutoPlayingNext] = useState(false);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState<number | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'wallpapers' | 'logos' | 'posters'>('all');
  const [isFullResLoaded, setIsFullResLoaded] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [streamQualityFilter, setStreamQualityFilter] = useState<'all' | '4k' | '1080p' | '720p'>('all');
  const [selectedServer, setSelectedServer] = useState<string>('ishowstream');
  const [showServerPicker, setShowServerPicker] = useState<boolean>(false);
  const [episodeSearchQuery, setEpisodeSearchQuery] = useState<string>('');
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [videoFilter, setVideoFilter] = useState<'all' | 'trailers' | 'clips'>('all');

  const heroRef = useRef<HTMLDivElement>(null);
  const actionRowRef = useRef<HTMLDivElement>(null);
  const serverPickerRef = useRef<HTMLDivElement>(null);
  const sectionContainerRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Show Toast Helper (avoids window.alert)
  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Sticky header observer: Only triggers once the hero action buttons have scrolled off the viewport
  useEffect(() => {
    let rafId = 0;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (actionRowRef.current) {
          const rect = actionRowRef.current.getBoundingClientRect();
          // 60px corresponds to the top navbar height
          setShowStickyHeader(rect.bottom < 60);
        } else {
          setShowStickyHeader(window.scrollY > 680);
        }
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Close server picker on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (serverPickerRef.current && !serverPickerRef.current.contains(e.target as Node)) {
        setShowServerPicker(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowServerPicker(false);
      }
    };
    if (showServerPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showServerPicker]);


  // Sync watchlist & history
  useEffect(() => {
    if (detail) {
      setInLibrary(isInWatchlist(detail.id));
      if (fetchedDetail) {
        addToHistory({ ...detail, media_type: type });
      }
      
      const progress = getProgressForId(detail.id);
      if (progress && progress.episode && (progress.season || anilistId)) {
        if (progress.season) setSelectedSeason(progress.season);
        setSelectedEpisode(progress.episode);
      }
    }
  }, [detail, type, fetchedDetail, anilistId]);

  // Season Details Query for TV
  const { data: fetchedSeasonData, isLoading: loadingSeason } = useQuery({
    queryKey: ['season', tmdbId, selectedSeason],
    queryFn: () => getSeasonDetails(tmdbId, selectedSeason),
    enabled: type === MediaType.TV && !!tmdbId && selectedSeason > 0 && !aniListConvertedDetail,
    staleTime: 1000 * 60 * 30,
  });

  const seasonData = (anilistId || rawAniListDetail?.status === 'NOT_YET_RELEASED' || aniListConvertedDetail)
    ? (detail?.season_detail_fallback || fetchedSeasonData)
    : (fetchedSeasonData || detail?.season_detail_fallback);

  const imdbId = fetchedDetail?.external_ids?.imdb_id;
  
  // Streams Query
  const { data: streamData, isLoading: loadingStreams } = useQuery({
    queryKey: ['streams', type, imdbId, selectedSeason, selectedEpisode],
    queryFn: async () => {
      if (!imdbId) return { streams: [] };
      if (type === MediaType.MOVIE) {
        return await getStreams(MediaType.MOVIE, imdbId);
      } else {
        return await getEpisodeStreams(imdbId, selectedSeason, selectedEpisode);
      }
    },
    enabled: !!imdbId && (type === MediaType.MOVIE || (type === MediaType.TV && !!selectedSeason && !!selectedEpisode)),
    staleTime: 1000 * 60 * 30,
  });
  
  const streams = streamData?.streams || [];

  // Filtered Streams
  const filteredStreams = useMemo(() => {
    if (streamQualityFilter === 'all') return streams;
    return streams.filter(s => {
      const text = ((s.title || '') + ' ' + (s.name || '')).toLowerCase();
      if (streamQualityFilter === '4k') return text.includes('4k') || text.includes('2160p');
      if (streamQualityFilter === '1080p') return text.includes('1080p');
      if (streamQualityFilter === '720p') return text.includes('720p');
      return true;
    });
  }, [streams, streamQualityFilter]);

  // Handle auto-playing next episode
  useEffect(() => {
    if (isAutoPlayingNext && !loadingStreams) {
      if (streams.length > 0) {
        const bestStream = streams.find(s => s.url) || streams[0];
        handleStreamPlay(bestStream);
      } else {
        setActiveSection('downloads'); 
      }
      setIsAutoPlayingNext(false);
    }
  }, [streams, loadingStreams, isAutoPlayingNext]);

  // Watchlist Toggle
  const toggleLibrary = () => {
    if (!detail) return;
    if (inLibrary) {
      removeFromWatchlist(detail.id);
      setInLibrary(false);
      showToast('Removed from Watchlist');
    } else {
      addToWatchlist({ 
        ...detail, 
        anilist_id: effectiveAnilistId,
        media_type: type 
      });
      setInLibrary(true);
      showToast('Added to Watchlist');
    }
  };

  // Play Stream Handler
  const handleStreamPlay = (stream: Stream) => {
    setVideoError(false);
    if (stream.url) {
      setDirectUrl(stream.url);
      activateSection('player');
    } else if (stream.infoHash) {
      const magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.title || 'video')}`;
      window.location.href = magnet;
      showToast('Opening Magnet Link...');
    }
  };

  // Launch Vidy Player
  const openVidyPlayer = (seasonNum?: number, episodeNum?: number, serverOverride?: string) => {
    if (!detail) return;
    const targetSeason = seasonNum ?? selectedSeason;
    const targetEpisode = episodeNum ?? selectedEpisode;
    const targetId = detail.id || tmdbId;
    const playerPath = type === MediaType.MOVIE
      ? `/watch/movie/${targetId}`
      : `/watch/tv/${targetId}/${targetSeason}/${targetEpisode}`;
    
    const params = new URLSearchParams();
    if (effectiveAnilistId) params.set('anilistId', effectiveAnilistId.toString());
    const targetServer = serverOverride || selectedServer;
    if (targetServer && targetServer !== 'ishowstream') {
      params.set('server', targetServer);
    }
    const query = params.toString() ? `?${params.toString()}` : '';

    saveProgress({
      id: detail.id,
      anilist_id: effectiveAnilistId,
      media_type: type,
      title: detail.title || detail.name || '',
      poster_path: detail.poster_path || null,
      season: type === MediaType.TV ? targetSeason : undefined,
      episode: type === MediaType.TV ? targetEpisode : undefined,
    });
    navigate(`${playerPath}${query}`);
  };

  const activateSection = (section: 'none' | 'player' | 'downloads') => {
    if (section === 'player' && detail) {
      saveProgress({
        id: detail.id,
        anilist_id: effectiveAnilistId,
        media_type: type,
        title: detail.title || detail.name || '',
        poster_path: detail.poster_path || null,
        season: type === MediaType.TV ? selectedSeason : undefined,
        episode: type === MediaType.TV ? selectedEpisode : undefined,
      });
    }
    setActiveSection(section);
    setTimeout(() => {
      sectionContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const getEpisodeCount = (seasonNum: number) => {
    if (detail?.season_detail_fallback?.episodes) {
      return detail.season_detail_fallback.episodes.length;
    }
    const seasons = (fetchedDetail as any)?.seasons || detail?.seasons;
    if (Array.isArray(seasons)) {
      const season = seasons.find((s: any) => s.season_number === seasonNum);
      if (season?.episode_count) return season.episode_count;
    }
    if (seasonData?.episodes && seasonData.season_number === seasonNum) {
      return seasonData.episodes.length;
    }
    return detail?.number_of_episodes || 24;
  };

  const handleNextEpisode = () => {
    const currentCount = getEpisodeCount(selectedSeason);
    if (selectedEpisode < currentCount) {
      setSelectedEpisode(prev => prev + 1);
    } else if (selectedSeason < (detail?.number_of_seasons || 1)) {
      setSelectedSeason(prev => prev + 1);
      setSelectedEpisode(1);
    } else return;
    
    setIsAutoPlayingNext(true);
    setShowNextEpButton(false);
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (type !== MediaType.TV) return;
    const video = e.currentTarget;
    const timeLeft = video.duration - video.currentTime;
    if (timeLeft <= 30 && timeLeft > 0) {
      const count = getEpisodeCount(selectedSeason);
      const hasNext = selectedEpisode < count || selectedSeason < (detail?.number_of_seasons || 1);
      if (hasNext && !showNextEpButton) setShowNextEpButton(true);
    } else {
      if (showNextEpButton) setShowNextEpButton(false);
    }
  };

  // Native Share / Clipboard Fallback
  const handleShare = async () => {
    const shareTitle = detail?.title || detail?.name || 'StreamHub';
    const shareData = {
      title: shareTitle,
      text: `Watch ${shareTitle} on StreamHub`,
      url: window.location.href,
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        showToast('Shared successfully!');
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }
    navigator.clipboard.writeText(window.location.href);
    showToast('Link copied to clipboard!');
  };

  // Helper metadata
  const backdropPath = detail?.backdrop_path || '';
  const backdropUrl = backdropPath
    ? (backdropPath.startsWith('http') ? backdropPath : `${TMDB_BACKDROP_W1280}${backdropPath}`)
    : '';
  const backdropSrcSet = backdropPath && !backdropPath.startsWith('http')
    ? `${TMDB_BACKDROP_W780}${backdropPath} 780w, ${TMDB_BACKDROP_W1280}${backdropPath} 1280w`
    : undefined;
  const posterUrl = detail?.poster_path 
    ? (detail.poster_path.startsWith('http') ? detail.poster_path : `${TMDB_POSTER_BASE}${detail.poster_path}`) 
    : POSTER_FALLBACK_SVG;
  const title = detail?.title || detail?.name || '';
  const date = detail?.release_date || detail?.first_air_date || '';
  const releaseYear = date ? date.split('-')[0] : '';
  const rating = detail?.vote_average ? detail.vote_average.toFixed(1) : 'N/A';
  const voteCount = detail?.vote_count ? new Intl.NumberFormat('en-US', { notation: 'compact' }).format(detail.vote_count) : null;
  const savedProgress = detail ? getProgressForId(detail.id) : undefined;
  const resumeSeconds = savedProgress?.currentTime || 0;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
  };

  const formatRuntime = (minutes?: number) => {
    if (!minutes) return null;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`;
    return `${mins}m`;
  };

  const formatCurrency = (amount?: number) => {
    if (!amount || amount <= 0) return null;
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(2)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  // Extract Certification / Age Rating
  const certification = useMemo(() => {
    if (!fetchedDetail) return null;
    if (type === MediaType.MOVIE && fetchedDetail.release_dates?.results) {
      const us = fetchedDetail.release_dates.results.find(r => r.iso_3166_1 === 'US') || fetchedDetail.release_dates.results[0];
      const cert = us?.release_dates?.find(d => d.certification)?.certification;
      if (cert) return cert;
    }
    if (type === MediaType.TV && fetchedDetail.content_ratings?.results) {
      const us = fetchedDetail.content_ratings.results.find(r => r.iso_3166_1 === 'US') || fetchedDetail.content_ratings.results[0];
      if (us?.rating) return us.rating;
    }
    return null;
  }, [fetchedDetail, type]);

  // Key Crew & Directors
  const directors = useMemo(() => {
    if (!fetchedDetail) return [];
    if (type === MediaType.TV && fetchedDetail.created_by && fetchedDetail.created_by.length > 0) {
      return fetchedDetail.created_by.map(c => ({ name: c.name, role: 'Creator', id: c.id, profile_path: c.profile_path }));
    }
    if (fetchedDetail.credits?.crew) {
      const directList = fetchedDetail.credits.crew.filter(c => c.job === 'Director').slice(0, 3);
      if (directList.length > 0) {
        return directList.map(d => ({ name: d.name, role: 'Director', id: d.id, profile_path: d.profile_path }));
      }
    }
    return [];
  }, [fetchedDetail, type]);

  const keyCrew = useMemo(() => {
    if (!fetchedDetail?.credits?.crew) return [];
    const importantJobs = ['Screenplay', 'Writer', 'Director of Photography', 'Original Music Composer'];
    const crewMap = new Map<string, { name: string; role: string; id: number }>();
    fetchedDetail.credits.crew.forEach(member => {
      if (importantJobs.includes(member.job) && !crewMap.has(member.job)) {
        crewMap.set(member.job, { name: member.name, role: member.job, id: member.id });
      }
    });
    return Array.from(crewMap.values()).slice(0, 4);
  }, [fetchedDetail]);

  // Trailers and Clips categorized cleanly
  const allVideos = useMemo(() => {
    if (!videos) return [];
    return videos.filter(v => v.site === 'YouTube');
  }, [videos]);

  const officialTrailers = useMemo(() => {
    return allVideos.filter(v => v.type === 'Trailer' || v.type === 'Teaser');
  }, [allVideos]);

  const otherClips = useMemo(() => {
    return allVideos.filter(v => v.type !== 'Trailer' && v.type !== 'Teaser');
  }, [allVideos]);

  const sortedVideos = useMemo(() => {
    return [...officialTrailers, ...otherClips];
  }, [officialTrailers, otherClips]);

  const primaryTrailer = officialTrailers.find(v => v.type === 'Trailer') || officialTrailers[0] || allVideos[0];
  const trailerCount = officialTrailers.length > 0 ? officialTrailers.length : allVideos.length;

  // Wallpapers (Backdrops)
  const wallpapersList = useMemo<GalleryAssetItem[]>(() => {
    const rawBackdrops = fetchedDetail?.images?.backdrops || [];
    return rawBackdrops.map((img, idx) => {
      let qualityBadge = 'HD';
      if (img.width >= 7680) qualityBadge = '8K UHD';
      else if (img.width >= 3840) qualityBadge = '4K UHD';
      else if (img.width >= 2560) qualityBadge = '2K QHD';
      else if (img.width >= 1920) qualityBadge = '1080p FHD';

      return {
        id: `wallpaper-${idx}`,
        file_path: img.file_path,
        width: img.width,
        height: img.height,
        vote_average: img.vote_average,
        type: 'wallpaper',
        title: `${qualityBadge} Wallpaper`,
        badge: qualityBadge,
        resolutionText: `${img.width} × ${img.height}`,
        aspectRatio: 'aspect-video',
      };
    });
  }, [fetchedDetail]);

  // Official Transparent PNG & Vector Logos
  const logosList = useMemo<GalleryAssetItem[]>(() => {
    const rawLogos = fetchedDetail?.images?.logos || [];
    return rawLogos.map((logo, idx) => {
      const lang = logo.iso_639_1 ? logo.iso_639_1.toUpperCase() : 'Official';
      return {
        id: `logo-${idx}`,
        file_path: logo.file_path,
        width: logo.width,
        height: logo.height,
        vote_average: logo.vote_average,
        type: 'logo',
        title: `Official Logo (${lang})`,
        badge: 'PNG Logo',
        resolutionText: `${logo.width} × ${logo.height}`,
        aspectRatio: 'aspect-[16/9]',
        iso_639_1: logo.iso_639_1,
      };
    });
  }, [fetchedDetail]);

  // Official Key Art Posters
  const postersList = useMemo<GalleryAssetItem[]>(() => {
    const rawPosters = fetchedDetail?.images?.posters || [];
    return rawPosters.slice(0, 24).map((poster, idx) => ({
      id: `poster-${idx}`,
      file_path: poster.file_path,
      width: poster.width,
      height: poster.height,
      vote_average: poster.vote_average,
      type: 'poster',
      title: 'Official Key Art Poster',
      badge: poster.width >= 2000 ? '4K Poster' : 'HD Poster',
      resolutionText: `${poster.width} × ${poster.height}`,
      aspectRatio: 'aspect-[2/3]',
    }));
  }, [fetchedDetail]);

  // Combined Gallery Assets (Wallpapers, Logos, Posters)
  const allGalleryAssets = useMemo<GalleryAssetItem[]>(() => {
    return [...wallpapersList, ...logosList, ...postersList];
  }, [wallpapersList, logosList, postersList]);

  // Filtered Assets based on Active Filter Chip
  const filteredGalleryAssets = useMemo<GalleryAssetItem[]>(() => {
    if (galleryFilter === 'wallpapers') return wallpapersList;
    if (galleryFilter === 'logos') return logosList;
    if (galleryFilter === 'posters') return postersList;
    return allGalleryAssets;
  }, [galleryFilter, wallpapersList, logosList, postersList, allGalleryAssets]);

  // Reset loading status when switching selected asset
  useEffect(() => {
    setIsFullResLoaded(false);
  }, [selectedAssetIndex]);

  // Keyboard navigation for full-resolution lightbox
  useEffect(() => {
    const handleGalleryKey = (e: KeyboardEvent) => {
      if (selectedAssetIndex === null) return;
      if (e.key === 'Escape') {
        setSelectedAssetIndex(null);
      } else if (e.key === 'ArrowRight') {
        setSelectedAssetIndex(prev => (prev !== null && prev < filteredGalleryAssets.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowLeft') {
        setSelectedAssetIndex(prev => (prev !== null && prev > 0 ? prev - 1 : filteredGalleryAssets.length - 1));
      }
    };
    window.addEventListener('keydown', handleGalleryKey);
    return () => window.removeEventListener('keydown', handleGalleryKey);
  }, [selectedAssetIndex, filteredGalleryAssets.length]);

  // English or Original Language Logo artwork (never unrelated 3rd languages)
  const officialLogo = useMemo(() => {
    const logos = fetchedDetail?.images?.logos;
    if (!logos || logos.length === 0) return null;

    const origLang = (fetchedDetail?.original_language || detail?.original_language || '').toLowerCase();

    // 1. First priority: English logo
    const enLogos = logos.filter(l => l.iso_639_1?.toLowerCase() === 'en');
    if (enLogos.length > 0) {
      return enLogos.sort((a, b) => ((b.vote_average || 0) * 10 + (b.vote_count || 0)) - ((a.vote_average || 0) * 10 + (a.vote_count || 0)))[0].file_path;
    }

    // 2. Second priority: Original show language logo (e.g. ja for anime, ko for k-drama, fr for French)
    if (origLang && origLang !== 'en') {
      const origLogos = logos.filter(l => l.iso_639_1?.toLowerCase() === origLang);
      if (origLogos.length > 0) {
        return origLogos.sort((a, b) => ((b.vote_average || 0) * 10 + (b.vote_count || 0)) - ((a.vote_average || 0) * 10 + (a.vote_count || 0)))[0].file_path;
      }
    }

    // 3. Third priority: Language neutral logo (null, empty, or 'xx')
    const neutralLogos = logos.filter(l => !l.iso_639_1 || l.iso_639_1 === 'xx' || l.iso_639_1 === 'null');
    if (neutralLogos.length > 0) {
      return neutralLogos.sort((a, b) => ((b.vote_average || 0) * 10 + (b.vote_count || 0)) - ((a.vote_average || 0) * 10 + (a.vote_count || 0)))[0].file_path;
    }

    // Never fallback to an unrelated foreign language
    return null;
  }, [fetchedDetail, detail]);

  if (isError) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">Title Not Found</h1>
        <p className="text-[var(--text-muted)] mb-6 max-w-md text-sm">
          We couldn't retrieve the details for this title from the database. It may have been removed or the ID is invalid.
        </p>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate('/')}
            className="bg-[rgb(var(--primary-color))] text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:brightness-110 transition-all text-sm shadow-lg shadow-[rgb(var(--primary-color))]/20"
          >
            <Home className="w-4 h-4" /> Go Home
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] px-5 py-2.5 rounded-xl font-semibold hover:bg-[var(--bg-hover)] transition-all text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (showSkeleton) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] p-4 sm:p-8 animate-pulse">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="w-full h-[400px] rounded-3xl" />
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
            <Skeleton className="w-full aspect-[2/3] rounded-2xl" />
            <div className="space-y-4">
              <Skeleton width="60%" height={48} className="rounded-lg" />
              <Skeleton width="40%" height={24} className="rounded-md" />
              <Skeleton width="100%" height={120} className="rounded-xl" />
              <div className="flex gap-4 pt-4">
                <Skeleton width={160} height={48} variant="rectangular" className="rounded-xl" />
                <Skeleton width={140} height={48} variant="rectangular" className="rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans transition-colors duration-300 flex flex-col relative selection:bg-[rgb(var(--primary-color))]/30">
      
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#18181b] border border-white/15 text-white px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-[rgb(var(--primary-color))]" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Floating Sticky Bar on Scroll */}
      <div 
        className={`fixed top-[57px] inset-x-0 z-30 bg-[var(--bg-main)]/95 backdrop-blur-xl border-b border-white/10 transition-all duration-300 py-2.5 px-4 sm:px-8 flex items-center justify-between shadow-lg ${
          showStickyHeader ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <img src={posterUrl} alt="" className="w-8 h-11 object-cover rounded shadow shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[var(--text-main)] truncate">{title}</h4>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Star className="w-3 h-3 fill-amber-400" /> {rating}
              </span>
              <span>·</span>
              <span>{releaseYear}</span>
              {type === MediaType.TV && (
                <>
                  <span>·</span>
                  <span>{detail?.number_of_seasons || 1} Seasons</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isShowUnreleased ? (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Upcoming</span>
            </div>
          ) : (
            <button
              onClick={() => openVidyPlayer()}
              className="bg-[rgb(var(--primary-color))] text-white text-xs sm:text-sm font-bold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg flex items-center gap-1.5 shadow-md hover:brightness-110 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Play</span>
            </button>
          )}
          <button
            onClick={toggleLibrary}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              inLibrary 
                ? 'bg-[rgb(var(--primary-color))]/15 border-[rgb(var(--primary-color))] text-[rgb(var(--primary-color))]' 
                : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
            title={inLibrary ? 'In Watchlist' : 'Add to Watchlist'}
          >
            {inLibrary ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
          <button
            onClick={handleShare}
            className="p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cinematic Hero Section */}
      <div ref={heroRef} className="relative w-full min-h-[420px] sm:min-h-[480px] lg:min-h-[540px] flex flex-col justify-end overflow-visible">
        {/* Layer 1: High Resolution Backdrop Image */}
        {backdropUrl ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img 
              src={backdropUrl} 
              srcSet={backdropSrcSet}
              sizes="100vw"
              alt={title}
              loading="eager"
              fetchPriority="high"
              className="w-full h-full object-cover object-center lg:object-top transform scale-105 filter brightness-95 contrast-105" 
            />
            {/* Vignette gradients for immaculate readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/65 to-[var(--bg-main)]/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-main)] via-[var(--bg-main)]/80 to-transparent w-full lg:w-3/4" />
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-[var(--bg-main)]/90" />
            {/* Ambient theme glow */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[rgb(var(--primary-color))]/15 rounded-full blur-[120px] pointer-events-none" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#18181b] to-[var(--bg-main)]" />
        )}

        {/* Layer 2: Breadcrumbs & Back Navigation */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 w-full flex items-center justify-between">
          <nav className="flex items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
            <Link to="/" className="hover:text-[var(--text-main)] transition-colors flex items-center gap-1">
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
            <span>/</span>
            <Link 
              to={type === MediaType.TV ? "/discover?type=tv" : "/discover?type=movie"} 
              className="hover:text-[var(--text-main)] transition-colors"
            >
              {type === MediaType.TV ? 'Series' : 'Movies'}
            </Link>
            <span>/</span>
            <span className="text-[var(--text-main)] font-semibold truncate max-w-[200px] sm:max-w-xs">{title}</span>
          </nav>

          <button 
            onClick={() => navigate(-1)} 
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> <span>Back</span>
          </button>
        </div>

        {/* Layer 3: Hero Content Body */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-8 sm:pb-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 items-end">
            
            {/* Poster Card Column (Desktop) */}
            <div className="hidden lg:block shrink-0">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/15 aspect-[2/3] bg-[var(--bg-card)] group">
                <img 
                  src={posterUrl} 
                  alt={title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-xs text-white/90 font-medium">Click to enlarge poster</span>
                </div>
              </div>
            </div>

            {/* Hero Main Info Column */}
            <div className="flex flex-col min-w-0">
              
              {/* Mobile Poster & Title Lockup */}
              <div className="lg:hidden flex gap-4 mb-4 items-center">
                <div className="w-24 sm:w-28 shrink-0 rounded-xl overflow-hidden shadow-2xl border border-white/15 aspect-[2/3] bg-[var(--bg-card)]">
                  <img src={posterUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col justify-center min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {isAnime ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/15 px-2 py-0.5 rounded-full border border-pink-500/30">
                        <Ghost className="w-3 h-3" /> Anime Series
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--primary-color))]">
                        {type === MediaType.TV ? 'Series' : 'Feature Film'}
                      </span>
                    )}
                    {certification && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/20 text-white/80 font-mono font-medium">
                        {certification}
                      </span>
                    )}
                  </div>
                  {officialLogo && !logoLoadFailed ? (
                    <div className="mb-2 max-w-[200px]">
                      <img 
                        src={`${TMDB_IMAGE_BASE}${officialLogo}`} 
                        alt={title} 
                        onError={() => setLogoLoadFailed(true)}
                        className="max-h-14 w-auto object-contain filter drop-shadow-md" 
                      />
                      <h1 className="sr-only">{title}</h1>
                    </div>
                  ) : (
                    <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight break-words">
                      {title}
                    </h1>
                  )}
                  {detail?.original_title && detail.original_title.toLowerCase() !== title.toLowerCase() && (
                    <p className="text-xs text-white/60 mt-0.5">
                      ({detail.original_title})
                    </p>
                  )}
                  {!detail?.original_title && detail?.original_name && detail.original_name.toLowerCase() !== title.toLowerCase() && (
                    <p className="text-xs text-white/60 mt-0.5">
                      ({detail.original_name})
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/70 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {rating}
                    </span>
                    <span>·</span>
                    <span>{releaseYear}</span>
                    {fetchedDetail?.runtime && (
                      <>
                        <span>·</span>
                        <span>{formatRuntime(fetchedDetail.runtime)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Header */}
              <div className="hidden lg:block mb-4">
                <div className="flex items-center gap-3 mb-2.5">
                  {isAnime ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pink-400 bg-pink-500/15 px-3 py-1 rounded-full border border-pink-500/30 shadow-sm">
                      <Ghost className="w-3.5 h-3.5" /> AniList Anime Series
                    </span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-[rgb(var(--primary-color))]">
                      {type === MediaType.TV ? 'Television Series' : 'Feature Film'}
                    </span>
                  )}
                  {certification && (
                    <span className="text-xs px-2 py-0.5 rounded border border-white/25 text-white/90 font-mono font-semibold">
                      {certification}
                    </span>
                  )}
                  {(fetchedDetail?.status || detail?.status) && (
                    <span className="text-xs text-white/60 font-medium">
                      {fetchedDetail?.status || detail?.status}
                    </span>
                  )}
                </div>

                {/* Title and Transparent Logo Header */}
                <div className="mb-4">
                  {officialLogo && !logoLoadFailed ? (
                    <div className="mb-3 max-w-lg">
                      <img 
                        src={`${TMDB_IMAGE_BASE}${officialLogo}`} 
                        alt={title} 
                        onError={() => setLogoLoadFailed(true)}
                        className="max-h-24 xl:max-h-28 w-auto object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]" 
                      />
                      <h1 className="sr-only">{title}</h1>
                    </div>
                  ) : (
                    <h1 className="text-3xl sm:text-4xl xl:text-5xl font-black text-white tracking-tight leading-[1.08] max-w-4xl drop-shadow-md">
                      {title}
                    </h1>
                  )}

                  {/* Original Language Title if different */}
                  {detail?.original_title && detail.original_title.toLowerCase() !== title.toLowerCase() && (
                    <p className="text-sm font-medium text-white/60 tracking-normal mt-1">
                      Original: <span className="text-white/80">{detail.original_title}</span>
                    </p>
                  )}
                  {!detail?.original_title && detail?.original_name && detail.original_name.toLowerCase() !== title.toLowerCase() && (
                    <p className="text-sm font-medium text-white/60 tracking-normal mt-1">
                      Original: <span className="text-white/80">{detail.original_name}</span>
                    </p>
                  )}
                </div>

                {/* Tagline */}
                {detail?.tagline && (
                  <p className="text-base xl:text-lg italic text-white/80 font-serif max-w-3xl mb-4 leading-relaxed">
                    "{detail.tagline}"
                  </p>
                )}

                {/* Desktop Metadata Line (Zero-Pill Discipline) */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80">
                  <div className="inline-flex items-center gap-1.5 text-amber-400 font-bold">
                    <Star className="w-4 h-4 fill-amber-400" /> 
                    <span>{rating}</span>
                    {voteCount && <span className="text-xs text-white/50 font-normal">({voteCount} votes)</span>}
                  </div>
                  <span>·</span>
                  <span>{date}</span>
                  {fetchedDetail?.runtime && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-white/60" /> {formatRuntime(fetchedDetail.runtime)}
                      </span>
                    </>
                  )}
                  {type === MediaType.TV && (
                    <>
                      <span>·</span>
                      <span>{fetchedDetail?.number_of_seasons || 1} Seasons</span>
                      {fetchedDetail?.number_of_episodes && <span>({fetchedDetail.number_of_episodes} Episodes)</span>}
                    </>
                  )}
                  {fetchedDetail?.genres && fetchedDetail.genres.length > 0 && (
                    <>
                      <span>·</span>
                      <div className="flex items-center gap-2">
                        {fetchedDetail.genres.map((g, i) => (
                          <React.Fragment key={g.id}>
                            <Link 
                              to={`/discover?type=${type}&genre=${g.id}`} 
                              className="text-white/70 hover:text-white transition-colors underline-offset-4 hover:underline"
                            >
                              {g.name}
                            </Link>
                            {i < fetchedDetail.genres.length - 1 && <span className="text-white/40">/</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons Matrix */}
              <div ref={actionRowRef} className="flex flex-wrap items-center gap-3 pt-2 relative z-30">
                
                {/* Primary Play Button */}
                {isShowUnreleased ? (
                  <button
                    disabled
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2.5 py-3.5 px-7 rounded-xl font-bold text-base bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-not-allowed shadow-md"
                  >
                    <Clock className="w-5 h-5 text-amber-400" />
                    <span>Not Yet Released</span>
                  </button>
                ) : (
                  <button
                    onClick={() => openVidyPlayer()}
                    disabled={loadingDetails}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-3 py-3.5 px-7 rounded-xl font-bold text-base transition-all duration-200 bg-[rgb(var(--primary-color))] text-white hover:brightness-110 shadow-lg shadow-[rgb(var(--primary-color))]/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                  >
                    {loadingDetails ? (
                      <Server className="w-5 h-5 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 fill-current transition-transform group-hover:scale-110" />
                    )}
                    <span>
                      {loadingDetails
                        ? 'Loading...'
                        : resumeSeconds > 0
                          ? `Resume (${formatTime(resumeSeconds)})`
                          : type === MediaType.TV
                            ? `Play S${selectedSeason} E${selectedEpisode}`
                            : 'Play Movie'}
                    </span>
                  </button>
                )}

                {/* Fast Server Quick Launch Selector */}
                {!isShowUnreleased && (
                  <div className="relative" ref={serverPickerRef}>
                    <button
                      onClick={() => setShowServerPicker(!showServerPicker)}
                      className="flex items-center gap-2 py-3 px-4 rounded-xl border border-white/20 bg-black/50 hover:bg-black/70 text-white backdrop-blur-md transition-all text-sm font-semibold group cursor-pointer shadow-md hover:border-white/40"
                      title="Choose Streaming Provider Server"
                    >
                      <Server className="w-4 h-4 text-[rgb(var(--primary-color))]" />
                      <span className="hidden sm:inline text-xs text-white/70">Server:</span>
                      <span className="text-xs font-bold text-white group-hover:text-[rgb(var(--primary-color))] transition-colors">
                        {FAST_SERVERS.find(s => s.id === selectedServer)?.name || 'iShowStream'}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-white/60 transition-transform ${showServerPicker ? 'rotate-180' : ''}`} />
                    </button>

                    {showServerPicker && (
                      <div className="absolute top-full left-0 mt-2.5 w-72 bg-[#121318]/95 border border-white/15 rounded-2xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 backdrop-blur-2xl ring-1 ring-white/10">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-white/80 font-bold">
                            <Zap className="w-3.5 h-3.5 text-amber-400" /> Fast Stream Servers
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">Ad-Free</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 mt-1.5 pr-0.5">
                          {FAST_SERVERS.map(srv => {
                            const isSelected = selectedServer === srv.id;
                            return (
                              <button
                                key={srv.id}
                                onClick={() => {
                                  setSelectedServer(srv.id);
                                  setShowServerPicker(false);
                                  openVidyPlayer(undefined, undefined, srv.id);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-md' 
                                    : 'text-white/80 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {isSelected ? (
                                    <Check className="w-4 h-4 text-white shrink-0" />
                                  ) : (
                                    <Server className="w-4 h-4 text-white/40 shrink-0" />
                                  )}
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${healthDotClass(getHealthBook(), `movie:${srv.id}`)}`}
                                    title="Server health"
                                  />
                                  <div className="text-left min-w-0">
                                    <p className="truncate font-bold leading-tight">{srv.name}</p>
                                    {srv.badge && (
                                      <p className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-amber-400/90'}`}>{srv.badge}</p>
                                    )}
                                  </div>
                                </div>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg shrink-0 ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 border border-white/10'
                                }`}>
                                  {srv.speed}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Trailer Button */}
                {primaryTrailer && (
                  <button
                    onClick={() => {
                      setSelectedTrailer(primaryTrailer);
                      setShowTrailerModal(true);
                    }}
                    className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold border border-white/20 bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all hover:border-red-500/60 hover:text-red-400 group"
                  >
                    <Youtube className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                    <span className="text-sm">Trailer</span>
                  </button>
                )}

                {/* Torrents / Streams Drawer Trigger */}
                <button
                  onClick={() => {
                    setActiveTab('streams');
                    sectionContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold border border-white/15 bg-white/10 hover:bg-white/15 text-white backdrop-blur-md transition-all text-sm"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Streams ({streams.length})</span>
                </button>

                {/* Watchlist Toggle */}
                <button
                  onClick={toggleLibrary}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-center ${
                    inLibrary
                      ? 'bg-[rgb(var(--primary-color))]/20 border-[rgb(var(--primary-color))] text-[rgb(var(--primary-color))]'
                      : 'bg-black/40 hover:bg-black/60 border-white/15 text-white/80 hover:text-white'
                  }`}
                  title={inLibrary ? 'In Watchlist' : 'Add to Watchlist'}
                  aria-label={inLibrary ? 'In Watchlist' : 'Add to Watchlist'}
                >
                  {inLibrary ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </button>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="p-3 rounded-xl border border-white/15 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-all flex items-center justify-center"
                  title="Share"
                  aria-label="Share"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area with Navigation Tabs */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow">
        
        {/* Navigation Tabs Bar */}
        <div className="mb-8 border-b border-[var(--border-color)] pb-3">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[rgb(var(--primary-color))] text-white shadow-lg shadow-[rgb(var(--primary-color))]/25'
                  : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-white/20'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>Overview</span>
            </button>

            {type === MediaType.TV && (
              <button
                onClick={() => setActiveTab('episodes')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  activeTab === 'episodes'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-lg shadow-[rgb(var(--primary-color))]/25'
                    : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-white/20'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>Episodes</span>
                {seasonData?.episodes && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-mono ${
                    activeTab === 'episodes' ? 'bg-white/20 text-white' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                  }`}>
                    {seasonData.episodes.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('streams')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'streams'
                  ? 'bg-[rgb(var(--primary-color))] text-white shadow-lg shadow-[rgb(var(--primary-color))]/25'
                  : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-white/20'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Torrents & Streams</span>
              {streams.length > 0 && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-mono ${
                  activeTab === 'streams' ? 'bg-white/20 text-white' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                }`}>
                  {streams.length}
                </span>
              )}
            </button>

            {sortedVideos.length > 0 && (
              <button
                onClick={() => setActiveTab('videos')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  activeTab === 'videos'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-lg shadow-[rgb(var(--primary-color))]/25'
                    : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-white/20'
                }`}
              >
                <Youtube className="w-4 h-4 text-red-500" />
                <span>Trailers ({trailerCount})</span>
              </button>
            )}

            {allGalleryAssets.length > 0 && (
              <button
                onClick={() => setActiveTab('photos')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                  activeTab === 'photos'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-lg shadow-[rgb(var(--primary-color))]/25'
                    : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-white/20'
                }`}
              >
                <Image className="w-4 h-4 text-purple-400" />
                <span>Wallpapers & Logos</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-mono ${
                  activeTab === 'photos' ? 'bg-white/20 text-white' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                }`}>
                  {allGalleryAssets.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Section Anchor for Scrolling */}
        <div ref={sectionContainerRef} className="scroll-mt-24">
          
          {/* Active Direct Video Player Section (if activated) */}
          {activeSection === 'player' && (
            <div className="mb-10 w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
              {!videoError ? (
                <>
                  <video 
                    controls 
                    autoPlay 
                    className="w-full h-full outline-none" 
                    src={directUrl} 
                    onError={() => setVideoError(true)} 
                    onTimeUpdate={handleTimeUpdate} 
                  />
                  <button 
                    type="button" 
                    onClick={() => { setActiveSection('none'); setDirectUrl(''); }} 
                    className="absolute top-4 right-4 bg-black/70 hover:bg-red-600 text-white p-2 rounded-xl transition-colors shadow-lg" 
                    aria-label="Close video" 
                    title="Close video"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  {showNextEpButton && (
                    <button 
                      onClick={handleNextEpisode} 
                      className="absolute bottom-16 right-4 sm:right-8 z-10 bg-white text-black px-5 py-3 rounded-xl font-bold shadow-2xl flex items-center gap-2 hover:bg-white/90 transition-colors"
                    >
                      <span>Next episode</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
                  <p className="text-white font-bold text-lg mb-1">Direct stream playback failed</p>
                  <p className="text-white/60 text-sm max-w-sm mb-4">The chosen stream could not be loaded directly. You can select another stream or play with Vidy Player.</p>
                  <button 
                    onClick={() => openVidyPlayer()}
                    className="bg-[rgb(var(--primary-color))] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow hover:brightness-110"
                  >
                    Switch to Vidy Player
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-12 animate-fade-in">
              
              {/* Synopsis & Key Info Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-10">
                <div className="space-y-8 min-w-0">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-3 flex items-center gap-2">
                      <Clapperboard className="w-5 h-5 text-[rgb(var(--primary-color))]" /> 
                      Story Synopsis
                    </h3>
                    <p className={`text-[var(--text-muted)] leading-relaxed text-base sm:text-lg ${!overviewExpanded ? 'line-clamp-4' : ''}`}>
                      {detail?.overview || 'No synopsis provided for this title.'}
                    </p>
                    {detail?.overview && detail.overview.length > 280 && (
                      <button 
                        onClick={() => setOverviewExpanded(!overviewExpanded)}
                        className="text-xs font-semibold text-[rgb(var(--primary-color))] hover:underline mt-2 inline-flex items-center gap-1"
                      >
                        {overviewExpanded ? 'Show less' : 'Read more...'}
                      </button>
                    )}
                  </div>

                  {/* Directors & Key Creators Spotlight */}
                  {directors.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                        {type === MediaType.TV ? 'Created By' : 'Directed By'}
                      </h4>
                      <div className="flex flex-wrap gap-4">
                        {directors.map(person => (
                          <div 
                            key={person.id}
                            onClick={() => navigate(`/person/${person.id}`)}
                            className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-color)] p-2.5 pr-4 rounded-xl cursor-pointer hover:border-[rgb(var(--primary-color))] transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--bg-hover)] shrink-0">
                              <img 
                                src={person.profile_path ? `${TMDB_POSTER_BASE}${person.profile_path}` : AVATAR_FALLBACK_SVG} 
                                alt={person.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[var(--text-main)] group-hover:text-[rgb(var(--primary-color))] transition-colors">
                                {person.name}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">{person.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Cast Carousel */}
                  {fetchedDetail?.credits?.cast && fetchedDetail.credits.cast.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                          <Users className="w-5 h-5 text-[rgb(var(--primary-color))]" /> 
                          Featured Cast
                        </h3>
                        <span className="text-xs text-[var(--text-muted)]">
                          {fetchedDetail.credits.cast.length} members
                        </span>
                      </div>
                      
                      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                        {fetchedDetail.credits.cast.slice(0, 14).map(actor => (
                          <button
                            type="button"
                            key={actor.id}
                            onClick={() => navigate(`/person/${actor.id}`)}
                            className="w-28 shrink-0 text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-color))] rounded-xl"
                          >
                            <div className="w-full aspect-[2/3] rounded-xl overflow-hidden mb-2 bg-[var(--bg-card)] border border-[var(--border-color)] group-hover:border-[rgb(var(--primary-color))] transition-all shadow-md">
                              <img 
                                src={actor.profile_path ? `${TMDB_POSTER_BASE}${actor.profile_path}` : AVATAR_FALLBACK_SVG} 
                                alt={actor.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                            <p className="text-xs font-bold text-[var(--text-main)] truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">
                              {actor.name}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] truncate">
                              {actor.character || 'Role'}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Crew Tags */}
                  {keyCrew.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                        Key Production Crew
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {keyCrew.map((crew, idx) => (
                          <button
                            key={idx}
                            onClick={() => crew.id && navigate(`/person/${crew.id}`)}
                            className="bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border-subtle)] text-left hover:border-[rgb(var(--primary-color))]/50 transition-colors group cursor-pointer"
                          >
                            <p className="text-xs text-[var(--text-muted)]">{crew.role}</p>
                            <p className="text-sm font-semibold text-[var(--text-main)] mt-0.5 truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">{crew.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* Right Column: Where to Stream + Metadata & Facts */}
                <div className="space-y-6">

                  {/* Where to Stream Card */}
                  {watchProviders && (watchProviders.flatrate?.length || watchProviders.rent?.length || watchProviders.buy?.length) ? (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
                          <Tv className="w-4 h-4 text-[rgb(var(--primary-color))]" /> 
                          Where to Stream
                        </h4>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">Official</span>
                      </div>

                      {/* Subscription Stream */}
                      {watchProviders.flatrate && watchProviders.flatrate.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Stream Subscription</p>
                          <div className="flex flex-wrap gap-2">
                            {watchProviders.flatrate.map(p => (
                              <div
                                key={p.provider_id}
                                className="flex items-center gap-2 bg-[var(--bg-input)] px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] shadow-sm"
                                title={p.provider_name}
                              >
                                {p.logo_path && (
                                  <img 
                                    src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} 
                                    alt={p.provider_name} 
                                    className="w-5 h-5 rounded-lg object-contain shadow-sm" 
                                  />
                                )}
                                <span className="text-xs font-bold text-[var(--text-main)]">{p.provider_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rent or Buy */}
                      {(watchProviders.rent?.length || watchProviders.buy?.length) ? (
                        <div className="pt-2 border-t border-[var(--border-subtle)]">
                          <p className="text-[11px] font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wider">Rent / Buy</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(watchProviders.rent || watchProviders.buy)?.slice(0, 5).map(p => (
                              <div
                                key={p.provider_id}
                                className="flex items-center gap-1.5 bg-[var(--bg-input)] px-2 py-1 rounded-lg border border-[var(--border-subtle)]"
                                title={p.provider_name}
                              >
                                {p.logo_path && (
                                  <img 
                                    src={`https://image.tmdb.org/t/p/w92${p.logo_path}`} 
                                    alt={p.provider_name} 
                                    className="w-4 h-4 rounded object-contain" 
                                  />
                                )}
                                <span className="text-[11px] font-medium text-[var(--text-main)]">{p.provider_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 space-y-4 shadow-xl">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
                      <Award className="w-4 h-4 text-[rgb(var(--primary-color))]" /> 
                      Information & Facts
                    </h4>

                    {/* Status */}
                    {fetchedDetail?.status && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Status</span>
                        <span className="font-semibold text-[var(--text-main)]">{fetchedDetail.status}</span>
                      </div>
                    )}

                    {/* Release Date */}
                    {date && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Original Air Date</span>
                        <span className="font-semibold text-[var(--text-main)]">{date}</span>
                      </div>
                    )}

                    {/* Language */}
                    {fetchedDetail?.original_language && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Original Language</span>
                        <span className="font-semibold text-[var(--text-main)] uppercase font-mono">
                          {fetchedDetail.original_language}
                        </span>
                      </div>
                    )}

                    {/* Budget (Movies) */}
                    {fetchedDetail?.budget && fetchedDetail.budget > 0 ? (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Budget</span>
                        <span className="font-semibold text-emerald-400">{formatCurrency(fetchedDetail.budget)}</span>
                      </div>
                    ) : null}

                    {/* Box Office Revenue (Movies) */}
                    {fetchedDetail?.revenue && fetchedDetail.revenue > 0 ? (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-[var(--text-muted)]">Box Office</span>
                        <span className="font-semibold text-emerald-400">{formatCurrency(fetchedDetail.revenue)}</span>
                      </div>
                    ) : null}

                    {/* External IMDB Link */}
                    {imdbId && (
                      <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">IMDb Profile</span>
                        <a 
                          href={`https://www.imdb.com/title/${imdbId}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>{imdbId}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Production Studios & Networks */}
                  {((fetchedDetail?.production_companies && fetchedDetail.production_companies.length > 0) || 
                    (fetchedDetail?.networks && fetchedDetail.networks.length > 0)) && (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)] border-b border-[var(--border-color)] pb-3">
                        {type === MediaType.TV ? 'Original Network & Studios' : 'Production Companies'}
                      </h4>
                      <div className="space-y-3">
                        {(fetchedDetail.networks || fetchedDetail.production_companies)?.slice(0, 4).map(company => (
                          <div key={company.id} className="flex items-center gap-3">
                            {company.logo_path ? (
                              <div className="w-12 h-7 bg-white/10 rounded p-1 flex items-center justify-center shrink-0">
                                <img 
                                  src={`${TMDB_IMAGE_BASE}${company.logo_path}`} 
                                  alt={company.name} 
                                  className="max-h-full max-w-full object-contain filter invert opacity-90" 
                                />
                              </div>
                            ) : (
                              <div className="w-7 h-7 bg-[var(--bg-hover)] rounded flex items-center justify-center shrink-0 text-xs font-bold text-[var(--text-muted)]">
                                {company.name.charAt(0)}
                              </div>
                            )}
                            <span className="text-sm font-medium text-[var(--text-main)] truncate">{company.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keywords / Themes */}
                  {((fetchedDetail?.keywords?.keywords && fetchedDetail.keywords.keywords.length > 0) ||
                    (fetchedDetail?.keywords?.results && fetchedDetail.keywords.results.length > 0)) && (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">
                        Themes & Tags
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {(fetchedDetail?.keywords?.keywords || fetchedDetail?.keywords?.results)?.slice(0, 10).map(kw => (
                          <span 
                            key={kw.id}
                            className="text-xs text-[var(--text-muted)] bg-[var(--bg-input)] px-2.5 py-1 rounded-md border border-[var(--border-color)]"
                          >
                            #{kw.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          )}

          {/* TAB 2: EPISODES (TV SERIES & ANIME) */}
          {activeTab === 'episodes' && type === MediaType.TV && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Season Selector Bar & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-color)]">
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 max-w-full">
                  {[...Array(fetchedDetail?.number_of_seasons || 1)].map((_, idx) => {
                    const seasonNumber = idx + 1;
                    const isActive = selectedSeason === seasonNumber;
                    return (
                      <button
                        key={seasonNumber}
                        onClick={() => {
                          setSelectedSeason(seasonNumber);
                          setSelectedEpisode(1);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                          isActive
                            ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                            : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        Season {seasonNumber}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {/* Episode Search Filter */}
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search episodes..."
                      value={episodeSearchQuery}
                      onChange={(e) => setEpisodeSearchQuery(e.target.value)}
                      className="w-full bg-[var(--bg-input)] text-xs text-[var(--text-main)] pl-8 pr-7 py-2 rounded-xl border border-[var(--border-color)] outline-none focus:border-[rgb(var(--primary-color))] transition-colors"
                    />
                    {episodeSearchQuery && (
                      <button
                        onClick={() => setEpisodeSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Direct Episode Selector Jump (Anime Support) */}
                  {anilistId && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] shrink-0">
                      <span>Jump:</span>
                      <input 
                        type="number" 
                        min="1" 
                        step="1" 
                        value={selectedEpisode} 
                        onChange={(e) => setSelectedEpisode(Math.max(1, Number(e.target.value) || 1))} 
                        className="w-16 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 py-1 text-[var(--text-main)] outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))]" 
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Season Synopsis (if available) */}
              {seasonData?.overview && (
                <div className="p-4 bg-[var(--bg-card)]/50 rounded-xl border border-[var(--border-color)] text-sm text-[var(--text-muted)]">
                  <span className="font-bold text-[var(--text-main)]">Season Overview: </span>
                  {seasonData.overview}
                </div>
              )}

              {/* Episodes List / Grid */}
              {(() => {
                const rawEpisodes = seasonData?.episodes || [];
                const filteredEpisodes = rawEpisodes.filter((ep: TMDBEpisode) => {
                  if (!episodeSearchQuery.trim()) return true;
                  const q = episodeSearchQuery.toLowerCase().trim();
                  const matchNum = ep.episode_number.toString() === q || `e${ep.episode_number}` === q || `episode ${ep.episode_number}`.includes(q);
                  const matchName = (ep.name || '').toLowerCase().includes(q);
                  const matchOverview = (ep.overview || '').toLowerCase().includes(q);
                  return matchNum || matchName || matchOverview;
                });

                if (loadingSeason) {
                  return (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-28 skeleton-loader rounded-2xl w-full" />
                      ))}
                    </div>
                  );
                }

                if (rawEpisodes.length > 0 && filteredEpisodes.length === 0) {
                  return (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-8 text-center space-y-3">
                      <p className="text-sm font-semibold text-[var(--text-main)]">
                        No episodes found matching "{episodeSearchQuery}"
                      </p>
                      <button
                        onClick={() => setEpisodeSearchQuery('')}
                        className="text-xs font-bold text-[rgb(var(--primary-color))] hover:underline"
                      >
                        Clear Search
                      </button>
                    </div>
                  );
                }

                if (filteredEpisodes.length > 0) {
                  return (
                    <div className="space-y-4">
                      {filteredEpisodes.map((ep: TMDBEpisode) => {
                        const isCurrent = selectedEpisode === ep.episode_number;
                        const isEpUpcoming = Boolean(
                          ep.is_upcoming ||
                          isShowUnreleased ||
                          (ep.air_date && new Date(ep.air_date).getTime() > Date.now())
                        );

                        const isThisEpProgress = savedProgress?.season === selectedSeason && savedProgress?.episode === ep.episode_number;
                        const isPastEpisode = (savedProgress?.season === selectedSeason && (savedProgress?.episode || 0) > ep.episode_number) ||
                                              ((savedProgress?.season || 0) > selectedSeason);
                        const isNextUpEpisode = (savedProgress?.season === selectedSeason && ep.episode_number === ((savedProgress?.episode || 0) + 1));
                        const epProgressPct = isThisEpProgress ? (savedProgress?.progress || 15) : 0;

                        const stillUrl = ep.still_path?.startsWith('http')
                          ? ep.still_path
                          : ep.still_path
                            ? `${TMDB_IMAGE_BASE}${ep.still_path}`
                            : (backdropUrl || posterUrl);
                        
                        return (
                          <div
                            key={ep.id}
                            className={`group relative flex flex-col md:flex-row gap-4 p-4 rounded-2xl border transition-all ${
                              isEpUpcoming
                                ? 'bg-[var(--bg-card)]/50 border-amber-500/20 border-dashed opacity-80'
                                : isCurrent
                                  ? 'bg-[var(--bg-hover)] border-[rgb(var(--primary-color))] shadow-lg shadow-[rgb(var(--primary-color))]/10 ring-1 ring-[rgb(var(--primary-color))]'
                                  : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[var(--text-muted)]/40 hover:bg-[var(--bg-hover)]/60'
                            }`}
                          >
                            {/* 16:9 Episode Thumbnail */}
                            <div 
                              onClick={() => {
                                if (isEpUpcoming) {
                                  showToast(`Episode ${ep.episode_number} has not aired yet.${ep.air_date ? ` Airs on ${ep.air_date}.` : ''}`);
                                  return;
                                }
                                setSelectedEpisode(ep.episode_number);
                                openVidyPlayer(selectedSeason, ep.episode_number);
                              }}
                              className={`w-full md:w-56 aspect-video rounded-xl overflow-hidden bg-black/50 shrink-0 relative shadow-md transition-shadow ${
                                isEpUpcoming ? 'cursor-not-allowed opacity-75' : 'cursor-pointer group-hover:shadow-xl'
                              }`}
                            >
                              <img 
                                src={stillUrl} 
                                alt={ep.name} 
                                onError={(e) => {
                                  if (posterUrl && e.currentTarget.src !== posterUrl) {
                                    e.currentTarget.src = posterUrl;
                                  }
                                }}
                                className={`w-full h-full object-cover transition-transform duration-300 ${isEpUpcoming ? 'grayscale-[25%]' : 'group-hover:scale-105'}`} 
                              />
                              
                              {/* Play overlay or Upcoming lock overlay */}
                              {isEpUpcoming ? (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg">
                                    <Clock className="w-4 h-4" />
                                  </div>
                                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider bg-black/75 px-2 py-0.5 rounded font-mono">
                                    Upcoming
                                  </span>
                                </div>
                              ) : (
                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                  <div className="w-10 h-10 rounded-full bg-[rgb(var(--primary-color))] text-white flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                  </div>
                                </div>
                              )}

                              {/* Watched / In Progress bar */}
                              {isThisEpProgress && (
                                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/70 overflow-hidden">
                                  <div 
                                    className="h-full bg-[rgb(var(--primary-color))] transition-all" 
                                    style={{ width: `${epProgressPct}%` }} 
                                  />
                                </div>
                              )}

                              {ep.runtime && !isEpUpcoming && (
                                <span className="absolute bottom-2 right-2 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">
                                  {ep.runtime}m
                                </span>
                              )}
                            </div>

                            {/* Episode Info */}
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs font-bold font-mono ${isEpUpcoming ? 'text-amber-400' : 'text-[rgb(var(--primary-color))]'}`}>
                                      E{ep.episode_number}
                                    </span>
                                    <h4 className="text-base font-bold text-[var(--text-main)] truncate max-w-md">
                                      {ep.name || `Episode ${ep.episode_number}`}
                                    </h4>

                                    {/* Progress Badges */}
                                    {isThisEpProgress && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[rgb(var(--primary-color))]/20 text-[rgb(var(--primary-color))] border border-[rgb(var(--primary-color))]/30">
                                        Resume ({epProgressPct}%)
                                      </span>
                                    )}
                                    {isPastEpisode && !isThisEpProgress && (
                                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
                                        <Check className="w-3 h-3" /> Watched
                                      </span>
                                    )}
                                    {isNextUpEpisode && !isThisEpProgress && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        Up Next
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                                    {isEpUpcoming ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                        {ep.air_date ? `Airs ${ep.air_date}` : 'Upcoming'}
                                      </span>
                                    ) : (
                                      <>
                                        {ep.vote_average > 0 && (
                                          <span className="flex items-center gap-1 text-amber-400 font-semibold">
                                            <Star className="w-3 h-3 fill-amber-400" /> {ep.vote_average.toFixed(1)}
                                          </span>
                                        )}
                                        {ep.air_date && <span>{ep.air_date}</span>}
                                      </>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed line-clamp-2 md:line-clamp-3">
                                  {ep.overview || (isEpUpcoming ? 'This episode has not yet aired.' : 'No description available for this episode.')}
                                </p>
                              </div>

                              {/* Quick Action Footer for this episode */}
                              <div className="flex items-center justify-between pt-3 mt-2 border-t border-[var(--border-color)]">
                                <div className="flex items-center gap-2">
                                  {isCurrent && !isEpUpcoming && (
                                    <span className="text-[11px] font-semibold text-[rgb(var(--primary-color))] flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5" /> Selected
                                    </span>
                                  )}
                                  {isEpUpcoming && (
                                    <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> Not yet broadcasted
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isEpUpcoming ? (
                                    <div className="text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-not-allowed">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>Not Aired Yet</span>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedEpisode(ep.episode_number);
                                        openVidyPlayer(selectedSeason, ep.episode_number);
                                      }}
                                      className="text-xs font-bold bg-[rgb(var(--primary-color))] text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 hover:brightness-110 transition-all shadow cursor-pointer"
                                    >
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                      <span>{isThisEpProgress ? 'Resume Episode' : 'Watch Episode'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  );
                }

                return (
                  /* Fallback for when TMDB season details fail or are empty */
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {[...Array(getEpisodeCount(selectedSeason))].map((_, i) => {
                      const epNum = i + 1;
                      const isCur = selectedEpisode === epNum;
                      return (
                        <button
                          key={epNum}
                          onClick={() => {
                            setSelectedEpisode(epNum);
                            openVidyPlayer(selectedSeason, epNum);
                          }}
                          className={`p-4 rounded-xl border text-center transition-all ${
                            isCur
                              ? 'bg-[rgb(var(--primary-color))] text-white border-transparent'
                              : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <p className="text-xs text-[var(--text-muted)] font-mono">Episode</p>
                          <p className="text-xl font-bold mt-1">{epNum}</p>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          )}

          {/* TAB 3: TORRENTS & STREAMS (TORRENTIO INTEGRATION) */}
          {activeTab === 'streams' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                      <Zap className="w-5 h-5 text-[rgb(var(--primary-color))]" /> 
                      Torrentio Streams & Direct Downloads
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Real-time scrapers providing 4K, 1080p, HDR, and Real-Debrid cached streams.
                    </p>
                  </div>

                  {/* Quality Filter Segmented Buttons */}
                  <div className="flex items-center gap-1 bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-color)] self-start sm:self-auto">
                    {(['all', '4k', '1080p', '720p'] as const).map(q => (
                      <button
                        key={q}
                        onClick={() => setStreamQualityFilter(q)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg uppercase transition-all ${
                          streamQualityFilter === q
                            ? 'bg-[rgb(var(--primary-color))] text-white shadow'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Season/Episode selector if TV */}
                {type === MediaType.TV && (
                  <div className="flex flex-wrap items-center gap-3 py-3 border-b border-[var(--border-color)] text-xs font-medium text-[var(--text-muted)]">
                    <span>Filtering streams for:</span>
                    <span className="font-bold text-[var(--text-main)] bg-[var(--bg-input)] px-2.5 py-1 rounded-lg border border-[var(--border-color)]">
                      Season {selectedSeason} · Episode {selectedEpisode}
                    </span>
                    <button
                      onClick={() => setActiveTab('episodes')}
                      className="text-[rgb(var(--primary-color))] hover:underline font-semibold"
                    >
                      Change Episode
                    </button>
                  </div>
                )}

                {/* Stream List */}
                <div className="pt-3">
                  <StreamList 
                    streams={filteredStreams} 
                    loading={loadingStreams} 
                    onPlay={handleStreamPlay} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TRAILERS & VIDEOS GALLERY */}
          {activeTab === 'videos' && (
            <div className="space-y-6 animate-fade-in">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setVideoFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    videoFilter === 'all'
                      ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm'
                      : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  All Videos ({sortedVideos.length})
                </button>
                {officialTrailers.length > 0 && (
                  <button
                    onClick={() => setVideoFilter('trailers')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      videoFilter === 'trailers'
                        ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm'
                        : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Trailers & Teasers ({officialTrailers.length})
                  </button>
                )}
                {otherClips.length > 0 && (
                  <button
                    onClick={() => setVideoFilter('clips')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      videoFilter === 'clips'
                        ? 'bg-[rgb(var(--primary-color))] text-white shadow-sm'
                        : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Clips & Featurettes ({otherClips.length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(videoFilter === 'trailers' ? officialTrailers : videoFilter === 'clips' ? otherClips : sortedVideos).map(video => (
                  <div
                    key={video.id}
                    onClick={() => {
                      setSelectedTrailer(video);
                      setShowTrailerModal(true);
                    }}
                    className="group bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:border-[rgb(var(--primary-color))] transition-all"
                  >
                    <div className="relative aspect-video bg-black/60 overflow-hidden">
                      <img 
                        src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`} 
                        alt={video.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-2 left-2 bg-black/80 text-[10px] text-white px-2 py-0.5 rounded font-semibold uppercase">
                        {video.type}
                      </span>
                    </div>
                    <div className="p-4">
                      <h4 className="text-sm font-bold text-[var(--text-main)] truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">
                        {video.name}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
                        <Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: WALLPAPERS & LOGOS GALLERY */}
          {activeTab === 'photos' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header and Filter Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-card)] p-4 sm:p-5 rounded-2xl border border-[var(--border-color)]">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                    <Image className="w-5 h-5 text-purple-400" />
                    <span>Official Wallpapers, Logos & Artwork</span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Click any picture to open and inspect in full uncompressed resolution (loads full 4K UHD, 8K Ultra, and master PNG files).
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
                  <button
                    onClick={() => setGalleryFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      galleryFilter === 'all'
                        ? 'bg-[rgb(var(--primary-color))] text-white shadow'
                        : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    All ({allGalleryAssets.length})
                  </button>
                  {wallpapersList.length > 0 && (
                    <button
                      onClick={() => setGalleryFilter('wallpapers')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        galleryFilter === 'wallpapers'
                          ? 'bg-[rgb(var(--primary-color))] text-white shadow'
                          : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      <span>Wallpapers</span>
                      <span className="opacity-75">({wallpapersList.length})</span>
                    </button>
                  )}
                  {logosList.length > 0 && (
                    <button
                      onClick={() => setGalleryFilter('logos')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        galleryFilter === 'logos'
                          ? 'bg-[rgb(var(--primary-color))] text-white shadow'
                          : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      <span>Logos</span>
                      <span className="opacity-75">({logosList.length})</span>
                    </button>
                  )}
                  {postersList.length > 0 && (
                    <button
                      onClick={() => setGalleryFilter('posters')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        galleryFilter === 'posters'
                          ? 'bg-[rgb(var(--primary-color))] text-white shadow'
                          : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      <span>Posters</span>
                      <span className="opacity-75">({postersList.length})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Assets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredGalleryAssets.map((asset, idx) => {
                  const isLogo = asset.type === 'logo';
                  const isPoster = asset.type === 'poster';

                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAssetIndex(idx)}
                      className={`relative rounded-2xl overflow-hidden border border-[var(--border-color)] cursor-pointer group shadow-md hover:shadow-2xl hover:border-[rgb(var(--primary-color))] transition-all ${
                        isPoster ? 'aspect-[2/3]' : 'aspect-video'
                      } ${isLogo ? 'bg-[#121318] p-5 flex items-center justify-center' : 'bg-[var(--bg-card)]'}`}
                    >
                      <img 
                        src={`${isLogo ? TMDB_IMAGE_BASE : TMDB_BACKDROP_W780}${asset.file_path}`} 
                        alt={asset.title} 
                        loading="lazy"
                        className={`transition-transform duration-500 group-hover:scale-105 ${
                          isLogo ? 'max-h-[85%] max-w-[85%] object-contain filter drop-shadow-md' : 'w-full h-full object-cover'
                        }`} 
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-10">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md backdrop-blur-md uppercase tracking-wider ${
                          asset.width >= 3840 
                            ? 'bg-amber-400 text-black font-black' 
                            : isLogo 
                              ? 'bg-purple-600/90 text-white' 
                              : 'bg-black/75 text-white/90 border border-white/10'
                        }`}>
                          {asset.badge}
                        </span>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-black/75 text-white/90 border border-white/10 backdrop-blur-md">
                          {asset.resolutionText}
                        </span>
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-4 text-center z-20">
                        <span className="text-xs font-bold text-white bg-black/85 px-3.5 py-1.5 rounded-xl border border-white/20 shadow-lg flex items-center gap-1.5">
                          <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>View Full 4K/8K Quality</span>
                        </span>
                        <span className="text-[11px] text-white/80 font-mono">
                          {asset.resolutionText} px
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* FRANCHISE & UNIVERSE COLLECTION (If movie belongs to one) */}
        {collection && collection.parts && collection.parts.length > 0 && (
          <div className="mt-14 pt-10 border-t border-[var(--border-color)]">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 mb-8 p-6 sm:p-8 bg-gradient-to-r from-black/80 to-[var(--bg-card)]">
              {collection.backdrop_path && (
                <img 
                  src={`${TMDB_IMAGE_BASE}${collection.backdrop_path}`} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" 
                />
              )}
              <div className="relative z-10 max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[rgb(var(--primary-color))] mb-2">
                  <Layers className="w-4 h-4" /> 
                  <span>Franchise Universe</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">
                  {collection.name}
                </h3>
                {collection.overview && (
                  <p className="text-sm text-white/70 line-clamp-2 mb-4 leading-relaxed">
                    {collection.overview}
                  </p>
                )}
              </div>
            </div>

            <div className="flex overflow-x-auto space-x-4 pb-4 custom-scrollbar">
              {collection.parts.map(part => (
                <MediaCard 
                  key={part.id} 
                  item={{ ...part, media_type: MediaType.MOVIE }} 
                  onClick={() => navigate(`/movie/${part.id}`)} 
                />
              ))}
            </div>
          </div>
        )}

        {/* RECOMMENDATIONS & SIMILAR MEDIA SECTION */}
        {((recommendations && recommendations.length > 0) || (similarMedia && similarMedia.length > 0)) && (
          <div className="mt-14 pt-10 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-[var(--text-main)] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[rgb(var(--primary-color))]" /> 
                Recommended For You
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {(recommendations && recommendations.length > 0 ? recommendations : similarMedia || []).slice(0, 10).map(rec => (
                <MediaCard 
                  key={rec.id} 
                  item={rec} 
                  onClick={() => navigate(rec.media_type === MediaType.MOVIE ? `/movie/${rec.id}` : `/tv/${rec.id}`)} 
                />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* FULL QUALITY 4K / 8K LIGHTBOX FOR WALLPAPERS & LOGOS */}
      {selectedAssetIndex !== null && filteredGalleryAssets[selectedAssetIndex] && (() => {
        const currentAsset = filteredGalleryAssets[selectedAssetIndex];
        const isLogo = currentAsset.type === 'logo';
        const originalUrl = `${TMDB_IMAGE_ORIGINAL}${currentAsset.file_path}`;
        const previewUrl = `${TMDB_BACKDROP_W1280}${currentAsset.file_path}`;

        return (
          <div 
            className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-xl p-3 sm:p-6 animate-in fade-in"
            onClick={() => setSelectedAssetIndex(null)}
          >
            {/* Top Toolbar */}
            <div 
              className="w-full max-w-7xl flex items-center justify-between gap-3 text-white z-20 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Asset Info & Resolution Badge */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`text-xs font-black px-2.5 py-1 rounded-lg shadow uppercase tracking-wider ${
                  currentAsset.width >= 7680
                    ? 'bg-emerald-500 text-black'
                    : currentAsset.width >= 3840
                      ? 'bg-amber-400 text-black'
                      : isLogo
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/20 text-white'
                }`}>
                  {currentAsset.badge}
                </span>

                <div className="min-w-0 hidden sm:block">
                  <p className="text-xs font-bold text-white truncate">{currentAsset.title}</p>
                  <p className="text-[11px] text-white/60 font-mono">
                    Full Resolution: <span className="text-emerald-400 font-bold">{currentAsset.resolutionText}</span> px
                  </p>
                </div>

                <span className="text-xs font-mono bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 text-white/80">
                  {selectedAssetIndex + 1} / {filteredGalleryAssets.length}
                </span>
              </div>

              {/* Controls: Download, New Tab, Close */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="bg-[rgb(var(--primary-color))] hover:brightness-110 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-[rgb(var(--primary-color))]/25 transition-all"
                  title="Download full quality original file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Download</span>
                  <span className="hidden lg:inline text-[10px] opacity-80 font-mono">({currentAsset.width}×{currentAsset.height})</span>
                </a>

                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/10 hover:bg-white/20 text-white p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-white/15 transition-all"
                  title="Open raw full resolution in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open Raw</span>
                </a>

                <button 
                  onClick={() => setSelectedAssetIndex(null)} 
                  className="text-white/80 hover:text-white bg-white/10 hover:bg-red-600/80 p-2 rounded-xl border border-white/15 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Central Media Canvas with Prev / Next */}
            <div 
              className="relative w-full max-w-7xl flex-1 flex items-center justify-center my-2 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {filteredGalleryAssets.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAssetIndex(prev => prev !== null && prev > 0 ? prev - 1 : filteredGalleryAssets.length - 1);
                    }}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 sm:p-3.5 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/20 transition-all z-30 cursor-pointer shadow-2xl hover:scale-105"
                    title="Previous (Left Arrow)"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAssetIndex(prev => prev !== null && prev < filteredGalleryAssets.length - 1 ? prev + 1 : 0);
                    }}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 sm:p-3.5 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/20 transition-all z-30 cursor-pointer shadow-2xl hover:scale-105"
                    title="Next (Right Arrow)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Full Resolution Image Container */}
              <div className={`relative max-h-[82vh] max-w-[95vw] rounded-2xl overflow-hidden flex items-center justify-center ${
                isLogo ? 'bg-[#121318]/90 p-8 border border-white/15 shadow-2xl' : 'shadow-2xl'
              }`}>
                {/* Instant blur preview while raw 4K/8K loads */}
                {!isFullResLoaded && (
                  <img 
                    src={previewUrl} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-contain filter blur-sm scale-100 opacity-60" 
                  />
                )}

                {/* Loading Banner for 4K / 8K */}
                {!isFullResLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10 pointer-events-none">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-white bg-black/85 px-4 py-2 rounded-xl border border-white/20 shadow-2xl">
                      <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                      <span>Loading Full Quality ({currentAsset.resolutionText})...</span>
                    </div>
                  </div>
                )}

                {/* Full Uncompressed Original Image */}
                <img 
                  src={originalUrl} 
                  alt={currentAsset.title} 
                  onLoad={() => setIsFullResLoaded(true)}
                  className={`max-h-[80vh] max-w-[92vw] object-contain transition-opacity duration-300 relative z-10 ${
                    isFullResLoaded ? 'opacity-100' : 'opacity-0'
                  }`} 
                />
              </div>
            </div>

            {/* Bottom Status Bar */}
            <div 
              className="text-center text-xs text-white/60 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-white/80 font-medium">Rendered at 100% Uncompressed Full Quality</span>
              <span className="mx-2">·</span>
              <span className="text-emerald-400 font-mono font-semibold">{currentAsset.resolutionText} px</span>
              <span className="mx-2">·</span>
              <span>Use Left/Right arrow keys to navigate, Esc to close</span>
            </div>
          </div>
        );
      })()}

      {/* TRAILER MODAL DIALOG */}
      {showTrailerModal && selectedTrailer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => {
            setShowTrailerModal(false);
            setSelectedTrailer(null);
          }}
        >
          <div 
            className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => {
                setShowTrailerModal(false);
                setSelectedTrailer(null);
              }} 
              className="absolute top-4 right-4 z-10 bg-black/60 hover:bg-red-600 text-white p-2 rounded-xl transition-colors shadow-lg"
              title="Close trailer"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe 
              src={`https://www.youtube.com/embed/${selectedTrailer.key}?autoplay=1&rel=0`} 
              className="w-full h-full" 
              frameBorder="0" 
              allow="autoplay; encrypted-media; fullscreen" 
              allowFullScreen
              title={selectedTrailer.name}
            />
          </div>
        </div>
      )}

    </div>
  );
};
