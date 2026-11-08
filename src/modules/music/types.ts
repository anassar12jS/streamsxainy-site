export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  artwork: string;
  duration: number; // in seconds
  audioUrl?: string;
  isDash?: boolean;
  isrc?: string;
  youtubeId?: string;
  year?: string;
  genre?: string;
  isExplicit?: boolean;
  isLive?: boolean;
  source?: 'innertube' | 'addon' | 'stream' | 'curated';
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  artwork: string;
  year: string;
  genre: string;
  trackCount: number;
  duration?: number;
  tracks: MusicTrack[];
}

export interface Artist {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
  monthlyListeners?: string;
  topTracks: MusicTrack[];
  albums: Album[];
  singles: Album[];
}

export interface Playlist {
  id: string;
  title: string;
  subtitle: string;
  curator?: string;
  artwork: string;
  trackCount: number;
  tracks: MusicTrack[];
}

export interface SyncedLyricLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsData {
  plain?: string;
  ttml?: string;
  synced?: SyncedLyricLine[];
}

export interface AddonManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  author?: string;
  types: ('stream' | 'search' | 'lyrics')[];
  resources?: string[];
  settings?: { key: string; default: any; options?: { value: any; label?: string }[] }[];
  allowDownloads?: boolean;
  checkValidLossless?: boolean;
}

export interface PartyMember {
  id: string;
  name: string;
  avatar?: string;
  isHost?: boolean;
  joinedAt?: number;
}

export interface PartyState {
  code: string;
  hostId: string;
  isPlaying: boolean;
  currentTrack?: MusicTrack;
  positionMs: number;
  anchorMs: number;
  serverTimeMs: number;
  members: PartyMember[];
  queue: MusicTrack[];
}

export interface ReplayStats {
  year: number;
  totalMinutesListened: number;
  totalPlays: number;
  topTracks: { track: MusicTrack; plays: number; minutes: number }[];
  topArtists: { name: string; avatar?: string; plays: number; minutes: number }[];
  topAlbums: { title: string; artist: string; artwork: string; plays: number }[];
}

export interface UserSettings {
  enableLossless: boolean;
  enableDiscordRpc: boolean;
  enableSpotifyCanvas: boolean;
  preferredQuality: 'LOSSLESS' | 'HIGH' | 'LOW';
  lyricProviders: string[];
}
