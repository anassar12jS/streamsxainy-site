import { create } from 'zustand';
import { MusicTrack, LyricsData } from '../types';

export type RepeatMode = 'off' | 'all' | 'one';
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

const STORAGE_LIKES = 'bitchord_music_likes';
const STORAGE_RECENT = 'bitchord_music_recent';
const STORAGE_VOLUME = 'bitchord_music_volume';

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
  audioQuality: 'auto' | 'high' | 'lossless';
  extensionConnected: boolean;
  likedTrackIds: string[];
  recentlyPlayed: MusicTrack[];
  activeLyrics: LyricsData | null;
  isLoadingLyrics: boolean;
  trackPlayNonce: number;

  // Actions
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
  toggleLike: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
  addToQueue: (track: MusicTrack, playNext?: boolean) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  setTime: (currentTime: number, duration?: number) => void;
  setLyrics: (lyrics: LyricsData | null) => void;
  setIsLoadingLyrics: (loading: boolean) => void;
  setExtensionConnected: (connected: boolean) => void;
}

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  currentTrack: null,
  playbackStatus: 'idle',
  currentTime: 0,
  duration: 0,
  volume: loadStoredVolume(),
  isMuted: false,
  queue: [],
  queueIndex: 0,
  shuffle: false,
  repeatMode: 'off',
  showLyrics: false,
  showQueue: false,
  audioQuality: 'lossless',
  extensionConnected: false,
  likedTrackIds: loadStoredLikes(),
  recentlyPlayed: loadStoredRecent(),
  activeLyrics: null,
  isLoadingLyrics: false,
  trackPlayNonce: 0,

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

  setShowLyrics: (show) => set({ showLyrics: show, showQueue: show ? false : get().showQueue }),
  toggleLyrics: () => {
    const next = !get().showLyrics;
    set({ showLyrics: next, showQueue: next ? false : get().showQueue });
  },

  setShowQueue: (show) => set({ showQueue: show, showLyrics: show ? false : get().showLyrics }),
  toggleQueue: () => {
    const next = !get().showQueue;
    set({ showQueue: next, showLyrics: next ? false : get().showLyrics });
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
