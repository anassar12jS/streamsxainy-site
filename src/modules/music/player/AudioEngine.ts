// @ts-ignore
import shaka from 'shaka-player/dist/shaka-player.compiled';
import { MusicTrack } from '../types';
import { SteeredClock } from './SteeredClock';

export interface AudioEngineCallbacks {
  onTimeUpdate?: (currentTime: number, duration?: number) => void;
  onStatusChange?: (status: 'idle' | 'loading' | 'playing' | 'paused' | 'error') => void;
  onEnded?: () => void;
  /** YouTube refused / failed to play the loaded video (code = YT iframe error: 2,5,100,101,150) */
  onYouTubeError?: (code: number | undefined) => void;
}

export type YouTubeStartResult = 'playing' | 'blocked' | 'error' | 'superseded';

let isYtScriptLoaded = false;
let ytApiReadyPromise: Promise<void> | null = null;

function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).YT && (window as any).YT.Player) {
    return Promise.resolve();
  }
  if (ytApiReadyPromise) return ytApiReadyPromise;

  ytApiReadyPromise = new Promise((resolve) => {
    const existingScript = document.getElementById('yt-iframe-api-script');
    if (!existingScript && !isYtScriptLoaded) {
      isYtScriptLoaded = true;
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    const prevOnReady = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (typeof prevOnReady === 'function') {
        try { prevOnReady(); } catch {}
      }
      resolve();
    };

    const interval = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        clearInterval(interval);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 8000);
  });

  return ytApiReadyPromise;
}

export class MusicAudioEngine {
  private player: any = null;
  public audioElement: HTMLAudioElement;
  public audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private isShakaSupported: boolean = false;
  public steeredClock: SteeredClock;

  // Dual-mode: HTML5 progressive/DASH or YouTube Full-Song Audio Player
  public activeMode: 'html5' | 'youtube' = 'html5';
  private ytPlayer: any = null;
  private isYtReady: boolean = false;
  /** Resolves true once the hidden YouTube player is ready (false if it never became ready) */
  private ytReadyPromise: Promise<boolean>;
  private resolveYtReady!: (ready: boolean) => void;
  /** Settles the in-flight playYouTube() call when YouTube reports the real outcome */
  private startWaiter: ((r: YouTubeStartResult) => void) | null = null;
  private loadToken = 0;
  private ytTimer: any = null;
  private callbacks: AudioEngineCallbacks | null = null;
  private currentVolume: number = 1;
  private currentMuted: boolean = false;

  constructor(audioElement: HTMLAudioElement, callbacks?: AudioEngineCallbacks) {
    this.audioElement = audioElement;
    this.audioElement.crossOrigin = 'anonymous';
    this.callbacks = callbacks || null;
    this.steeredClock = new SteeredClock(this.audioElement);
    this.ytReadyPromise = new Promise<boolean>(resolve => { this.resolveYtReady = resolve; });

    this.initAudioContext();
    this.initShaka();
    this.setupMediaSessionHandlers();
    this.initYouTubePlayer();
  }

  private initAudioContext() {
    try {
      if ((this.audioElement as any).__sourceNode) {
        this.sourceNode = (this.audioElement as any).__sourceNode;
        this.audioContext = (this.audioElement as any).__audioContext;
        return;
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.sourceNode.connect(this.audioContext.destination);
        (this.audioElement as any).__sourceNode = this.sourceNode;
        (this.audioElement as any).__audioContext = this.audioContext;
      }
    } catch (err) {
      console.warn('Web Audio Context initialization deferred or already attached:', err);
    }
  }

  private initShaka() {
    try {
      if (typeof window !== 'undefined' && shaka && shaka.polyfill) {
        shaka.polyfill.installAll();
        if (shaka.Player && shaka.Player.isBrowserSupported()) {
          this.isShakaSupported = true;
          this.player = new shaka.Player();
          this.player.configure({
            streaming: {
              bufferingGoal: 30,
              rebufferingGoal: 5,
            },
            manifest: {
              dash: {
                ignoreMinBufferTime: true,
              },
            },
          });
          this.player.attach(this.audioElement).catch((err: any) => {
            console.warn('Failed to attach Shaka Player to audio element:', err);
          });
        }
      }
    } catch (err) {
      console.warn('Shaka Player initialization skipped, falling back to progressive audio:', err);
    }
  }

  private async initYouTubePlayer() {
    try {
      await ensureYouTubeIframeApi();

      let container = document.getElementById('music-yt-hidden-player-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'music-yt-hidden-player-container';
        container.style.position = 'fixed';
        container.style.bottom = '-9999px';
        container.style.right = '-9999px';
        container.style.width = '200px';
        container.style.height = '200px';
        container.style.opacity = '0.001';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '-999';
        document.body.appendChild(container);
      }

      const playerDivId = `music-yt-iframe-${Date.now()}`;
      const playerDiv = document.createElement('div');
      playerDiv.id = playerDivId;
      container.appendChild(playerDiv);

      this.ytPlayer = new (window as any).YT.Player(playerDivId, {
        height: '200',
        width: '200',
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            this.isYtReady = true;
            this.setVolume(this.currentVolume);
            this.setMuted(this.currentMuted);
            this.resolveYtReady(true);
          },
          onStateChange: (event: any) => {
            if (this.activeMode !== 'youtube') return;
            const state = event.data;
            // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            if (state === 1) {
              this.callbacks?.onStatusChange?.('playing');
              this.startYouTubeTimer();
              this.settleStart('playing');
            } else if (state === 2) {
              this.callbacks?.onStatusChange?.('paused');
              this.stopYouTubeTimer();
            } else if (state === 3) {
              this.callbacks?.onStatusChange?.('loading');
            } else if (state === 0) {
              this.stopYouTubeTimer();
              this.callbacks?.onEnded?.();
            }
          },
          onError: (err: any) => {
            console.warn('YouTube Player playback error:', err);
            if (this.activeMode === 'youtube') {
              this.callbacks?.onYouTubeError?.(typeof err?.data === 'number' ? err.data : undefined);
              this.settleStart('error');
            }
          },
        },
      });
    } catch (e) {
      console.warn('YouTube Iframe Player initialization error:', e);
      this.resolveYtReady(false);
    }
    // Never leave playYouTube() waiting forever if the iframe API is blocked
    setTimeout(() => this.resolveYtReady(this.isYtReady), 10000);
  }

  private settleStart(result: YouTubeStartResult) {
    const w = this.startWaiter;
    this.startWaiter = null;
    w?.(result);
  }

  public async resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {}
    }
  }

  /**
   * Plays a full-length song through the hidden YouTube player.
   *
   * Resolves with what YouTube ACTUALLY did, not what we hoped for:
   *  - 'playing'    playback really started
   *  - 'blocked'    the browser/YouTube didn't start it (autoplay policy); a user press will
   *  - 'error'      YouTube refused the video (e.g. embedding disabled) -> caller should fall back
   *  - 'superseded' a newer track was requested meanwhile
   */
  public async playYouTube(videoId: string): Promise<YouTubeStartResult> {
    this.activeMode = 'youtube';
    const token = ++this.loadToken;
    this.settleStart('superseded'); // release a previous waiter

    // Stop the HTML5 element
    this.audioElement.pause();
    this.audioElement.removeAttribute('src');

    this.callbacks?.onStatusChange?.('loading');
    const ready = await this.ytReadyPromise;
    if (token !== this.loadToken) return 'superseded';
    if (!ready || !this.ytPlayer) {
      this.callbacks?.onStatusChange?.('error');
      return 'error';
    }

    return new Promise<YouTubeStartResult>((resolve) => {
      let nudge: any;
      let watchdog: any;
      this.startWaiter = (result) => {
        clearTimeout(nudge);
        clearTimeout(watchdog);
        resolve(result);
      };

      try {
        // loadVideoById already autoplays. 'tiny' keeps the (unused) video stream minimal so
        // the audio starts sooner.
        this.ytPlayer.loadVideoById({ videoId, startSeconds: 0, suggestedQuality: 'tiny' });
        this.ytPlayer.setPlaybackQuality?.('tiny');
      } catch (err) {
        console.warn('Error loading video in YouTube player:', err);
        this.callbacks?.onStatusChange?.('error');
        this.settleStart('error');
        return;
      }

      // If it hasn't started shortly, nudge it once...
      nudge = setTimeout(() => {
        if (token === this.loadToken && this.startWaiter) {
          try { this.ytPlayer.playVideo(); } catch {}
        }
      }, 800);
      // ...and if it still doesn't, report 'blocked' so fallbacks kick in without making the app feel slow
      watchdog = setTimeout(() => {
        if (token === this.loadToken && this.startWaiter) this.settleStart('blocked');
      }, 3500);
    });
  }

  private startYouTubeTimer() {
    this.stopYouTubeTimer();
    this.ytTimer = setInterval(() => {
      if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        try {
          const current = this.ytPlayer.getCurrentTime() || 0;
          const duration = this.ytPlayer.getDuration() || 0;
          this.steeredClock.setTime(current);
          if (duration > 0) {
            this.callbacks?.onTimeUpdate?.(current, duration);
          }
        } catch {}
      }
    }, 120);
  }

  private stopYouTubeTimer() {
    if (this.ytTimer) {
      clearInterval(this.ytTimer);
      this.ytTimer = null;
    }
  }

  /**
   * Loads direct HTTP / DASH audio stream (e.g. for live radio stations).
   */
  public async loadStream(streamUrl: string, isDash: boolean = false): Promise<void> {
    if (!streamUrl || typeof streamUrl !== 'string' || (!streamUrl.startsWith('http') && !streamUrl.startsWith('blob:'))) {
      throw new Error(`Invalid audio stream source: ${String(streamUrl)}`);
    }

    this.activeMode = 'html5';
    this.stopYouTubeTimer();
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try { this.ytPlayer.pauseVideo(); } catch {}
    }

    await this.resumeAudioContext();

    if (isDash && this.isShakaSupported && this.player) {
      try {
        await this.player.attach(this.audioElement);
        await this.player.load(streamUrl);
        await this.audioElement.play();
        return;
      } catch (err) {
        console.warn('Shaka DASH load failed, trying standard audio fallback:', err);
      }
    }

    // Standard progressive HTTP streaming fallback
    try {
      if (this.player) {
        try {
          await this.player.detach();
        } catch {}
      }
      this.audioElement.src = streamUrl;
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        console.warn('Autoplay held by browser policy; user gesture will start playback');
        this.callbacks?.onStatusChange?.('paused');
        return;
      }
      console.error('Audio play error:', err);
      throw err;
    }
  }

  public play(): Promise<void> {
    if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      try {
        this.ytPlayer.playVideo();
        return Promise.resolve();
      } catch {}
    }
    void this.resumeAudioContext();
    return this.audioElement.play();
  }

  public setMediaSessionState(state: 'playing' | 'paused' | 'none') {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try { navigator.mediaSession.playbackState = state; } catch {}
    }
  }

  public pause(): void {
    if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
        return;
      } catch {}
    }
    this.audioElement.pause();
  }

  public seek(seconds: number): void {
    const target = Math.max(0, seconds);
    if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try {
        this.ytPlayer.seekTo(target, true);
        const duration = this.ytPlayer.getDuration?.() || 0;
        this.callbacks?.onTimeUpdate?.(target, duration > 0 ? duration : undefined);
        return;
      } catch {}
    }
    this.audioElement.currentTime = target;
  }

  public setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    this.audioElement.volume = this.currentVolume;
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(Math.round(this.currentVolume * 100));
      } catch {}
    }
  }

  public setMuted(muted: boolean): void {
    this.currentMuted = muted;
    this.audioElement.muted = muted;
    if (this.ytPlayer) {
      try {
        if (muted && typeof this.ytPlayer.mute === 'function') {
          this.ytPlayer.mute();
        } else if (!muted && typeof this.ytPlayer.unMute === 'function') {
          this.ytPlayer.unMute();
        }
      } catch {}
    }
  }

  public getCurrentTime(): number {
    if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
      try {
        return this.ytPlayer.getCurrentTime() || 0;
      } catch {}
    }
    return this.audioElement.currentTime;
  }

  public getDuration(): number {
    if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function') {
      try {
        return this.ytPlayer.getDuration() || 0;
      } catch {}
    }
    return this.audioElement.duration || 0;
  }

  public syncMediaSession(track: MusicTrack, onPlay?: () => void, onPause?: () => void, onNext?: () => void, onPrev?: () => void) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        artwork: [
          { src: track.artwork, sizes: '96x96', type: 'image/jpeg' },
          { src: track.artwork, sizes: '256x256', type: 'image/jpeg' },
          { src: track.artwork, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      if (onPlay) navigator.mediaSession.setActionHandler('play', onPlay);
      if (onPause) navigator.mediaSession.setActionHandler('pause', onPause);
      if (onNext) navigator.mediaSession.setActionHandler('nexttrack', onNext);
      if (onPrev) navigator.mediaSession.setActionHandler('previoustrack', onPrev);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.seek(details.seekTime);
        }
      });
    } catch (err) {
      console.debug('MediaSession registration error:', err);
    }
  }

  private setupMediaSessionHandlers() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const delta = details.seekOffset || 10;
        this.seek(this.getCurrentTime() + delta);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const delta = details.seekOffset || 10;
        this.seek(this.getCurrentTime() - delta);
      });
    } catch {}
  }

  public destroy() {
    this.stopYouTubeTimer();
    this.audioElement.pause();
    this.audioElement.removeAttribute('src');
    this.audioElement.load();
    this.steeredClock.destroy();

    if (this.ytPlayer) {
      try {
        this.ytPlayer.destroy();
      } catch {}
      this.ytPlayer = null;
    }

    if (this.player) {
      try {
        this.player.destroy();
        this.player = null;
      } catch {}
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }
}
