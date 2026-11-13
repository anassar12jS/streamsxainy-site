

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
    const value = (raw ? JSON.parse(raw) : fallback) as T;
    parseCache.set(key, { raw, value });
    return value;
  } catch (e) {
    return fallback;
  }
};

// --- Watchlist ---
export const getWatchlist = (): TMDBResult[] => readStoredJSON<TMDBResult[]>(WATCHLIST_KEY, []);

export const addToWatchlist = (item: TMDBResult) => {
  const list = getWatchlist();
  if (!list.find(i => i.id === item.id)) {
    const updated = [item, ...list];
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
    emitStorageChange(WATCHLIST_KEY);
  }
};

export const removeFromWatchlist = (id: number) => {
  const list = getWatchlist();
  const updated = list.filter(i => i.id !== id);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
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
  const updated = [item, ...filtered].slice(0, 20);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
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
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
  emitStorageChange(PROGRESS_KEY);
};

export const removeFromProgress = (id: number) => {
  const list = getProgress();
  const updated = list.filter(i => i.id !== id);
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
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
    localStorage.setItem(TV_FAVORITES_KEY, JSON.stringify(updated));
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
    localStorage.setItem(TV_RECENT_KEY, JSON.stringify(updated));
};

// --- Sports Favorites ---
export const getFavoriteSportsMatches = (): string[] => readStoredJSON<string[]>(SPORTS_FAVORITES_KEY, []);

export const addFavoriteSportsMatch = (id: string) => {
    const list = getFavoriteSportsMatches();
    if (!list.includes(id)) {
        const updated = [id, ...list];
        localStorage.setItem(SPORTS_FAVORITES_KEY, JSON.stringify(updated));
    }
};

export const removeFavoriteSportsMatch = (id: string) => {
    const list = getFavoriteSportsMatches();
    const updated = list.filter(i => i !== id);
    localStorage.setItem(SPORTS_FAVORITES_KEY, JSON.stringify(updated));
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
        localStorage.setItem(SPORTS_REMINDERS_KEY, JSON.stringify(updated));
    }
};

export const removeMatchReminder = (id: string) => {
    const list = getMatchReminders();
    const updated = list.filter(i => i !== id);
    localStorage.setItem(SPORTS_REMINDERS_KEY, JSON.stringify(updated));
};

export const isMatchReminder = (id: string): boolean => {
    const list = getMatchReminders();
    return list.includes(id);
};


// --- Stream Providers ---
export const getStreamProviders = (): StreamProvider[] => {
    const stored = localStorage.getItem(PROVIDERS_KEY);
    // Fallback for legacy single URL storage
    const legacyUrl = localStorage.getItem('torrentio_url');

    if (stored) return readStoredJSON<StreamProvider[]>(PROVIDERS_KEY, []);

    if (legacyUrl) {
        return [{ name: 'Torrentio (Legacy)', url: legacyUrl }];
    }

    return [{ name: 'Torrentio', url: TORRENTIO_BASE_URL }];
};

export const saveStreamProviders = (providers: StreamProvider[]) => {
    localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers));
};

// --- Settings & Data ---
export const getTheme = (): string => localStorage.getItem(THEME_KEY) || 'purple';
export const setTheme = (color: string) => localStorage.setItem(THEME_KEY, color);

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
  return THEME_RGB['purple'];
};
export const getMode = (): 'dark' | 'light' => (localStorage.getItem(MODE_KEY) as 'dark' | 'light') || 'dark';
export const setMode = (mode: 'dark' | 'light') => localStorage.setItem(MODE_KEY, mode);

const DEFAULT_SERVER_KEY = 'streamhub_default_server';
const AUTOPLAY_NEXT_KEY = 'streamhub_autoplay_next';

export const getDefaultServer = (): string => localStorage.getItem(DEFAULT_SERVER_KEY) || 'ishowstream';
export const setDefaultServer = (server: string) => localStorage.setItem(DEFAULT_SERVER_KEY, server);

export const getAutoplayNext = (): boolean => localStorage.getItem(AUTOPLAY_NEXT_KEY) !== 'false';
export const setAutoplayNext = (val: boolean) => localStorage.setItem(AUTOPLAY_NEXT_KEY, val ? 'true' : 'false');

export const clearAllWatchData = () => {
  localStorage.removeItem(WATCHLIST_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(PROGRESS_KEY);
  localStorage.removeItem(SPORTS_FAVORITES_KEY);
  localStorage.removeItem(SPORTS_REMINDERS_KEY);
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
        if (data.watchlist) localStorage.setItem(WATCHLIST_KEY, JSON.stringify(data.watchlist));
        if (data.history) localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
        if (data.progress) localStorage.setItem(PROGRESS_KEY, JSON.stringify(data.progress));
        if (data.tvFavorites) localStorage.setItem(TV_FAVORITES_KEY, JSON.stringify(data.tvFavorites));
        if (data.tvRecent) localStorage.setItem(TV_RECENT_KEY, JSON.stringify(data.tvRecent));
        if (data.providers) localStorage.setItem(PROVIDERS_KEY, JSON.stringify(data.providers));
        if (data.sportsFavorites) localStorage.setItem(SPORTS_FAVORITES_KEY, JSON.stringify(data.sportsFavorites));
        if (data.settings) {
            if (data.settings.theme) localStorage.setItem(THEME_KEY, data.settings.theme);
            if (data.settings.mode) localStorage.setItem(MODE_KEY, data.settings.mode);
        }
        return true;
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
};