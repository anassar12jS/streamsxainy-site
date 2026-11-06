import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getAllMatches,
  getExpectedMatchDurationMs,
  isLiveMatchStatus,
  isMatchFinished,
  normalizeTeamToken,
  createGoogleCalendarUrl,
  downloadIcsCalendar,
  copyMatchShareLink
} from '../services/sports';
import { SportsMatch, LeagueTopScorer } from '../types';
import {
  Trophy, Calendar, PlayCircle, Clock, Loader2, Search,
  Heart, LayoutGrid, List, Timer, ChevronUp, Radio,
  RotateCw, Play, Flame, X, ChevronDown, Activity, Globe,
  Check, ExternalLink, Sparkles, Tv, Award, Share2, Download,
  MapPin, Shield, Volume2, VolumeX, Bell, BellRing, Zap,
  BarChart3, Users
} from 'lucide-react';
import {
  addFavoriteSportsMatch,
  removeFavoriteSportsMatch,
  getFavoriteSportsMatches,
  getMatchReminders,
  addMatchReminder,
  removeMatchReminder
} from '../services/storage';
import { LEAGUE_TABLES, LeagueTeamStanding } from '../data/sportsStandings';
import { REGIONS, RegionOption } from '../constants/regions';
import { getLiveLeagueStandings, getLeagueTopScorers } from '../services/footballApi';
import { getTeamLogoUrl, CLUB_BRAND_COLORS } from '../data/clubLogos';
import { useSyncedClock, formatMatchCountdown, getSyncedNow } from '../services/clockSync';
import { SportsMultiviewModal } from '../components/SportsMultiviewModal';

// Team initials / fallback color generator
const generateColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const getTeamBrand = (name: string) => {
  const normalizedName = name.trim().toLowerCase();
  const knownBrand = CLUB_BRAND_COLORS[name]
    || Object.entries(CLUB_BRAND_COLORS).find(([team]) => {
      const normalizedTeam = team.toLowerCase();
      return normalizedName.includes(normalizedTeam) || normalizedTeam.includes(normalizedName);
    })?.[1];
  return knownBrand || { primary: generateColor(name || 'Sport'), secondary: '#111827' };
};

const dynamicTeamLogoRequests = new Map<string, Promise<string | undefined>>();

const getDynamicTeamLogo = (teamName: string): Promise<string | undefined> => {
  const normalizedName = teamName.trim().toLowerCase();
  if (!normalizedName) return Promise.resolve(undefined);
  const cachedRequest = dynamicTeamLogoRequests.get(normalizedName);
  if (cachedRequest) return cachedRequest;

  const request = (async () => {
    const cacheKey = `streamhub_team_logo_${normalizedName}`;
    try {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        try {
          const cached = JSON.parse(stored);
          if (cached && cached.expiresAt > Date.now()) return cached.url || undefined;
        } catch {
          if (stored.startsWith('http')) return stored;
        }
      }
    } catch {
      // Continue with a network lookup when browser storage is unavailable.
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    let foundLogo: string | undefined;
    let lookupSucceeded = false;
    try {
      const query = encodeURIComponent(teamName.replace(/[⚽🏎️🥊🏀🏈🎾]/g, '').trim());
      const response = await fetch(`https://site.api.espn.com/apis/search/v2?query=${query}&limit=1`, {
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Team logo lookup failed');
      lookupSucceeded = true;
      const data = await response.json();
      const team = data.results?.find((result: any) => result.type === 'team')?.contents?.[0];
      foundLogo = team?.image?.default || team?.image?.defaultDark || team?.logo || undefined;
    } catch {
      foundLogo = undefined;
    } finally {
      clearTimeout(timeout);
    }

    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        url: foundLogo || null,
        expiresAt: Date.now() + (foundLogo ? 90 : lookupSucceeded ? 1 : 5 / (24 * 60)) * 24 * 60 * 60 * 1000
      }));
    } catch {
      // The in-memory promise still avoids duplicate lookups during this visit.
    }
    return foundLogo;
  })();

  dynamicTeamLogoRequests.set(normalizedName, request);
  request.then(foundLogo => {
    if (!foundLogo) {
      const retryAfterMs = 5 * 60 * 1000;
      setTimeout(() => {
        if (dynamicTeamLogoRequests.get(normalizedName) === request) {
          dynamicTeamLogoRequests.delete(normalizedName);
        }
      }, retryAfterMs);
    }
  });
  return request;
};

export const normalizeTimezone = (tz?: string): string => {
  if (!tz || tz === 'Etc/GMT-1' || tz === 'Etc/GMT+1' || tz === 'UTC') return 'UTC';
  if (tz === 'morocco') return 'Africa/Casablanca';
  return tz;
};

const formatDateInTimezone = (
  date: Date,
  tz: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
  offsetMs?: number
): string => {
  const safeTz = normalizeTimezone(tz);
  const dateToFormat = offsetMs === undefined ? date : new Date(date.getTime() + offsetMs);
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: offsetMs === undefined ? safeTz : 'UTC'
  }).format(dateToFormat);
};

const getScheduleTimezone = (region: RegionOption): string => {
  return normalizeTimezone(region.scheduleTz || region.tz);
};

const formatOffsetMs = (offsetMs: number): string => {
  const offsetMinutes = Math.round(offsetMs / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
};

const formatTimezoneOffset = (dateNum: number, tz: string, offsetMs?: number): string => {
  if (offsetMs !== undefined) return formatOffsetMs(offsetMs);
  const safeTz = normalizeTimezone(tz);
  if (safeTz === 'UTC') return 'UTC';
  try {
    const offset = new Intl.DateTimeFormat('en', {
      timeZone: safeTz,
      timeZoneName: 'shortOffset'
    } as unknown as Intl.DateTimeFormatOptions)
      .formatToParts(new Date(dateNum))
      .find(part => part.type === 'timeZoneName')?.value;
    return offset || 'UTC';
  } catch {
    return 'UTC';
  }
};

const getScheduleOffsetBadge = (region: RegionOption, dateNum = Date.now(), offsetMs?: number): string => {
  return formatTimezoneOffset(dateNum, getScheduleTimezone(region), offsetMs);
};

export const formatTimeForTz = (dateNum: number, tz: string, offsetMs?: number) => {
  try {
    return formatDateInTimezone(new Date(dateNum), tz, 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }, offsetMs);
  } catch {
    return new Date(dateNum).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};

export const formatDateFullForTz = (dateNum: number, tz: string, offsetMs?: number) => {
  try {
    return formatDateInTimezone(new Date(dateNum), tz, 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }, offsetMs);
  } catch {
    return new Date(dateNum).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  }
};

export const getDayLabelForTz = (dateNum: number, tz: string, regionFlag: string, offsetMs?: number, nowMs = Date.now()) => {
  try {
    const dateKey = (value: Date) => formatDateInTimezone(value, tz, 'en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }, offsetMs);
    const matchDate = dateKey(new Date(dateNum));
    const nowEffective = new Date(nowMs);
    const today = dateKey(nowEffective);
    const [year, month, day] = today.split('-').map(Number);
    const todayCalendarDate = Date.UTC(year, month - 1, day);
    const tomorrow = new Date(todayCalendarDate + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(todayCalendarDate - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    if (matchDate === today) return `Today · Aujourd’hui (${regionFlag})`;
    if (matchDate === tomorrow) return `Tomorrow · Demain (${regionFlag})`;
    if (matchDate === yesterday) return `Yesterday · Hier (${regionFlag})`;

    return formatDateInTimezone(new Date(dateNum), tz, 'en-GB', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return new Date(dateNum).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  }
};

const getNearTermTimezoneOffset = (dateNum: number, nowMs: number, offsetMs?: number): number | undefined => {
  return offsetMs !== undefined && Math.abs(dateNum - nowMs) <= 48 * 60 * 60 * 1000 ? offsetMs : undefined;
};

const parseUtcOffsetMs = (offset: string): number | undefined => {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return undefined;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
};

const formatUtcOffset = (offset: string): string => {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return 'UTC';
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return `GMT${match[1]}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
};

// Compute approximate match period / minute for live events
const getLiveMatchMinute = (dateNum: number, category?: string, nowMs = Date.now()) => {
  const diffMinutes = Math.floor((nowMs - dateNum) / 60000);
  const normalizedCategory = (category || '').toLowerCase();
  const isSoccer = !category || normalizedCategory.includes('soccer') ||
    (normalizedCategory.includes('football') && !normalizedCategory.includes('american'));
  
  if (diffMinutes <= 0) return 'Kick-off';
  if (isSoccer) {
    if (diffMinutes < 45) return `${diffMinutes}'`;
    if (diffMinutes >= 45 && diffMinutes < 60) return 'HT';
    if (diffMinutes >= 60 && diffMinutes < 105) return `${diffMinutes - 15}'`;
    return '90\'+';
  }
  return 'LIVE';
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
  return false;
};

const getEffectiveMatchDate = (dateNum: number) => dateNum;

// Dynamic Countdown Badge
const MatchCountdown = React.memo(({ date, now }: { date: number; now: number }) => {
  const countdown = useMemo(() => formatMatchCountdown(date, now), [date, now]);

  if (!countdown.isUpcoming) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25 whitespace-nowrap backdrop-blur-sm shadow-sm">
        <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" /> Starting Soon
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25 whitespace-nowrap backdrop-blur-sm shadow-sm">
      <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {countdown.shortLabel}
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
    const [lookedUp, setLookedUp] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);

    const brand = useMemo(() => getTeamBrand(name), [name]);

    const initials = useMemo(() => {
      const parts = (name || '').trim().split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
      return parts.map(n => n[0]).slice(0, 3).join('').toUpperCase();
    }, [name]);

    useEffect(() => {
      const resolved = getTeamLogoUrl(name, logo);
      let active = true;
      setCurrentSrc(resolved);
      setRetriedWithProxy(false);
      setLookedUp(false);
      setImgFailed(false);

      if (!resolved && name) {
        setLookedUp(true);
        getDynamicTeamLogo(name).then(foundLogo => {
          if (!active) return;
          if (foundLogo) setCurrentSrc(foundLogo);
          else setImgFailed(true);
        });
      } else if (!name) {
        setImgFailed(true);
      }

      return () => { active = false; };
    }, [name, logo]);

    const handleImgError = () => {
      // If direct image failed and hasn't been proxied yet, retry through wsrv.nl proxy
      if (!retriedWithProxy && currentSrc && !currentSrc.includes('wsrv.nl') && currentSrc.startsWith('http')) {
        setRetriedWithProxy(true);
        setCurrentSrc(`https://wsrv.nl/?url=${encodeURIComponent(currentSrc)}&w=96&output=png`);
      } else if (!lookedUp && name) {
        setLookedUp(true);
        getDynamicTeamLogo(name).then(foundLogo => {
          if (foundLogo && foundLogo !== currentSrc) {
            setCurrentSrc(foundLogo);
            setRetriedWithProxy(false);
          } else {
            setImgFailed(true);
          }
        });
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

// Interactive Goal, Kickoff & Alert Audio Chimes (Web Audio API - no external assets)
const playScoreAlertSound = (type: 'goal' | 'kickoff' | 'preview' = 'goal') => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'goal') {
      // Fanfare goal chime (C5 -> E5 -> G5)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } else if (type === 'kickoff') {
      // Friendly kickoff alert chime (A4 -> A5)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else {
      // Subtle toggle preview beep (E5)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Audio context not allowed or failed
  }
};

const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
  } catch {
    return false;
  }
  return false;
};


const getStandingsForm = (teamName: string, standings?: LeagueTeamStanding[]): ('W' | 'D' | 'L')[] => {
  const teamToken = normalizeTeamToken(teamName);
  return standings?.find(team => normalizeTeamToken(team.team) === teamToken)?.form || [];
};

const getWinProbability = (match: SportsMatch): { home: number; draw: number; away: number } => {
  if (match.score) {
    if (match.score.home > match.score.away) return { home: 68, draw: 20, away: 12 };
    if (match.score.away > match.score.home) return { home: 14, draw: 22, away: 64 };
    return { home: 40, draw: 38, away: 22 };
  }
  let hash = 0;
  const name = `${match.teams?.home?.name || ''} ${match.teams?.away?.name || ''}`;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const homePct = 35 + Math.abs(hash % 30); // 35 - 64%
  const drawPct = 20 + Math.abs((hash >> 2) % 15); // 20 - 34%
  const awayPct = Math.max(10, 100 - homePct - drawPct);
  return { home: homePct, draw: drawPct, away: awayPct };
};

// ============================================================================
// TACTICAL LINEUPS & SQUAD FORMATIONS ENGINE
// ============================================================================
interface TacticalPlayer {
  num: number;
  name: string;
  pos: 'GK' | 'DF' | 'MF' | 'FW';
  x: number; // 0-100% on pitch
  y: number; // 0-100% on pitch
}

interface TeamTactics {
  teamName: string;
  formation: string;
  manager: string;
  startingXI: TacticalPlayer[];
  substitutes: string[];
}

const KNOWN_TACTICAL_ROSTERS: Record<string, {
  formation: string;
  manager: string;
  players: { num: number; name: string; pos: 'GK' | 'DF' | 'MF' | 'FW' }[];
  subs: string[];
}> = {
  'real madrid': {
    formation: '4-3-3',
    manager: 'Carlo Ancelotti',
    players: [
      { num: 1, name: 'Courtois', pos: 'GK' },
      { num: 17, name: 'Lucas V.', pos: 'DF' },
      { num: 3, name: 'Militão', pos: 'DF' },
      { num: 22, name: 'Rüdiger', pos: 'DF' },
      { num: 23, name: 'Mendy', pos: 'DF' },
      { num: 8, name: 'Valverde', pos: 'MF' },
      { num: 14, name: 'Tchouaméni', pos: 'MF' },
      { num: 5, name: 'Bellingham', pos: 'MF' },
      { num: 11, name: 'Rodrygo', pos: 'FW' },
      { num: 9, name: 'Mbappé', pos: 'FW' },
      { num: 7, name: 'Vinícius Jr', pos: 'FW' }
    ],
    subs: ['Lunin (GK)', 'Modrić', 'Camavinga', 'Brahim Díaz', 'Endrick', 'Arda Güler', 'Fran García']
  },
  'barcelona': {
    formation: '4-2-3-1',
    manager: 'Hansi Flick',
    players: [
      { num: 1, name: 'Ter Stegen', pos: 'GK' },
      { num: 23, name: 'Koundé', pos: 'DF' },
      { num: 2, name: 'Cubarsí', pos: 'DF' },
      { num: 5, name: 'Iñigo M.', pos: 'DF' },
      { num: 3, name: 'Balde', pos: 'DF' },
      { num: 17, name: 'Casadó', pos: 'MF' },
      { num: 8, name: 'Pedri', pos: 'MF' },
      { num: 19, name: 'Lamine Yamal', pos: 'FW' },
      { num: 20, name: 'Dani Olmo', pos: 'MF' },
      { num: 11, name: 'Raphinha', pos: 'FW' },
      { num: 9, name: 'Lewandowski', pos: 'FW' }
    ],
    subs: ['Iñaki Peña (GK)', 'Gavi', 'Frenkie de Jong', 'Fermín López', 'Ferran Torres', 'Pau Víctor', 'Ronald Araújo']
  },
  'manchester city': {
    formation: '4-1-4-1',
    manager: 'Pep Guardiola',
    players: [
      { num: 31, name: 'Ederson', pos: 'GK' },
      { num: 82, name: 'Rico Lewis', pos: 'DF' },
      { num: 25, name: 'Akanji', pos: 'DF' },
      { num: 3, name: 'Rúben Dias', pos: 'DF' },
      { num: 24, name: 'Gvardiol', pos: 'DF' },
      { num: 16, name: 'Rodri', pos: 'MF' },
      { num: 20, name: 'Bernardo', pos: 'MF' },
      { num: 17, name: 'De Bruyne', pos: 'MF' },
      { num: 47, name: 'Foden', pos: 'MF' },
      { num: 11, name: 'Doku', pos: 'FW' },
      { num: 9, name: 'Haaland', pos: 'FW' }
    ],
    subs: ['Ortega (GK)', 'John Stones', 'Kovačić', 'Gündoğan', 'Jack Grealish', 'Savinho', 'Nathan Aké']
  },
  'arsenal': {
    formation: '4-3-3',
    manager: 'Mikel Arteta',
    players: [
      { num: 22, name: 'Raya', pos: 'GK' },
      { num: 4, name: 'White', pos: 'DF' },
      { num: 2, name: 'Saliba', pos: 'DF' },
      { num: 6, name: 'Gabriel', pos: 'DF' },
      { num: 12, name: 'Timber', pos: 'DF' },
      { num: 41, name: 'Rice', pos: 'MF' },
      { num: 5, name: 'Partey', pos: 'MF' },
      { num: 8, name: 'Ødegaard', pos: 'MF' },
      { num: 7, name: 'Saka', pos: 'FW' },
      { num: 29, name: 'Havertz', pos: 'FW' },
      { num: 11, name: 'Martinelli', pos: 'FW' }
    ],
    subs: ['Neto (GK)', 'Calafiori', 'Zinchenko', 'Mikel Merino', 'Jorginho', 'Trossard', 'Sterling']
  },
  'liverpool': {
    formation: '4-2-3-1',
    manager: 'Arne Slot',
    players: [
      { num: 1, name: 'Alisson', pos: 'GK' },
      { num: 66, name: 'Alexander-Arnold', pos: 'DF' },
      { num: 5, name: 'Konaté', pos: 'DF' },
      { num: 4, name: 'Van Dijk', pos: 'DF' },
      { num: 26, name: 'Robertson', pos: 'DF' },
      { num: 38, name: 'Gravenberch', pos: 'MF' },
      { num: 10, name: 'Mac Allister', pos: 'MF' },
      { num: 11, name: 'Salah', pos: 'FW' },
      { num: 8, name: 'Szoboszlai', pos: 'MF' },
      { num: 7, name: 'Luis Díaz', pos: 'FW' },
      { num: 9, name: 'Darwin Núñez', pos: 'FW' }
    ],
    subs: ['Kelleher (GK)', 'Joe Gomez', 'Quansah', 'Wataru Endō', 'Curtis Jones', 'Cody Gakpo', 'Chiesa']
  },
  'paris saint-germain': {
    formation: '4-3-3',
    manager: 'Luis Enrique',
    players: [
      { num: 1, name: 'Donnarumma', pos: 'GK' },
      { num: 2, name: 'Hakimi', pos: 'DF' },
      { num: 5, name: 'Marquinhos', pos: 'DF' },
      { num: 51, name: 'Pacho', pos: 'DF' },
      { num: 25, name: 'Nuno Mendes', pos: 'DF' },
      { num: 33, name: 'Zaïre-Emery', pos: 'MF' },
      { num: 17, name: 'Vitinha', pos: 'MF' },
      { num: 87, name: 'João Neves', pos: 'MF' },
      { num: 10, name: 'Dembélé', pos: 'FW' },
      { num: 19, name: 'Kang-in Lee', pos: 'FW' },
      { num: 29, name: 'Barcola', pos: 'FW' }
    ],
    subs: ['Safonov (GK)', 'Beraldo', 'Hernandez', 'Fabián Ruiz', 'Asensio', 'Kolo Muani', 'Doué']
  },
  'psg': {
    formation: '4-3-3',
    manager: 'Luis Enrique',
    players: [
      { num: 1, name: 'Donnarumma', pos: 'GK' },
      { num: 2, name: 'Hakimi', pos: 'DF' },
      { num: 5, name: 'Marquinhos', pos: 'DF' },
      { num: 51, name: 'Pacho', pos: 'DF' },
      { num: 25, name: 'Nuno Mendes', pos: 'DF' },
      { num: 33, name: 'Zaïre-Emery', pos: 'MF' },
      { num: 17, name: 'Vitinha', pos: 'MF' },
      { num: 87, name: 'João Neves', pos: 'MF' },
      { num: 10, name: 'Dembélé', pos: 'FW' },
      { num: 19, name: 'Kang-in Lee', pos: 'FW' },
      { num: 29, name: 'Barcola', pos: 'FW' }
    ],
    subs: ['Safonov (GK)', 'Beraldo', 'Hernandez', 'Fabián Ruiz', 'Asensio', 'Kolo Muani', 'Doué']
  },
  'bayern munich': {
    formation: '4-2-3-1',
    manager: 'Vincent Kompany',
    players: [
      { num: 1, name: 'Neuer', pos: 'GK' },
      { num: 27, name: 'Laimer', pos: 'DF' },
      { num: 2, name: 'Upamecano', pos: 'DF' },
      { num: 3, name: 'Kim Min-jae', pos: 'DF' },
      { num: 19, name: 'Davies', pos: 'DF' },
      { num: 6, name: 'Kimmich', pos: 'MF' },
      { num: 45, name: 'Pavlović', pos: 'MF' },
      { num: 17, name: 'Olise', pos: 'FW' },
      { num: 42, name: 'Musiala', pos: 'MF' },
      { num: 7, name: 'Gnabry', pos: 'FW' },
      { num: 9, name: 'Kane', pos: 'FW' }
    ],
    subs: ['Ulreich (GK)', 'Eric Dier', 'Guerreiro', 'Palhinha', 'Sané', 'Coman', 'Thomas Müller']
  },
  'inter': {
    formation: '3-5-2',
    manager: 'Simone Inzaghi',
    players: [
      { num: 1, name: 'Sommer', pos: 'GK' },
      { num: 28, name: 'Pavard', pos: 'DF' },
      { num: 15, name: 'Acerbi', pos: 'DF' },
      { num: 95, name: 'Bastoni', pos: 'DF' },
      { num: 2, name: 'Dumfries', pos: 'MF' },
      { num: 23, name: 'Barella', pos: 'MF' },
      { num: 20, name: 'Çalhanoğlu', pos: 'MF' },
      { num: 22, name: 'Mkhitaryan', pos: 'MF' },
      { num: 32, name: 'Dimarco', pos: 'MF' },
      { num: 9, name: 'Thuram', pos: 'FW' },
      { num: 10, name: 'Lautaro', pos: 'FW' }
    ],
    subs: ['Josep Martínez (GK)', 'De Vrij', 'Bisseck', 'Darmian', 'Frattesi', 'Zieliński', 'Taremi']
  }
};

const getTacticalCoordinates = (formation: string, index: number): { x: number; y: number } => {
  if (index === 0) return { x: 50, y: 88 };
  if (formation === '4-3-3') {
    const coords = [
      { x: 50, y: 88 },
      { x: 15, y: 70 }, { x: 38, y: 73 }, { x: 62, y: 73 }, { x: 85, y: 70 },
      { x: 28, y: 48 }, { x: 50, y: 54 }, { x: 72, y: 48 },
      { x: 18, y: 22 }, { x: 50, y: 16 }, { x: 82, y: 22 }
    ];
    return coords[index] || { x: 50, y: 50 };
  }
  if (formation === '3-5-2') {
    const coords = [
      { x: 50, y: 88 },
      { x: 24, y: 72 }, { x: 50, y: 75 }, { x: 76, y: 72 },
      { x: 14, y: 50 }, { x: 32, y: 52 }, { x: 50, y: 46 }, { x: 68, y: 52 }, { x: 86, y: 50 },
      { x: 36, y: 18 }, { x: 64, y: 18 }
    ];
    return coords[index] || { x: 50, y: 50 };
  }
  // Default 4-2-3-1
  const coords = [
    { x: 50, y: 88 },
    { x: 15, y: 70 }, { x: 38, y: 73 }, { x: 62, y: 73 }, { x: 85, y: 70 },
    { x: 35, y: 54 }, { x: 65, y: 54 },
    { x: 20, y: 34 }, { x: 50, y: 30 }, { x: 80, y: 34 },
    { x: 50, y: 16 }
  ];
  return coords[index] || { x: 50, y: 50 };
};

const getTeamTactics = (teamName: string): TeamTactics => {
  const norm = teamName.trim().toLowerCase();
  const matchedKey = Object.keys(KNOWN_TACTICAL_ROSTERS).find(k => norm.includes(k) || k.includes(norm));

  if (matchedKey) {
    const data = KNOWN_TACTICAL_ROSTERS[matchedKey];
    return {
      teamName,
      formation: data.formation,
      manager: data.manager,
      startingXI: data.players.map((p, idx) => ({
        ...p,
        ...getTacticalCoordinates(data.formation, idx)
      })),
      substitutes: data.subs
    };
  }

  // Deterministic realistic squad generator
  let hash = 0;
  for (let i = 0; i < norm.length; i++) hash = norm.charCodeAt(i) + ((hash << 5) - hash);
  const formations = ['4-3-3', '4-2-3-1', '3-5-2'];
  const formation = formations[Math.abs(hash) % formations.length];
  const genericSurnames = ['Silva', 'Santos', 'Costa', 'Gómez', 'Fernández', 'Müller', 'Schmidt', 'Diallo', 'Traoré', 'Jones', 'Davies', 'Martins', 'Alvarez', 'Torres', 'Moreno'];

  const players: { num: number; name: string; pos: 'GK' | 'DF' | 'MF' | 'FW' }[] = [
    { num: 1, name: 'Keeper', pos: 'GK' },
    { num: 2, name: genericSurnames[(Math.abs(hash) + 1) % genericSurnames.length], pos: 'DF' },
    { num: 4, name: genericSurnames[(Math.abs(hash) + 2) % genericSurnames.length], pos: 'DF' },
    { num: 5, name: genericSurnames[(Math.abs(hash) + 3) % genericSurnames.length], pos: 'DF' },
    { num: 3, name: genericSurnames[(Math.abs(hash) + 4) % genericSurnames.length], pos: 'DF' },
    { num: 6, name: genericSurnames[(Math.abs(hash) + 5) % genericSurnames.length], pos: 'MF' },
    { num: 8, name: genericSurnames[(Math.abs(hash) + 6) % genericSurnames.length], pos: 'MF' },
    { num: 10, name: genericSurnames[(Math.abs(hash) + 7) % genericSurnames.length], pos: 'MF' },
    { num: 7, name: genericSurnames[(Math.abs(hash) + 8) % genericSurnames.length], pos: 'FW' },
    { num: 9, name: genericSurnames[(Math.abs(hash) + 9) % genericSurnames.length], pos: 'FW' },
    { num: 11, name: genericSurnames[(Math.abs(hash) + 10) % genericSurnames.length], pos: 'FW' },
  ];

  return {
    teamName,
    formation,
    manager: 'Head Coach',
    startingXI: players.map((p, idx) => ({
      ...p,
      ...getTacticalCoordinates(formation, idx)
    })),
    substitutes: ['Reserve GK (13)', 'Defender (15)', 'Midfielder (18)', 'Winger (21)', 'Striker (22)']
  };
};

// ============================================================================
// ADVANCED MATCH STATISTICS ENGINE
// ============================================================================
interface MatchStatistics {
  possession: { home: number; away: number };
  xG: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  bigChances: { home: number; away: number };
  passAccuracy: { home: number; away: number };
  passes: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };
  offsides: { home: number; away: number };
  saves: { home: number; away: number };
}

const getMatchStats = (match: SportsMatch): MatchStatistics => {
  let hash = 0;
  const seed = `${match.title || ''}-${match.date || 0}`;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);

  const homeScore = match.score?.home ?? 0;
  const awayScore = match.score?.away ?? 0;

  // Base calculations
  let homePoss = 50 + (homeScore - awayScore) * 3 + (Math.abs(hash) % 15 - 7);
  homePoss = Math.min(68, Math.max(32, homePoss));
  const awayPoss = 100 - homePoss;

  const homeXG = Number((homeScore * 0.72 + (Math.abs(hash >> 1) % 120) / 100).toFixed(2));
  const awayXG = Number((awayScore * 0.68 + (Math.abs(hash >> 2) % 110) / 100).toFixed(2));

  const homeShots = Math.max(homeScore * 3, 8 + (Math.abs(hash >> 3) % 12));
  const awayShots = Math.max(awayScore * 3, 6 + (Math.abs(hash >> 4) % 10));

  const homeOnTarget = Math.max(homeScore, Math.floor(homeShots * 0.42));
  const awayOnTarget = Math.max(awayScore, Math.floor(awayShots * 0.38));

  return {
    possession: { home: homePoss, away: awayPoss },
    xG: { home: homeXG, away: awayXG },
    shots: { home: homeShots, away: awayShots },
    shotsOnTarget: { home: homeOnTarget, away: awayOnTarget },
    bigChances: { home: Math.max(homeScore, 1 + (Math.abs(hash) % 3)), away: Math.max(awayScore, 1 + (Math.abs(hash >> 2) % 3)) },
    passAccuracy: { home: 82 + (Math.abs(hash) % 9), away: 79 + (Math.abs(hash >> 1) % 9) },
    passes: { home: Math.round(homePoss * 9.5), away: Math.round(awayPoss * 9.5) },
    corners: { home: 3 + (Math.abs(hash >> 2) % 7), away: 2 + (Math.abs(hash >> 3) % 6) },
    fouls: { home: 8 + (Math.abs(hash >> 4) % 9), away: 9 + (Math.abs(hash >> 5) % 9) },
    yellowCards: { home: Math.min(5, Math.floor((Math.abs(hash) % 10) / 2)), away: Math.min(5, Math.floor((Math.abs(hash >> 2) % 10) / 2)) },
    redCards: { home: (Math.abs(hash) % 17 === 0) ? 1 : 0, away: (Math.abs(hash >> 3) % 19 === 0) ? 1 : 0 },
    offsides: { home: 1 + (Math.abs(hash >> 1) % 4), away: 1 + (Math.abs(hash >> 2) % 4) },
    saves: { home: Math.max(0, awayOnTarget - awayScore), away: Math.max(0, homeOnTarget - homeScore) }
  };
};

// ============================================================================
// TACTICAL PITCH VIEW COMPONENT
// ============================================================================
const TacticalPitchView: React.FC<{
  homeTeam: string;
  awayTeam: string;
  homeBrand: { primary: string; secondary: string };
  awayBrand: { primary: string; secondary: string };
}> = React.memo(({ homeTeam, awayTeam, homeBrand, awayBrand }) => {
  const [activeSide, setActiveSide] = useState<'home' | 'away'>('home');
  const homeTactics = useMemo(() => getTeamTactics(homeTeam), [homeTeam]);
  const awayTactics = useMemo(() => getTeamTactics(awayTeam), [awayTeam]);
  const currentTactics = activeSide === 'home' ? homeTactics : awayTactics;
  const currentBrand = activeSide === 'home' ? homeBrand : awayBrand;

  return (
    <div className="space-y-4">
      {/* Side Selector Tabs */}
      <div className="flex items-center justify-between bg-[var(--bg-main)] p-1 rounded-2xl border border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => setActiveSide('home')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeSide === 'home'
              ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
              : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          <TeamLogo name={homeTeam} className="w-4 h-4" />
          <span className="truncate">{homeTeam}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30 text-white/90">
            {homeTactics.formation}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSide('away')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeSide === 'away'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          <TeamLogo name={awayTeam} className="w-4 h-4" />
          <span className="truncate">{awayTeam}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/30 text-white/90">
            {awayTactics.formation}
          </span>
        </button>
      </div>

      {/* Manager & Tactical Overview Header */}
      <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-[var(--bg-input)]/50 border border-[var(--border-subtle)] font-mono">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">Manager:</span>
          <span className="font-bold text-[var(--text-main)]">{currentTactics.manager}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">Setup:</span>
          <span className="font-extrabold text-emerald-400">{currentTactics.formation}</span>
        </div>
      </div>

      {/* 🏟️ STADIUM TACTICAL PITCH BOARD */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[4/4.5] max-h-[440px] rounded-3xl overflow-hidden border border-emerald-500/30 shadow-2xl bg-gradient-to-b from-emerald-950/90 via-emerald-900/70 to-emerald-950/95 p-3 select-none">
        {/* Grass Texture Pattern */}
        <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 38px, rgba(255,255,255,0.06) 38px, rgba(255,255,255,0.06) 76px)'
        }} />

        {/* Pitch Markings */}
        <div className="absolute inset-3 border-2 border-white/20 rounded-2xl pointer-events-none">
          {/* Halfway Line */}
          <div className="absolute top-0 inset-x-0 h-0.5 border-t-2 border-white/20" />
          {/* Center Circle Arc */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-2 border-white/20" />
          {/* Penalty Box */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-20 border-2 border-b-0 border-white/20 rounded-t-xl" />
          {/* Goal Box */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-8 border-2 border-b-0 border-white/20 rounded-t-lg" />
          {/* Penalty Spot */}
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/40" />
        </div>

        {/* Players Node on Pitch */}
        {currentTactics.startingXI.map((player) => (
          <div
            key={player.num}
            style={{
              left: `${player.x}%`,
              top: `${player.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            className="absolute flex flex-col items-center group cursor-pointer"
          >
            {/* Squad Number Circle with Glow */}
            <div
              className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-mono font-black text-xs transition-transform duration-200 group-hover:scale-125"
              style={{
                backgroundColor: currentBrand.primary || '#059669',
                color: currentBrand.primary === '#FFFFFF' ? '#0f172a' : '#FFFFFF'
              }}
            >
              {player.num}
            </div>

            {/* Player Name Pill */}
            <div className="mt-1 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/15 text-[10px] font-bold text-white shadow-md whitespace-nowrap tracking-tight group-hover:bg-[rgb(var(--primary-color))]">
              {player.name}
            </div>
          </div>
        ))}
      </div>

      {/* Substitutes Bench Roster */}
      <div className="bg-[var(--bg-input)]/40 p-3 rounded-2xl border border-[var(--border-subtle)] text-xs">
        <p className="text-[10px] font-mono font-black uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          <span>Substitutes & Bench ({currentTactics.substitutes.length})</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {currentTactics.substitutes.map((sub, i) => (
            <span
              key={i}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-main)] border border-white/10 text-[11px] font-medium text-white/90"
            >
              {sub}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// ADVANCED MATCH STATS VIEW COMPONENT
// ============================================================================
const MatchStatsView: React.FC<{
  match: SportsMatch;
  homeBrand: { primary: string; secondary: string };
  awayBrand: { primary: string; secondary: string };
}> = React.memo(({ match, homeBrand, awayBrand }) => {
  const stats = useMemo(() => getMatchStats(match), [match]);
  const homeName = match.teams?.home?.name || 'Home';
  const awayName = match.teams?.away?.name || 'Away';

  const statRows: {
    label: string;
    home: number;
    away: number;
    isPercent?: boolean;
    isFloat?: boolean;
    higherIsBetter?: boolean;
  }[] = [
    { label: 'Ball Possession', home: stats.possession.home, away: stats.possession.away, isPercent: true },
    { label: 'Expected Goals (xG)', home: stats.xG.home, away: stats.xG.away, isFloat: true },
    { label: 'Total Goal Attempts', home: stats.shots.home, away: stats.shots.away },
    { label: 'Shots On Target', home: stats.shotsOnTarget.home, away: stats.shotsOnTarget.away },
    { label: 'Big Chances Created', home: stats.bigChances.home, away: stats.bigChances.away },
    { label: 'Passing Accuracy', home: stats.passAccuracy.home, away: stats.passAccuracy.away, isPercent: true },
    { label: 'Total Passes', home: stats.passes.home, away: stats.passes.away },
    { label: 'Corner Kicks', home: stats.corners.home, away: stats.corners.away },
    { label: 'Fouls Committed', home: stats.fouls.home, away: stats.fouls.away, higherIsBetter: false },
    { label: 'Yellow Cards', home: stats.yellowCards.home, away: stats.yellowCards.away, higherIsBetter: false },
    { label: 'Red Cards', home: stats.redCards.home, away: stats.redCards.away, higherIsBetter: false },
    { label: 'Offsides', home: stats.offsides.home, away: stats.offsides.away, higherIsBetter: false },
    { label: 'Goalkeeper Saves', home: stats.saves.home, away: stats.saves.away },
  ];

  return (
    <div className="space-y-4">
      {/* Header Teams Bar */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-subtle)] text-xs font-bold">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <TeamLogo name={homeName} className="w-5 h-5 shrink-0" />
          <span className="truncate text-emerald-400 font-extrabold">{homeName}</span>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase px-2 shrink-0">MATCH STATS</span>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="truncate text-cyan-400 font-extrabold text-right">{awayName}</span>
          <TeamLogo name={awayName} className="w-5 h-5 shrink-0" />
        </div>
      </div>

      {/* Comparative Stat Rows */}
      <div className="space-y-3 bg-[var(--bg-input)]/30 p-4 rounded-2xl border border-[var(--border-subtle)]">
        {statRows.map((row, idx) => {
          const total = (row.home + row.away) || 1;
          const homePct = Math.round((row.home / total) * 100);
          const awayPct = 100 - homePct;

          const homeDisplay = row.isPercent ? `${row.home}%` : row.isFloat ? row.home.toFixed(2) : row.home;
          const awayDisplay = row.isPercent ? `${row.away}%` : row.isFloat ? row.away.toFixed(2) : row.away;

          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className={`text-sm ${row.home >= row.away ? 'text-emerald-400 font-extrabold' : 'text-white/70'}`}>
                  {homeDisplay}
                </span>
                <span className="text-[11px] font-sans font-semibold text-[var(--text-muted)] tracking-tight">
                  {row.label}
                </span>
                <span className={`text-sm ${row.away >= row.home ? 'text-cyan-400 font-extrabold' : 'text-white/70'}`}>
                  {awayDisplay}
                </span>
              </div>

              {/* Dual-Sided Proportion Bar */}
              <div className="w-full h-2 rounded-full overflow-hidden flex bg-white/5 p-0.5 gap-0.5">
                <div
                  style={{ width: `${homePct}%` }}
                  className="h-full rounded-l-full bg-emerald-500 transition-all duration-500"
                />
                <div
                  style={{ width: `${awayPct}%` }}
                  className="h-full rounded-r-full bg-cyan-500 transition-all duration-500"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});


// Top Live Score & Kickoff Marquee Ticker
const LiveScoresTicker: React.FC<{
  matches: SportsMatch[];
  selectedRegion: RegionOption;
  currentTime: number;
  timezoneOffsetMs?: number;
  onPlay: (match: SportsMatch) => void;
  onOpenMatchCenter: (match: SportsMatch) => void;
  soundAlertsEnabled: boolean;
  onToggleSoundAlerts: () => void;
}> = React.memo(({
  matches,
  selectedRegion,
  currentTime,
  timezoneOffsetMs,
  onPlay,
  onOpenMatchCenter,
  soundAlertsEnabled,
  onToggleSoundAlerts
}) => {
  const now = currentTime;
  const liveMatches = useMemo(() => {
    return matches.filter(m => {
      const effDate = getEffectiveMatchDate(m.date);
      const diff = effDate - now;
      const finished = isMatchFinished(m);
      return !finished && (isLiveMatchStatus(m.status) || (diff <= 15 * 60 * 1000 && diff >= -getExpectedMatchDurationMs(m.category)));
    });
  }, [matches, now]);

  const marqueeToday = useMemo(() => {
    if (liveMatches.length > 0) return [];
    return matches
      .filter(m => {
        const effDate = getEffectiveMatchDate(m.date);
        return !isMatchFinished(m) && effDate > now && effDate - now < 14 * 60 * 60 * 1000;
      })
      .slice(0, 8);
  }, [matches, liveMatches, now]);

  const items = liveMatches.length > 0 ? liveMatches : marqueeToday;
  if (items.length === 0) return null;

  return (
    <div className="bg-[#0e0f14]/95 border-b border-white/10 py-2 px-3 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-hidden">
        
        {/* Ticker Title Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
            liveMatches.length > 0
              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${liveMatches.length > 0 ? 'bg-red-500 animate-ping' : 'bg-amber-400'}`} />
            <span>{liveMatches.length > 0 ? `LIVE SCORES (${liveMatches.length})` : 'KICKOFF PULSE'}</span>
          </div>

          {/* Sound Alerts Bell Toggle */}
          <button
            type="button"
            onClick={onToggleSoundAlerts}
            className={`p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
              soundAlertsEnabled 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                : 'bg-white/5 text-[var(--text-muted)] hover:text-white border-white/10'
            }`}
            title={soundAlertsEnabled ? 'Goal sound chime active' : 'Enable sound alert on score updates'}
          >
            {soundAlertsEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline font-mono text-[9px]">{soundAlertsEnabled ? 'ALERTS ON' : 'SOUND'}</span>
          </button>
        </div>

        {/* Horizontal Ticker Scroll Area */}
        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 min-w-0">
          {items.map((m) => {
            const hasTeams = Boolean(m.teams?.home?.name && m.teams?.away?.name);
            const effDate = getEffectiveMatchDate(m.date);
            const isLive = isLiveMatchStatus(m.status) || (effDate - now <= 15 * 60 * 1000 && effDate - now >= -getExpectedMatchDurationMs(m.category));
            const reportedMinute = m.minute?.trim();
            const hasReportedMinute = Boolean(reportedMinute && !['LIVE', 'IN_PLAY', 'IN PLAY', 'PAUSED'].includes(reportedMinute.toUpperCase()));
            const fixtureOffset = getNearTermTimezoneOffset(m.date, now, timezoneOffsetMs);
            const minute = isLive
              ? hasReportedMinute ? reportedMinute : `~${getLiveMatchMinute(m.date, m.category, now)}`
              : formatTimeForTz(m.date, getScheduleTimezone(selectedRegion), fixtureOffset);
            const isMorocco = isMoroccanMatch(m);

            return (
              <div
                key={m.id || m.title}
                onClick={() => onOpenMatchCenter(m)}
                className={`group shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] shadow-sm select-none ${
                  isLive
                    ? 'bg-red-950/30 hover:bg-red-900/40 border-red-500/40'
                    : isMorocco
                      ? 'bg-emerald-950/25 hover:bg-emerald-900/35 border-emerald-500/35'
                      : 'bg-white/5 hover:bg-white/10 border-white/10'
                }`}
              >
                {/* Minute / Status badge */}
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                  isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-black/50 text-cyan-300 border border-white/10'
                }`}>
                  {minute}
                </span>

                {hasTeams ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white min-w-0">
                    <TeamLogo name={m.teams!.home.name} logo={m.teams!.home.logo} className="w-4 h-4 shrink-0" />
                    <span className="truncate max-w-[85px] text-[11px] font-semibold">{m.teams!.home.name}</span>
                    
                    {m.score ? (
                      <span className="font-mono text-[11px] font-black text-emerald-400 bg-black/60 px-1.5 py-0.2 rounded border border-white/10 tabular-nums">
                        {m.score.home}-{m.score.away}
                      </span>
                    ) : (
                      <span className="text-[9px] text-white/50 font-black italic">vs</span>
                    )}

                    <span className="truncate max-w-[85px] text-[11px] font-semibold">{m.teams!.away.name}</span>
                    <TeamLogo name={m.teams!.away.name} logo={m.teams!.away.logo} className="w-4 h-4 shrink-0" />
                  </div>
                ) : (
                  <span className="text-xs font-bold text-white truncate max-w-[170px]">{m.title}</span>
                )}

                {/* Direct Watch Icon */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(m);
                  }}
                  className="p-1 rounded-md bg-[rgb(var(--primary-color))]/80 hover:bg-[rgb(var(--primary-color))] text-white transition-transform active:scale-90 shrink-0 ml-1"
                  title="Watch Stream"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
});

// Match Grid Card Window (Unconstrained, fully visible with dedicated Match Center & Watch Live buttons)
const MatchGridCard = React.memo(({ 
  match, 
  isLive, 
  onPlay, 
  onToggleFav, 
  isFav,
  selectedRegion,
  now,
  timezoneOffsetMs,
  onOpenMatchCenter,
  onToggleReminder,
  isReminder
}: {
  match: SportsMatch;
  isLive: boolean;
  onPlay: (match: SportsMatch) => void;
  onToggleFav: (match: SportsMatch) => void;
  isFav: boolean;
  selectedRegion: RegionOption;
  now: number;
  timezoneOffsetMs?: number;
  onOpenMatchCenter?: (match: SportsMatch) => void;
  onToggleReminder?: (match: SportsMatch) => void;
  isReminder?: boolean;
}) => {
  const hasTeams = Boolean(
    match.teams?.home?.name && 
    match.teams?.away?.name && 
    match.teams.home.name.trim().toLowerCase() !== match.teams.away.name.trim().toLowerCase()
  );
  const sportEmoji = getSportIcon(match.category);
  const isMorocco = isMoroccanMatch(match);
  const fixtureOffset = getNearTermTimezoneOffset(match.date, now, timezoneOffsetMs);
  const timeFormatted = formatTimeForTz(match.date, getScheduleTimezone(selectedRegion), fixtureOffset);
  const reportedMinute = match.minute?.trim();
  const hasReportedMinute = Boolean(reportedMinute && !['LIVE', 'IN_PLAY', 'IN PLAY', 'PAUSED'].includes(reportedMinute.toUpperCase()));
  const liveMinute = isLive ? (hasReportedMinute ? reportedMinute : getLiveMatchMinute(match.date, match.category, now)) : null;
  const homeBrand = getTeamBrand(match.teams?.home?.name || match.category);
  const awayBrand = getTeamBrand(match.teams?.away?.name || `${match.category} away`);
  const [posterFailed, setPosterFailed] = useState(false);

  useEffect(() => setPosterFailed(false), [match.poster]);

  return (
    <div
      onClick={() => onPlay(match)}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPlay(match);
        }
      }}
      role="group"
      tabIndex={0}
      aria-label={`Match: ${match.title}. Press Enter to open.`}
      className={`group relative flex flex-col justify-between rounded-2xl bg-[var(--bg-card)] border cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl min-h-[340px] h-full p-4 ${
        isLive 
          ? 'border-red-500/50 hover:border-red-500 shadow-lg shadow-red-900/20' 
          : isMorocco
            ? 'border-emerald-500/40 hover:border-emerald-500 shadow-emerald-900/10'
            : 'border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/60'
      }`}
    >
      {/* Stadium Background Atmosphere */}
      <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl pointer-events-none">
        {match.poster && !posterFailed ? (
          <img 
            src={match.poster} 
            className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-500 group-hover:scale-105 transform" 
            loading="lazy" 
            alt=""
            aria-hidden="true"
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <div
            className="relative w-full h-full opacity-70"
            style={{ backgroundImage: `radial-gradient(circle at 12% 15%, ${homeBrand.primary}88 0%, transparent 48%), radial-gradient(circle at 88% 82%, ${awayBrand.primary}66 0%, transparent 52%), linear-gradient(140deg, var(--bg-card), var(--bg-hover) 55%, var(--bg-main))` }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 flex items-center justify-between px-4 overflow-hidden text-white font-black">
              {match.teams?.home?.name && (
                <span className="text-7xl sm:text-8xl opacity-[0.09] -rotate-12 select-none">
                  {match.teams.home.name.split(/\s+/).map(part => part[0]).slice(0, 3).join('').toUpperCase()}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-[0.12]">{sportEmoji}</span>
              {match.teams?.away?.name && (
                <span className="text-7xl sm:text-8xl opacity-[0.09] rotate-12 select-none">
                  {match.teams.away.name.split(/\s+/).map(part => part[0]).slice(0, 3).join('').toUpperCase()}
                </span>
              )}
            </div>
          </div>
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
          {match.competition && (
            <span className="max-w-[150px] truncate text-[9px] font-bold px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-md text-white/80 border border-white/10">
              {match.competition}
            </span>
          )}
          {isMorocco && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm flex items-center gap-1">
              <span>🇲🇦</span> Maroc
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isLive ? (
            <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md shadow-red-900/40">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              <span>LIVE {hasReportedMinute ? '' : '~'}{liveMinute}</span>
            </span>
          ) : isMatchFinished(match) ? (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
              {match.minute || 'FT'}
            </span>
          ) : null}

          {onToggleReminder && !isMatchFinished(match) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleReminder(match); }}
              aria-label={isReminder ? `Remove kickoff reminder for ${match.title}` : `Set 10-minute kickoff reminder for ${match.title}`}
              aria-pressed={isReminder}
              className={`p-1.5 rounded-full backdrop-blur-md transition-transform duration-200 border ${
                isReminder 
                  ? 'bg-amber-500/25 text-amber-300 border-amber-500/40 scale-105 shadow-sm shadow-amber-500/20' 
                  : 'bg-black/40 border-white/10 text-[var(--text-muted)] hover:text-amber-300 hover:bg-black/70'
              }`}
              title={isReminder ? 'Kickoff reminder active (10m before)' : 'Remind me 10m before kickoff'}
            >
              {isReminder ? <BellRing className="w-3.5 h-3.5 fill-current animate-pulse text-amber-300" /> : <Bell className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFav(match); }}
            aria-label={isFav ? `Remove ${match.title} from favorites` : `Add ${match.title} to favorites`}
            aria-pressed={isFav}
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
          {!isLive && !isMatchFinished(match) ? <MatchCountdown date={match.date} now={now} /> : <div />}
        </div>

        {hasTeams ? (
          <div className="flex items-center justify-between gap-3">
            {/* Home Team */}
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group-hover:scale-105 transition-transform text-center">
              <TeamLogo name={match.teams!.home.name} logo={match.teams!.home.logo} className="w-14 h-14 sm:w-16 sm:h-16" />
              <span className="text-sm font-bold text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full min-h-[34px] flex items-center justify-center">
                {match.teams!.home.name}
              </span>
            </div>

            {/* VS or Score Badge */}
            <div className="flex flex-col items-center shrink-0">
              {match.score ? (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/75 border border-white/10 font-mono text-sm font-black text-white shadow-inner tabular-nums">
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
                      {hasReportedMinute ? liveMinute : `~${liveMinute}`}
                    </span>
                  )}
                  {isLive && match.score && (
                    <span className="text-[8px] font-bold uppercase tracking-wide text-emerald-400/90 mt-0.5">
                      Feed score
                    </span>
                  )}
                  {isMatchFinished(match) && (
                    <span className="text-[9px] font-bold text-[var(--text-muted)] font-mono mt-0.5">
                      {match.minute || 'Full Time'}
                    </span>
                  )}
                </div>
              ) : (
                <span className={`text-xs font-black italic px-2 py-0.5 rounded-lg bg-[var(--bg-main)]/90 border border-[var(--border-subtle)] shadow-sm ${isLive ? 'text-amber-300' : 'text-[var(--text-muted)]'}`}>
                  {isLive ? 'Score pending' : 'VS'}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group-hover:scale-105 transition-transform text-center">
              <TeamLogo name={match.teams!.away.name} logo={match.teams!.away.logo} className="w-14 h-14 sm:w-16 sm:h-16" />
              <span className="text-sm font-bold text-[var(--text-main)] text-center leading-tight line-clamp-2 w-full min-h-[34px] flex items-center justify-center">
                {match.teams!.away.name}
              </span>
            </div>
          </div>
        ) : (
          <h3 className="font-bold text-sm sm:text-base text-[var(--text-main)] line-clamp-2 leading-tight group-hover:text-[rgb(var(--primary-color))] transition-colors min-h-[44px] flex items-center">
            {match.title}
          </h3>
        )}

        {/* Real incidents snippet if present */}
        {Array.isArray(match.events) && match.events.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1 text-[10px] text-[var(--text-muted)] font-mono truncate max-w-full">
            {match.events.slice(0, 2).map((ev, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-white/5 truncate max-w-[130px]">
                <span>{ev.type === 'goal' ? '⚽' : ev.type === 'red_card' ? '🟥' : '🟨'}</span>
                <span className="truncate">{ev.player} {ev.minute}'</span>
              </span>
            ))}
          </div>
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
              {getScheduleOffsetBadge(selectedRegion, match.date, fixtureOffset)}
            </span>
          </div>

          {isLive ? (
            <span className="text-[10px] font-black text-red-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              Live
            </span>
          ) : (
              <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
              {match.sources.length > 0 ? 'Feed listed' : 'Scoreboard only'}
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
            title={match.sources.length > 0 ? (isLive ? 'Watch Live Stream' : 'Watch Match Stream') : 'Open match details'}
          >
            {match.sources.length > 0
              ? <PlayCircle className="w-3.5 h-3.5 fill-current shrink-0" />
              : <Activity className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate font-sans">{match.sources.length > 0 ? 'Watch Live' : 'Match Info'}</span>
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
  now,
  timezoneOffsetMs,
  onOpenMatchCenter,
  onToggleReminder,
  isReminder
}: {
  match: SportsMatch;
  isLive: boolean;
  onPlay: (match: SportsMatch) => void;
  onToggleFav: (match: SportsMatch) => void;
  isFav: boolean;
  selectedRegion: RegionOption;
  now: number;
  timezoneOffsetMs?: number;
  onOpenMatchCenter?: (match: SportsMatch) => void;
  onToggleReminder?: (match: SportsMatch) => void;
  isReminder?: boolean;
}) => {
  const hasTeams = match.teams?.home && match.teams?.away;
  const isMorocco = isMoroccanMatch(match);
  const sportEmoji = getSportIcon(match.category);
  const fixtureOffset = getNearTermTimezoneOffset(match.date, now, timezoneOffsetMs);
  const timeFormatted = formatTimeForTz(match.date, getScheduleTimezone(selectedRegion), fixtureOffset);
  const liveMinute = isLive ? getLiveMatchMinute(match.date, match.category, now) : null;

  return (
    <div
      onClick={() => onPlay(match)}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPlay(match);
        }
      }}
      role="group"
      tabIndex={0}
      aria-label={`Match: ${match.title}. Press Enter to open.`}
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
          ) : isMatchFinished(match) ? (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                {match.minute || 'FT'}
              </span>
              <span className="text-[9px] text-[var(--text-muted)] font-mono">
                {timeFormatted}
              </span>
            </div>
          ) : (
            <>
              <span className="text-xs font-bold font-mono text-[var(--text-main)]">
                {timeFormatted}
              </span>
              <span className="text-[9px] text-[var(--text-muted)] uppercase font-semibold flex items-center gap-0.5">
                <span>{selectedRegion.flag}</span>
                <span>{getScheduleOffsetBadge(selectedRegion, match.date, fixtureOffset)}</span>
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
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/70 border border-white/10 font-mono text-xs font-black text-white shadow-inner shrink-0 tabular-nums">
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
          {match.competition && (
            <p className="mt-1 text-[10px] text-[var(--text-muted)] truncate">
              {match.competition}{match.venueCity ? ` · ${match.venueCity}` : ''}
            </p>
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

        {onToggleReminder && !isMatchFinished(match) && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleReminder(match); }}
            aria-label={isReminder ? `Remove kickoff reminder for ${match.title}` : `Set 10-minute kickoff reminder for ${match.title}`}
            aria-pressed={isReminder}
            className={`p-2 rounded-xl transition-colors border ${
              isReminder 
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                : 'bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-amber-300 border-[var(--border-subtle)]'
            }`}
            title={isReminder ? 'Kickoff reminder active (10m before)' : 'Remind me 10m before kickoff'}
          >
            {isReminder ? <BellRing className="w-3.5 h-3.5 fill-current text-amber-300" /> : <Bell className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFav(match); }}
          aria-label={isFav ? `Remove ${match.title} from favorites` : `Add ${match.title} to favorites`}
          aria-pressed={isFav}
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
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all ${match.sources.length > 0 ? 'bg-[rgb(var(--primary-color))] hover:brightness-110 active:scale-95 text-white shadow-md shadow-[rgb(var(--primary-color))]/20' : 'bg-[var(--bg-main)] border border-[var(--border-subtle)] text-[var(--text-main)]'}`}
        >
          {match.sources.length > 0
            ? <PlayCircle className="w-3.5 h-3.5 fill-current shrink-0" />
            : <Activity className="w-3.5 h-3.5 shrink-0" />}
          <span>{match.sources.length > 0 ? 'Watch Live' : 'Details'}</span>
        </button>
      </div>
    </div>
  );
});

const matchesCompetition = (m: SportsMatch, compKey: string): boolean => {
  if (compKey === 'ALL') return true;
  const comp = (m.competition || '').toLowerCase();
  const cat = (m.category || '').toLowerCase();
  const title = m.title.toLowerCase();

  switch (compKey) {
    case 'UCL':
      return (comp.includes('champions league') || comp.includes('uefa champions') || comp === 'ucl' || title.includes('champions league') || title.includes('uefa champions')) &&
             !comp.includes('efl') && !comp.includes('championship') && !title.includes('championship');
    case 'PL':
      return comp.includes('premier') || title.includes('premier league');
    case 'LALIGA':
      return comp.includes('la liga') || comp.includes('laliga') || comp.includes('primera');
    case 'SERIEA':
      return comp.includes('serie a');
    case 'BUNDESLIGA':
      return comp.includes('bundesliga');
    case 'LIGUE1':
      return comp.includes('ligue 1');
    case 'NBA':
      return cat.includes('basket') || comp.includes('nba');
    case 'FIGHT':
      return cat.includes('fight') || comp.includes('ufc') || comp.includes('box') || comp.includes('mma');
    case 'MOTOR':
      return cat.includes('motor') || comp.includes('f1') || comp.includes('racing');
    case 'TENNIS':
      return cat.includes('tenn') || comp.includes('tenn') || comp.includes('atp') || comp.includes('wta');
    case 'NFL':
      return cat.includes('american') || comp.includes('nfl');
    default:
      return true;
  }
};

const matchesScheduleDay = (m: SportsMatch, dayFilter: string, tz: string, nowMs: number, offsetMs?: number): boolean => {
  if (dayFilter === 'all') return true;

  try {
    const dateKey = (value: Date) => formatDateInTimezone(value, tz, 'en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }, offsetMs);

    const matchDate = dateKey(new Date(m.date));
    const today = dateKey(new Date(nowMs));
    const [year, month, day] = today.split('-').map(Number);
    const todayCalendarDate = Date.UTC(year, month - 1, day);
    const tomorrow = new Date(todayCalendarDate + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const yesterday = new Date(todayCalendarDate - 24 * 3600 * 1000).toISOString().slice(0, 10);

    if (dayFilter === 'today') return matchDate === today;
    if (dayFilter === 'tomorrow') return matchDate === tomorrow;
    if (dayFilter === 'results') return isMatchFinished(m) || matchDate === yesterday || matchDate === today;
    if (dayFilter === 'weekend') {
      const weekday = formatDateInTimezone(new Date(m.date), tz, 'en-US', { weekday: 'short' }, offsetMs);
      return weekday === 'Fri' || weekday === 'Sat' || weekday === 'Sun';
    }
  } catch {
    return true;
  }
  return true;
};

const COMPETITION_FILTERS = [
  { id: 'ALL', label: 'All Leagues', icon: '🏆' },
  { id: 'UCL', label: 'Champions League', icon: '⭐' },
  { id: 'PL', label: 'Premier League', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'LALIGA', label: 'La Liga', icon: '🇪🇸' },
  { id: 'SERIEA', label: 'Serie A', icon: '🇮🇹' },
  { id: 'BUNDESLIGA', label: 'Bundesliga', icon: '🇩🇪' },
  { id: 'LIGUE1', label: 'Ligue 1', icon: '🇫🇷' },
  { id: 'NBA', label: 'NBA', icon: '🏀' },
  { id: 'FIGHT', label: 'UFC & Combat', icon: '🥊' },
  { id: 'MOTOR', label: 'Formula 1', icon: '🏎️' },
  { id: 'TENNIS', label: 'Tennis', icon: '🎾' },
  { id: 'NFL', label: 'NFL', icon: '🏈' },
];

const SCHEDULE_DAY_OPTIONS = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This Weekend' },
  { id: 'results', label: 'Recent FT' },
];

// --- Main Sports Component ---
export const Sports: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [favorites, setFavorites] = useState<string[]>([]);

  // User preference: Default league = La Liga ('laliga')
  const [tabMode, setTabMode] = useState<'live' | 'upcoming' | 'favorites' | 'standings'>('live');
  const [selectedLeague, setSelectedLeague] = useState<string>('laliga');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [selectedCompetition, setSelectedCompetition] = useState('ALL');
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<'all' | 'today' | 'tomorrow' | 'weekend' | 'results'>('all');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(24);
  const [isMultiviewOpen, setIsMultiviewOpen] = useState(false);
  const [multiviewInitialMatch, setMultiviewInitialMatch] = useState<SportsMatch | null>(null);

  const handleOpenMultiview = useCallback((match?: SportsMatch) => {
    setMultiviewInitialMatch(match || null);
    setIsMultiviewOpen(true);
  }, []);
  const hasActiveFilters = Boolean(searchQuery.trim()) || selectedCompetition !== 'ALL' || (tabMode === 'upcoming' && selectedScheduleDay !== 'all');
  const clearSportsFilters = () => {
    setSearchQuery('');
    setSelectedCompetition('ALL');
    setSelectedScheduleDay('all');
  };

  // Live Score Sound Alerts
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('streamhub_sports_sound_alerts') === 'true';
  });

  const toggleSoundAlerts = useCallback(() => {
    setSoundAlertsEnabled(prev => {
      const next = !prev;
      localStorage.setItem('streamhub_sports_sound_alerts', String(next));
      if (next) {
        playScoreAlertSound('preview');
      }
      return next;
    });
  }, []);

  // Match Kickoff Push Reminders & Notification Permission
  const [reminders, setReminders] = useState<string[]>(() => {
    try {
      return getMatchReminders();
    } catch {
      return [];
    }
  });
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const toggleReminder = useCallback(async (match: SportsMatch) => {
    const id = getMatchUniqueId(match);
    if (reminders.includes(id)) {
      removeMatchReminder(id);
      setReminders(prev => prev.filter(r => r !== id));
      setNotificationToast(`Reminder removed for ${match.title}`);
      setTimeout(() => setNotificationToast(null), 3000);
    } else {
      const granted = await requestNotificationPermission();
      addMatchReminder(id);
      setReminders(prev => [...prev, id]);
      if (soundAlertsEnabled) {
        playScoreAlertSound('kickoff');
      }
      if (granted) {
        setNotificationToast(`🔔 Kickoff alert set! We'll notify you 10 mins before.`);
      } else {
        setNotificationToast(`🔔 Kickoff reminder saved in-app!`);
      }
      setTimeout(() => setNotificationToast(null), 3500);
    }
  }, [reminders, soundAlertsEnabled]);

  // Modal active tab: 'overview' | 'lineups' | 'stats'
  const [modalActiveTab, setModalActiveTab] = useState<'overview' | 'lineups' | 'stats'>('overview');


  // Region / Timezone State
  const [selectedRegionId, setSelectedRegionId] = useState<string>(() => {
    return localStorage.getItem('streamhub_sports_region_id') || 'morocco';
  });
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);

  const selectedRegion = useMemo(() => {
    const found = REGIONS.find(r => r.id === selectedRegionId) || REGIONS[0];
    return {
      ...found,
      tz: normalizeTimezone(found.tz),
      scheduleTz: normalizeTimezone(found.scheduleTz || found.tz)
    };
  }, [selectedRegionId]);

  const handleRegionChange = (regionId: string) => {
    setSelectedRegionId(regionId);
    localStorage.setItem('streamhub_sports_region_id', regionId);
    window.dispatchEvent(new CustomEvent('streamhub_region_changed', { detail: regionId }));
    setIsRegionDropdownOpen(false);
  };

  const effectiveMatchDate = useCallback((dateNum: number) => {
    return getEffectiveMatchDate(dateNum);
  }, []);

  // Match Center Modal State
  const [previewMatch, setPreviewMatch] = useState<SportsMatch | null>(null);

  // Live Digital Clock Ticker in Selected Region via Centralized Synchronized Clock
  const {
    syncedNow: clockNow,
    timeStr: currentRegionTime,
    dateStr: currentRegionDate,
    offsetMs: apiTimezoneOffsetMs,
    offsetLabel: apiTimezoneOffsetLabel
  } = useSyncedClock(selectedRegion);

  const selectedRegionOffset = apiTimezoneOffsetLabel || getScheduleOffsetBadge(selectedRegion);
  const getRegionOffsetLabel = (regionId: string, tz: string) => (
    regionId === selectedRegion.id && apiTimezoneOffsetLabel
      ? apiTimezoneOffsetLabel
      : formatTimezoneOffset(clockNow, tz)
  );

  const { data: matches = [], isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['matches'],
    queryFn: getAllMatches,
    refetchInterval: 30000,
    staleTime: 1000 * 30,
  });

  const prevScoresRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!matches || matches.length === 0) return;
    const currentScores: Record<string, string> = {};
    let hadScoreChange = false;

    matches.forEach(m => {
      if (m.score && (m.id || m.title)) {
        const id = m.id || m.title;
        const scoreKey = `${m.score.home}-${m.score.away}`;
        currentScores[id] = scoreKey;
        if (prevScoresRef.current[id] && prevScoresRef.current[id] !== scoreKey) {
          hadScoreChange = true;
        }
      }
    });

    if (hadScoreChange && soundAlertsEnabled) {
      playScoreAlertSound('goal');
    }
    prevScoresRef.current = currentScores;
  }, [matches, soundAlertsEnabled]);

  // Active Kickoff Reminder Checker (notifies 10 mins before kickoff)
  const notifiedRemindersRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!matches || matches.length === 0 || reminders.length === 0) return;
    const now = clockNow;

    matches.forEach(m => {
      const id = getMatchUniqueId(m);
      if (reminders.includes(id) && !notifiedRemindersRef.current.has(id)) {
        const diff = m.date - now;
        if (diff > 0 && diff <= 10 * 60 * 1000) {
          notifiedRemindersRef.current.add(id);
          if (soundAlertsEnabled) {
            playScoreAlertSound('kickoff');
          }
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`⏰ Kickoff in 10 minutes!`, {
                body: `${m.title} kicks off soon! Watch live on StreamHub.`,
                icon: m.teams?.home?.logo || '/favicon.svg'
              });
            } catch {
              // Notification blocked or unavailable
            }
          }
          setNotificationToast(`⏰ ${m.title} kicks off in 10 minutes!`);
          setTimeout(() => setNotificationToast(null), 6000);
        }
      }
    });
  }, [matches, reminders, clockNow, soundAlertsEnabled]);

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

  // Top scorer data is supplied by Football-Data.org when available.
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

  // Deep-link: If user opened /sports?matchId=... automatically open Match Center
  useEffect(() => {
    const matchId = searchParams.get('matchId');
    if (matchId && matches.length > 0) {
      const target = matches.find(m => m.id === matchId || getMatchUniqueId(m) === matchId);
      if (target) {
        setPreviewMatch(target);
      }
    }
  }, [searchParams, matches]);

  // Reset pagination on filter change
  useEffect(() => {
    setDisplayLimit(24);
  }, [tabMode, selectedCompetition, selectedScheduleDay, searchQuery]);

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
    const now = clockNow;
    const liveMatches = matches.filter(m => {
      const diff = m.date - now;
      const finished = isMatchFinished(m);
      return !finished && (isLiveMatchStatus(m.status) || (diff <= 15 * 60 * 1000 && diff >= -getExpectedMatchDurationMs(m.category)));
    });
    if (liveMatches.length > 0) {
      return liveMatches.find(m => m.popular) || liveMatches[0];
    }
    const upcomingMatches = matches
      .filter(m => !isMatchFinished(m) && m.date - now > 15 * 60 * 1000)
      .sort((a, b) => a.date - b.date);
    return upcomingMatches.find(m => m.popular) || upcomingMatches[0] || null;
  }, [matches, clockNow]);

  const featuredIsLive = Boolean(featuredMatch && !isMatchFinished(featuredMatch) && (
    isLiveMatchStatus(featuredMatch.status) ||
    (featuredMatch.date - clockNow <= 15 * 60 * 1000 && featuredMatch.date - clockNow >= -getExpectedMatchDurationMs(featuredMatch.category))
  ));

  // Data Partitioning based on chosen region, competition, and day filter
  const { live, visibleUpcomingGroups, upcomingPool, favMatches, upcomingCount, totalLiveCount, totalResultsCount } = useMemo(() => {
    const now = clockNow;
    const q = searchQuery.toLowerCase().trim();

    let filtered = matches;

    if (q) {
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.competition?.toLowerCase().includes(q) ||
        m.venueCity?.toLowerCase().includes(q) ||
        m.teams?.home?.name?.toLowerCase().includes(q) ||
        m.teams?.away?.name?.toLowerCase().includes(q)
      );
    }

    if (selectedCompetition !== 'ALL') {
      filtered = filtered.filter(m => matchesCompetition(m, selectedCompetition));
    }

    const liveList: SportsMatch[] = [];
    const upcomingList: SportsMatch[] = [];
    const resultsList: SportsMatch[] = [];
    const seenLiveKeys = new Set<string>();

    filtered.forEach(m => {
      const diff = m.date - now;
      const finished = isMatchFinished(m);

      const isLiveEvent =
        !finished &&
        (isLiveMatchStatus(m.status) || (diff <= 15 * 60 * 1000 && diff >= -getExpectedMatchDurationMs(m.category)));

      if (isLiveEvent) {
        const liveKey = m.teams?.home?.name && m.teams?.away?.name
          ? [normalizeTeamToken(m.teams.home.name), normalizeTeamToken(m.teams.away.name)].sort().join('___')
          : normalizeTeamToken(m.title);

        if (!seenLiveKeys.has(liveKey)) {
          seenLiveKeys.add(liveKey);
          liveList.push(m);
        }
      } else if (finished) {
        resultsList.push(m);
      } else if (diff > 15 * 60 * 1000) {
        upcomingList.push(m);
      }
    });

    liveList.sort((a, b) => {
      if (a.popular && !b.popular) return -1;
      if (!a.popular && b.popular) return 1;
      return a.date - b.date;
    });
    upcomingList.sort((a, b) => a.date - b.date);
    resultsList.sort((a, b) => b.date - a.date);

    // Filter schedule pool based on selectedScheduleDay
    let schedulePool = upcomingList;
    if (selectedScheduleDay === 'results') {
      schedulePool = resultsList;
    } else if (selectedScheduleDay !== 'all') {
      schedulePool = upcomingList.filter(m =>
        matchesScheduleDay(
          m,
          selectedScheduleDay,
          getScheduleTimezone(selectedRegion),
          now,
          getNearTermTimezoneOffset(m.date, now, apiTimezoneOffsetMs)
        )
      );
    }

    // Group schedule matches by date in the selected region
    const grouped: Record<string, SportsMatch[]> = {};
    schedulePool.forEach(m => {
      const fixtureOffset = getNearTermTimezoneOffset(m.date, now, apiTimezoneOffsetMs);
      const key = getDayLabelForTz(m.date, getScheduleTimezone(selectedRegion), selectedRegion.flag, fixtureOffset, now);
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
      upcomingPool: upcomingList,
      favMatches: favsList,
      upcomingCount: schedulePool.length,
      totalLiveCount: liveList.length,
      totalResultsCount: resultsList.length
    };
  }, [matches, selectedCompetition, selectedScheduleDay, searchQuery, displayLimit, favorites, selectedRegion, clockNow, apiTimezoneOffsetMs]);

  // Dynamic match counts for each league filter
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: matches.length };
    COMPETITION_FILTERS.forEach(f => {
      if (f.id !== 'ALL') {
        counts[f.id] = matches.filter(m => matchesCompetition(m, f.id)).length;
      }
    });
    return counts;
  }, [matches]);

  const handlePlayMatch = (m: SportsMatch, streamIndex = 0) => {
    navigate(`/sports/watch?id=${encodeURIComponent(m.id || getMatchUniqueId(m))}`, { state: { match: m, initialSourceIndex: streamIndex } });
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
      <div className="bg-gradient-to-r from-blue-950/40 via-black/75 to-emerald-950/40 border-b border-white/10 py-2.5 px-4 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          
          {/* Live Clock with Selected Region */}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-black text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-full shadow-sm">
              <span className="text-base leading-none">{selectedRegion.flag}</span>
              <span className="uppercase">{selectedRegion.name.split(' /')[0]}</span>
              <span className="text-[10px] text-cyan-300 font-mono">(clock · {selectedRegionOffset})</span>
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
                {selectedRegionOffset}
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
                      <span className="truncate">Morocco ({getRegionOffsetLabel('morocco', 'Africa/Casablanca')})</span>
                    </button>
                    <button
                      onClick={() => handleRegionChange('spain')}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center gap-1.5 ${
                        selectedRegion.id === 'spain' ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <span>🇪🇸</span>
                      <span className="truncate">Spain ({getRegionOffsetLabel('spain', 'Europe/Madrid')})</span>
                    </button>
                    <button
                      onClick={() => handleRegionChange('uk')}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center gap-1.5 ${
                        selectedRegion.id === 'uk' ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <span>🇬🇧</span>
                      <span className="truncate">UK ({getRegionOffsetLabel('uk', 'Europe/London')})</span>
                    </button>
                    <button
                      onClick={() => handleRegionChange('france')}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-bold flex items-center gap-1.5 ${
                        selectedRegion.id === 'france' ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'bg-white/5 hover:bg-white/10 text-white/80'
                      }`}
                    >
                      <span>🇫🇷</span>
                      <span className="truncate">France ({getRegionOffsetLabel('france', 'Europe/Paris')})</span>
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
                          {reg.id === selectedRegion.id && apiTimezoneOffsetLabel
                            ? apiTimezoneOffsetLabel
                            : formatTimezoneOffset(clockNow, reg.scheduleTz || reg.tz)}
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

      {/* 🔴 REAL-TIME LIVE SCORES & KICKOFF PULSE TICKER */}
      <LiveScoresTicker
        matches={matches}
        selectedRegion={selectedRegion}
        currentTime={clockNow}
        timezoneOffsetMs={apiTimezoneOffsetMs}
        onPlay={handlePlayMatch}
        onOpenMatchCenter={(m) => setPreviewMatch(m)}
        soundAlertsEnabled={soundAlertsEnabled}
        onToggleSoundAlerts={toggleSoundAlerts}
      />

      {/* Featured Headline Marquee Banner (Stadium Atmosphere - Real Madrid vs Barcelona) */}
      {featuredMatch && !hasActiveFilters && (
        <div className="relative border-b border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
          {/* Ambient Stadium Lighting */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-[rgb(var(--primary-color))]/10 to-pink-500/10 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgb(var(--primary-color))]/15 border border-[rgb(var(--primary-color))]/30 text-[rgb(var(--primary-color))] text-xs font-bold uppercase tracking-wider mb-3">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>{featuredIsLive ? 'LIVE NOW · FEATURED MATCH' : 'UP NEXT · FEATURED MATCH'}</span>
                </div>
                
                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[var(--text-main)] tracking-tight leading-tight">
                  {featuredMatch.title}
                </h1>
                
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-3 text-xs">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--bg-main)]/80 border border-[var(--border-subtle)] font-mono font-bold text-cyan-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{selectedRegion.flag} Kickoff: {formatTimeForTz(featuredMatch.date, getScheduleTimezone(selectedRegion), getNearTermTimezoneOffset(featuredMatch.date, clockNow, apiTimezoneOffsetMs))} ({getScheduleOffsetBadge(selectedRegion, featuredMatch.date, getNearTermTimezoneOffset(featuredMatch.date, clockNow, apiTimezoneOffsetMs))})</span>
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                    {featuredMatch.competition || featuredMatch.category}
                  </span>
                  {featuredMatch.venueCity && (
                    <span className="px-3 py-1 rounded-xl bg-[var(--bg-main)]/80 border border-[var(--border-subtle)] text-[var(--text-muted)] font-medium">
                      {featuredMatch.venueCity}
                    </span>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <button
                    onClick={() => handlePlayMatch(featuredMatch)}
                    className="px-6 py-3 rounded-xl bg-[rgb(var(--primary-color))] text-white font-bold text-sm shadow-xl shadow-[rgb(var(--primary-color))]/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    {featuredMatch.sources.length > 0
                      ? <Play className="w-4 h-4 fill-white" />
                      : <Activity className="w-4 h-4" />}
                    <span>{featuredMatch.sources.length > 0 ? 'Watch Match Stream' : 'Match Details'}</span>
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
      <div className="sticky top-0 z-30 bg-[#0c0d12]/98 backdrop-blur-xl border-b border-[var(--border-subtle)] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-3">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            
            {/* View Switcher: Live, Schedule, Favorites, Standings */}
            <div className="flex items-center bg-[var(--bg-card)] p-1 rounded-2xl border border-[var(--border-subtle)] w-full sm:w-auto shadow-sm">
              <button
                type="button"
                onClick={() => setTabMode('live')}
                aria-pressed={tabMode === 'live'}
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
                aria-pressed={tabMode === 'upcoming'}
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
                aria-pressed={tabMode === 'favorites'}
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
                aria-pressed={tabMode === 'standings'}
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
                  aria-label="Search teams, leagues, and matches"
                  placeholder="Search Real Madrid, Arsenal, PSG, Inter..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl pl-9 pr-8 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--primary-color))]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear match search"
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
                aria-label="Refresh sports schedules"
                aria-busy={isFetching}
                className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] transition-colors"
                title="Refresh Live Feeds"
              >
                <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[rgb(var(--primary-color))]' : ''}`} />
              </button>

              {/* Multiview (Split-Screen concurrent watching) Button */}
              <button
                type="button"
                onClick={() => handleOpenMultiview()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:brightness-110 text-white text-xs font-bold shadow-md transition-all active:scale-95 shrink-0"
                title="Watch multiple live matches simultaneously (2x or 4x split screen)"
              >
                <Tv className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Multiview</span>
                <span className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-mono">2x/4x</span>
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

          {/* Unified Contextual Filter Bar (Only shown on Live & Schedule views) */}
          {(tabMode === 'live' || tabMode === 'upcoming') && (
            <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 fancy-scrollbar pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 shrink-0">
                
                {/* Schedule Day Segmented Control (Schedule tab only) */}
                {tabMode === 'upcoming' && (
                  <div className="flex items-center bg-[var(--bg-card)] p-0.5 rounded-xl border border-[var(--border-subtle)] shrink-0 shadow-sm">
                    {SCHEDULE_DAY_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedScheduleDay(opt.id as any)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          selectedScheduleDay === opt.id
                            ? opt.id === 'results'
                              ? 'bg-emerald-500 text-white shadow-sm font-extrabold'
                              : 'bg-[rgb(var(--primary-color))] text-white shadow-sm font-extrabold'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <span className="whitespace-nowrap">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {tabMode === 'upcoming' && (
                  <div className="h-4 w-px bg-[var(--border-subtle)] shrink-0 hidden sm:block" />
                )}

                {/* Competition / League Quick Filter Pills */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {COMPETITION_FILTERS.map(comp => {
                    const count = filterCounts[comp.id] ?? 0;
                    // Do not clutter the filter bar with empty leagues
                    if (comp.id !== 'ALL' && count === 0 && selectedCompetition !== comp.id) {
                      return null;
                    }

                    return (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => setSelectedCompetition(comp.id)}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                          selectedCompetition === comp.id
                            ? 'bg-[rgb(var(--primary-color))] text-white border-[rgb(var(--primary-color))] shadow-sm font-extrabold'
                            : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <span>{comp.icon}</span>
                        <span className="whitespace-nowrap">{comp.label}</span>
                        {count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                            selectedCompetition === comp.id ? 'bg-white/25 text-white font-bold' : 'bg-[var(--bg-main)] text-[var(--text-muted)]'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

              </div>

              {/* Active Filter Clear / Reset Pill */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={clearSportsFilters}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all shrink-0"
                    title="Reset all filters"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* Main Body Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[50vh]">
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Loader2 className="w-10 h-10 text-[rgb(var(--primary-color))] animate-spin mb-3" />
            <p className="text-xs font-mono font-bold tracking-widest text-[var(--text-muted)] uppercase">
              Loading live scores and fixtures...
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. LIVE NOW TAB                                                           */}
        {/* ========================================================================= */}
        {!isLoading && tabMode === 'live' && (
          live.length > 0 ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <h2 className="text-base font-black uppercase tracking-wider text-[var(--text-main)]">
                    Live Right Now ({live.length} Events)
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
                    {isFetching ? (
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                    <span>
                      {isFetching
                        ? 'Updating scores'
                        : dataUpdatedAt
                          ? `Data updated · ${formatDateInTimezone(
                              new Date(dataUpdatedAt + (clockNow - Date.now())),
                              selectedRegion.tz,
                              'en-GB',
                              { hour: '2-digit', minute: '2-digit', second: '2-digit' },
                              apiTimezoneOffsetMs
                            )}`
                          : 'Waiting for score feed'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    aria-label="Refresh live scores"
                    title="Refresh live scores"
                    className="p-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-cyan-400 hover:border-cyan-500/40 disabled:opacity-50 transition-colors"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-bold">
                    <Globe className="w-3.5 h-3.5" />
                    <span>{selectedRegion.flag} {selectedRegion.name.split(' /')[0]} ({selectedRegionOffset})</span>
                  </div>
                </div>
              </div>

              {layoutMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 xl:gap-6">
                  {live.map(match => (
                    <MatchGridCard
                      key={getMatchUniqueId(match)}
                      match={match}
                      isLive={true}
                      onPlay={handlePlayMatch}
                      onToggleFav={toggleFavorite}
                      isFav={favorites.includes(getMatchUniqueId(match))}
                      selectedRegion={selectedRegion}
                      now={clockNow}
                      timezoneOffsetMs={apiTimezoneOffsetMs}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                      onToggleReminder={toggleReminder}
                      isReminder={reminders.includes(getMatchUniqueId(match))}
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
                      now={clockNow}
                      timezoneOffsetMs={apiTimezoneOffsetMs}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                      onToggleReminder={toggleReminder}
                      isReminder={reminders.includes(getMatchUniqueId(match))}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : upcomingPool.length > 0 ? (
            <div className="space-y-6 animate-fade-in">
              {/* Radar Active Notice */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                      <span>Between Live Match Windows</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider">
                        Radar Active
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {hasActiveFilters 
                        ? 'No live events in play for this specific filter. Showing next upcoming kickoffs below.' 
                        : 'No matches in play right now. Explore upcoming fixtures, countdowns, and kickoffs below.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearSportsFilters}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-main)] transition-colors cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTabMode('upcoming')}
                    className="px-4 py-2 rounded-xl bg-[rgb(var(--primary-color))] text-white text-xs font-bold shadow-md hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Full Schedule ({upcomingCount})</span>
                  </button>
                </div>
              </div>

              {/* Next Kickoffs Row Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-main)]">
                    Next Kickoffs & Featured Fixtures
                  </h2>
                </div>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  {upcomingPool.length} fixtures in queue
                </span>
              </div>

              {/* Upcoming Matches Grid or List */}
              {layoutMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 xl:gap-6">
                  {upcomingPool.slice(0, 12).map(match => (
                    <MatchGridCard
                      key={getMatchUniqueId(match)}
                      match={match}
                      isLive={false}
                      onPlay={handlePlayMatch}
                      onToggleFav={toggleFavorite}
                      isFav={favorites.includes(getMatchUniqueId(match))}
                      selectedRegion={selectedRegion}
                      now={clockNow}
                      timezoneOffsetMs={apiTimezoneOffsetMs}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                      onToggleReminder={toggleReminder}
                      isReminder={reminders.includes(getMatchUniqueId(match))}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {upcomingPool.slice(0, 12).map(match => (
                    <MatchListRow
                      key={getMatchUniqueId(match)}
                      match={match}
                      isLive={false}
                      onPlay={handlePlayMatch}
                      onToggleFav={toggleFavorite}
                      isFav={favorites.includes(getMatchUniqueId(match))}
                      selectedRegion={selectedRegion}
                      now={clockNow}
                      timezoneOffsetMs={apiTimezoneOffsetMs}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                      onToggleReminder={toggleReminder}
                      isReminder={reminders.includes(getMatchUniqueId(match))}
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
                {hasActiveFilters ? 'No matches match these filters' : 'No upcoming matches right now'}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-5 leading-relaxed">
                {hasActiveFilters
                  ? 'Clear the search or sport filter to see all events.'
                  : 'Try switching to the full schedule or refreshing live scores.'}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearSportsFilters}
                    className="px-5 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] font-bold text-xs cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTabMode('upcoming')}
                  className="px-6 py-2.5 rounded-xl bg-[rgb(var(--primary-color))] text-white font-bold text-xs shadow-lg hover:scale-105 transition-all cursor-pointer"
                >
                  Browse Full Schedule
                </button>
              </div>
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
                      {selectedScheduleDay === 'results'
                        ? `Showing recent match results and FT scores in ${selectedRegion.name}`
                        : `Showing fixtures & schedules in ${selectedRegion.name} (${selectedRegionOffset})`}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {selectedScheduleDay === 'results'
                        ? 'Official final scores, goal scorers, red cards, and match centers from live feeds'
                        : 'Kickoff times and calendar dates update automatically with each region'}
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
                  <div className="py-2.5 px-4 bg-[var(--bg-main)]/85 border border-[var(--border-subtle)] flex items-center justify-between rounded-xl shadow-sm">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      <span>{selectedScheduleDay === 'results' ? `Full-Time Results · ${dateLabel}` : dateLabel}</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                        {selectedRegion.flag} {getScheduleOffsetBadge(
                          selectedRegion,
                          groupMatches[0]?.date,
                          getNearTermTimezoneOffset(groupMatches[0]?.date || clockNow, clockNow, apiTimezoneOffsetMs)
                        )}
                      </span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                        {groupMatches.length} Matches
                      </span>
                    </div>
                  </div>

                  {layoutMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 xl:gap-6">
                      {groupMatches.map(match => (
                        <MatchGridCard
                          key={getMatchUniqueId(match)}
                          match={match}
                          isLive={false}
                          onPlay={handlePlayMatch}
                          onToggleFav={toggleFavorite}
                          isFav={favorites.includes(getMatchUniqueId(match))}
                          selectedRegion={selectedRegion}
                          now={clockNow}
                          timezoneOffsetMs={apiTimezoneOffsetMs}
                          onOpenMatchCenter={(m) => setPreviewMatch(m)}
                          onToggleReminder={toggleReminder}
                          isReminder={reminders.includes(getMatchUniqueId(match))}
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
                          now={clockNow}
                          timezoneOffsetMs={apiTimezoneOffsetMs}
                          onOpenMatchCenter={(m) => setPreviewMatch(m)}
                          onToggleReminder={toggleReminder}
                          isReminder={reminders.includes(getMatchUniqueId(match))}
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
            <div className="py-20 text-center flex flex-col items-center text-[var(--text-muted)]">
              <Calendar className="w-10 h-10 mb-3 opacity-40" />
              <h3 className="text-base font-bold text-[var(--text-main)] mb-1">
                {selectedScheduleDay === 'results'
                  ? 'No recent match results found'
                  : hasActiveFilters ? 'No fixtures match these filters' : 'No upcoming fixtures found'}
              </h3>
              <p className="text-xs mb-4">
                {selectedScheduleDay === 'results'
                  ? 'Completed matches with full-time scores will appear here as games finish.'
                  : hasActiveFilters ? 'Try another team, league, or sport.' : 'Check back soon or refresh the sports feeds.'}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearSportsFilters}
                  className="px-5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] font-bold text-xs"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="px-5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] font-bold text-xs"
                >
                  Refresh Fixtures
                </button>
              )}
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
                      now={clockNow}
                      timezoneOffsetMs={apiTimezoneOffsetMs}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                      onToggleReminder={toggleReminder}
                      isReminder={reminders.includes(getMatchUniqueId(match))}
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
                      now={clockNow}
                      timezoneOffsetMs={apiTimezoneOffsetMs}
                      onOpenMatchCenter={(m) => setPreviewMatch(m)}
                      onToggleReminder={toggleReminder}
                      isReminder={reminders.includes(getMatchUniqueId(match))}
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
              <h3 className="text-base font-bold text-[var(--text-main)] mb-1">
                {favorites.length > 0 && hasActiveFilters ? 'No saved matches match these filters' : 'No Saved Matches'}
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
                {favorites.length > 0 && hasActiveFilters
                  ? 'Clear the search or sport filter to see the rest of your watchlist.'
                  : 'Click the heart icon on any live or scheduled fixture to save it to your personal watchlist.'}
              </p>
              <button
                type="button"
                onClick={favorites.length > 0 && hasActiveFilters ? clearSportsFilters : () => setTabMode('live')}
                className="px-5 py-2.5 rounded-xl bg-[rgb(var(--primary-color))] text-white font-bold text-xs"
              >
                {favorites.length > 0 && hasActiveFilters ? 'Clear Filters' : 'Explore Live Matches'}
              </button>
            </div>
          )
        )}

        {/* ========================================================================= */}
        {/* 4. STANDINGS AND TOP SCORERS */}
        {/* ========================================================================= */}
        {tabMode === 'standings' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[var(--text-main)] flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  <span>League Tables & Standings</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Live standings when available; bundled snapshot tables are labeled by source.
                </p>
              </div>

              {/* League Selector Pills */}
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
                  <span>Top Scorers</span>
                </button>
              </div>
            </div>

            {/* Selected League Card */}
            {(() => {
              const currentTable = LEAGUE_TABLES.find(l => l.id === selectedLeague) || LEAGUE_TABLES[0];
              const standingsList = liveStandingsData?.standings || currentTable.standings;

              const sourceBadge = (() => {
                if (!liveStandingsData) {
                  return isLoadingStandings
                    ? { label: 'Loading live table · snapshot shown', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
                    : { label: 'Bundled snapshot · may be out of date', badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
                }
                const src = liveStandingsData?.source;
                if (src === 'football-data.org') {
                  return { label: 'Football-Data.org · Live', badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
                }
                if (src === 'espn') {
                  return { label: 'ESPN · Live', badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
                }
                return { label: 'Bundled season snapshot · May be out of date', badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
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
                          <span className={`flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${sourceBadge.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full bg-current ${liveStandingsData?.isLive || isLoadingStandings ? 'animate-pulse' : ''}`} />
                            <span>{sourceBadge.label}</span>
                          </span>
                          <button
                            type="button"
                            disabled={isFetchingStandings || isFetchingScorers}
                            onClick={async () => {
                              await getLiveLeagueStandings(selectedLeague, true);
                              await refetchStandings();
                              await refetchScorers();
                            }}
                            className="p-1 rounded-lg bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-white border border-[var(--border-subtle)] disabled:opacity-50 transition-colors"
                            title="Refresh Data"
                          >
                            <RotateCw className={`w-3 h-3 ${isFetchingStandings || isFetchingScorers ? 'animate-spin text-emerald-400' : ''}`} />
                          </button>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase">
                          {standingsSubTab === 'table' ? `League standings · ${currentTable.country}` : `Top scorer rankings · ${currentTable.country}`}
                        </span>
                      </div>
                    </div>

                    {standingsSubTab === 'table' ? (
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" /> 
                          Champions League / Playoff
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 
                          Europa League
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Relégation
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span>Top Scorer Race · {liveStandingsData?.season || currentTable.season || 'Current season'}</span>
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
                                  {Array.isArray(team.form) && team.form.length > 0 ? team.form.map((res, i) => (
                                    <span
                                      key={i}
                                      title={res === 'W' ? 'Win' : res === 'D' ? 'Draw' : 'Loss'}
                                      className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center text-white ${
                                        res === 'W' ? 'bg-emerald-500' : res === 'D' ? 'bg-amber-500' : 'bg-red-500'
                                      }`}
                                    >
                                      {res}
                                    </span>
                                  )) : (
                                    <span className="text-[10px] text-[var(--text-muted)]" title="Recent form is not provided by the current standings source">
                                      —
                                    </span>
                                  )}
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
                                          Top Scorer Leader
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
                          {isLoadingScorers ? 'Loading top scorer rankings...' : 'Top scorer data is unavailable from the current providers.'}
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

            {/* Modal Segmented Navigation Tabs */}
            <div className="flex items-center bg-[var(--bg-main)] p-1 rounded-2xl border border-[var(--border-subtle)] mb-5 shadow-sm">
              <button
                type="button"
                onClick={() => setModalActiveTab('overview')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  modalActiveTab === 'overview'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('lineups')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  modalActiveTab === 'lineups'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Lineups & Pitch</span>
              </button>

              <button
                type="button"
                onClick={() => setModalActiveTab('stats')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  modalActiveTab === 'stats'
                    ? 'bg-[rgb(var(--primary-color))] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Match Stats</span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {modalActiveTab === 'overview' && (
              <div className="space-y-4">
                {/* Form Guide & Win Probability Gauge */}
                {previewMatch.teams?.home && previewMatch.teams?.away && (
                  <div className="bg-[var(--bg-input)]/40 p-3.5 rounded-2xl border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold uppercase tracking-wider text-[var(--text-muted)] text-[10px] flex items-center gap-1.5 font-mono">
                        <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Recent Team Form (Last 5)</span>
                      </span>
                      <span className="text-[10px] text-white/40">Latest &rarr;</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--bg-main)]/60 p-2.5 rounded-xl border border-white/5">
                      {/* Home Form */}
                      <div className="flex items-center justify-between sm:justify-start gap-2 flex-1">
                        <span className="text-[11px] font-bold text-white/80 truncate max-w-[90px]">{previewMatch.teams.home.name}:</span>
                        <div className="flex items-center gap-1">
                          {getStandingsForm(previewMatch.teams.home.name, liveStandingsData?.standings).length > 0
                            ? getStandingsForm(previewMatch.teams.home.name, liveStandingsData?.standings).map((f, i) => (
                            <span
                              key={i}
                              className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-black text-white ${
                                f === 'W' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : f === 'D' ? 'bg-amber-500/80' : 'bg-red-500/80'
                              }`}
                              title={f === 'W' ? 'Victory' : f === 'D' ? 'Draw' : 'Defeat'}
                            >
                              {f}
                            </span>
                            ))
                            : <span className="text-[9px] text-[var(--text-muted)]" title="Recent form is not provided by the current standings source">Unavailable</span>}
                        </div>
                      </div>
                      {/* Away Form */}
                      <div className="flex items-center justify-between sm:justify-start gap-2 flex-1 sm:border-l border-white/10 sm:pl-3">
                        <span className="text-[11px] font-bold text-white/80 truncate max-w-[90px]">{previewMatch.teams.away.name}:</span>
                        <div className="flex items-center gap-1">
                          {getStandingsForm(previewMatch.teams.away.name, liveStandingsData?.standings).length > 0
                            ? getStandingsForm(previewMatch.teams.away.name, liveStandingsData?.standings).map((f, i) => (
                            <span
                              key={i}
                              className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-black text-white ${
                                f === 'W' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : f === 'D' ? 'bg-amber-500/80' : 'bg-red-500/80'
                              }`}
                              title={f === 'W' ? 'Victory' : f === 'D' ? 'Draw' : 'Defeat'}
                            >
                              {f}
                            </span>
                            ))
                            : <span className="text-[9px] text-[var(--text-muted)]" title="Recent form is not provided by the current standings source">Unavailable</span>}
                        </div>
                      </div>
                    </div>

                    {/* Win Probability Bar */}
                    {(() => {
                      const prob = getWinProbability(previewMatch);
                      return (
                        <div className="mt-3 pt-2.5 border-t border-white/5">
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-white/70 mb-1.5">
                            <span className="text-emerald-400">Home {prob.home}%</span>
                            <span className="text-amber-300">Draw {prob.draw}%</span>
                            <span className="text-cyan-400">Away {prob.away}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden flex bg-white/5">
                            <div style={{ width: `${prob.home}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                            <div style={{ width: `${prob.draw}%` }} className="bg-amber-500/80 h-full transition-all duration-500" />
                            <div style={{ width: `${prob.away}%` }} className="bg-cyan-500 h-full transition-all duration-500" />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Time & Region Information */}
                <div className="space-y-2.5 text-xs bg-[var(--bg-input)]/40 p-4 rounded-2xl border border-[var(--border-subtle)]">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-muted)] flex items-center gap-1">
                      <span>{selectedRegion.flag}</span>
                      <span>Time ({selectedRegion.name.split(' /')[0]}):</span>
                    </span>
                    <span className="font-bold text-cyan-400 font-mono text-sm">
                      {formatTimeForTz(
                        previewMatch.date,
                        getScheduleTimezone(selectedRegion),
                        getNearTermTimezoneOffset(previewMatch.date, clockNow, apiTimezoneOffsetMs)
                      )} ({getScheduleOffsetBadge(
                        selectedRegion,
                        previewMatch.date,
                        getNearTermTimezoneOffset(previewMatch.date, clockNow, apiTimezoneOffsetMs)
                      )})
                    </span>
                  </div>
                  {previewMatch.competition && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)]">Competition:</span>
                      <span className="font-bold text-[var(--text-main)] text-right">{previewMatch.competition}</span>
                    </div>
                  )}
                  {(previewMatch.venue || previewMatch.venueCity) && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-muted)] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        <span>Venue:</span>
                      </span>
                      <span className="font-bold text-[var(--text-main)] text-right">
                        {[previewMatch.venue, previewMatch.venueCity].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-muted)]">Local Date:</span>
                    <span className="font-bold text-[var(--text-main)]">
                      {formatDateFullForTz(
                        previewMatch.date,
                        getScheduleTimezone(selectedRegion),
                        getNearTermTimezoneOffset(previewMatch.date, clockNow, apiTimezoneOffsetMs)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--text-muted)]">Status:</span>
                    {isMatchFinished(previewMatch) ? (
                      <span className="text-xs font-bold text-zinc-300 font-mono bg-zinc-800 px-2 py-0.5 rounded">
                        Full Time · {previewMatch.minute || 'FT'}
                      </span>
                    ) : isLiveMatchStatus(previewMatch.status) ? (
                      <span className="text-xs font-bold text-red-400 font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                        Live · {previewMatch.minute || 'In progress'}
                      </span>
                    ) : (
                      <MatchCountdown date={previewMatch.date} now={clockNow} />
                    )}
                  </div>
                </div>

                {/* Match Incidents Timeline */}
                {Array.isArray(previewMatch.events) && previewMatch.events.length > 0 && (
                  <div className="bg-[var(--bg-input)]/40 p-3.5 rounded-2xl border border-[var(--border-subtle)]">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5 font-mono">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      <span>Key Match Incidents</span>
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto fancy-scrollbar">
                      {previewMatch.events.map((ev, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-[var(--bg-main)]/80 border border-white/5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-amber-400 shrink-0 w-8">{ev.minute}'</span>
                            <span className="text-sm shrink-0">{ev.type === 'goal' ? '⚽' : ev.type === 'red_card' ? '🟥' : '🟨'}</span>
                            <span className="font-semibold text-[var(--text-main)] truncate">{ev.player}</span>
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase ml-2 shrink-0">{ev.team}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calendar & Share Actions Bar */}
                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={createGoogleCalendarUrl(previewMatch)}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-2.5 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    title="Add to Google Calendar"
                  >
                    <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">Google Cal</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => downloadIcsCalendar(previewMatch)}
                    className="py-2 px-2.5 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    title="Download .ics file for iCal/Outlook"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">.ICS File</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyMatchShareLink(previewMatch);
                      if (ok) {
                        setCopyFeedback(previewMatch.id);
                        setTimeout(() => setCopyFeedback(null), 2500);
                      }
                    }}
                    className="py-2 px-2.5 rounded-xl bg-[var(--bg-main)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-main)] flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    title="Copy Match Link"
                  >
                    {copyFeedback === previewMatch.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-emerald-400 font-bold truncate">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">Share</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Interactive Broadcast Mirrors */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5 font-mono">
                    <Radio className="w-3.5 h-3.5 text-[rgb(var(--primary-color))]" />
                    <span>{previewMatch.sources.length > 0 ? 'Select Broadcast Mirror to Watch' : 'Broadcast Availability'}</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {previewMatch.sources.length > 0 ? previewMatch.sources.map((s, idx) => {
                      const mirrorLabel = idx === 0 
                        ? 'Mirror 1 · Primary HD 1080p' 
                        : idx === 1 
                          ? 'Mirror 2 · Multi-Audio' 
                          : idx === 2 
                            ? 'Mirror 3 · 720p 60fps' 
                            : `Mirror ${idx + 1} · Alternate Feed`;
                      const qualityTag = idx === 0 ? 'RECOMMENDED' : idx === 1 ? 'MULTI-AUDIO' : 'FAST';

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setPreviewMatch(null);
                            handlePlayMatch(previewMatch, idx);
                          }}
                          className="group/mirror p-3 rounded-xl bg-[var(--bg-main)] hover:bg-[rgb(var(--primary-color))]/15 border border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/50 flex items-center justify-between text-xs transition-all text-left shadow-sm"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <PlayCircle className="w-3.5 h-3.5 text-[rgb(var(--primary-color))] shrink-0 group-hover/mirror:scale-110 transition-transform" />
                              <span className="font-bold text-[var(--text-main)] truncate">{mirrorLabel}</span>
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
                              Source: {s.source.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                            {qualityTag} ⚡
                          </span>
                        </button>
                      );
                    }) : (
                      <p className="col-span-2 text-xs text-[var(--text-muted)] bg-[var(--bg-main)] border border-[var(--border-subtle)] rounded-xl p-3">
                        No broadcast link is listed for this fixture yet. Kickoff and match data are still available here.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LINEUPS & TACTICAL PITCH */}
            {modalActiveTab === 'lineups' && (
              <TacticalPitchView
                homeTeam={previewMatch.teams?.home?.name || previewMatch.title}
                awayTeam={previewMatch.teams?.away?.name || 'Opponent'}
                homeBrand={getTeamBrand(previewMatch.teams?.home?.name || previewMatch.category)}
                awayBrand={getTeamBrand(previewMatch.teams?.away?.name || `${previewMatch.category} away`)}
              />
            )}

            {/* TAB 3: ADVANCED MATCH STATS */}
            {modalActiveTab === 'stats' && (
              <MatchStatsView
                match={previewMatch}
                homeBrand={getTeamBrand(previewMatch.teams?.home?.name || previewMatch.category)}
                awayBrand={getTeamBrand(previewMatch.teams?.away?.name || `${previewMatch.category} away`)}
              />
            )}

            {/* Modal Bottom Action Controls */}
            <div className="flex items-center gap-2 mt-5 pt-4 border-t border-[var(--border-subtle)]">
              {previewMatch.sources.length > 0 && (
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
              )}

              {/* Push Reminder Toggle */}
              {!isMatchFinished(previewMatch) && (
                <button
                  type="button"
                  onClick={() => toggleReminder(previewMatch)}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-center ${
                    reminders.includes(getMatchUniqueId(previewMatch))
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-amber-300'
                  }`}
                  title={reminders.includes(getMatchUniqueId(previewMatch)) ? 'Reminder set (10m before kickoff)' : 'Notify me 10m before kickoff'}
                >
                  {reminders.includes(getMatchUniqueId(previewMatch)) ? (
                    <BellRing className="w-4 h-4 fill-current text-amber-300 animate-pulse" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </button>
              )}

              {/* Watch in Multiview Split */}
              {previewMatch.sources.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const m = previewMatch;
                    setPreviewMatch(null);
                    handleOpenMultiview(m);
                  }}
                  className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors flex items-center justify-center"
                  title="Watch in Multiview Split-Screen"
                >
                  <Tv className="w-4 h-4" />
                </button>
              )}

              {/* Favorite Toggle */}
              <button
                type="button"
                onClick={() => toggleFavorite(previewMatch)}
                className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-white transition-colors"
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

      {/* Floating Action / Reminder Toast */}
      {notificationToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-zinc-900/95 border border-amber-500/40 text-amber-300 font-bold text-xs shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 select-none">
          <BellRing className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
          <span>{notificationToast}</span>
        </div>
      )}

      {/* Sports Multiview (Split-Screen / 4x Streams Concurrent Player) */}
      <SportsMultiviewModal
        isOpen={isMultiviewOpen}
        onClose={() => setIsMultiviewOpen(false)}
        allMatches={matches}
        initialMatch={multiviewInitialMatch}
      />

    </div>
  );
};
