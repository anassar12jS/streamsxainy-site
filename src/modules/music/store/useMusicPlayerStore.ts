import { create } from 'zustand';
import { MusicTrack, LyricsData } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

const STORAGE_LIKES = 'bitchord_music_likes';
const STORAGE_RECENT = 'bitchord_music_recent';
const STORAGE_VOLUME = 'bitchord_music_volume';
const STORAGE_SESSION = 'bitchord_music_session_v1';
const STORAGE_AUTOPLAY = 'bitchord_music_autoplay_radio';

interface StoredSession { currentTrack: MusicTrack | null; queue: MusicTrack[]; queueIndex: number; }

/** Last track + queue, so a reload resumes where you were (paused, not auto-playing). */
const loadStoredSession = (): StoredSession => {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION);
    if (raw) {
      const v = JSON.parse(raw) as StoredSession;
      if (v?.currentTrack && Array.isArray(v.queue)) return v;
    }
  } catch {}
  return { currentTrack: null, queue: [], queueIndex: 0 };
};

const saveSession = (currentTrack: MusicTrack | null, queue: MusicTrack[], queueIndex: number) => {
  try {
    // keep the window around the current song; the full queue can be huge
    const start = Math.max(0, queueIndex - 5);
    const slice = queue.slice(start, start + 100);
    localStorage.setItem(
      STORAGE_SESSION,
      JSON.stringify({ currentTrack, queue: slice, queueIndex: queueIndex - start })
    );
  } catch {}
};

const loadStoredAutoplay = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_AUTOPLAY) !== '0';
  } catch {
    return true;
  }
};


const loadStoredLikes = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_LIKES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const loadStoredRecent = (): MusicTrack[] => {
  try {
    const raw = localStorage.getItem(STORAGE_RECENT);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const loadStoredVolume = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_VOLUME);
    return raw !== null ? Number(raw) : 0.85;
  } catch {
    return 0.85;
  }
};

export interface MusicPlayerState {
  currentTrack: MusicTrack | null;
  playbackStatus: PlaybackStatus;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: MusicTrack[];
  queueIndex: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  showLyrics: boolean;
  showQueue: boolean;
  immersiveTab: 'lyrics' | 'queue';
  audioQuality: 'auto' | 'high' | 'lossless';
  extensionConnected: boolean;
  likedTrackIds: string[];
  recentlyPlayed: MusicTrack[];
  activeLyrics: LyricsData | null;
  isLoadingLyrics: boolean;
  trackPlayNonce: number;
  activeAccount: any | null;
  /** When the queue runs out, keep playing similar songs (YouTube Music radio) */
  autoplayRadio: boolean;

  // Actions
  setActiveAccount: (account: any) => void;
  setTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  playTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setShowLyrics: (show: boolean) => void;
  toggleLyrics: () => void;
  setShowQueue: (show: boolean) => void;
  toggleQueue: () => void;
  setImmersiveTab: (tab: 'lyrics' | 'queue') => void;
  toggleLike: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
  addToQueue: (track: MusicTrack, playNext?: boolean) => void;
  /** Appends tracks not already queued; returns how many were added */
  appendToQueue: (tracks: MusicTrack[]) => number;
  setAutoplayRadio: (on: boolean) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  setTime: (currentTime: number, duration?: number) => void;
  setLyrics: (lyrics: LyricsData | null) => void;
  setIsLoadingLyrics: (loading: boolean) => void;
  setExtensionConnected: (connected: boolean) => void;
}

const initialSession = loadStoredSession();

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  currentTrack: initialSession.currentTrack,
  playbackStatus: 'idle',
  currentTime: 0,
  duration: initialSession.currentTrack?.duration || 0,
  volume: loadStoredVolume(),
  isMuted: false,
  queue: initialSession.queue,
  queueIndex: initialSession.queueIndex,
  shuffle: false,
  repeatMode: 'off',
  showLyrics: false,
  showQueue: false,
  immersiveTab: 'lyrics',
  audioQuality: 'lossless',
  extensionConnected: false,
  likedTrackIds: loadStoredLikes(),
  recentlyPlayed: loadStoredRecent(),
  activeLyrics: null,
  isLoadingLyrics: false,
  trackPlayNonce: 0,
  activeAccount: null,
  autoplayRadio: loadStoredAutoplay(),

  setActiveAccount: (account: any) => {
    try {
      if (account) {
        localStorage.setItem('bitchord_active_account', JSON.stringify(account));
        if (account.id) {
          localStorage.setItem('bitchord_selected_channel_id', account.id);
        }
      }
    } catch {}
    set({ activeAccount: account });
  },

  setTrack: (track, newQueue) => {
    const state = get();
    let updatedQueue = newQueue || state.queue;
    let newIndex = 0;

    if (newQueue && newQueue.length > 0) {
      updatedQueue = newQueue;
      const found = updatedQueue.findIndex(t => t.id === track.id);
      newIndex = found >= 0 ? found : 0;
    } else {
      const existing = updatedQueue.findIndex(t => t.id === track.id);
      if (existing >= 0) {
        newIndex = existing;
      } else {
        updatedQueue = [track, ...updatedQueue];
        newIndex = 0;
      }
    }

    // Update recently played
    const filteredRecent = state.recentlyPlayed.filter(t => t.id !== track.id);
    const updatedRecent = [track, ...filteredRecent].slice(0, 40);
    try {
      localStorage.setItem(STORAGE_RECENT, JSON.stringify(updatedRecent));
    } catch {}

    saveSession(track, updatedQueue, newIndex);

    set({
      currentTrack: track,
      queue: updatedQueue,
      queueIndex: newIndex,
      currentTime: 0,
      duration: track.duration || 0,
      playbackStatus: 'loading',
      activeLyrics: null,
      isLoadingLyrics: true,
      recentlyPlayed: updatedRecent,
      trackPlayNonce: Date.now(),
    });
  },

  playTrack: (track, newQueue) => {
    get().setTrack(track, newQueue);
  },

  play: () => set({ playbackStatus: 'playing' }),
  pause: () => set({ playbackStatus: 'paused' }),
  togglePlayPause: () => {
    const { playbackStatus, currentTrack, queue } = get();
    if (!currentTrack && queue.length > 0) {
      get().playTrack(queue[0]);
      return;
    }
    if (playbackStatus === 'idle' && currentTrack) {
      get().playTrack(currentTrack);
      return;
    }
    if (playbackStatus === 'playing') {
      set({ playbackStatus: 'paused' });
    } else if (currentTrack) {
      set({ playbackStatus: 'playing' });
    }
  },

  nextTrack: () => {
    const { queue, queueIndex, shuffle, repeatMode } = get();
    if (queue.length === 0) return;

    let nextIdx = queueIndex + 1;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else if (nextIdx >= queue.length) {
      if (repeatMode === 'all') {
        nextIdx = 0;
      } else {
        set({ playbackStatus: 'paused' });
        return;
      }
    }

    const nextTrackItem = queue[nextIdx];
    if (nextTrackItem) {
      get().setTrack(nextTrackItem);
    }
  },

  prevTrack: () => {
    const { queue, queueIndex, currentTime } = get();
    if (queue.length === 0) return;

    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }

    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = queue.length - 1;
    }

    const prevTrackItem = queue[prevIdx];
    if (prevTrackItem) {
      get().setTrack(prevTrackItem);
    }
  },

  seek: (seconds) => {
    set({ currentTime: Math.max(0, seconds) });
  },

  setVolume: (vol) => {
    const clamped = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem(STORAGE_VOLUME, String(clamped));
    } catch {}
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () => {
    set(state => ({ isMuted: !state.isMuted }));
  },

  toggleShuffle: () => {
    set(state => ({ shuffle: !state.shuffle }));
  },

  cycleRepeat: () => {
    set(state => {
      if (state.repeatMode === 'off') return { repeatMode: 'all' };
      if (state.repeatMode === 'all') return { repeatMode: 'one' };
      return { repeatMode: 'off' };
    });
  },

  setImmersiveTab: (tab) => set({ immersiveTab: tab }),

  setShowLyrics: (show) => set({ showLyrics: show, showQueue: false, ...(show ? { immersiveTab: 'lyrics' } : {}) }),
  toggleLyrics: () => {
    const next = !get().showLyrics;
    set({ showLyrics: next, showQueue: false, ...(next ? { immersiveTab: 'lyrics' } : {}) });
  },

  setShowQueue: (show) => {
    const state = get();
    if (state.showLyrics) {
      set({ immersiveTab: show ? 'queue' : 'lyrics', showQueue: false });
    } else {
      set({ showQueue: show });
    }
  },
  toggleQueue: () => {
    const state = get();
    if (state.showLyrics) {
      set({ 
        immersiveTab: state.immersiveTab === 'queue' ? 'lyrics' : 'queue',
        showQueue: false 
      });
    } else {
      set({ showQueue: !state.showQueue });
    }
  },

  toggleLike: (trackId) => {
    set(state => {
      const exists = state.likedTrackIds.includes(trackId);
      const updated = exists
        ? state.likedTrackIds.filter(id => id !== trackId)
        : [...state.likedTrackIds, trackId];
      try {
        localStorage.setItem(STORAGE_LIKES, JSON.stringify(updated));
      } catch {}
      return { likedTrackIds: updated };
    });
  },

  isLiked: (trackId) => {
    return get().likedTrackIds.includes(trackId);
  },

  addToQueue: (track, playNext = false) => {
    set(state => {
      if (playNext && state.currentTrack) {
        const nextQueue = [...state.queue];
        nextQueue.splice(state.queueIndex + 1, 0, track);
        return { queue: nextQueue };
      }
      return { queue: [...state.queue, track] };
    });
  },

  appendToQueue: (tracks) => {
    const { queue, currentTrack, queueIndex } = get();
    const have = new Set(queue.map(t => t.id));
    const fresh = tracks.filter(t => !have.has(t.id));
    if (!fresh.length) return 0;
    const next = [...queue, ...fresh];
    set({ queue: next });
    saveSession(currentTrack, next, queueIndex);
    return fresh.length;
  },

  setAutoplayRadio: (on) => {
    try { localStorage.setItem(STORAGE_AUTOPLAY, on ? '1' : '0'); } catch {}
    set({ autoplayRadio: on });
  },

  removeFromQueue: (index) => {
    set(state => {
      const nextQueue = state.queue.filter((_, idx) => idx !== index);
      const nextIdx = index < state.queueIndex ? state.queueIndex - 1 : state.queueIndex;
      return { queue: nextQueue, queueIndex: Math.max(0, nextIdx) };
    });
  },

  clearQueue: () => {
    const { currentTrack } = get();
    set({ queue: currentTrack ? [currentTrack] : [], queueIndex: 0 });
  },

  setPlaybackStatus: (status) => set({ playbackStatus: status }),
  setTime: (currentTime, duration) => {
    if (duration !== undefined && duration > 0) {
      set({ currentTime, duration });
    } else {
      set({ currentTime });
    }
  },

  setLyrics: (lyrics) => set({ activeLyrics: lyrics, isLoadingLyrics: false }),
  setIsLoadingLyrics: (loading) => set({ isLoadingLyrics: loading }),
  setExtensionConnected: (connected) => set({ extensionConnected: connected }),
}));
