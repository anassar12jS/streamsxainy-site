/**
 * Centralized Clock & Timezone Synchronization Service
 * 
 * Synchronizes client clocks across StreamHub with the official time.now API
 * (https://time.now/developer/api/time?timezone=...) so that countdowns, kickoff times,
 * and live clocks in Sports.tsx, SportsPlayer.tsx, and modals stay 100% in sync
 * regardless of local device OS clock skew or timezone offsets.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { REGIONS, RegionOption } from '../constants/regions';

export interface ClockAnchor {
  epochMs: number;
  monotonicMs: number;
  offsetMs: number;
  offsetLabel: string;
  tz: string;
}

const STORAGE_KEY = 'streamhub_clock_anchor_v1';

export const normalizeTimezone = (tz?: string): string => {
  if (!tz || tz === 'Etc/GMT-1' || tz === 'Etc/GMT+1' || tz === 'UTC') return 'UTC';
  if (tz === 'morocco') return 'Africa/Casablanca';
  return tz;
};

export const parseUtcOffsetMs = (offset: string): number | undefined => {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return undefined;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
};

export const formatUtcOffset = (offset: string): string => {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) return 'UTC';
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return `GMT${match[1]}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
};

export const formatOffsetMs = (offsetMs: number): string => {
  const offsetMinutes = Math.round(offsetMs / 60000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
};

export const getScheduleTimezone = (region: RegionOption): string => {
  return normalizeTimezone(region.scheduleTz || region.tz);
};

export const formatDateInTimezone = (
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

// Singleton in-memory clock anchor
let globalAnchor: ClockAnchor | null = (() => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate that anchor is recent (within 6 hours)
      const ageMs = Date.now() - (parsed.storedAt || 0);
      if (ageMs < 6 * 3600 * 1000 && typeof parsed.epochMs === 'number') {
        return {
          epochMs: parsed.epochMs + ageMs,
          monotonicMs: performance.now(),
          offsetMs: parsed.offsetMs || 0,
          offsetLabel: parsed.offsetLabel || 'UTC',
          tz: parsed.tz || 'Africa/Casablanca'
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return null;
})();

/**
 * Returns current authoritative UTC timestamp in milliseconds.
 * If synchronized with time.now API, uses the calibrated drift-free monotonic clock.
 */
export const getSyncedNow = (): number => {
  if (globalAnchor) {
    return globalAnchor.epochMs + (performance.now() - globalAnchor.monotonicMs);
  }
  return Date.now();
};

export const getClockAnchor = (): ClockAnchor | null => globalAnchor;

/**
 * Sync the global anchor with the official time.now API
 */
export const syncClockWithApi = async (timezone = 'Africa/Casablanca'): Promise<ClockAnchor | null> => {
  const safeTz = normalizeTimezone(timezone);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(`https://time.now/developer/api/time?timezone=${encodeURIComponent(safeTz)}`, {
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`Time API HTTP ${res.status}`);
    const data = await res.json() as { timezone?: string; unixtime?: number; utc_offset?: string };
    const offsetMs = data.utc_offset ? parseUtcOffsetMs(data.utc_offset) : undefined;

    if (typeof data.unixtime !== 'number' || offsetMs === undefined) {
      throw new Error('Invalid response structure from Time API');
    }

    const anchor: ClockAnchor = {
      epochMs: data.unixtime * 1000,
      monotonicMs: performance.now(),
      offsetMs,
      offsetLabel: formatUtcOffset(data.utc_offset || '+00:00'),
      tz: safeTz
    };

    globalAnchor = anchor;

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        epochMs: anchor.epochMs,
        offsetMs: anchor.offsetMs,
        offsetLabel: anchor.offsetLabel,
        tz: anchor.tz,
        storedAt: Date.now()
      }));
    } catch {
      // Ignore sessionStorage issues
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('streamhub_clock_synced', { detail: anchor }));
    }

    return anchor;
  } catch (err) {
    // Return existing anchor if available
    return globalAnchor;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

/**
 * High-precision React hook for live clock and synchronized match countdowns
 */
export const useSyncedClock = (selectedRegion: RegionOption) => {
  const [syncedNow, setSyncedNow] = useState(() => getSyncedNow());
  const [anchor, setAnchor] = useState<ClockAnchor | null>(() => globalAnchor);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  const targetTz = useMemo(() => normalizeTimezone(selectedRegion.tz), [selectedRegion.tz]);

  // Recalculate formatted time strings
  const updateTick = useCallback(() => {
    const now = getSyncedNow();
    setSyncedNow(now);

    const currentAnchor = globalAnchor;
    const offsetMs = currentAnchor ? currentAnchor.offsetMs : undefined;
    const displayDate = new Date(now + (offsetMs || 0));
    const displayTz = currentAnchor ? 'UTC' : targetTz;

    try {
      const t = formatDateInTimezone(displayDate, displayTz, 'en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const d = formatDateInTimezone(displayDate, displayTz, 'en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      setTimeStr(t);
      setDateStr(d);
    } catch {
      setTimeStr(new Date(now).toLocaleTimeString());
      setDateStr(new Date(now).toLocaleDateString());
    }
  }, [targetTz]);

  useEffect(() => {
    let active = true;

    // Trigger immediate background sync
    void syncClockWithApi(targetTz).then(res => {
      if (active && res) {
        setAnchor(res);
        updateTick();
      }
    });

    // Listen for clock synced events
    const handleSynced = (e: any) => {
      if (active && e.detail) {
        setAnchor(e.detail);
        updateTick();
      }
    };
    window.addEventListener('streamhub_clock_synced', handleSynced);

    // 1-second ticker for clock and live countdowns
    updateTick();
    const tickInterval = setInterval(updateTick, 1000);

    // Periodic re-sync with API every 60 seconds
    const syncInterval = setInterval(() => {
      void syncClockWithApi(targetTz);
    }, 60000);

    return () => {
      active = false;
      window.removeEventListener('streamhub_clock_synced', handleSynced);
      clearInterval(tickInterval);
      clearInterval(syncInterval);
    };
  }, [targetTz, updateTick]);

  const offsetLabel = anchor?.offsetLabel || (selectedRegion.tz === 'Africa/Casablanca' ? 'GMT+0' : (selectedRegion.offsetBadge || 'UTC'));
  const offsetMs = anchor?.offsetMs;

  return {
    syncedNow,
    anchor,
    timeStr,
    dateStr,
    offsetMs,
    offsetLabel,
    syncClock: () => syncClockWithApi(targetTz)
  };
};

/**
 * Formats match countdown with exact match between cards and player
 */
export const formatMatchCountdown = (matchDate: number, nowMs = getSyncedNow()): {
  isUpcoming: boolean;
  totalMs: number;
  hours: number;
  mins: number;
  secs: number;
  shortLabel: string;
  fullLabel: string;
} => {
  const diff = matchDate - nowMs;
  if (diff <= 0) {
    return {
      isUpcoming: false,
      totalMs: diff,
      hours: 0,
      mins: 0,
      secs: 0,
      shortLabel: 'Starting Soon',
      fullLabel: 'Starting Soon'
    };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  let shortLabel = '';
  let fullLabel = '';

  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    shortLabel = `${days}d away`;
    fullLabel = `${days}d ${hours % 24}h ${mins}m`;
  } else if (hours >= 24) {
    const days = Math.floor(hours / 24);
    shortLabel = `${days}d ${hours % 24}h`;
    fullLabel = `${days}d ${hours % 24}h ${mins}m ${secs}s`;
  } else {
    shortLabel = `${hours}h ${mins}m`;
    fullLabel = `${hours}h ${mins}m ${secs}s`;
  }

  return {
    isUpcoming: true,
    totalMs: diff,
    hours,
    mins,
    secs,
    shortLabel,
    fullLabel
  };
};
