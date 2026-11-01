import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAllMatches, isMatchFinished, normalizeTeamToken } from '../services/sports';
import { SportsMatch, LeagueTopScorer } from '../types';
import {
  Trophy, Calendar, PlayCircle, Clock, Loader2, Search,
  Heart, LayoutGrid, List, Timer, ChevronUp, Radio,
  RotateCw, Play, Flame, X, ChevronDown, Activity, Globe,
  Check, ExternalLink, Sparkles, Tv, Award
} from 'lucide-react';
import {
  addFavoriteSportsMatch,
  removeFavoriteSportsMatch,
  getFavoriteSportsMatches
} from '../services/storage';
import { LEAGUE_TABLES } from '../data/sportsStandings';
import { REGIONS, RegionOption } from '../constants/regions';
import { getLiveLeagueStandings, getLeagueTopScorers } from '../services/footballApi';
import { getTeamLogoUrl, CLUB_BRAND_COLORS } from '../data/clubLogos';

// Team initials / fallback color generator
const generateColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// Normalizes timezones to resolve Moroccan local time (UTC+0 / GMT 0 as set by local decree)
export const normalizeTimezone = (tz?: string): string => {
  if (!tz || tz === 'Africa/Casablanca' || tz === 'Etc/GMT-1' || tz === 'UTC') return 'UTC';
  return tz;
};

export const formatTimeForTz = (dateNum: number, tz: string) => {
  const safeTz = normalizeTimezone(tz);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: safeTz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(dateNum));
  } catch {
    return new Date(dateNum).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

export const formatDateFullForTz = (dateNum: number, tz: string) => {
  const safeTz = normalizeTimezone(tz);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: safeTz,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(dateNum));
  } catch {
    return new Date(dateNum).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }
};

export const getDayLabelForTz = (dateNum: number, tz: string, regionFlag: string) => {
  const safeTz = normalizeTimezone(tz);
  try {
    const matchDate = new Intl.DateTimeFormat('en-CA', { timeZone: safeTz }).format(new Date(dateNum));
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: safeTz }).format(new Date());

    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: safeTz }).format(tomorrowObj);

    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: safeTz }).format(yesterdayObj);

    if (matchDate === today) return `Today · Aujourd’hui (${regionFlag})`;
    if (matchDate === tomorrow) return `Tomorrow · Demain (${regionFlag})`;
    if (matchDate === yesterday) return `Yesterday · Hier (${regionFlag})`;

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: safeTz,
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }).format(new Date(dateNum));
  } catch {
    return new Date(dateNum).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }
};

// Compute approximate match period / minute for live events
const getLiveMatchMinute = (dateNum: number, category?: string) => {
  const diffMinutes = Math.floor((Date.now() - dateNum) / 60000);
  const isFoot = !category || category.toLowerCase().includes('foot');
  
  if (diffMinutes <= 0) return 'Kick-off';
  if (isFoot) {
    if (diffMinutes < 45) return `${diffMinutes}'`;
    if (diffMinutes >= 45 && diffMinutes < 60) return 'HT';
    if (diffMinutes >= 60 && diffMinutes < 105) return `${diffMinutes - 15}'`;
    return '90\'+';
  }
  return `${diffMinutes}' live`;
};

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

const getMatchUniqueId = (match: SportsMatch): string => {
  return match.id || btoa(`${match.title}-${match.date}-${match.category || ''}`).slice(0, 16);
};

// Check if match involves Moroccan clubs or Atlas Lions
const isMoroccanMatch = (m: SportsMatch): boolean => {
  const text = `${m.title} ${m.category} ${m.teams?.home?.name || ''} ${m.teams?.away?.name || ''}`.toLowerCase();
  const moroccanKeywords = [
    'morocco', 'maroc', 'botola', 'raja', 'wydad', 'as far', 'far rabat', 'berkane', 
    'fus rabat', 'mas fes', 'mas fès', 'irt tanger', 'tanger', 'olympic safi', 'ocs safi', 
    'mat tetouan', 'tetouan', 'hassania agadir', 'husa', 'renaissance zemamra', 'chabab mohammedia', 
    'jeunesse soualem', 'touarga', 'uts', 'mco oujda', 'maghreb fez', 'atlas lions', 'mar'
  ];
  return moroccanKeywords.some(k => text.includes(k));
};

// Dynamic Countdown Badge
const MatchCountdown = React.memo(({ date }: { date: number }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = date - Date.now();
      if (diff <= 0) {
        setTimeLeft('Starting Soon');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours >= 48) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d away`);
      } else if (hours >= 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
      } else {
        setTimeLeft(`${hours}h ${mins}m`);
      }
    };

    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [date]);

  if (!timeLeft) return null;

  return (
    <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25 whitespace-nowrap backdrop-blur-sm shadow-sm">
      <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {timeLeft}
    </span>
  );
});

// Team Crest Logo with Multi-Stage Resolution, Image Proxy Failover & Brand Crest Fallback
const TeamLogo: React.FC<{ name: string; logo?: string; className?: string; size?: string }> = React.memo(
  ({ name, logo, className = 'w-10 h-10', size = 'text-xs' }) => {
    // 1. Resolve to guaranteed working logo or proxied URL
    const targetUrl = useMemo(() => getTeamLogoUrl(name, logo), [name, logo]);
    const [currentSrc, setCurrentSrc] = useState(targetUrl);
    const [retriedWithProxy, setRetriedWithProxy] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);

    const brand = useMemo(() => {
      const match = CLUB_BRAND_COLORS[name] || Object.entries(CLUB_BRAND_COLORS).find(([k]) => name.toLowerCase().includes(k.toLowerCase()))?.[1];
      return match || { primary: generateColor(name), secondary: '#111827' };
    }, [name]);

    const initials = useMemo(() => {
      const parts = (name || '').trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
      return parts.map(n => n[0]).slice(0, 3).join('').toUpperCase();
    }, [name]);

    useEffect(() => {
      const resolved = getTeamLogoUrl(name, logo);
      if (resolved) {
        setCurrentSrc(resolved);
        setRetriedWithProxy(false);
        setImgFailed(false);
      } else if (name) {
        // Check dynamic localStorage cache
        const cacheKey = `streamhub_team_logo_${name.toLowerCase().trim()}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setCurrentSrc(cached);
          setImgFailed(false);
        } else {
          // Asynchronously query ESPN official team database
          let active = true;
          fetch(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(name.replace(/[⚽🏎️🥊🏀🏈🎾]/g, '').trim())}&limit=1`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (!active || !data) return;
              const team = data.results?.find((r: any) => r.type === 'team')?.contents?.[0];
              const foundLogo = team?.image?.default || team?.image?.defaultDark;
              if (foundLogo) {
                localStorage.setItem(cacheKey, foundLogo);
                setCurrentSrc(foundLogo);
                setImgFailed(false);
              } else {
                setImgFailed(true);
              }
            })
            .catch(() => {
              if (active) setImgFailed(true);
            });
          return () => { active = false; };
        }
      } else {
        setImgFailed(true);
      }
    }, [name, logo]);

    const handleImgError = () => {
      // If direct image failed and hasn't been proxied yet, retry through wsrv.nl proxy
      if (!retriedWithProxy && currentSrc && !currentSrc.includes('wsrv.nl') && currentSrc.startsWith('http')) {
        setRetriedWithProxy(true);
        setCurrentSrc(`https://wsrv.nl/?url=${encodeURIComponent(currentSrc)}&w=96&output=png`);
      } else {
        setImgFailed(true);
      }
    };

    if (currentSrc && !imgFailed) {
      return (
        <div className={`relative shrink-0 flex items-center justify-center p-1 bg-[var(--bg-main)]/90 rounded-xl border border-[var(--border-subtle)] shadow-sm ${className}`}>
          <img
            src={currentSrc}
            alt={name}
            className="w-full h-full object-contain drop-shadow-md transition-transform hover:scale-110"
            onError={handleImgError}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    // High-impact brand crest fallback
    return (
      <div
        className={`rounded-xl flex flex-col items-center justify-center font-black shrink-0 shadow-md border border-white/20 select-none overflow-hidden relative ${className}`}
        style={{
          background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.secondary} 100%)`,
          color: brand.primary === '#FFFFFF' ? '#0f172a' : '#FFFFFF'
        }}
        title={name}
      >
        <span className={`${size} tracking-tighter drop-shadow-sm`}>{initials || 'FC'}</span>
      </div>
    );
  }
);

// Match Grid Card Window (Unconstrained, fully visible with dedicated Match Center & Watch Live buttons)
const MatchGridCard = React.memo(({ 
  match, 
  isLive, 
  onPlay, 
  onToggleFav, 
  isFav,
  selectedRegion,
  onOpenMatchCenter
}: {
  match: SportsMatch;
  isLive: boolean;
  onPlay: (match: SportsMatch) => void;
  onToggleFav: (match: SportsMatch) => void;
  isFav: boolean;
  selectedRegion: RegionOption;
  onOpenMatchCenter?: (match: SportsMatch) => void;
}) => {
  const hasTeams = Boolean(
    match.teams?.home?.name && 
    match.teams?.away?.name && 
    match.teams.home.name.trim().toLowerCase() !== match.teams.away.name.trim().toLowerCase()
  );
  const sportEmoji = getSportIcon(match.category);
  const isMorocco = isMoroccanMatch(match);
  const timeFormatted = formatTimeForTz(match.date, selectedRegion.tz);
  const liveMinute = isLive ? getLiveMatchMinute(match.date, match.category) : null;

  return (
    <div
      onClick={() => onPlay(match)}
      className={`group relative flex flex-col justify-between rounded-2xl bg-[var(--bg-card)] border cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl min-h-[300px] h-full p-4 ${
        isLive 
          ? 'border-red-500/50 hover:border-red-500 shadow-lg shadow-red-900/20' 
          : isMorocco
            ? 'border-emerald-500/40 hover:border-emerald-500 shadow-emerald-900/10'
            : 'border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/60'
      }`}
    >
      {/* Stadium Background Atmosphere */}
      <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl pointer-events-none">
        {match.poster ? (
          <img 
            src={match.poster} 
            className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-500 group-hover:scale-105 transform" 
            loading="lazy" 
            alt={match.title}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--bg-card)] via-[var(--bg-hover)] to-[var(--bg-main)] opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-card)] via-[var(--bg-card)]/90 to-transparent" />
      </div>

      {/* Top Header Tags */}
      <div className="relative z-10 flex justify-between items-start gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs">{sportEmoji}</span>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-[var(--bg-main)]/90 backdrop-blur-md text-[var(--text-main)] border border-[var(--border-subtle)] shadow-sm">
            {match.category}
          </span>
          {isMorocco && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm flex items-center gap-1">
              <span>🇲🇦</span> Maroc
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isLive && (
            <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md shadow-red-900/40">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              <span>LIVE {liveMinute}</span>
            </span>
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFav(match); }}
            className={`p-1.5 rounded-full backdrop-blur-md transition-transform duration-200 border ${
              isFav 
                ? 'bg-red-500/20 text-red-500 border-red-500/30 scale-105' 
                : 'bg-black/40 border-white/10 text-[var(--text-muted)] hover:text-red-400 hover:bg-black/70'
            }`}
            title="Toggle Favorite"
          >
            <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Center Teams Matchup View */}
      <div className="relative z-10 my-auto py-2">
        <div className="mb-2 flex items-center justify-between">
          {!isLive ? <MatchCountdown date={match.date} /> : <div />}
        </div>

        {hasTeams ? (
          <div className="flex items-center justify-between gap-3">
            {/* Home Team */}
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group-hover:scale-105 transition-transform text-center">
              <TeamLogo name={match.teams!.home.name} logo={match.teams!.home.logo} className="w-12 h-12" />
              <span className="text-xs font-bold text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full min-h-[30px] flex items-center justify-center">
                {match.teams!.home.name}
              </span>
            </div>

            {/* VS or Score Badge */}
            <div className="flex flex-col items-center shrink-0">
              {match.score ? (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/70 border border-white/10 font-mono text-sm font-black text-white shadow-inner">
                    <span className={match.score.home > match.score.away ? 'text-emerald-400 font-extrabold' : ''}>
                      {match.score.home}
                    </span>
                    <span className="text-[var(--text-muted)] text-xs">:</span>
                    <span className={match.score.away > match.score.home ? 'text-emerald-400 font-extrabold' : ''}>
                      {match.score.away}
                    </span>
                  </div>
                  {isLive && (
                    <span className="text-[9px] font-bold text-red-400 font-mono mt-0.5 animate-pulse">
                      {match.minute || liveMinute}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs font-black text-[var(--text-muted)] italic px-2 py-0.5 rounded-lg bg-[var(--bg-main)]/90 border border-[var(--border-subtle)] shadow-sm">
                  VS
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group-hover:scale-105 transition-transform text-center">
              <TeamLogo name={match.teams!.away.name} logo={match.teams!.away.logo} className="w-12 h-12" />
              <span className="text-xs font-bold text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full min-h-[30px] flex items-center justify-center">
                {match.teams!.away.name}
              </span>
            </div>
          </div>
        ) : (
          <h3 className="font-bold text-sm sm:text-base text-[var(--text-main)] line-clamp-2 leading-tight group-hover:text-[rgb(var(--primary-color))] transition-colors min-h-[44px] flex items-center">
            {match.title}
          </h3>
        )}
      </div>

      {/* Bottom Footer Controls - Dual Row so buttons NEVER get cut off */}
      <div className="relative z-10 mt-3 pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
        
        {/* Row 1: Time, Timezone & Live Indicator */}
        <div className="flex items-center justify-between gap-1 text-[11px] text-[var(--text-muted)] font-mono">
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-bold text-[var(--text-main)] truncate">
              {selectedRegion.flag} {timeFormatted}
            </span>
            <span className="text-[10px] text-cyan-400/90 font-medium font-sans px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20 shrink-0">
              {selectedRegion.offsetBadge}
            </span>
          </div>

          {isLive ? (
            <span className="text-[10px] font-black text-red-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              Live
            </span>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
              HD Feed
            </span>
          )}
        </div>

        {/* Row 2: Dual Action Buttons (Match Center & Watch Live) - 100% visible, fully expanded */}
        <div className="flex items-center gap-2 w-full">
          {onOpenMatchCenter && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMatchCenter(match);
              }}
              className="flex-1 py-2 px-2.5 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-main)] hover:text-white flex items-center justify-center gap-1.5 transition-all shadow-sm group/btn"
              title="Open Match Center & Multi-Streams"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover/btn:scale-110 transition-transform" />
              <span className="truncate font-sans">Match Center</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(match);
            }}
            className="flex-1 py-2 px-3 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 active:scale-95 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-md shadow-[rgb(var(--primary-color))]/20 transition-all"
            title={isLive ? "Watch Live Stream" : "Watch Match Stream"}
          >
            <PlayCircle className="w-3.5 h-3.5 fill-current shrink-0" />
            <span className="truncate font-sans">{isLive ? 'Watch Live' : 'Watch Live'}</span>
          </button>
        </div>

      </div>
    </div>
  );
});

// List Row View (Optimized for complete visibility with both Match Center and Watch Live buttons)
const MatchListRow = React.memo(({ 
  match, 
  isLive, 
  onPlay, 
  onToggleFav, 
  isFav,
  selectedRegion,
  onOpenMatchCenter
}: {
  match: SportsMatch;
  isLive: boolean;
  onPlay: (match: SportsMatch) => void;
  onToggleFav: (match: SportsMatch) => void;
  isFav: boolean;
  selectedRegion: RegionOption;
  onOpenMatchCenter?: (match: SportsMatch) => void;
}) => {
  const hasTeams = match.teams?.home && match.teams?.away;
  const isMorocco = isMoroccanMatch(match);
  const sportEmoji = getSportIcon(match.category);
  const timeFormatted = formatTimeForTz(match.date, selectedRegion.tz);
  const liveMinute = isLive ? getLiveMatchMinute(match.date, match.category) : null;

  return (
    <div
      onClick={() => onPlay(match)}
      className={`group relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border rounded-2xl p-3 sm:p-4 cursor-pointer transition-all duration-200 ${
        isLive 
          ? 'border-red-500/50 hover:border-red-500' 
          : isMorocco
            ? 'border-emerald-500/40 hover:border-emerald-500 hover:translate-x-1'
            : 'border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/50 hover:translate-x-1'
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-5 flex-1 min-w-0">
        
        {/* Time / Status Column */}
        <div className="flex flex-col items-center justify-center w-20 sm:w-24 shrink-0 sm:border-r border-[var(--border-subtle)] sm:pr-3 text-center">
          {isLive ? (
            <div className="flex flex-col items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-[10px] font-black text-red-500 tracking-wider">LIVE {liveMinute}</span>
            </div>
          ) : (
            <>
              <span className="text-xs font-bold font-mono text-[var(--text-main)]">
                {timeFormatted}
              </span>
              <span className="text-[9px] text-[var(--text-muted)] uppercase font-semibold flex items-center gap-0.5">
                <span>{selectedRegion.flag}</span>
                <span>{selectedRegion.offsetBadge}</span>
              </span>
            </>
          )}
        </div>

        {/* Center Teams / Title */}
        <div className="flex-1 min-w-0">
          {hasTeams ? (
            <div className="flex items-center gap-2 sm:gap-4 max-w-xl">
              {/* Home */}
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate text-right">
                  {match.teams!.home.name}
                </span>
                <TeamLogo name={match.teams!.home.name} logo={match.teams!.home.logo} className="w-8 h-8" />
              </div>

              {match.score ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 font-mono text-xs font-black text-white shadow-inner shrink-0">
                  <span className={match.score.home > match.score.away ? 'text-emerald-400 font-bold' : ''}>
                    {match.score.home}
                  </span>
                  <span className="text-[var(--text-muted)] text-[10px]">:</span>
                  <span className={match.score.away > match.score.home ? 'text-emerald-400 font-bold' : ''}>
                    {match.score.away}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] font-black text-[var(--text-muted)] italic px-1.5 py-0.5 rounded bg-[var(--bg-main)] shrink-0">
                  VS
                </span>
              )}

              {/* Away */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <TeamLogo name={match.teams!.away.name} logo={match.teams!.away.logo} className="w-8 h-8" />
                <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate">
                  {match.teams!.away.name}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm">{sportEmoji}</span>
              <h3 className="font-bold text-xs sm:text-sm text-[var(--text-main)] truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">
                {match.title}
              </h3>
            </div>
          )}
        </div>

      </div>

      {/* Right Controls with Match Center & Watch Live */}
      <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 sm:pl-3 border-t sm:border-t-0 sm:border-l border-[var(--border-subtle)] shrink-0">
        {isMorocco && (
          <span className="hidden lg:inline-flex text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            🇲🇦 Maroc
          </span>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFav(match); }}
          className={`p-2 rounded-xl transition-colors border ${
            isFav 
              ? 'bg-red-500/10 text-red-500 border-red-500/20' 
              : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-red-400 border-[var(--border-subtle)]'
          }`}
          title="Add to Favorites"
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
        </button>

        {onOpenMatchCenter && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMatchCenter(match);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-main)] transition-colors"
            title="Open Match Center & Streams"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Center</span>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay(match);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[rgb(var(--primary-color))] hover:brightness-110 active:scale-95 text-white font-bold text-xs shadow-md shadow-[rgb(var(--primary-color))]/20 transition-all"
        >
          <PlayCircle className="w-3.5 h-3.5 fill-current shrink-0" />
          <span>{isLive ? 'Watch Live' : 'Watch Live'}</span>
        </button>
      </div>
    </div>
  );
});

// --- Main Sports Component ---
export const Sports: React.FC = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<string[]>([]);

  // User preference: Default league = La Liga ('laliga')
  const [tabMode, setTabMode] = useState<'live' | 'upcoming' | 'favorites' | 'standings'>('live');
  const [selectedLeague, setSelectedLeague] = useState<string>('laliga');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(24);

  // Region / Timezone State
  const [selectedRegionId, setSelectedRegionId] = useState<string>(() => {
    return localStorage.getItem('streamhub_sports_region_id') || 'morocco';
  });
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);

  const selectedRegion = useMemo(() => {
    const found = REGIONS.find(r => r.id === selectedRegionId) || REGIONS[0];
    return {
      ...found,
      tz: normalizeTimezone(found.tz)
    };
  }, [selectedRegionId]);

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    localStorage.setItem('streamhub_sports_region_id', regionId);
    window.dispatchEvent(new CustomEvent('streamhub_region_changed', { detail: regionId }));
    setIsRegionDropdownOpen(false);
  };

  // Match Center Modal State
  const [previewMatch, setPreviewMatch] = useState<SportsMatch | null>(null);

  // Live Digital Clock Ticker in Selected Region
  const [currentRegionTime, setCurrentRegionTime] = useState('');
  const [currentRegionDate, setCurrentRegionDate] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const safeTz = normalizeTimezone(selectedRegion.tz);
      const timeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: safeTz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(now);

      const dateStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: safeTz,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(now);

      setCurrentRegionTime(timeStr);
      setCurrentRegionDate(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [selectedRegion.tz]);

  const { data: matches = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['matches'],
    queryFn: getAllMatches,
    refetchInterval: 30000,
    staleTime: 1000 * 30,
  });

  // Live Standings Query (Tier 1: Football-Data.org -> Tier 2: ESPN -> Tier 3: Curated)
  const { 
    data: liveStandingsData, 
    isLoading: isLoadingStandings, 
    refetch: refetchStandings,
    isFetching: isFetchingStandings 
  } = useQuery({
    queryKey: ['standings', selectedLeague],
    queryFn: () => getLiveLeagueStandings(selectedLeague),
    staleTime: 1000 * 60 * 5, // 5 mins freshness
  });

  // Top Scorers Query (Tier 1: Football-Data.org Pichichi / Golden Boot -> Curated)
  const [standingsSubTab, setStandingsSubTab] = useState<'table' | 'scorers'>('table');
  const {
    data: topScorersData = [],
    isLoading: isLoadingScorers,
    refetch: refetchScorers,
    isFetching: isFetchingScorers
  } = useQuery({
    queryKey: ['scorers', selectedLeague],
    queryFn: () => getLeagueTopScorers(selectedLeague),
    staleTime: 1000 * 60 * 15, // 15 mins freshness
  });

  useEffect(() => {
    try {
      const favs = getFavoriteSportsMatches();
      if (Array.isArray(favs)) setFavorites(favs);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  }, []);

  // Reset pagination on filter change
  useEffect(() => {
    setDisplayLimit(24);
  }, [tabMode, activeCategory, searchQuery]);

  const toggleFavorite = useCallback((match: SportsMatch) => {
    const id = getMatchUniqueId(match);
    if (favorites.includes(id)) {
      removeFavoriteSportsMatch(id);
      setFavorites(prev => prev.filter(fid => fid !== id));
    } else {
      addFavoriteSportsMatch(id);
      setFavorites(prev => [...prev, id]);
    }
  }, [favorites]);

  // Featured Marquee Game (Prioritize live popular match, else marquee upcoming)
  const featuredMatch = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const now = Date.now();
    const liveMatches = matches.filter(m => {
      const diff = m.date - now;
      const finished = isMatchFinished(m);
      return !finished && (m.status === 'IN_PLAY' || (diff <= 15 * 60 * 1000 && diff >= -115 * 60 * 1000));
    });
    if (liveMatches.length > 0) {
      return liveMatches.find(m => m.popular) || liveMatches[0];
    }
    return matches.find(m => m.popular) || matches[0];
  }, [matches]);

  // Data Partitioning based on chosen region
  const { live, visibleUpcomingGroups, favMatches, upcomingCount } = useMemo(() => {
    const now = Date.now();
    const q = searchQuery.toLowerCase().trim();

    let filtered = matches;

    if (q) {
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.teams?.home?.name?.toLowerCase().includes(q) ||
        m.teams?.away?.name?.toLowerCase().includes(q)
      );
    }

    if (activeCategory === 'MOROCCO') {
      filtered = filtered.filter(isMoroccanMatch);
    } else if (activeCategory !== 'ALL') {
      filtered = filtered.filter(m => m.category.toUpperCase() === activeCategory);
    }

    const liveList: SportsMatch[] = [];
    const upcomingList: SportsMatch[] = [];
    const seenLiveKeys = new Set<string>();

    filtered.forEach(m => {
      const diff = m.date - now;
      const finished = isMatchFinished(m);

      const isLiveEvent =
        !finished &&
        (m.status === 'IN_PLAY' || (diff <= 15 * 60 * 1000 && diff >= -115 * 60 * 1000));

      if (isLiveEvent) {
        const liveKey = m.teams?.home?.name && m.teams?.away?.name
          ? [normalizeTeamToken(m.teams.home.name), normalizeTeamToken(m.teams.away.name)].sort().join('___')
          : normalizeTeamToken(m.title);

        if (!seenLiveKeys.has(liveKey)) {
          seenLiveKeys.add(liveKey);
          liveList.push(m);
        }
      } else if (!finished && diff > 15 * 60 * 1000) {
        upcomingList.push(m);
      }
    });

    liveList.sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return a.date - b.date;
    });
    upcomingList.sort((a, b) => a.date - b.date);

    // Group upcoming matches by date in the selected region
    const grouped: Record<string, SportsMatch[]> = {};
    upcomingList.forEach(m => {
      const key = getDayLabelForTz(m.date, selectedRegion.tz, selectedRegion.flag);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });

    // Virtual pagination
    const visibleGroups: Record<string, SportsMatch[]> = {};
    let count = 0;
    let limitReached = false;

    Object.entries(grouped).forEach(([key, groupMatches]) => {
      if (limitReached) return;
      if (count + groupMatches.length <= displayLimit) {
        visibleGroups[key] = groupMatches;
        count += groupMatches.length;
      } else {
        const remaining = displayLimit - count;
        if (remaining > 0) {
          visibleGroups[key] = groupMatches.slice(0, remaining);
          count += remaining;
        }
        limitReached = true;
      }
    });

    const favsList = filtered.filter(m => favorites.includes(getMatchUniqueId(m)));

    return {
      live: liveList,
      visibleUpcomingGroups: visibleGroups,
      favMatches: favsList,
      upcomingCount: upcomingList.length
    };
  }, [matches, activeCategory, searchQuery, displayLimit, favorites, selectedRegion]);

  // Dynamic Sport Categories (Standard sports first, Botola/Maroc as specialized filter)
  const categories = useMemo(() => {
    const moroccoCount = matches.filter(isMoroccanMatch).length;
    const footCount = matches.filter(m => m.category.toLowerCase().includes('foot')).length;
    const basketCount = matches.filter(m => m.category.toLowerCase().includes('basket')).length;
    const fightCount = matches.filter(m => m.category.toLowerCase().includes('fight')).length;
    const motorCount = matches.filter(m => m.category.toLowerCase().includes('motor')).length;
    const tennCount = matches.filter(m => m.category.toLowerCase().includes('tenn')).length;
    
    return [
      { name: 'ALL', label: 'All Sports', icon: '🌐', count: matches.length },
      ...(moroccoCount > 0 ? [{ name: 'MOROCCO', label: 'Botola & Maroc', icon: '🇲🇦', count: moroccoCount }] : []),
      ...(footCount > 0 ? [{ name: 'FOOTBALL', label: 'Football', icon: '⚽', count: footCount }] : []),
      ...(basketCount > 0 ? [{ name: 'BASKETBALL', label: 'Basketball (NBA)', icon: '🏀', count: basketCount }] : []),
      ...(fightCount > 0 ? [{ name: 'FIGHT', label: 'Combat / UFC', icon: '🥊', count: fightCount }] : []),
      ...(motorCount > 0 ? [{ name: 'MOTOR SPORTS', label: 'Formula 1', icon: '🏎️', count: motorCount }] : []),
      ...(tennCount > 0 ? [{ name: 'TENNIS', label: 'Tennis', icon: '🎾', count: tennCount }] : []),
    ];
  }, [matches]);

  const handlePlayMatch = (m: SportsMatch) => {
    navigate('/sports/watch', { state: { match: m } });
  };

  // Scroll to top button
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] pb-24 transition-colors duration-300">
      
      {/* 🌍 DYNAMIC REGION & TIMEZONE TICKER BAR */}
      <div className="bg-gradient-to-r from-blue-950/40 via-black/75 to-emerald-950/40 border-b border-white/10 py-2.5 px-4 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          
          {/* Live Clock with Selected Region */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-black text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-full shadow-sm">
              <span className="text-base leading-none">{selectedRegion.flag}</span>
              <span className="uppercase">{selectedRegion.name.split(' /')[0]}</span>
              <span className="text-[10px] text-cyan-300 font-mono">({selectedRegion.offsetBadge})</span>
            </span>

            <div className="flex items-center gap-2 font-mono font-bold text-white text-sm">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>{currentRegionTime || '00:00:00'}</span>
            </div>

            <span className="text-[var(--text-muted)] hidden md:inline font-medium">
              · {currentRegionDate}
            </span>
          </div>

          {/* Region Selector Interactive Button & Dropdown */}
          <div className="relative flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kickoff Timezone:</span>
            </span>
            
            <button
              type="button"
              onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] hover:border-cyan-500/50 text-xs font-bold text-[var(--text-main)] shadow-sm transition-all"
            >
              <span className="text-sm">{selectedRegion.flag}</span>
              <span className="truncate max-w-[130px] sm:max-w-none">{selectedRegion.name}</span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                {selectedRegion.offsetBadge}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${isRegionDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isRegionDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsRegionDropdownOpen(false)} 
                />
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl bg-[#121216] border border-white/15 p-2.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 fancy-scrollbar">
                  <div className="px-3 py-2 border-b border-white/10 mb-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Select Kickoff Timezone</span>
                    </p>
                    <p className="text-[10px] text-white/50 mt-0.5">
                      All match kickoffs, dates, and schedules recalculate instantly
                    </p>
                  </div>

                  {/* Fast Region Presets Grid */}
                  <div className="grid grid-cols-2 gap-1 mb-2 pb-2 border-b border-white/10">
                    <button
                      onClick={() => handleRegionChange('morocco')}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center gap-1.5 ${
                        selectedRegion.id === 'morocco' ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <span>🇲🇦</span>
                      <span className="truncate">Morocco (GMT+1)</span>
                    </button>
                    <button
                      onClick={() => handleRegionChange('spain')}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center gap-1.5 ${
                        selectedRegion.id === 'spain' ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <span>🇪🇸</span>
                      <span className="truncate">Spain (CET)</span>
                    </button>
                    <button
                      onClick={() => handleRegionChange('uk')}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center gap-1.5 ${
                        selectedRegion.id === 'uk' ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <span>🇬🇧</span>
                      <span className="truncate">UK (London)</span>
                    </button>
                    <button
                      onClick={() => handleRegionChange('france')}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center gap-1.5 ${
                        selectedRegion.id === 'france' ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <span>🇫🇷</span>
                      <span className="truncate">France (Paris)</span>
                    </button>
                  </div>

                  {/* Complete Regions List */}
                  {REGIONS.map(reg => {
                    const isSelected = reg.id === selectedRegion.id;
                    return (
                      <button
                        key={reg.id}
                        onClick={() => handleRegionChange(reg.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors text-xs mb-1 ${
                          isSelected 
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' 
                            : 'hover:bg-white/10 text-white/80 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{reg.flag}</span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{reg.name}</p>
                            <p className="text-[10px] text-white/50 truncate">{reg.country}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono shrink-0 px-2 py-0.5 rounded bg-white/10 text-white/70 ml-2 font-bold">
                          {reg.offsetBadge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Featured Headline Marquee Banner (Stadium Atmosphere - Real Madrid vs Barcelona) */}
      {featuredMatch && !searchQuery && activeCategory === 'ALL' && (
        <div className="relative border-b border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
          {/* Ambient Stadium Lighting */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-[rgb(var(--primary-color))]/10 to-pink-500/10 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgb(var(--primary-color))]/15 border border-[rgb(var(--primary-color))]/30 text-[rgb(var(--primary-color))] text-xs font-bold uppercase tracking-wider mb-3">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>Featured Match · Match Phare (2026/2027)</span>
                </div>
                
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[var(--text-main)] tracking-tight leading-tight">
                  {featuredMatch.title}
                </h1>
                
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-3 text-xs">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--bg-main)]/80 border border-[var(--border-subtle)] font-mono font-bold text-cyan-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{selectedRegion.flag} Kickoff: {formatTimeForTz(featuredMatch.date, selectedRegion.tz)} ({selectedRegion.offsetBadge})</span>
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                    HD 1080p Commentary
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <button
                    onClick={() => handlePlayMatch(featuredMatch)}
                    className="px-6 py-3 rounded-xl bg-[rgb(var(--primary-color))] text-white font-bold text-sm shadow-xl shadow-[rgb(var(--primary-color))]/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Watch Match Stream</span>
                  </button>

                  <button
                    onClick={() => setPreviewMatch(featuredMatch)}
                    className="px-4 py-3 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-main)] transition-colors flex items-center gap-1.5"
                  >
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Match Center</span>
                  </button>

                  <button
                    onClick={() => toggleFavorite(featuredMatch)}
                    className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all flex items-center gap-2 ${
                      favorites.includes(getMatchUniqueId(featuredMatch))
                        ? 'bg-red-500/15 border-red-500/30 text-red-500'
                        : 'bg-[var(--bg-main)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${favorites.includes(getMatchUniqueId(featuredMatch)) ? 'fill-current' : ''}`} />
                    <span>{favorites.includes(getMatchUniqueId(featuredMatch)) ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
              </div>

              {/* Matchup Shield Preview */}
              {featuredMatch.teams?.home && featuredMatch.teams?.away && (
                <div className="flex items-center gap-6 bg-[var(--bg-main)]/90 backdrop-blur-md p-6 rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
                  <div className="flex flex-col items-center gap-2">
                    <TeamLogo name={featuredMatch.teams.home.name} logo={featuredMatch.teams.home.logo} className="w-16 h-16" />
                    <span className="text-xs font-bold text-[var(--text-main)] max-w-[100px] truncate text-center">
                      {featuredMatch.teams.home.name}
                    </span>
                  </div>

                  <span className="text-2xl font-black text-[var(--text-muted)] italic">VS</span>

                  <div className="flex flex-col items-center gap-2">
                    <TeamLogo name={featuredMatch.teams.away.name} logo={featuredMatch.teams.away.logo} className="w-16 h-16" />
                    <span className="text-xs font-bold text-[var(--text-main)] max-w-[100px] truncate text-center">
                      {featuredMatch.teams.away.name}
                    </span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Control Sticky Toolbar */}
      <div className="sticky top-[45px] z-30 bg-[var(--bg-main)]/95 backdrop-blur-xl border-b border-[var(--border-subtle)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-3">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* View Switcher: Live, Schedule, Favorites, Standings */}
            <div className="flex items-center bg-[var(--bg-card)] p-1 rounded-2xl border border-[var(--border-subtle)] w-full sm:w-auto shadow-sm">
              <button
                type="button"
                onClick={() => setTabMode('live')}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  tabMode === 'live'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <span>Live Now</span>
                {live.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20 text-white animate-pulse">
                    {live.length}
                  </span>
                )}
              </button>


              <button
                type="button"
                onClick={() => setTabMode('upcoming')}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  tabMode === 'upcoming'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule</span>
              </button>

              <button
                type="button"
                onClick={() => setTabMode('favorites')}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  tabMode === 'favorites'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>Favorites</span>
                {favorites.length > 0 && (
                  <span className="text-[10px] text-[var(--text-muted)]">({favorites.length})</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setTabMode('standings')}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  tabMode === 'standings'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Standings</span>
              </button>
            </div>

            {/* Search & Layout Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-72">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search Real Madrid, Arsenal, PSG, Inter..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl pl-9 pr-8 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Refresh Feeds Button */}
              <button
                type="button"
                onClick={() => refetch()}
                className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
                title="Refresh Live Feeds"
              >
                <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[rgb(var(--primary-color))]' : ''}`} />
              </button>

              {/* Grid / List Layout Switcher */}
              <div className="hidden sm:flex items-center bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-1">
                <button
                  type="button"
                  onClick={() => setLayoutMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    layoutMode === 'grid'
                      ? 'bg-[var(--bg-hover)] text-[var(--text-main)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('list')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    layoutMode === 'list'
                      ? 'bg-[var(--bg-hover)] text-[var(--text-main)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>

          {/* Category Filter Pills (Standard Sports First, Botola/Maroc as specialized filter) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 fancy-scrollbar">
            {categories.map(cat => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setActiveCategory(cat.name)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  activeCategory === cat.name
                    ? 'bg-[rgb(var(--primary-color))] border-[rgb(var(--primary-color))] text-white shadow-md'
                    : cat.name === 'MOROCCO'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label || cat.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeCategory === cat.name ? 'bg-white/20 text-white' : 'bg-[var(--bg-main)] text-[var(--text-muted)]'}`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Main Body Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[50vh]">
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Loader2 className="w-10 h-10 text-[rgb(var(--primary-color))] animate-spin mb-3" />
            <p className="text-xs font-mono font-bold tracking-widest text-[var(--text-muted)] uppercase">
              Connecting to Live Satellite Feeds...
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. LIVE NOW TAB                                                           */}
        {/* ========================================================================= */}
        {!isLoading && tabMode === 'live' && (
          live.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <h2 className="text-base font-black uppercase tracking-wider text-[var(--text-main)]">
                    Live Right Now ({live.length} Events)
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-bold">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{selectedRegion.flag} {selectedRegion.name.split(' /')[0]} ({selectedRegion.offsetBadge})</span>
                </div>
              </div>

              {layoutMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {live.map(match => (
                    <MatchGridCard
                      key={getMatchUniqueId(match)}
                      match={match}
                      isLive={true}
                      onPlay={handlePlayMatch}
                      onToggleFav={toggleFavorite}
                      isFav={favorites.includes(getMatchUniqueId(match))}
                      selectedRegion={selectedRegion}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {live.map(match => (
                    <MatchListRow
                      key={getMatchUniqueId(match)}
                      match={match}
                      isLive={true}
                      onPlay={handlePlayMatch}
                      onToggleFav={toggleFavorite}
                      isFav={favorites.includes(getMatchUniqueId(match))}
                      selectedRegion={selectedRegion}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center mb-4 text-[var(--text-muted)] shadow-md">
                <Radio className="w-8 h-8 opacity-40" />
              </div>
              <h3 className="text-lg font-black text-[var(--text-main)] mb-1">
                No Live Match Data Returned Right Now
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-5 leading-relaxed">
                There may be no game in progress, or a sports data provider may be temporarily unavailable. Try the schedule or refresh.
              </p>
              <button
                type="button"
                onClick={() => setTabMode('upcoming')}
                className="px-6 py-2.5 rounded-xl bg-[rgb(var(--primary-color))] text-white font-bold text-xs shadow-lg hover:scale-105 transition-all"
              >
                Browse Full Schedule
              </button>
            </div>
          )
        )}


        {/* ========================================================================= */}
        {/* 2. UPCOMING SCHEDULE TAB (WITH REGION DAY BOUNDARIES)                     */}
        {/* ========================================================================= */}
        {!isLoading && tabMode === 'upcoming' && (
          Object.keys(visibleUpcomingGroups).length > 0 ? (
            <div className="space-y-10">
              
              {/* Region Notice & Switcher Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedRegion.flag}</span>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-main)]">
                      Showing schedules in {selectedRegion.name} ({selectedRegion.offsetBadge})
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Kickoff times and calendar dates update automatically with each region
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRegionDropdownOpen(true)}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-cyan-400 flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Switch Region</span>
                </button>
              </div>

              {Object.entries(visibleUpcomingGroups).map(([dateLabel, groupMatches]) => (
                <div key={dateLabel} className="space-y-4">
                  <div className="sticky top-[155px] z-20 py-2.5 px-4 bg-[var(--bg-main)]/95 backdrop-blur-md border border-[var(--border-subtle)] flex items-center justify-between rounded-xl shadow-md">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span>{dateLabel}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                        {selectedRegion.flag} {selectedRegion.offsetBadge}
                      </span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                        {groupMatches.length} Matches
                      </span>
                    </div>
                  </div>

                  {layoutMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {groupMatches.map(match => (
                        <MatchGridCard
                          key={getMatchUniqueId(match)}
                          match={match}
                          isLive={false}
                          onPlay={handlePlayMatch}
                          onToggleFav={toggleFavorite}
                          isFav={favorites.includes(getMatchUniqueId(match))}
                          selectedRegion={selectedRegion}
                          onOpenMatchCenter={(m) => setPreviewMatch(m)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {groupMatches.map(match => (
                        <MatchListRow
                          key={getMatchUniqueId(match)}
                          match={match}
                          isLive={false}
                          onPlay={handlePlayMatch}
                          onToggleFav={toggleFavorite}
                          isFav={favorites.includes(getMatchUniqueId(match))}
                          selectedRegion={selectedRegion}
                          onOpenMatchCenter={(m) => setPreviewMatch(m)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {upcomingCount > Object.values(visibleUpcomingGroups).flat().length && (
                <div className="flex justify-center pt-6">
                  <button
                    type="button"
                    onClick={() => setDisplayLimit(l => l + 24)}
                    className="px-8 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] text-xs font-bold text-[var(--text-main)] shadow-md hover:scale-105 transition-all"
                  >
                    Load More Events (+24)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-[var(--text-muted)]">
              No matches found in the upcoming schedule for this filter.
            </div>
          )
        )}

        {/* ========================================================================= */}
        {/* 3. FAVORITES TAB                                                          */}
        {/* ========================================================================= */}
        {!isLoading && tabMode === 'favorites' && (
          favMatches.length > 0 ? (
            <div className="space-y-5">
              <h2 className="text-base font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
                <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                <span>My Saved Matches ({favMatches.length})</span>
              </h2>

              {layoutMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {favMatches.map(match => (
                    <MatchGridCard
                      key={getMatchUniqueId(match)}
                      match={match}
                      isLive={false}
                      onPlay={handlePlayMatch}
                      onToggleFav={toggleFavorite}
                      isFav={true}
                      selectedRegion={selectedRegion}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {favMatches.map(match => (
                    <MatchListRow
                      key={getMatchUniqueId(match)}
                      match={match}
                      isLive={false}
                      onPlay={handlePlayMatch}
                      onToggleFav={toggleFavorite}
                      isFav={true}
                      selectedRegion={selectedRegion}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center mb-4 text-red-400">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-main)] mb-1">No Saved Matches</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
                Click the heart icon on any live or scheduled fixture to save it to your personal watchlist.
              </p>
              <button
                type="button"
                onClick={() => setTabMode('live')}
                className="px-5 py-2.5 rounded-xl bg-[rgb(var(--primary-color))] text-white font-bold text-xs"
              >
                Explore Live Matches
              </button>
            </div>
          )
        )}

        {/* ========================================================================= */}
        {/* 4. STANDINGS TAB (2026/2027 SEASON - LA LIGA -> PL -> LIGUE 1 -> SERIE A) */}
        {/* ========================================================================= */}
        {tabMode === 'standings' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>League Tables & Standings (2026 / 2027 Season)</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Active 2026/2027 campaign — La Liga, Premier League, Ligue 1, Serie A, and Botola Pro Inwi.
                </p>
              </div>

              {/* League Selector Pills (Ordered strictly: La Liga -> Premier League -> Ligue 1 -> Serie A -> Botola) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 fancy-scrollbar">
                {LEAGUE_TABLES.map(league => (
                  <button
                    key={league.id}
                    onClick={() => setSelectedLeague(league.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border flex items-center gap-1.5 ${
                      selectedLeague === league.id
                        ? 'bg-[rgb(var(--primary-color))] text-white border-[rgb(var(--primary-color))] shadow-md shadow-[rgb(var(--primary-color))]/25'
                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <span>{league.flag}</span>
                    <span>{league.shortName || league.name.split(' (')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Standings Sub-Navigation: League Table vs Top Scorers */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm">
                <button
                  type="button"
                  onClick={() => setStandingsSubTab('table')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    standingsSubTab === 'table'
                      ? 'bg-[rgb(var(--primary-color))] text-white shadow-md shadow-[rgb(var(--primary-color))]/20'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>League Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStandingsSubTab('scorers')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    standingsSubTab === 'scorers'
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-black shadow-md shadow-amber-500/20'
                      : 'text-[var(--text-muted)] hover:text-white'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>Top Scorers (Pichichi ⚽)</span>
                </button>
              </div>
            </div>

            {/* Selected League Card */}
            {(() => {
              const currentTable = LEAGUE_TABLES.find(l => l.id === selectedLeague) || LEAGUE_TABLES[0];
              const isBotola = currentTable.id === 'botola';
              const standingsList = liveStandingsData?.standings || currentTable.standings;
              const isLiveFromApi = liveStandingsData?.isLive;

              const sourceBadge = (() => {
                const src = liveStandingsData?.source;
                if (src === 'football-data.org') {
                  return { label: 'Football-Data.org (Official Live v4 ⚡)', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
                }
                if (src === 'espn') {
                  return { label: 'ESPN Radar (Live Fallback)', badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
                }
                if (src === 'botola-inwi') {
                  return { label: 'Botola Pro Inwi (Morocco Official)', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
                }
                return { label: '2026/2027 Season', badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
              })();

              return (
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-subtle)] overflow-hidden shadow-xl">
                  {/* Card Header */}
                  <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-main)]/50">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{currentTable.flag}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-black text-[var(--text-main)]">
                            {liveStandingsData?.name || currentTable.name}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgb(var(--primary-color))]/20 text-[rgb(var(--primary-color))] border border-[rgb(var(--primary-color))]/30">
                            {liveStandingsData?.season || currentTable.season || '2026 / 2027'} Season
                          </span>
                          {isLiveFromApi && (
                            <span className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${sourceBadge.badgeClass}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                              <span>{sourceBadge.label}</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              refetchStandings();
                              refetchScorers();
                            }}
                            className="p-1 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white border border-[var(--border-subtle)] transition-colors"
                            title="Refresh Data"
                          >
                            <RotateCw className={`w-3 h-3 ${isFetchingStandings || isFetchingScorers ? 'animate-spin text-emerald-400' : ''}`} />
                          </button>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">
                          {standingsSubTab === 'table' ? `Official Ranking Table · ${currentTable.country}` : `Golden Boot & Pichichi Rankings · ${currentTable.country}`}
                        </span>
                      </div>
                    </div>

                    {standingsSubTab === 'table' ? (
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" /> 
                          {isBotola ? 'CAF Champions League' : 'Champions League / Playoff'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 
                          {isBotola ? 'CAF Confederation' : 'Europa League'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Relégation
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>Pichichi Race 2026/2027</span>
                      </div>
                    )}
                  </div>

                  {/* SubTab 1: LEAGUE TABLE */}
                  {standingsSubTab === 'table' && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead className="bg-[var(--bg-input)]/50 text-[var(--text-muted)] text-[10px] sm:text-[11px] uppercase tracking-wider font-bold border-b border-[var(--border-subtle)]">
                          <tr>
                            <th className="py-3 px-3 sm:px-4 w-12 text-center">Pos</th>
                            <th className="py-3 px-3 sm:px-4">Club</th>
                            <th className="py-3 px-2 sm:px-3 text-center">P</th>
                            <th className="py-3 px-2 sm:px-3 text-center">W</th>
                            <th className="py-3 px-2 sm:px-3 text-center">D</th>
                            <th className="py-3 px-2 sm:px-3 text-center">L</th>
                            <th className="py-3 px-2 sm:px-3 text-center hidden md:table-cell">GD</th>
                            <th className="py-3 px-3 sm:px-4 text-center font-black text-[var(--text-main)]">PTS</th>
                            <th className="py-3 px-3 sm:px-4 text-center hidden sm:table-cell">Form</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {standingsList.map(team => (
                            <tr key={team.pos} className="hover:bg-[var(--bg-hover)]/40 transition-colors">
                              <td className="py-3 px-3 sm:px-4 text-center font-bold relative">
                                {team.zone === 'ucl' || team.zone === 'playoff' ? (
                                  <span className="absolute left-0 top-1 bottom-1 w-1 bg-blue-500 rounded-r" />
                                ) : team.zone === 'uel' || team.zone === 'conf' ? (
                                  <span className="absolute left-0 top-1 bottom-1 w-1 bg-amber-500 rounded-r" />
                                ) : team.zone === 'relegation' ? (
                                  <span className="absolute left-0 top-1 bottom-1 w-1 bg-red-500 rounded-r" />
                                ) : null}
                                <span className="text-[var(--text-muted)]">{team.pos}</span>
                              </td>
                              <td className="py-3 px-3 sm:px-4">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <TeamLogo name={team.team} logo={team.logo} className="w-6 h-6 shrink-0" size="text-[9px]" />
                                  <span className="font-bold text-[var(--text-main)] truncate">{team.team}</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-3 text-center font-mono text-[var(--text-muted)]">{team.played}</td>
                              <td className="py-3 px-2 sm:px-3 text-center font-mono text-[var(--text-muted)]">{team.won}</td>
                              <td className="py-3 px-2 sm:px-3 text-center font-mono text-[var(--text-muted)]">{team.drawn}</td>
                              <td className="py-3 px-2 sm:px-3 text-center font-mono text-[var(--text-muted)]">{team.lost}</td>
                              <td className="py-3 px-2 sm:px-3 text-center font-mono hidden md:table-cell text-[var(--text-muted)]">
                                {team.gd > 0 ? `+${team.gd}` : team.gd}
                              </td>
                              <td className="py-3 px-3 sm:px-4 text-center font-mono font-black text-sm text-[rgb(var(--primary-color))]">
                                {team.points}
                              </td>
                              <td className="py-3 px-3 sm:px-4 text-center hidden sm:table-cell">
                                <div className="flex items-center justify-center gap-1">
                                  {team.form.map((res, i) => (
                                    <span
                                      key={i}
                                      className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center text-white ${
                                        res === 'W' ? 'bg-emerald-500' : res === 'D' ? 'bg-amber-500' : 'bg-red-500'
                                      }`}
                                    >
                                      {res}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* SubTab 2: TOP SCORERS (PICHICHI / GOLDEN BOOT) */}
                  {standingsSubTab === 'scorers' && (
                    <div className="overflow-x-auto">
                      {topScorersData.length > 0 ? (
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-[var(--bg-input)]/50 text-[var(--text-muted)] text-[10px] sm:text-[11px] uppercase tracking-wider font-bold border-b border-[var(--border-subtle)]">
                            <tr>
                              <th className="py-3 px-3 sm:px-4 w-12 text-center">Rank</th>
                              <th className="py-3 px-3 sm:px-4">Player</th>
                              <th className="py-3 px-3 sm:px-4">Club</th>
                              <th className="py-3 px-2 sm:px-3 text-center">Matches</th>
                              <th className="py-3 px-2 sm:px-3 text-center hidden sm:table-cell">Assists</th>
                              <th className="py-3 px-3 sm:px-4 text-center font-black text-amber-400">Goals ⚽</th>
                              <th className="py-3 px-3 sm:px-4 text-center hidden md:table-cell text-[var(--text-muted)]">Goals/Match</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-subtle)]">
                            {topScorersData.map((scorer: LeagueTopScorer) => {
                              const played = scorer.playedGames ?? 0;
                              const ratio = played > 0 ? (scorer.goals / played).toFixed(2) : '-';
                              const medal = scorer.rank === 1 ? '🥇' : scorer.rank === 2 ? '🥈' : scorer.rank === 3 ? '🥉' : null;

                              return (
                                <tr key={`${scorer.rank}-${scorer.name}`} className="hover:bg-[var(--bg-hover)]/40 transition-colors">
                                  <td className="py-3 px-3 sm:px-4 text-center font-black">
                                    {medal ? (
                                      <span className="text-base" title={`Rank ${scorer.rank}`}>{medal}</span>
                                    ) : (
                                      <span className="text-[var(--text-muted)] font-mono">{scorer.rank}</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 sm:px-4 font-bold text-[var(--text-main)]">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate">{scorer.name}</span>
                                      {scorer.rank === 1 && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                          Pichichi Leader
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 sm:px-4">
                                    <div className="flex items-center gap-2">
                                      <TeamLogo name={scorer.team} logo={scorer.teamLogo} className="w-5 h-5 shrink-0" size="text-[8px]" />
                                      <span className="text-[var(--text-muted)] truncate">{scorer.team}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 sm:px-3 text-center font-mono text-[var(--text-muted)]">
                                    {played}
                                  </td>
                                  <td className="py-3 px-2 sm:px-3 text-center font-mono text-[var(--text-muted)] hidden sm:table-cell">
                                    {scorer.assists ?? 0}
                                  </td>
                                  <td className="py-3 px-3 sm:px-4 text-center font-mono font-black text-base text-amber-400">
                                    {scorer.goals}
                                  </td>
                                  <td className="py-3 px-3 sm:px-4 text-center font-mono text-xs text-[var(--text-muted)] hidden md:table-cell">
                                    {ratio}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                          {isLoadingScorers ? 'Loading official Pichichi rankings...' : 'No top scorers recorded for this tournament.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* INTERACTIVE MATCH CENTER / FAST STREAM SELECTOR MODAL                     */}
      {/* ========================================================================= */}
      {previewMatch && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setPreviewMatch(null)}
        >
          <div 
            className="relative w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[92vh] fancy-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-[rgb(var(--primary-color))] to-emerald-500" />
            
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <span>{getSportIcon(previewMatch.category)}</span>
                <span>{previewMatch.category} · Match Center</span>
              </span>
              <button
                onClick={() => setPreviewMatch(null)}
                className="p-1.5 rounded-lg bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Matchup Banner */}
            <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-subtle)] mb-5">
              {previewMatch.teams?.home && previewMatch.teams?.away ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col items-center flex-1 text-center">
                    <TeamLogo name={previewMatch.teams.home.name} logo={previewMatch.teams.home.logo} className="w-14 h-14 mb-2" />
                    <span className="text-xs font-bold text-[var(--text-main)] line-clamp-1">{previewMatch.teams.home.name}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    {previewMatch.score ? (
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/80 border border-white/10 font-mono text-2xl font-black text-white shadow-lg">
                          <span className={previewMatch.score.home > previewMatch.score.away ? 'text-emerald-400 font-extrabold' : ''}>
                            {previewMatch.score.home}
                          </span>
                          <span className="text-[var(--text-muted)] text-sm">:</span>
                          <span className={previewMatch.score.away > previewMatch.score.home ? 'text-emerald-400 font-extrabold' : ''}>
                            {previewMatch.score.away}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-red-400 uppercase font-mono mt-1 tracking-wider animate-pulse">
                          {previewMatch.minute || 'LIVE'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-black text-[var(--text-muted)] italic">VS</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center flex-1 text-center">
                    <TeamLogo name={previewMatch.teams.away.name} logo={previewMatch.teams.away.logo} className="w-14 h-14 mb-2" />
                    <span className="text-xs font-bold text-[var(--text-main)] line-clamp-1">{previewMatch.teams.away.name}</span>
                  </div>
                </div>
              ) : (
                <h3 className="text-base font-bold text-[var(--text-main)] text-center">{previewMatch.title}</h3>
              )}
            </div>

            {/* Time & Region Information with Quick Region Switcher */}
            <div className="space-y-2.5 mb-5 text-xs bg-[var(--bg-input)]/40 p-4 rounded-2xl border border-[var(--border-subtle)]">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)] flex items-center gap-1">
                  <span>{selectedRegion.flag}</span>
                  <span>Time ({selectedRegion.name.split(' /')[0]}):</span>
                </span>
                <span className="font-bold text-cyan-400 font-mono text-sm">
                  {formatTimeForTz(previewMatch.date, selectedRegion.tz)} ({selectedRegion.offsetBadge})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)]">Local Date:</span>
                <span className="font-bold text-[var(--text-main)]">
                  {formatDateFullForTz(previewMatch.date, selectedRegion.tz)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)]">Status:</span>
                <MatchCountdown date={previewMatch.date} />
              </div>
            </div>

            {/* Quick Stream Servers Preview */}
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[rgb(var(--primary-color))]" />
                <span>Available Stream Nodes & Mirrors</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {previewMatch.sources.map((s, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-main)]">Mirror {idx + 1} ({s.source.toUpperCase()})</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">HD Online</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setPreviewMatch(null);
                  handlePlayMatch(previewMatch);
                }}
                className="flex-1 py-3 px-5 rounded-xl bg-[rgb(var(--primary-color))] text-white font-bold text-sm shadow-lg shadow-[rgb(var(--primary-color))]/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Watch Live Match</span>
              </button>
              <button
                onClick={() => {
                  toggleFavorite(previewMatch);
                }}
                className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-white"
                title="Toggle Favorite"
              >
                <Heart className={`w-4 h-4 ${favorites.includes(getMatchUniqueId(previewMatch)) ? 'fill-red-500 text-red-500' : ''}`} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating Scroll to Top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-6 right-6 p-3 rounded-full bg-[rgb(var(--primary-color))] text-white shadow-2xl transition-all duration-300 z-50 hover:scale-110 active:scale-95 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5" />
      </button>

    </div>
  );
};
