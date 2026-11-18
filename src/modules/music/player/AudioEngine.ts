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

  // Dual-mode: HTML5 progressive/DASH or YouTube Full-Song Audio Player
  public activeMode: 'html5' | 'youtube' = 'html5';
  private ytPlayer: any = null;

  /** Clock of whichever channel is currently driving playback */
  public get steeredClock(): SteeredClock {
    if (this.activeSlot === 'b' && this.nextClock) return this.nextClock;
    return this._steeredClockA;
  }
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
  /** 0..1 transition gain layered over the user's volume for crossfade-style fades */
  private fadeGain: number = 1;
  private fadeRaf: number | null = null;
  private fadingDirection: 'in' | 'out' | null = null;

  // --- Crossfade / gapless second channel ---
  // Slot 'a' is the original audioElement; slot 'b' is a lazily-created second
  // element used to pre-roll the next track. Exactly one slot is 'active' (the
  // one the store considers current); the other may hold a primed next track.
  private _steeredClockA!: SteeredClock;
  private activeSlot: 'a' | 'b' = 'a';
  private nextAudio: HTMLAudioElement | null = null;
  private nextShaka: any = null;
  private nextClock: SteeredClock | null = null;
  private slotMix: Record<'a' | 'b', number> = { a: 1, b: 1 };
  private slotTrackId: Record<'a' | 'b', string | null> = { a: null, b: null };
  private pendingNext: { trackId: string; url: string; isDash: boolean } | null = null;
  private crossfadeLive = false;
  private promotedTrackId: string | null = null;
  private mixRaf: number | null = null;

  constructor(audioElement: HTMLAudioElement, callbacks?: AudioEngineCallbacks) {
    this.audioElement = audioElement;
    this.audioElement.crossOrigin = 'anonymous';
    this.callbacks = callbacks || null;
    this._steeredClockA = new SteeredClock(this.audioElement);
    this.ytReadyPromise = new Promise<boolean>(resolve => { this.resolveYtReady = resolve; });

    this.initAudioContext();
    this.attachPrimaryEndedListener();
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


  // ---------- Crossfade / gapless second channel ----------

  private slotEl(slot: 'a' | 'b'): HTMLAudioElement {
    return slot === 'a' ? this.audioElement : (this.nextAudio as HTMLAudioElement);
  }

  private get activeEl(): HTMLAudioElement {
    return this.activeSlot === 'b' && this.nextAudio ? this.nextAudio : this.audioElement;
  }

  private otherSlot(slot: 'a' | 'b'): 'a' | 'b' {
    return slot === 'a' ? 'b' : 'a';
  }

  /** True when the given element is the channel currently driving playback */
  public isActiveElement(el: HTMLAudioElement | null): boolean {
    if (!el) return false;
    return el === this.activeEl;
  }

  private ensureNextChannel(): HTMLAudioElement {
    if (this.nextAudio) return this.nextAudio;
    const el = document.createElement('audio');
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    // Events on the secondary channel only surface while it is ACTIVE —
    // the primary element's events are handled by the host component.
    const onTime = () => {
      if (this.activeSlot === 'b') {
        this.callbacks?.onTimeUpdate?.(el.currentTime, el.duration || 0);
      }
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onTime);
    el.addEventListener('playing', () => {
      if (this.activeSlot === 'b') this.callbacks?.onStatusChange?.('playing');
    });
    el.addEventListener('pause', () => {
      if (this.activeSlot === 'b' && !el.ended) this.callbacks?.onStatusChange?.('paused');
    });
    el.addEventListener('ended', () => this.handleSlotEnded('b'));
    el.addEventListener('error', () => {
      if (this.activeSlot === 'b') this.callbacks?.onStatusChange?.('error');
    });
    this.nextAudio = el;
    this.nextClock = new SteeredClock(el);
    return el;
  }

  // 'ended' on the PRIMARY element — attached here so crossfade promotion runs
  // before the host component's own 'ended' listener advances the queue.
  private attachPrimaryEndedListener() {
    this.audioElement.addEventListener('ended', () => this.handleSlotEnded('a'));
  }

  private handleSlotEnded(slot: 'a' | 'b') {
    if (slot !== this.activeSlot) return; // next-channel end is not a track boundary
    if (this.crossfadeLive) {
      this.promoteNextSlot();
      // Primary-element ends are advanced by the host listener; the secondary
      // channel must emit the ended callback itself.
      if (slot === 'b') this.callbacks?.onEnded?.();
    } else if (slot === 'b') {
      this.callbacks?.onEnded?.();
    }
    // slot 'a' without crossfade: the host listener performs the advance.
  }

  /** Swaps channel roles after the outgoing track ends mid-crossfade. */
  private promoteNextSlot() {
    const incoming = this.otherSlot(this.activeSlot);
    const incomingEl = this.slotEl(incoming);
    // If the primed track already finished (very short jingle), don't promote —
    // let the normal load path handle it instead.
    if (incomingEl && incomingEl.ended) {
      this.crossfadeLive = false;
      this.pendingNext = null;
      this.promotedTrackId = null;
      this.slotMix = { a: 1, b: 1 };
      this.applyVolume();
      return;
    }
    this.activeSlot = incoming;
    this.promotedTrackId = this.slotTrackId[incoming];
    this.crossfadeLive = false;
    this.pendingNext = null;
    this.slotMix = { a: 1, b: 1 };
    this.fadeGain = 1;
    this.fadingDirection = null;
    if (this.mixRaf !== null) { cancelAnimationFrame(this.mixRaf); this.mixRaf = null; }
    const outgoing = this.otherSlot(this.activeSlot);
    const outgoingEl = this.slotEl(outgoing);
    if (outgoingEl && outgoingEl !== incomingEl) {
      try { outgoingEl.pause(); } catch {}
    }
    this.slotTrackId[outgoing] = null;
    this.applyVolume();
  }

  /** Returns the track id that crossfade-promoted playback just started, once. */
  public consumePromotedTrackId(): string | null {
    const id = this.promotedTrackId;
    this.promotedTrackId = null;
    return id;
  }

  /** Pre-loads the next track on the idle channel so it can crossfade in. */
  public armNextTrack(trackId: string, url: string, isDash: boolean) {
    if (this.activeMode !== 'html5' || this.crossfadeLive || this.pendingNext) return;
    const slot = this.otherSlot(this.activeSlot);
    const el = this.ensureNextChannel();
    try { el.pause(); } catch {}
    this.pendingNext = { trackId, url, isDash };
    this.slotTrackId[slot] = trackId;
    this.slotMix[slot] = 0;
    this.applyVolume();
    try {
      if (isDash && this.isShakaSupported) {
        this.ensureNextShaka().then((player: any) => {
          if (this.pendingNext?.url !== url) return;
          player.attach(el).then(() => player.load(url)).catch(() => {});
        }).catch(() => {});
      } else {
        el.src = url;
        el.load();
      }
    } catch {}
  }

  private ensureNextShaka(): Promise<any> {
    if (this.nextShaka) return Promise.resolve(this.nextShaka);
    return import('shaka-player/dist/shaka-player.compiled').then((shaka: any) => {
      const player = new shaka.Player();
      player.configure({ streaming: { bufferingGoal: 30 } });
      this.nextShaka = player;
      return player;
    });
  }

  public hasPendingNext(): boolean {
    return this.pendingNext !== null && this.nextAudio !== null;
  }

  public isCrossfadeLive(): boolean {
    return this.crossfadeLive;
  }

  /** Begins the overlap: next channel fades in while the active one fades out. */
  public startCrossfade(durationMs = 2400): boolean {
    if (this.activeMode !== 'html5' || !this.pendingNext || !this.nextAudio || this.crossfadeLive) {
      return false;
    }
    const nextEl = this.nextAudio;
    const nextSlot = this.otherSlot(this.activeSlot);
    this.crossfadeLive = true;
    this.slotMix[nextSlot] = 0;
    this.applyVolume();
    nextEl.play().catch(() => {
      // Autoplay blocked or load failure — abandon the crossfade cleanly.
      this.crossfadeLive = false;
      this.pendingNext = null;
      this.slotTrackId[nextSlot] = null;
      this.slotMix = { a: 1, b: 1 };
      try { nextEl.pause(); } catch {}
      this.applyVolume();
    });
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      const eased = t * t * (3 - 2 * t); // smoothstep
      this.slotMix[this.activeSlot] = 1 - eased;
      this.slotMix[nextSlot] = eased;
      this.applyVolume();
      if (t < 1 && this.crossfadeLive) {
        this.mixRaf = requestAnimationFrame(tick);
      } else {
        this.mixRaf = null;
      }
    };
    this.mixRaf = requestAnimationFrame(tick);
    return true;
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

    // Stop the HTML5 elements
    this.pendingNext = null;
    this.crossfadeLive = false;
    this.promotedTrackId = null;
    this.slotMix = { a: 1, b: 1 };
    this.slotTrackId = { a: null, b: null };
    this.audioElement.pause();
    this.audioElement.removeAttribute('src');
    if (this.nextAudio) {
      try { this.nextAudio.pause(); this.nextAudio.removeAttribute('src'); this.nextAudio.load(); } catch {}
    }

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
  public async loadStream(streamUrl: string, isDash: boolean = false, trackId?: string): Promise<void> {
    if (!streamUrl || typeof streamUrl !== 'string' || (!streamUrl.startsWith('http') && !streamUrl.startsWith('blob:'))) {
      throw new Error(`Invalid audio stream source: ${String(streamUrl)}`);
    }

    this.activeMode = 'html5';
    this.stopYouTubeTimer();
    // A fresh load replaces whatever was queued for crossfade.
    this.pendingNext = null;
    this.crossfadeLive = false;
    this.promotedTrackId = null;
    this.slotMix = { a: 1, b: 1 };
    const idle = this.otherSlot(this.activeSlot);
    const idleEl = this.slotEl(idle);
    if (idleEl && idleEl !== this.activeEl) {
      try { idleEl.pause(); idleEl.removeAttribute('src'); idleEl.load(); } catch {}
      const idlePlayer = idle === 'b' ? this.nextShaka : this.player;
      if (idlePlayer) { try { idlePlayer.detach().catch(() => {}); } catch {} }
    }
    this.slotTrackId[idle] = null;
    this.slotTrackId[this.activeSlot] = trackId ?? null;
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try { this.ytPlayer.pauseVideo(); } catch {}
    }

    await this.resumeAudioContext();

    const el = this.activeEl;
    const isSlotB = this.activeSlot === 'b';

    if (isDash) {
      try {
        const player = isSlotB ? await this.ensureNextShaka() : this.player;
        if (player) {
          await player.attach(el);
          await player.load(streamUrl);
          await el.play();
          return;
        }
      } catch (err) {
        console.warn('Shaka DASH load failed, trying standard audio fallback:', err);
      }
    }

    // Standard progressive HTTP streaming fallback
    try {
      const player = isSlotB ? this.nextShaka : this.player;
      if (player) {
        try {
          await player.detach();
        } catch {}
      }
      el.src = streamUrl;
      const playPromise = el.play();
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
    this.applyVolume();
  }

  public play(): Promise<void> {
    if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
      try {
        this.ytPlayer.playVideo();
        return Promise.resolve();
      } catch {}
    }
    void this.resumeAudioContext();
    if (this.crossfadeLive && this.nextAudio && this.nextAudio.paused) {
      this.nextAudio.play().catch(() => {});
    }
    return this.activeEl.play();
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
    if (this.nextAudio) {
      try { this.nextAudio.pause(); } catch {}
    }
  }

  public seek(seconds: number): void {
    const target = Math.max(0, seconds);
    if (this.fadeGain < 1 || this.fadingDirection === 'out') {
      this.startFadeIn(250);
    }
    if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try {
        this.ytPlayer.seekTo(target, true);
        const duration = this.ytPlayer.getDuration?.() || 0;
        this.callbacks?.onTimeUpdate?.(target, duration > 0 ? duration : undefined);
        return;
      } catch {}
    }
    this.activeEl.currentTime = target;
  }

  /** Pushes user volume * fadeGain * crossfade mix to each channel */
  private applyVolume() {
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    this.audioElement.volume = clamp(this.currentVolume * (this.activeSlot === 'a' ? this.fadeGain : 1) * this.slotMix.a);
    if (this.nextAudio) {
      this.nextAudio.volume = clamp(this.currentVolume * (this.activeSlot === 'b' ? this.fadeGain : 1) * this.slotMix.b);
    }
    const v = Math.max(0, Math.min(1, this.currentVolume * this.fadeGain));
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(Math.round(v * 100));
      } catch {}
    }
  }

  private animateFade(target: number, ms: number) {
    if (this.fadeRaf !== null) cancelAnimationFrame(this.fadeRaf);
    const from = this.fadeGain;
    if (from === target) {
      this.fadeGain = target;
      this.applyVolume();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / Math.max(1, ms));
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.fadeGain = from + (target - from) * eased;
      this.applyVolume();
      this.fadeRaf = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  /** Smooth fade to silence — call near the end of a track for a crossfade feel */
  public startFadeOut(ms = 1400) {
    if (this.fadingDirection === 'out' || this.fadeGain <= 0) return;
    this.fadingDirection = 'out';
    this.animateFade(0, ms);
    // Clear the flag once the ramp lands (or is interrupted by a fade-in)
    const check = () => {
      if (this.fadeRaf === null) this.fadingDirection = null;
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  /** True while a fade-out has pushed gain below full — used to detect stuck-silent states */
  public isFaded(): boolean {
    return this.fadeGain < 0.99;
  }

  /** Smooth fade back to full volume — call when a new track starts playing */
  public startFadeIn(ms = 900) {
    if (this.fadingDirection === 'in' && this.fadeGain >= 1) return;
    this.fadingDirection = 'in';
    this.animateFade(1, ms);
    const check = () => {
      if (this.fadeRaf === null) this.fadingDirection = null;
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  public setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    this.applyVolume();
  }

  public setMuted(muted: boolean): void {
    this.currentMuted = muted;
    this.audioElement.muted = muted;
    if (this.nextAudio) this.nextAudio.muted = muted;
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

  /** Playback speed (0.25x–2x). Works for HTML5/Shaka streams and the YouTube iframe fallback. */
  public setPlaybackRate(rate: number): void {
    const r = Math.min(2, Math.max(0.25, rate));
    try {
      this.audioElement.playbackRate = r;
      if (this.nextAudio) this.nextAudio.playbackRate = r;
    } catch {}
    try {
      if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.setPlaybackRate === 'function') {
        this.ytPlayer.setPlaybackRate(r);
      }
    } catch {}
  }

  public getCurrentTime(): number {
    if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
      try {
        return this.ytPlayer.getCurrentTime() || 0;
      } catch {}
    }
    return this.activeEl.currentTime;
  }

  public getDuration(): number {
    if (this.activeMode === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function') {
      try {
        return this.ytPlayer.getDuration() || 0;
      } catch {}
    }
    return this.activeEl.duration || 0;
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
    if (this.fadeRaf !== null) cancelAnimationFrame(this.fadeRaf);
    if (this.mixRaf !== null) cancelAnimationFrame(this.mixRaf);
    this.pendingNext = null;
    this.crossfadeLive = false;
    this.audioElement.pause();
    this.audioElement.removeAttribute('src');
    this.audioElement.load();
    if (this.nextAudio) {
      try { this.nextAudio.pause(); this.nextAudio.removeAttribute('src'); this.nextAudio.load(); } catch {}
    }
    if (this.nextShaka) {
      try { this.nextShaka.destroy(); } catch {}
      this.nextShaka = null;
    }
    this._steeredClockA.destroy();
    if (this.nextClock) { try { this.nextClock.destroy(); } catch {} this.nextClock = null; }

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
