

export enum MediaType {
  MOVIE = 'movie',
  TV = 'tv',
  PERSON = 'person'
}

export interface TMDBResult {
  id: number;
  anilist_id?: number;
  title?: string;
  name?: string; // For TV
  original_title?: string;
  original_name?: string;
  popularity?: number;
  adult?: boolean;
  profile_path?: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  media_type: MediaType;
  vote_average: number;
  vote_count?: number; // Number of votes
  release_date?: string;
  first_air_date?: string; // For TV
  genre_ids?: number[];
  belongs_to_collection?: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  };
  next_airing_episode?: {
    airingAt: number;
    episode: number;
    timeUntilAiring?: number;
  };
  is_dubbed?: boolean;
}

export interface CollectionPart {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type: MediaType;
  vote_average: number;
  release_date: string;
}

export interface Collection {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: CollectionPart[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
}

export interface TMDBDetail extends TMDBResult {
  genres: { id: number; name: string }[];
  tagline?: string;
  status?: string;
  original_language?: string;
  budget?: number;
  revenue?: number;
  number_of_episodes?: number;
  season_detail_fallback?: TMDBSeasonDetail;
  external_ids?: {
    imdb_id?: string;
    tvdb_id?: number;
    wikidata_id?: string;
    facebook_id?: string;
    instagram_id?: string;
    twitter_id?: string;
  };
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  seasons?: {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    season_number: number;
    episode_count: number;
    air_date?: string;
  }[];
  created_by?: {
    id: number;
    name: string;
    profile_path: string | null;
  }[];
  networks?: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }[];
  production_companies?: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string;
  }[];
  production_countries?: {
    iso_3166_1: string;
    name: string;
  }[];
  spoken_languages?: {
    english_name: string;
    iso_639_1: string;
    name: string;
  }[];
  release_dates?: {
    results: {
      iso_3166_1: string;
      release_dates: {
        certification: string;
        type: number;
        release_date: string;
      }[];
    }[];
  };
  content_ratings?: {
    results: {
      iso_3166_1: string;
      rating: string;
    }[];
  };
  keywords?: {
    keywords?: { id: number; name: string }[];
    results?: { id: number; name: string }[];
  };
  images?: {
    backdrops?: { file_path: string; width: number; height: number; vote_average: number }[];
    posters?: { file_path: string; width: number; height: number; vote_average: number }[];
    logos?: { file_path: string; width: number; height: number; file_type?: string }[];
  };
  credits?: {
    cast: CastMember[];
    crew?: {
      id: number;
      name: string;
      job: string;
      department: string;
      profile_path: string | null;
    }[];
  };
  videos?: {
    results: TMDBVideo[];
  };
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  still_path: string | null;
  vote_average: number;
  vote_count?: number;
  runtime?: number;
  is_upcoming?: boolean;
  airing_at?: number;
}

export interface TMDBSeasonDetail {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  poster_path: string | null;
  air_date?: string;
  episodes: TMDBEpisode[];
}

export interface TMDBVideo {
  id: string;
  key: string;
  site: string;
  type: string;
  name: string;
  official: boolean;
}

export interface Stream {
  name?: string;
  title?: string;
  infoHash?: string;
  fileIdx?: number;
  url?: string;
  behaviorHints?: {
    bingeGroup?: string;
  };
}

export interface StreamResponse {
  streams: Stream[];
}

export interface StreamProvider {
  name: string;
  url: string;
}

export interface SportsTeam {
  name: string;
  logo?: string;
}

export interface SportsMatchSource {
  source: string;
  id: string;
}

export interface SportsMatch {
  id: string;
  title: string;
  date: number; // Timestamp
  category: string;
  competition?: string;
  venue?: string;
  venueCity?: string;
  poster?: string;
  teams?: { home: SportsTeam; away: SportsTeam };
  sources: SportsMatchSource[];
  popular?: boolean;
  score?: { home: number; away: number };
  status?: string;
  minute?: string;
  always_live?: number;
  ends_at?: number;
  events?: MatchEvent[];
}

export interface LeagueTopScorer {
  rank: number;
  name: string;
  team: string;
  teamLogo?: string;
  goals: number;
  assists?: number;
  playedGames?: number;
}

export interface SportsStream {
  id: string;
  streamNo: number;
  language: string;
  hd: boolean;
  embedUrl: string;
  source: string;
}

export interface SportsChannel247 {
  id: string;
  name: string;
  category: 'Football' | 'Motorsport' | 'Combat' | 'Basketball' | 'General';
  logo?: string;
  country?: string;
  daddyliveId: string;
  streamUrl: string;
  badge?: string;
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'yellow_card' | 'red_card' | 'sub';
  player: string;
  team: 'home' | 'away';
  description?: string;
}

export interface LiveMatchScoreboard {
  homeScore: number;
  awayScore: number;
  period: string;
  minute: string;
  possession?: { home: number; away: number };
  shots?: { home: number; away: number };
  stats?: {
    possession?: { home: number; away: number };
    shots?: { home: number; away: number };
    shotsOnTarget?: { home: number; away: number };
    fouls?: { home: number; away: number };
    corners?: { home: number; away: number };
  };
  events?: MatchEvent[];
}

export interface WebtorOptions {
  id: string;
  magnet: string;
  width?: string;
  height?: string;
  theme?: 'light' | 'dark';
  poster?: string;
  title?: string;
  imdbId?: string;
  version?: string;
  mode?: string;
}

export interface AniListResult {
  id: number;
  title: {
    romaji: string;
    english: string;
    native: string;
  };
  coverImage: {
    large: string;
    extraLarge: string;
  };
  bannerImage: string;
  description: string;
  averageScore: number;
  format: string;
  status: string;
  seasonYear?: number;
  episodes?: number;
  duration?: number;
  nextAiringEpisode?: {
    airingAt: number;
    episode: number;
    timeUntilAiring?: number;
  };
  isDubbed?: boolean;
  genres: string[];
}

export interface IPTVChannel {
  id?: string;
  name: string;
  logo?: string;
  group?: string;
  url: string;
  country?: string;
  categories?: string[];
  isNsfw?: boolean;
  network?: string;
  owners?: string[];
  website?: string;
  launched?: string;
  quality?: string;
  language?: string[];
  tvgId?: string;
}

export interface ContinueWatchingItem {
  id: number;
  anilist_id?: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  season?: number;
  episode?: number;
  currentTime?: number;
  duration?: number;
  timestamp: number; // When they last watched
  progress?: number; // % watched (0-100)
}

declare global {
  interface Window {
    webtor: {
      push: (options: WebtorOptions) => void;
    };
    Hls?: any;
  }
}
