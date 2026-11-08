import { MusicTrack, ReplayStats } from '../types';

const STORAGE_KEY_REPLAY = 'bitchord_replay_records_v1';

export interface PlayRecord {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  duration: number;
  listenedSeconds: number;
  timestamp: number;
  completed: boolean;
}

export class ReplayRecorder {
  private static instance: ReplayRecorder;
  private currentTrack: MusicTrack | null = null;
  private startTime: number = 0;
  private accumulatedSeconds: number = 0;
  private lastTick: number = 0;

  public static getInstance(): ReplayRecorder {
    if (!ReplayRecorder.instance) {
      ReplayRecorder.instance = new ReplayRecorder();
    }
    return ReplayRecorder.instance;
  }

  /**
   * Called when a track starts playing
   */
  public onTrackStart(track: MusicTrack) {
    this.flushCurrentTrack();
    this.currentTrack = track;
    this.startTime = Date.now();
    this.accumulatedSeconds = 0;
    this.lastTick = performance.now();
  }

  /**
   * Called on playback tick to accumulate listened seconds
   */
  public onPlayTick() {
    if (!this.currentTrack) return;
    const now = performance.now();
    const delta = (now - this.lastTick) / 1000;
    if (delta > 0 && delta < 5) {
      this.accumulatedSeconds += delta;
    }
    this.lastTick = now;
  }

  /**
   * Called when paused, seeked, or track ends
   */
  public onTrackEnd(completed: boolean = false) {
    this.flushCurrentTrack(completed);
  }

  private flushCurrentTrack(completed: boolean = false) {
    if (!this.currentTrack) return;
    const track = this.currentTrack;
    const listened = Math.round(this.accumulatedSeconds);

    // Rule: Counts as a play if listened >= 30 seconds or >= 50% of duration
    const minThreshold = Math.min(30, (track.duration || 180) * 0.5);
    if (listened >= minThreshold) {
      this.saveRecord({
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album || 'Single',
        artwork: track.artwork,
        duration: track.duration || 180,
        listenedSeconds: listened,
        timestamp: this.startTime || Date.now(),
        completed,
      });
    }

    this.currentTrack = null;
    this.accumulatedSeconds = 0;
  }

  private saveRecord(record: PlayRecord) {
    try {
      const records = this.getAllRecords();
      records.unshift(record);
      // Keep last 1000 plays
      if (records.length > 1000) records.length = 1000;
      localStorage.setItem(STORAGE_KEY_REPLAY, JSON.stringify(records));
    } catch {}
  }

  public getAllRecords(): PlayRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_REPLAY);
      if (raw) return JSON.parse(raw);
    } catch {}

    // Initial realistic seed records for Apple Music Replay experience
    return [
      {
        id: 'rec-1',
        trackId: 'am-1',
        title: 'Cornfield Chase',
        artist: 'Hans Zimmer',
        album: 'Interstellar (Original Soundtrack)',
        artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/7e/c5/5e/7ec55ee2-ebf8-d988-8f9a-431af1047747/artwork.jpg/600x600bb.jpg',
        duration: 236,
        listenedSeconds: 236,
        timestamp: Date.now() - 3600000 * 2,
        completed: true,
      },
      {
        id: 'rec-2',
        trackId: 'am-2',
        title: 'Can You Hear the Music',
        artist: 'Ludwig Göransson',
        album: 'Oppenheimer (Original Soundtrack)',
        artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/4a/15/48/4a1548b2-b5ca-fae5-4f3d-ca290bf494ec/23UMGIM74921.rgb.jpg/600x600bb.jpg',
        duration: 110,
        listenedSeconds: 110,
        timestamp: Date.now() - 3600000 * 5,
        completed: true,
      },
      {
        id: 'rec-3',
        trackId: 'am-3',
        title: 'A Time of Quiet Between the Storms',
        artist: 'Hans Zimmer',
        album: 'Dune: Part Two (Original Soundtrack)',
        artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/b8/b5/45/b8b545d0-9ce1-38ae-aa21-0300a74ea85a/794043217997.jpg/600x600bb.jpg',
        duration: 261,
        listenedSeconds: 261,
        timestamp: Date.now() - 3600000 * 12,
        completed: true,
      },
      {
        id: 'rec-4',
        trackId: 'bitchord-1',
        title: "No One's Deserving",
        artist: 'Superheaven',
        album: 'Jar',
        artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
        duration: 184,
        listenedSeconds: 184,
        timestamp: Date.now() - 3600000 * 24,
        completed: true,
      },
      {
        id: 'rec-5',
        trackId: 'bitchord-2',
        title: 'Youngest Daughter',
        artist: 'Superheaven',
        album: 'Jar',
        artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/e3/6b/0c/e36b0c1b-5a7f-d776-6717-5110a40b3286/cover.jpg/600x600bb.jpg',
        duration: 250,
        listenedSeconds: 250,
        timestamp: Date.now() - 3600000 * 30,
        completed: true,
      },
    ];
  }

  public getStats(year: number = new Date().getFullYear()): ReplayStats {
    const records = this.getAllRecords();

    let totalSeconds = 0;
    const trackMap = new Map<string, { track: MusicTrack; plays: number; seconds: number }>();
    const artistMap = new Map<string, { plays: number; seconds: number; avatar?: string }>();
    const albumMap = new Map<string, { title: string; artist: string; artwork: string; plays: number }>();

    for (const r of records) {
      totalSeconds += r.listenedSeconds;

      // Track stats
      const existingT = trackMap.get(r.trackId) || {
        track: {
          id: r.trackId,
          title: r.title,
          artist: r.artist,
          album: r.album,
          artwork: r.artwork,
          duration: r.duration,
        },
        plays: 0,
        seconds: 0,
      };
      existingT.plays += 1;
      existingT.seconds += r.listenedSeconds;
      trackMap.set(r.trackId, existingT);

      // Artist stats
      const existingA = artistMap.get(r.artist) || { plays: 0, seconds: 0, avatar: r.artwork };
      existingA.plays += 1;
      existingA.seconds += r.listenedSeconds;
      artistMap.set(r.artist, existingA);

      // Album stats
      const albumKey = `${r.album}_${r.artist}`;
      const existingAlb = albumMap.get(albumKey) || {
        title: r.album,
        artist: r.artist,
        artwork: r.artwork,
        plays: 0,
      };
      existingAlb.plays += 1;
      albumMap.set(albumKey, existingAlb);
    }

    const topTracks = Array.from(trackMap.values())
      .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
      .slice(0, 10)
      .map(item => ({
        track: item.track,
        plays: item.plays,
        minutes: Math.round(item.seconds / 60),
      }));

    const topArtists = Array.from(artistMap.entries())
      .sort((a, b) => b[1].plays - a[1].plays)
      .slice(0, 8)
      .map(([name, data]) => ({
        name,
        avatar: data.avatar,
        plays: data.plays,
        minutes: Math.round(data.seconds / 60),
      }));

    const topAlbums = Array.from(albumMap.values())
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 6);

    return {
      year,
      totalMinutesListened: Math.round(totalSeconds / 60),
      totalPlays: records.length,
      topTracks,
      topArtists,
      topAlbums,
    };
  }

  public importFromBackup(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        localStorage.setItem(STORAGE_KEY_REPLAY, JSON.stringify(parsed));
        return true;
      }
    } catch {}
    return false;
  }
}

export const replayRecorder = ReplayRecorder.getInstance();
