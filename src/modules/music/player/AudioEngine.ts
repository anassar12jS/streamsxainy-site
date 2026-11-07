// @ts-ignore
import shaka from 'shaka-player/dist/shaka-player.compiled';
import { MusicTrack } from '../types';
import { SteeredClock } from './SteeredClock';

export class MusicAudioEngine {
  private player: any = null;
  public audioElement: HTMLAudioElement;
  public audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private isShakaSupported: boolean = false;
  public steeredClock: SteeredClock;

  constructor(audioElement: HTMLAudioElement) {
    this.audioElement = audioElement;
    this.audioElement.crossOrigin = 'anonymous';
    this.steeredClock = new SteeredClock(this.audioElement);

    this.initAudioContext();
    this.initShaka();
    this.setupMediaSessionHandlers();
  }

  private initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.sourceNode.connect(this.audioContext.destination);
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

  public async resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {}
    }
  }

  public async loadStream(streamUrl: string, isDash: boolean = false): Promise<void> {
    await this.resumeAudioContext();

    if (isDash && this.isShakaSupported && this.player) {
      try {
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
      await this.audioElement.play();
    } catch (err) {
      console.error('Audio play error:', err);
      throw err;
    }
  }

  public play(): Promise<void> {
    void this.resumeAudioContext();
    return this.audioElement.play();
  }

  public pause(): void {
    this.audioElement.pause();
  }

  public seek(seconds: number): void {
    this.audioElement.currentTime = Math.max(0, seconds);
  }

  public setVolume(volume: number): void {
    this.audioElement.volume = Math.max(0, Math.min(1, volume));
  }

  public setMuted(muted: boolean): void {
    this.audioElement.muted = muted;
  }

  public syncMediaSession(track: MusicTrack, onPlay?: () => void, onPause?: () => void, onNext?: () => void, onPrev?: () => void) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Apple Music',
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
        this.seek(this.audioElement.currentTime + delta);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const delta = details.seekOffset || 10;
        this.seek(this.audioElement.currentTime - delta);
      });
    } catch {}
  }

  public destroy() {
    this.audioElement.pause();
    this.audioElement.removeAttribute('src');
    this.audioElement.load();
    this.steeredClock.destroy();

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
