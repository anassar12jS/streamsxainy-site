import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SportsMatch, SportsMatchSource, SportsStream, SportsChannel247, LiveMatchScoreboard } from '../types';
import { getMatchStreams, getAllMatches, getLiveScoreboard } from '../services/sports';
import {
  ArrowLeft, RotateCw, ExternalLink, Expand,
  AlertCircle, Loader2, Radio, Zap, Globe, Calendar, Clock,
  Trophy, Heart, Check, Play, Info, Sparkles, Volume2,
  Activity, Languages, BarChart2, ChevronDown, ChevronUp, Tv, Flame
} from 'lucide-react';
import {
  addFavoriteSportsMatch,
  removeFavoriteSportsMatch,
  getFavoriteSportsMatches
} from '../services/storage';
import { REGIONS, RegionOption } from '../constants/regions';

const getSportIcon = (cat?: string) => {
  const c = (cat || '').toLowerCase();
  if (c.includes('foot') || c.includes('soccer')) return '⚽';
  if (c.includes('basket') || c.includes('nba')) return '🏀';
  if (c.includes('fight') || c.includes('ufc') || c.includes('mma') || c.includes('box')) return '🥊';
  if (c.includes('motor') || c.includes('f1') || c.includes('race')) return '🏎️';
  if (c.includes('american') || c.includes('nfl')) return '🏈';
  if (c.includes('base') || c.includes('mlb')) return '⚾';
  if (c.includes('hock') || c.includes('nhl')) return '🏒';
  if (c.includes('tenn')) return '🎾';
  if (c.includes('cric')) return '🏏';
  return '🏆';
};

const getScheduleTimezone = (region: RegionOption): string =>
  region.scheduleTz || region.tz;

const getTimezoneOffset = (dateNum: number, timeZone: string): string => {
  try {
    const offset = new Intl.DateTimeFormat('en', {
      timeZone,
      timeZoneName: 'shortOffset'
    } as unknown as Intl.DateTimeFormatOptions)
      .formatToParts(new Date(dateNum))
      .find(part => part.type === 'timeZoneName')?.value;
    return offset || 'GMT';
  } catch {
    return 'GMT';
  }
};

export const SportsPlayer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const rawMatch = location.state?.match as SportsMatch | undefined;
  const channel = location.state?.channel as SportsChannel247 | undefined;

  const match: SportsMatch | undefined = useMemo(() => {
    if (rawMatch) return rawMatch;
    if (channel) {
      return {
        id: channel.id,
        title: `${channel.name}`,
        category: channel.category.toLowerCase(),
        date: Date.now() - 30 * 60 * 1000,
        popular: true,
        sources: [
          { source: 'streamfree', id: channel.daddyliveId }
        ]
      };
    }
    return undefined;
  }, [rawMatch, channel]);

  const playerRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Expanded provider/source key
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>('');
  
  // Cache for fetched streams: { "sourceKey": [streams] }
  const [streamsCache, setStreamsCache] = useState<Record<string, SportsStream[]>>({});
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null);
  
  // Active playing stream
  const [activeStream, setActiveStream] = useState<SportsStream | null>(null);
  const [streamError, setStreamError] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState(0);

  // Favorites
  const [isFav, setIsFav] = useState(false);

  // Time / Live calculation
  const [isUpcoming, setIsUpcoming] = useState(false);
  const [timeToStart, setTimeToStart] = useState<string>('');

  // Live Scoreboard & Commentary Switcher States
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<string>('all');
  const [showEventsTimeline, setShowEventsTimeline] = useState<boolean>(false);

  const [selectedRegionId, setSelectedRegionId] = useState<string>(() => {
    return localStorage.getItem('streamhub_sports_region_id') || 'morocco';
  });

  useEffect(() => {
    const handleRegionEvent = (e: any) => {
      const regId = e?.detail || localStorage.getItem('streamhub_sports_region_id') || 'morocco';
      setSelectedRegionId(regId);
    };
    window.addEventListener('streamhub_region_changed', handleRegionEvent);
    window.addEventListener('storage', handleRegionEvent);
    return () => {
      window.removeEventListener('streamhub_region_changed', handleRegionEvent);
      window.removeEventListener('storage', handleRegionEvent);
    };
  }, []);

  const selectedRegion = useMemo<RegionOption>(() => {
    return REGIONS.find(r => r.id === selectedRegionId) || REGIONS[0];
  }, [selectedRegionId]);

  const regionTimeStr = useMemo(() => {
    if (!match?.date) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: getScheduleTimezone(selectedRegion),
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(match.date));
  }, [match?.date, selectedRegion]);

  const regionDateStr = useMemo(() => {
    if (!match?.date) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: getScheduleTimezone(selectedRegion),
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }).format(new Date(match.date));
  }, [match?.date, selectedRegion]);

  // Fetch all matches for the "Other Live Matches" row
  const { data: allMatches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: getAllMatches,
    staleTime: 1000 * 60,
  });

  // Calculate live matches excluding this one
  const otherLiveMatches = useMemo(() => {
    if (!match) return [];
    const now = Date.now();
    return allMatches.filter(m => {
      if (m.id === match.id || m.title === match.title) return false;
      const diff = m.date - now;
      return diff < 15 * 60 * 1000 && diff > -4 * 60 * 60 * 1000;
    }).slice(0, 6);
  }, [allMatches, match]);

  useEffect(() => {
    if (!match) {
      navigate('/sports', { replace: true });
      return;
    }

    // Check favorite status
    const favs = getFavoriteSportsMatches();
    setIsFav(favs.includes(match.id));

    // Check upcoming status
    const diff = match.date - Date.now();
    if (diff > 15 * 60 * 1000) {
      setIsUpcoming(true);
      const updateTimer = () => {
        const d = match.date - Date.now();
        if (d <= 0) {
          setIsUpcoming(false);
          return;
        }
        const hrs = Math.floor(d / (1000 * 60 * 60));
        const mins = Math.floor((d % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((d % (1000 * 60)) / 1000);
        if (hrs >= 24) {
          const days = Math.floor(hrs / 24);
          setTimeToStart(`${days}d ${hrs % 24}h`);
        } else {
          setTimeToStart(`${hrs}h ${mins}m ${secs}s`);
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setIsUpcoming(false);
    }

    // Auto-select and fetch first source if available
    if (match.sources && match.sources.length > 0) {
      const firstSource = match.sources[0];
      loadSource(firstSource);
    }
  }, [match, navigate]);

  const loadSource = async (source: SportsMatchSource) => {
    const key = `${source.source}-${source.id}`;
    setSelectedSourceKey(key);

    if (streamsCache[key] && streamsCache[key].length > 0) {
      if (!activeStream) {
        setActiveStream(streamsCache[key][0]);
      }
      return;
    }

    setLoadingSourceId(key);
    try {
      const streams = await getMatchStreams(source.source, source.id);
      setStreamsCache(prev => ({ ...prev, [key]: streams }));
      if (streams.length > 0) {
        // Auto-play HD / best stream
        const best = streams.find(s => s.hd && s.language.toLowerCase().includes('english')) 
          || streams.find(s => s.hd) 
          || streams[0];
        setActiveStream(best);
        setStreamError(false);
      }
    } catch (e) {
      console.error("Failed to load stream:", e);
      setStreamError(true);
    } finally {
      setLoadingSourceId(null);
    }
  };

  const handleSelectStream = (stream: SportsStream) => {
    setActiveStream(stream);
    setStreamError(false);
  };

  const toggleFavorite = () => {
    if (!match) return;
    if (isFav) {
      removeFavoriteSportsMatch(match.id);
      setIsFav(false);
    } else {
      addFavoriteSportsMatch(match.id);
      setIsFav(true);
    }
  };

  const reloadPlayer = () => {
    setRetryKey(k => k + 1);
    setStreamError(false);
  };

  const openFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  // Scoreboard calculation for live matches
  const scoreboard = useMemo<LiveMatchScoreboard | null>(() => {
    if (!match || isUpcoming || Boolean(channel)) return null;
    return getLiveScoreboard(match);
  }, [match, isUpcoming, channel]);

  // Current stream mirrors for the selected provider
  const currentStreams = useMemo(() => {
    return (selectedSourceKey && streamsCache[selectedSourceKey]) ? streamsCache[selectedSourceKey] : [];
  }, [selectedSourceKey, streamsCache]);

  const availableAudioLanguages = useMemo(() => {
    const langs = new Set<string>();
    currentStreams.forEach(s => {
      const l = s.language.toLowerCase();
      if (l.includes('english')) langs.add('English');
      else if (l.includes('spanish')) langs.add('Spanish');
      else if (l.includes('arabic')) langs.add('Arabic');
      else if (l.includes('french')) langs.add('French');
      else if (l.includes('streamfree') || l.includes('fast')) langs.add('Fast ⚡');
    });
    return Array.from(langs);
  }, [currentStreams]);

  const handleQuickAudioSwitch = (lang: string) => {
    setSelectedLanguageFilter(lang);
    if (lang === 'all') return;
    const clean = lang.toLowerCase().replace(' ⚡', '');
    const target = currentStreams.find(s => s.language.toLowerCase().includes(clean)) ||
                   currentStreams.find(s => s.source.toLowerCase().includes(clean));
    if (target) {
      setActiveStream(target);
      setStreamError(false);
    }
  };

  const filteredMirrors = useMemo(() => {
    if (selectedLanguageFilter === 'all') return currentStreams;
    const clean = selectedLanguageFilter.toLowerCase().replace(' ⚡', '');
    return currentStreams.filter(s => 
      s.language.toLowerCase().includes(clean) ||
      s.source.toLowerCase().includes(clean)
    );
  }, [currentStreams, selectedLanguageFilter]);

  if (!match) return null;

  const sportIcon = getSportIcon(match.category);
  const hasTeams = match.teams?.home && match.teams?.away;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col transition-colors duration-300">
      
      {/* Top Navigation & Toolbar (Matching VidyPlayer) */}
      <header className="sticky top-0 z-40 bg-[var(--bg-main)]/90 backdrop-blur-xl border-b border-[var(--border-subtle)] px-4 py-3 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          
          {/* Back & Match Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/sports')}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-subtle)]"
              aria-label="Back to Sports"
              title="Back to Sports"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">{sportIcon}</span>
                <h1 className="text-sm sm:text-base font-black truncate text-[var(--text-main)] tracking-tight">
                  {match.title}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
                <span className="text-[rgb(var(--primary-color))] font-bold uppercase tracking-wider text-[10px]">
                  {match.category}
                </span>
                <span>•</span>
                {regionTimeStr && (
                  <>
                    <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      {selectedRegion.flag} {regionTimeStr} ({getTimezoneOffset(match.date, getScheduleTimezone(selectedRegion))}) · {regionDateStr}
                    </span>
                    <span>•</span>
                  </>
                )}
                {isUpcoming ? (
                  <span className="flex items-center gap-1 text-amber-400 font-bold text-[10px]">
                    <Clock className="w-3 h-3" /> UPCOMING ({timeToStart})
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500 font-bold text-[10px] animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> LIVE NOW
                  </span>
                )}
                {activeStream && (
                  <>
                    <span>•</span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {activeStream.source} · Stream {activeStream.streamNo}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Open in New Tab - High Visibility */}
            {activeStream?.embedUrl && (
              <a
                href={activeStream.embedUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[rgb(var(--primary-color))]/15 text-[rgb(var(--primary-color))] border border-[rgb(var(--primary-color))]/30 hover:bg-[rgb(var(--primary-color))] hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
                title="Open stream in external window / direct player"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open in New Tab ↗</span>
              </a>
            )}

            {/* Favorite Button */}
            <button
              type="button"
              onClick={toggleFavorite}
              className={`p-2 rounded-xl border transition-colors ${
                isFav 
                  ? 'bg-red-500/10 border-red-500/30 text-red-500' 
                  : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-hover)]'
              }`}
              title="Add to Favorites"
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            </button>

            {/* Reload Stream */}
            <button
              type="button"
              onClick={reloadPlayer}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-subtle)]"
              title="Reload player"
              aria-label="Reload player"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={openFullscreen}
              className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border-subtle)]"
              title="Fullscreen"
            >
              <Expand className="w-4 h-4" />
            </button>

          </div>

        </div>
      </header>

      {/* Main Player Cinema Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 w-full flex flex-col gap-6">
        
        {/* Stage / Video Viewport */}
        <div 
          ref={containerRef}
          className="relative w-full rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-black shadow-2xl group/player aspect-video max-h-[78vh]"
        >
          {/* Ambient Cinema Backdrop Glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none z-10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[rgb(var(--primary-color))]/10 rounded-full blur-[120px] pointer-events-none" />

          {/* Upcoming State Card */}
          {isUpcoming ? (
            <div className="relative z-20 w-full h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-black">
              <div className="p-3 bg-amber-500/15 rounded-2xl border border-amber-500/30 text-amber-400 mb-4 animate-bounce">
                <Clock className="w-8 h-8" />
              </div>
              <span className="text-xs uppercase font-black tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mb-3">
                Pre-Match Countdown
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white max-w-xl leading-tight mb-2 drop-shadow-lg">
                {match.title}
              </h2>
              <div className="text-3xl sm:text-5xl font-mono font-black text-[rgb(var(--primary-color))] my-3 tracking-wider drop-shadow-md">
                {timeToStart}
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md leading-relaxed mt-1">
                Live streaming nodes connect approximately 15 minutes before official kickoff. You can test available mirrors below.
              </p>
              
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsUpcoming(false)}
                  className="px-6 py-2.5 rounded-xl bg-[rgb(var(--primary-color))] text-white font-bold text-xs hover:scale-105 transition-transform shadow-lg shadow-[rgb(var(--primary-color))]/30 flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Try Live Feeds Now
                </button>
              </div>
            </div>
          ) : activeStream ? (
            <div className="relative w-full h-full">
              <iframe
                key={`${activeStream.embedUrl}-${retryKey}`}
                ref={playerRef}
                src={activeStream.embedUrl}
                className="w-full h-full absolute inset-0 z-10 bg-black"
                frameBorder="0"
                allowFullScreen
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture *; clipboard-write; web-share"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="relative z-20 w-full h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-950">
              {loadingSourceId ? (
                <>
                  <Loader2 className="w-10 h-10 text-[rgb(var(--primary-color))] animate-spin mb-3" />
                  <p className="text-xs font-mono text-[var(--text-muted)] tracking-widest uppercase">
                    Locking On To Satellite Feed...
                  </p>
                </>
              ) : (
                <>
                  <Radio className="w-12 h-12 text-[var(--text-muted)] opacity-30 mb-3" />
                  <p className="text-sm font-bold text-white">Select a Stream Server</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Pick a broadcast provider from the list below to start streaming.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Player Stream Status & Direct Popout Helper */}
        {activeStream && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Playing via <strong className="text-[var(--text-main)]">{activeStream.source}</strong> ({activeStream.language})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] hidden md:inline">
                If the stream shows audio only or player is blocked by browser:
              </span>
              <a
                href={activeStream.embedUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-lg bg-[rgb(var(--primary-color))]/15 hover:bg-[rgb(var(--primary-color))] text-[rgb(var(--primary-color))] hover:text-white font-bold text-[11px] transition-colors flex items-center gap-1.5"
              >
                <span>Direct Popout Player</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Live Scoreboard & Match Stats Ticker (Football / Sports) */}
        {scoreboard && (
          <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-32 bg-[rgb(var(--primary-color))]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Live Ticker Top Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-red-400 font-mono">
                  LIVE SCOREBOARD
                </span>
                <span className="text-xs text-[var(--text-muted)]">•</span>
                <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-md font-mono">
                  {scoreboard.period} · {scoreboard.minute}'
                </span>
              </div>

              {scoreboard.events && scoreboard.events.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEventsTimeline(prev => !prev)}
                  className="text-xs font-bold text-[rgb(var(--primary-color))] hover:underline flex items-center gap-1"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{showEventsTimeline ? 'Hide Events' : 'Match Events Timeline'}</span>
                  {showEventsTimeline ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {/* Scoreboard Center Fixture */}
            <div className="flex items-center justify-between gap-4 max-w-2xl mx-auto py-2">
              <div className="flex items-center gap-3 flex-1 justify-end text-right">
                <span className="font-black text-sm sm:text-base text-white truncate max-w-[150px] sm:max-w-[200px]">
                  {match.teams?.home?.name || 'Home'}
                </span>
                {match.teams?.home?.logo && (
                  <img 
                    src={match.teams.home.logo} 
                    alt="" 
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0" 
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>

              {match.score ? (
                <div className="px-5 py-1.5 rounded-2xl bg-black/60 border border-white/15 flex items-center gap-3 shadow-inner">
                  <span className="text-2xl sm:text-4xl font-mono font-black text-white">
                    {scoreboard.homeScore}
                  </span>
                  <span className="text-sm font-bold text-zinc-500">:</span>
                  <span className="text-2xl sm:text-4xl font-mono font-black text-white">
                    {scoreboard.awayScore}
                  </span>
                </div>
              ) : (
                <div className="px-4 py-1.5 rounded-2xl bg-black/60 border border-white/10 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-red-400 font-mono">
                    LIVE
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 flex-1 justify-start text-left">
                {match.teams?.away?.logo && (
                  <img 
                    src={match.teams.away.logo} 
                    alt="" 
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0" 
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <span className="font-black text-sm sm:text-base text-white truncate max-w-[150px] sm:max-w-[200px]">
                  {match.teams?.away?.name || 'Away'}
                </span>
              </div>
            </div>

            {/* Live Possession Bar */}
            {scoreboard.possession && (
              <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5 max-w-xl mx-auto">
                <div className="flex justify-between text-[11px] font-bold text-[var(--text-muted)] font-mono">
                  <span>Possession: {scoreboard.possession.home}%</span>
                  <span>{scoreboard.possession.away}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-[rgb(var(--primary-color))]" 
                    style={{ width: `${scoreboard.possession.home}%` }} 
                  />
                  <div 
                    className="h-full bg-cyan-400" 
                    style={{ width: `${scoreboard.possession.away}%` }} 
                  />
                </div>
              </div>
            )}

            {/* Collapsible Match Events Timeline */}
            {showEventsTimeline && scoreboard.events && scoreboard.events.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-2 animate-in fade-in max-w-lg mx-auto">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] font-black block text-center mb-2">
                  Match Timeline & Key Incidents
                </span>
                {scoreboard.events.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="font-mono font-bold text-amber-400 w-8">{ev.minute}'</span>
                    <span className="font-medium text-white flex-1 text-center">
                      {ev.type === 'goal' ? '⚽ Goal! ' : ev.type === 'yellow_card' ? '🟨 Card: ' : 'Inc: '}
                      {ev.player} {ev.description ? `(${ev.description})` : ''}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] w-16 text-right truncate">
                      {ev.team === 'home' ? match.teams?.home?.name || 'Home' : match.teams?.away?.name || 'Away'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Server & Stream Switcher Window (Matching VidyPlayer Provider Bar) */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
            
            {/* Server Provider Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1 shrink-0 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-[rgb(var(--primary-color))]" /> Providers:
              </span>
              
              {match.sources.map((source, idx) => {
                const key = `${source.source}-${source.id}`;
                const isSelected = selectedSourceKey === key;
                const isStreamFree = source.source.toLowerCase() === 'streamfree';
                const isPpv = source.source.toLowerCase() === 'ppv';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => loadSource(source)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[rgb(var(--primary-color))] text-white border-[rgb(var(--primary-color))] shadow-md shadow-[rgb(var(--primary-color))]/20'
                        : 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <span>
                      {isStreamFree 
                        ? `⚡ Server ${idx + 1} (StreamFree FHD · strmfree.st)` 
                        : isPpv 
                          ? `💎 Server ${idx + 1} (PPV.st Broadcast)` 
                          : `Server ${idx + 1} (${source.source.toUpperCase()})`}
                    </span>
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>

            {/* Stream Protection Tip */}
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Info className="w-3.5 h-3.5 text-[rgb(var(--primary-color))] shrink-0" />
              <span className="text-[11px]">
                Ad-blocking shield active. If black screen occurs, click "Open in New Tab".
              </span>
            </div>

          </div>

          {/* Instant Audio / Commentary Switcher Pills */}
          {availableAudioLanguages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0 flex items-center gap-1 mr-1">
                <Languages className="w-3.5 h-3.5 text-pink-400" /> Audio:
              </span>
              <button
                type="button"
                onClick={() => handleQuickAudioSwitch('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  selectedLanguageFilter === 'all'
                    ? 'bg-white/20 text-white font-bold'
                    : 'text-[var(--text-muted)] hover:text-white bg-black/30'
                }`}
              >
                All Audio ({currentStreams.length})
              </button>
              {availableAudioLanguages.map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleQuickAudioSwitch(lang)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-1 ${
                    selectedLanguageFilter.toLowerCase().includes(lang.toLowerCase().replace(' ⚡', ''))
                      ? 'bg-[rgb(var(--primary-color))] text-white font-bold shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-white bg-black/30 hover:bg-black/50'
                  }`}
                >
                  {lang.toLowerCase().includes('english') && '🇬🇧 '}
                  {lang.toLowerCase().includes('spanish') && '🇪🇸 '}
                  {lang.toLowerCase().includes('arabic') && '🇸🇦 '}
                  {lang.toLowerCase().includes('french') && '🇫🇷 '}
                  {lang.toLowerCase().includes('fast') && '⚡ '}
                  <span>{lang}</span>
                </button>
              ))}
            </div>
          )}

          {/* Sub-streams Row (e.g. Stream 1 HD, Stream 2...) */}
          {filteredMirrors.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-muted)] mr-1">
                Available Mirrors:
              </span>
              {filteredMirrors.map(stream => {
                const isPlaying = activeStream?.id === stream.id;
                return (
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() => handleSelectStream(stream)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                      isPlaying
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm'
                        : 'bg-[var(--bg-main)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                    <span>Stream {stream.streamNo}</span>
                    {stream.hd ? (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-[rgb(var(--primary-color))]/20 text-[rgb(var(--primary-color))] font-mono font-black">
                        FHD
                      </span>
                    ) : (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono font-black">
                        FAST ⚡
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--text-muted)] font-normal">
                      ({stream.language})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Matchup Fixture Center Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {hasTeams ? (
              <div className="flex items-center justify-between w-full max-w-2xl mx-auto gap-4">
                {/* Home */}
                <div className="flex flex-col items-center gap-2 flex-1 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-subtle)] p-2.5 flex items-center justify-center shadow-md">
                    {match.teams?.home?.logo ? (
                      <img 
                        src={match.teams.home.logo} 
                        alt={match.teams.home.name} 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <Trophy className="w-8 h-8 text-[rgb(var(--primary-color))]" />
                    )}
                  </div>
                  <span className="font-black text-sm sm:text-base text-[var(--text-main)] line-clamp-1">
                    {match.teams?.home?.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Home</span>
                </div>

                {/* Center Score / VS */}
                <div className="flex flex-col items-center px-4">
                  <span className="text-xl sm:text-3xl font-black text-[var(--text-muted)] italic">
                    VS
                  </span>
                  <span className="text-[10px] font-mono text-[rgb(var(--primary-color))] mt-1 font-bold">
                    {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Away */}
                <div className="flex flex-col items-center gap-2 flex-1 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-subtle)] p-2.5 flex items-center justify-center shadow-md">
                    {match.teams?.away?.logo ? (
                      <img 
                        src={match.teams.away.logo} 
                        alt={match.teams.away.name} 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <Trophy className="w-8 h-8 text-pink-500" />
                    )}
                  </div>
                  <span className="font-black text-sm sm:text-base text-[var(--text-main)] line-clamp-1">
                    {match.teams?.away?.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Away</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-subtle)]">
                  <Trophy className="w-8 h-8 text-[rgb(var(--primary-color))]" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[var(--text-main)]">
                    {match.title}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] capitalize mt-1">
                    {match.category} Championship Event
                  </p>
                </div>
              </div>
            )}

            {/* Date / Time Card */}
            <div className="shrink-0 flex flex-col items-end text-xs text-[var(--text-muted)] border-t md:border-t-0 md:border-l border-[var(--border-subtle)] pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
              <div className="flex items-center gap-1.5 font-bold text-[var(--text-main)]">
                <Calendar className="w-3.5 h-3.5 text-[rgb(var(--primary-color))]" />
                <span>{regionDateStr || new Date(match.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-[var(--text-main)]">
                  {selectedRegion.flag} {regionTimeStr || new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({getTimezoneOffset(match.date, getScheduleTimezone(selectedRegion))})
                </span>
              </div>
              <span className="mt-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-subtle)]">
                {match.category}
              </span>
            </div>

          </div>
        </div>

        {/* Other Live Matches Happening Right Now */}
        {otherLiveMatches.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Other Live Matches Right Now
              </h3>
              <button
                onClick={() => navigate('/sports')}
                className="text-xs text-[rgb(var(--primary-color))] hover:underline font-semibold"
              >
                View All Fixtures →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {otherLiveMatches.map(m => (
                <div
                  key={m.id}
                  onClick={() => {
                    navigate('/sports/watch', { state: { match: m } });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/50 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-sm hover:shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-[rgb(var(--primary-color))] uppercase font-bold tracking-wider">
                      {m.category}
                    </span>
                    <p className="text-xs font-bold text-[var(--text-main)] truncate group-hover:text-[rgb(var(--primary-color))] transition-colors mt-0.5">
                      {m.title}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-[rgb(var(--primary-color))]/10 text-[rgb(var(--primary-color))] group-hover:bg-[rgb(var(--primary-color))] group-hover:text-white transition-all shrink-0">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

    </div>
  );
};
