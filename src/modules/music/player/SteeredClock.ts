/**
 * Steered Audio Clock for Apple Music Lyrics & Visualizers
 * Synchronizes high-resolution performance.now() with HTMLMediaElement timeupdate,
 * smoothing out browser 250ms timeupdate quantization and preventing lyric jitter.
 */
export class SteeredClock {
  private audioElement: HTMLAudioElement;
  private lastAudioTime: number = 0;
  private lastPerfTime: number = 0;
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private listeners: Set<(time: number) => void> = new Set();

  constructor(audioElement: HTMLAudioElement) {
    this.audioElement = audioElement;
    this.lastAudioTime = audioElement.currentTime;
    this.lastPerfTime = performance.now();

    this.onTimeUpdate = this.onTimeUpdate.bind(this);
    this.onPlay = this.onPlay.bind(this);
    this.onPause = this.onPause.bind(this);
    this.onSeeking = this.onSeeking.bind(this);
    this.tick = this.tick.bind(this);

    this.audioElement.addEventListener('timeupdate', this.onTimeUpdate);
    this.audioElement.addEventListener('play', this.onPlay);
    this.audioElement.addEventListener('pause', this.onPause);
    this.audioElement.addEventListener('seeking', this.onSeeking);

    if (!audioElement.paused) {
      this.start();
    }
  }

  private onTimeUpdate() {
    const current = this.audioElement.currentTime;
    const now = performance.now();
    // Steer if audio clock drifted significantly (> 120ms) from extrapolated time
    const expected = this.lastAudioTime + (now - this.lastPerfTime) / 1000;
    if (Math.abs(current - expected) > 0.12 || this.audioElement.paused) {
      this.lastAudioTime = current;
      this.lastPerfTime = now;
    }
  }

  private onPlay() {
    this.lastAudioTime = this.audioElement.currentTime;
    this.lastPerfTime = performance.now();
    this.start();
  }

  private onPause() {
    this.lastAudioTime = this.audioElement.currentTime;
    this.stop();
    this.emit(this.lastAudioTime);
  }

  private onSeeking() {
    this.lastAudioTime = this.audioElement.currentTime;
    this.lastPerfTime = performance.now();
    this.emit(this.lastAudioTime);
  }

  private start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tick();
  }

  private stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private tick() {
    if (!this.isRunning) return;
    const time = this.getCurrentTime();
    this.emit(time);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public setTime(time: number) {
    this.lastAudioTime = time;
    this.lastPerfTime = performance.now();
    this.emit(time);
  }

  public getCurrentTime(): number {
    if (this.audioElement.paused) {
      return this.audioElement.currentTime;
    }
    const delta = (performance.now() - this.lastPerfTime) / 1000;
    return Math.max(0, this.lastAudioTime + delta);
  }

  public subscribe(callback: (time: number) => void): () => void {
    this.listeners.add(callback);
    callback(this.getCurrentTime());
    return () => this.listeners.delete(callback);
  }

  private emit(time: number) {
    this.listeners.forEach(cb => cb(time));
  }

  public destroy() {
    this.stop();
    this.audioElement.removeEventListener('timeupdate', this.onTimeUpdate);
    this.audioElement.removeEventListener('play', this.onPlay);
    this.audioElement.removeEventListener('pause', this.onPause);
    this.audioElement.removeEventListener('seeking', this.onSeeking);
    this.listeners.clear();
  }
}
