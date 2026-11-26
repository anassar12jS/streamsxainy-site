

import { TMDBResult, IPTVChannel, ContinueWatchingItem, MediaType, StreamProvider } from '../types';
import { TORRENTIO_BASE_URL } from '../constants';

const WATCHLIST_KEY = 'streamhub_watchlist';
const HISTORY_KEY = 'streamhub_history';
const THEME_KEY = 'streamhub_theme';
const MODE_KEY = 'streamhub_mode';
const TV_FAVORITES_KEY = 'streamhub_tv_favorites';
const TV_RECENT_KEY = 'streamhub_tv_recent';
const PROGRESS_KEY = 'streamhub_progress';
const PROVIDERS_KEY = 'streamhub_providers';
const SPORTS_FAVORITES_KEY = 'streamhub_sports_favorites';

// --- Storage Events for Live Sync across Components ---
const emitStorageChange = (key: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('streamhub_storage_update', { detail: { key } }));
  }
};

// Parsed-value cache: localStorage.getItem is cheap but JSON.parse of large
// lists runs synchronously on the main thread. Hundreds of MediaCards each
// calling isInWatchlist()/getProgress() would re-parse the same blob per card.
// Cache the parsed result keyed by the raw string so external writes
// (importData, other tabs) still invalidate correctly.
const parseCache = new Map<string, { raw: string | null; value: unknown }>();

const readStoredJSON = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    const hit = parseCache.get(key);
    if (hit && hit.raw === raw) return hit.value as T;

    if (!raw) {
      parseCache.set(key, { raw, value: fallback });
      return fallback;
    }

    const parsed = JSON.parse(raw);

    if (Array.isArray(fallback)) {
      if (!Array.isArray(parsed)) {
        return fallback;
      }
      const sanitized = parsed.filter((item) => item !== null && item !== undefined) as unknown as T;
      parseCache.set(key, { raw, value: sanitized });
      return sanitized;
    }

    if (typeof fallback === 'object' && fallback !== null) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return fallback;
      }
      parseCache.set(key, { raw, value: parsed as T });
      return parsed as T;
    }

    if (parsed === null || parsed === undefined) {
      return fallback;
    }

    parseCache.set(key, { raw, value: parsed as T });
    return parsed as T;
  } catch (e) {
    return fallback;
  }
};

// Evict disposable cache entries if localStorage hits browser quota (~5MB)
const EVICTABLE_PREFIXES = [
  'streams_',
  'episode_streams_',
  'football_',
  'streamhub_sports_team_logo_',
  'ytm_',
  'xainy_stream_',
  'xainy_duration_',
  'bitchord_shelves_',
];

const SECONDARY_EVICTABLE_KEYS = [
  'bitchord_music_session_v1',
  'bitchord_music_recent',
  'vidy:provider-health',
];

const compactMediaItem = (item: TMDBResult): TMDBResult => ({
  id: item.id,
  title: item.title,
  name: item.name,
  poster_path: item.poster_path,
  backdrop_path: item.backdrop_path,
  overview: typeof item.overview === 'string' ? item.overview.slice(0, 240) : '',
  release_date: item.release_date,
  first_air_date: item.first_air_date,
  vote_average: item.vote_average,
  media_type: item.media_type,
  genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : undefined,
  ...(item.anilist_id ? { anilist_id: item.anilist_id } : {}),
  ...(item.is_dubbed !== undefined ? { is_dubbed: item.is_dubbed } : {}),
});

const evictDisposableCaches = (includeSecondary = false): number => {
  let removed = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && EVICTABLE_PREFIXES.some((p) => k.startsWith(p))) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
      parseCache.delete(k);
      removed++;
    }
    if (includeSecondary) {
      for (const k of SECONDARY_EVICTABLE_KEYS) {
        if (localStorage.getItem(k) !== null) {
          localStorage.removeItem(k);
          parseCache.delete(k);
          removed++;
        }
      }
    }
  } catch {}
  return removed;
};

// One-time cleanup of legacy bloated addon stream caches and oversized history/watchlist items left in localStorage
(() => {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('streams_') || k.startsWith('episode_streams_'))) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) localStorage.removeItem(k);

    for (const key of [HISTORY_KEY, WATCHLIST_KEY]) {
      const raw = localStorage.getItem(key);
      if (raw && raw.length > 30_000) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const compactList = parsed
            .filter((x): x is TMDBResult => Boolean(x && typeof x === 'object' && typeof x.id === 'number'))
            .slice(0, key === HISTORY_KEY ? 20 : 100)
            .map(compactMediaItem);
          localStorage.setItem(key, JSON.stringify(compactList));
        }
      }
    }
  } catch {}
})();

const safeSetItem = (key: string, value: string): boolean => {
  parseCache.delete(key);
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // QuotaExceededError or private browsing: evict disposable caches and retry
    if (evictDisposableCaches(false) > 0) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {}
    }
    if (evictDisposableCaches(true) > 0) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {}
    }
    return false;
  }
};

// --- Watchlist ---
export const getWatchlist = (): TMDBResult[] => readStoredJSON<TMDBResult[]>(WATCHLIST_KEY, []);

export const addToWatchlist = (item: TMDBResult) => {
  const list = getWatchlist();
  if (!list.find(i => i.id === item.id)) {
    const updated = [compactMediaItem(item), ...list];
    safeSetItem(WATCHLIST_KEY, JSON.stringify(updated));
    emitStorageChange(WATCHLIST_KEY);
  }
};

export const removeFromWatchlist = (id: number) => {
  const list = getWatchlist();
  const updated = list.filter(i => i.id !== id);
  safeSetItem(WATCHLIST_KEY, JSON.stringify(updated));
  emitStorageChange(WATCHLIST_KEY);
};

export const isInWatchlist = (id: number): boolean => {
  const list = getWatchlist();
  return !!list.find(i => i.id === id);
};

// --- History (Recently Watched Metadata) ---
export const getHistory = (): TMDBResult[] => readStoredJSON<TMDBResult[]>(HISTORY_KEY, []);

export const addToHistory = (item: TMDBResult) => {
  const list = getHistory();
  const filtered = list.filter(i => i.id !== item.id);
  const updated = [compactMediaItem(item), ...filtered].slice(0, 20);
  if (!safeSetItem(HISTORY_KEY, JSON.stringify(updated))) {
    // Still keep the latest 8 items (or 3) if browser storage is tight
    if (!safeSetItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 8)))) {
      safeSetItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 3)));
    }
  }
  emitStorageChange(HISTORY_KEY);
};

// --- Continue Watching (Progress) ---
export const getProgress = (): ContinueWatchingItem[] => readStoredJSON<ContinueWatchingItem[]>(PROGRESS_KEY, []);

export const saveProgress = (item: { 
  id: number; 
  anilist_id?: number;
  media_type: MediaType; 
  title: string; 
  poster_path: string | null; 
  season?: number; 
  episode?: number; 
  currentTime?: number;
  duration?: number;
  progress?: number;
}) => {
  const list = getProgress();
  const previous = list.find(i => i.id === item.id);
  
  const currentTime = item.currentTime !== undefined ? item.currentTime : (previous?.currentTime || 0);
  const duration = item.duration !== undefined ? item.duration : (previous?.duration || (item.media_type === MediaType.TV ? 1500 : 7200));
  
  // Calculate percentage (0-100)
  let progressPercent = item.progress;
  if (progressPercent === undefined) {
    if (duration > 0 && currentTime > 0) {
      progressPercent = Math.min(100, Math.max(5, Math.round((currentTime / duration) * 100)));
    } else {
      progressPercent = previous?.progress || 15;
    }
  }

  const newItem: ContinueWatchingItem = {
    ...previous,
    ...item,
    currentTime,
    duration,
    progress: progressPercent,
    timestamp: Date.now()
  };
  const filtered = list.filter(i => i.id !== item.id);
  const updated = [newItem, ...filtered].slice(0, 25);
  safeSetItem(PROGRESS_KEY, JSON.stringify(updated));
  emitStorageChange(PROGRESS_KEY);
};

export const removeFromProgress = (id: number) => {
  const list = getProgress();
  const updated = list.filter(i => i.id !== id);
  safeSetItem(PROGRESS_KEY, JSON.stringify(updated));
  emitStorageChange(PROGRESS_KEY);
};

export const getProgressForId = (id: number): ContinueWatchingItem | undefined => {
  const list = getProgress();
  return list.find(i => i.id === id);
};

// --- Live TV Favorites ---
export const getFavoriteChannels = (): IPTVChannel[] => readStoredJSON<IPTVChannel[]>(TV_FAVORITES_KEY, []);

export const toggleFavoriteChannel = (channel: IPTVChannel) => {
    const list = getFavoriteChannels();
    const exists = list.find(c => c.url === channel.url);
    let updated;
    if (exists) {
        updated = list.filter(c => c.url !== channel.url);
    } else {
        updated = [channel, ...list];
    }
    safeSetItem(TV_FAVORITES_KEY, JSON.stringify(updated));
    return !exists; // Returns true if added, false if removed
};

export const isFavoriteChannel = (url: string): boolean => {
    const list = getFavoriteChannels();
    return !!list.find(c => c.url === url);
};

// --- Live TV Recents ---
export const getRecentChannels = (): IPTVChannel[] => readStoredJSON<IPTVChannel[]>(TV_RECENT_KEY, []);

export const addRecentChannel = (channel: IPTVChannel) => {
    const list = getRecentChannels();
    const filtered = list.filter(c => c.url !== channel.url);
    const updated = [channel, ...filtered].slice(0, 10);
    safeSetItem(TV_RECENT_KEY, JSON.stringify(updated));
};

// --- Sports Favorites ---
export const getFavoriteSportsMatches = (): string[] => readStoredJSON<string[]>(SPORTS_FAVORITES_KEY, []);

export const addFavoriteSportsMatch = (id: string) => {
    const list = getFavoriteSportsMatches();
    if (!list.includes(id)) {
        const updated = [id, ...list];
        safeSetItem(SPORTS_FAVORITES_KEY, JSON.stringify(updated));
    }
};

export const removeFavoriteSportsMatch = (id: string) => {
    const list = getFavoriteSportsMatches();
    const updated = list.filter(i => i !== id);
    safeSetItem(SPORTS_FAVORITES_KEY, JSON.stringify(updated));
};

export const isFavoriteSportsMatch = (id: string): boolean => {
    const list = getFavoriteSportsMatches();
    return list.includes(id);
};

// --- Sports Match Reminders (Kickoff notifications) ---
const SPORTS_REMINDERS_KEY = 'streamhub_sports_reminders';

export const getMatchReminders = (): string[] => readStoredJSON<string[]>(SPORTS_REMINDERS_KEY, []);

export const addMatchReminder = (id: string) => {
    const list = getMatchReminders();
    if (!list.includes(id)) {
        const updated = [id, ...list];
        safeSetItem(SPORTS_REMINDERS_KEY, JSON.stringify(updated));
    }
};

export const removeMatchReminder = (id: string) => {
    const list = getMatchReminders();
    const updated = list.filter(i => i !== id);
    safeSetItem(SPORTS_REMINDERS_KEY, JSON.stringify(updated));
};

export const isMatchReminder = (id: string): boolean => {
    const list = getMatchReminders();
    return list.includes(id);
};


// --- Stream Providers ---
export const getStreamProviders = (): StreamProvider[] => {
    try {
        const stored = localStorage.getItem(PROVIDERS_KEY);
        // Fallback for legacy single URL storage
        const legacyUrl = localStorage.getItem('torrentio_url');

        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed.filter(
                    (p): p is StreamProvider =>
                        Boolean(p && typeof p === 'object' && typeof p.url === 'string' && p.url.trim().length > 0)
                );
            }
        }

        if (legacyUrl) {
            return [{ name: 'Torrentio (Legacy)', url: legacyUrl }];
        }
    } catch {
        // Fall through to default provider
    }

    return [{ name: 'Torrentio', url: TORRENTIO_BASE_URL }];
};

export const saveStreamProviders = (providers: StreamProvider[]) => {
    safeSetItem(PROVIDERS_KEY, JSON.stringify(providers));
};

// --- Settings & Data ---
export const getTheme = (): string => {
  try {
    return localStorage.getItem(THEME_KEY) || 'red';
  } catch {
    return 'red';
  }
};
export const setTheme = (color: string) => safeSetItem(THEME_KEY, color);

/** Preset id or "#rrggbb" custom hex → "r, g, b" string for rgb(var(--primary-color)) */
export const THEME_RGB: Record<string, string> = {
  purple: '147, 51, 234',
  red: '220, 38, 38',
  blue: '37, 99, 235',
  green: '22, 163, 74',
  orange: '234, 88, 12',
};

export const themeToRgb = (theme: string): string => {
  if (THEME_RGB[theme]) return THEME_RGB[theme];
  const hex = theme.startsWith('#') ? theme : theme.startsWith('custom:') ? theme.slice(7) : null;
  if (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }
  return THEME_RGB['red'];
};
export const getMode = (): 'dark' | 'light' => {
  try {
    return localStorage.getItem(MODE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};
export const setMode = (mode: 'dark' | 'light') => safeSetItem(MODE_KEY, mode);

const DEFAULT_SERVER_KEY = 'streamhub_default_server';
const AUTOPLAY_NEXT_KEY = 'streamhub_autoplay_next';

export const getDefaultServer = (): string => {
  try {
    return localStorage.getItem(DEFAULT_SERVER_KEY) || 'ishowstream';
  } catch {
    return 'ishowstream';
  }
};
export const setDefaultServer = (server: string) => safeSetItem(DEFAULT_SERVER_KEY, server);

export const getAutoplayNext = (): boolean => {
  try {
    return localStorage.getItem(AUTOPLAY_NEXT_KEY) !== 'false';
  } catch {
    return true;
  }
};
export const setAutoplayNext = (val: boolean) => safeSetItem(AUTOPLAY_NEXT_KEY, val ? 'true' : 'false');

export const clearAllWatchData = () => {
  try {
    localStorage.removeItem(WATCHLIST_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(SPORTS_FAVORITES_KEY);
    localStorage.removeItem(SPORTS_REMINDERS_KEY);
  } catch {}
  parseCache.delete(WATCHLIST_KEY);
  parseCache.delete(HISTORY_KEY);
  parseCache.delete(PROGRESS_KEY);
  parseCache.delete(SPORTS_FAVORITES_KEY);
  parseCache.delete(SPORTS_REMINDERS_KEY);
  emitStorageChange(PROGRESS_KEY);
  emitStorageChange(WATCHLIST_KEY);
};

// Export/Import
export const exportData = (): string => {
    const data = {
        watchlist: getWatchlist(),
        history: getHistory(),
        progress: getProgress(),
        tvFavorites: getFavoriteChannels(),
        tvRecent: getRecentChannels(),
        providers: getStreamProviders(),
        sportsFavorites: getFavoriteSportsMatches(),
        settings: {
            theme: getTheme(),
            mode: getMode(),
        }
    };
    return JSON.stringify(data, null, 2);
};

export const importData = (jsonString: string): boolean => {
    try {
        const data = JSON.parse(jsonString);
        if (!data || typeof data !== 'object' || Array.isArray(data)) return false;

        if (Array.isArray(data.watchlist)) {
            safeSetItem(WATCHLIST_KEY, JSON.stringify(data.watchlist.map(compactMediaItem)));
        }
        if (Array.isArray(data.history)) {
            safeSetItem(HISTORY_KEY, JSON.stringify(data.history.slice(0, 20).map(compactMediaItem)));
        }
        if (Array.isArray(data.progress)) {
            safeSetItem(PROGRESS_KEY, JSON.stringify(data.progress.slice(0, 25)));
        }
        if (Array.isArray(data.tvFavorites)) {
            safeSetItem(TV_FAVORITES_KEY, JSON.stringify(data.tvFavorites));
        }
        if (Array.isArray(data.tvRecent)) {
            safeSetItem(TV_RECENT_KEY, JSON.stringify(data.tvRecent.slice(0, 10)));
        }
        if (Array.isArray(data.providers)) {
            safeSetItem(PROVIDERS_KEY, JSON.stringify(data.providers));
        }
        if (Array.isArray(data.sportsFavorites)) {
            safeSetItem(SPORTS_FAVORITES_KEY, JSON.stringify(data.sportsFavorites));
        }
        if (data.settings && typeof data.settings === 'object') {
            if (typeof data.settings.theme === 'string') safeSetItem(THEME_KEY, data.settings.theme);
            if (data.settings.mode === 'light' || data.settings.mode === 'dark') safeSetItem(MODE_KEY, data.settings.mode);
        }
        return true;
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
};