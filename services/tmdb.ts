import { TMDB_API_KEY, TMDB_BASE_URL } from '../constants';
import { TMDBResult, TMDBDetail, TMDBVideo, MediaType, PersonDetail, Collection, TMDBSeasonDetail } from '../types';
import { rankSearchResults, getSpellCorrection, correctQueryTokens, extractYearFromQuery } from './searchUtils';

const fetchTMDB = async (endpoint: string, params: Record<string, string> = {}) => {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', TMDB_API_KEY);
  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB Error: ${res.status}`);
  return res.json();
};

export const getTrending = async (): Promise<TMDBResult[]> => {
  const data = await fetchTMDB('/trending/all/day');
  return data.results;
};

export const getTrendingWeek = async (): Promise<TMDBResult[]> => {
  try {
    const data = await fetchTMDB('/trending/all/week');
    return data.results;
  } catch (e) {
    return [];
  }
};

export const getNowPlayingMovies = async (): Promise<TMDBResult[]> => {
  try {
    const data = await fetchTMDB('/movie/now_playing');
    return data.results.map((m: any) => ({ ...m, media_type: MediaType.MOVIE }));
  } catch (e) {
    return [];
  }
};

export const getUpcomingMovies = async (): Promise<TMDBResult[]> => {
  try {
    const data = await fetchTMDB('/movie/upcoming');
    return data.results.map((m: any) => ({ ...m, media_type: MediaType.MOVIE }));
  } catch (e) {
    return [];
  }
};

export const getAiringTodayTV = async (): Promise<TMDBResult[]> => {
  try {
    const data = await fetchTMDB('/tv/airing_today');
    return data.results.map((t: any) => ({ ...t, media_type: MediaType.TV }));
  } catch (e) {
    return [];
  }
};

export const getPopularMovies = async (): Promise<TMDBResult[]> => {
  const data = await fetchTMDB('/movie/popular');
  return data.results.map((m: any) => ({ ...m, media_type: MediaType.MOVIE }));
};

export const getPopularTV = async (): Promise<TMDBResult[]> => {
  const data = await fetchTMDB('/tv/popular');
  return data.results.map((t: any) => ({ ...t, media_type: MediaType.TV }));
};

export const getTopRatedMovies = async (): Promise<TMDBResult[]> => {
  try {
    // Enforce high vote threshold (2000+ votes) to guarantee universally acclaimed cinema and eliminate obscure 10/10 single-vote noise
    const data = await fetchTMDB('/discover/movie', {
      sort_by: 'vote_average.desc',
      'vote_count.gte': '2000',
      include_adult: 'false'
    });
    return data.results.map((m: any) => ({ ...m, media_type: MediaType.MOVIE }));
  } catch (e) {
    const data = await fetchTMDB('/movie/top_rated');
    return data.results.filter((m: any) => (m.vote_count || 0) >= 1000).map((m: any) => ({ ...m, media_type: MediaType.MOVIE }));
  }
};

export const getTopRatedTV = async (): Promise<TMDBResult[]> => {
  try {
    // Enforce solid vote threshold for series (500+ votes)
    const data = await fetchTMDB('/discover/tv', {
      sort_by: 'vote_average.desc',
      'vote_count.gte': '500',
      include_adult: 'false'
    });
    return data.results.map((t: any) => ({ ...t, media_type: MediaType.TV }));
  } catch (e) {
    const data = await fetchTMDB('/tv/top_rated');
    return data.results.filter((t: any) => (t.vote_count || 0) >= 400).map((t: any) => ({ ...t, media_type: MediaType.TV }));
  }
};

export const searchMedia = async (query: string): Promise<TMDBResult[]> => {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  // Extract year if specified (e.g. "The Outlaws 2017")
  const yearMatch = trimmed.match(/\b(19\d\d|20\d\d)\b/);
  const cleanTitle = yearMatch ? trimmed.replace(/\b(19\d\d|20\d\d)\b/g, '').trim() : '';

  // 1. Detect dictionary-based typo corrections
  const spellCorrection = getSpellCorrection(trimmed) || (cleanTitle ? getSpellCorrection(cleanTitle) : null);
  const tokenCorrection = correctQueryTokens(trimmed);

  // 2. Assemble candidate search terms to send to TMDB
  const queryTerms = new Set<string>();
  queryTerms.add(trimmed);

  if (cleanTitle && cleanTitle.length >= 2) {
    queryTerms.add(cleanTitle);
  }

  if (spellCorrection && spellCorrection.toLowerCase() !== trimmed.toLowerCase()) {
    queryTerms.add(spellCorrection);
  }

  if (tokenCorrection && tokenCorrection.toLowerCase() !== trimmed.toLowerCase()) {
    queryTerms.add(tokenCorrection);
  }

  // Handle multi-word queries: if user typed "stranger thngs 4" or "spider man homecoming",
  // also extract high-information tokens (length >= 4 and non-stopword)
  const words = trimmed.split(/\s+/).filter(w => w.length >= 4 && !/^(the|and|for|with|from)$/i.test(w));
  if (words.length >= 2) {
    queryTerms.add(words.slice(0, 2).join(' '));
  }

  // 3. Build parallel requests across TMDB multi-search
  const searchPromises: Promise<any[]>[] = [];
  const queryList = Array.from(queryTerms).slice(0, 5); // cap to 5 parallel searches

  for (const q of queryList) {
    searchPromises.push(
      fetchTMDB('/search/multi', { query: q, page: '1', include_adult: 'false' })
        .then(d => d?.results || [])
        .catch(() => [])
    );
  }

  // If primary query has 2+ words, also query movie & tv endpoints for higher recall
  if (queryList[0]) {
    searchPromises.push(
      fetchTMDB('/search/movie', { query: queryList[0], page: '1', include_adult: 'false' })
        .then(d => (d?.results || []).map((m: any) => ({ ...m, media_type: MediaType.MOVIE })))
        .catch(() => []),
      fetchTMDB('/search/tv', { query: queryList[0], page: '1', include_adult: 'false' })
        .then(d => (d?.results || []).map((t: any) => ({ ...t, media_type: MediaType.TV })))
        .catch(() => [])
    );
  }

  const settleResults = await Promise.all(searchPromises);
  const flatResults = settleResults.flat();

  // Deduplicate raw TMDB results by ID and MediaType
  const seen = new Set<string>();
  const formatted: TMDBResult[] = [];

  for (const r of flatResults) {
    if (!r) continue;
    const media_type = r.media_type || (r.title ? MediaType.MOVIE : MediaType.TV);
    const key = `${media_type}_${r.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      formatted.push({
        ...r,
        media_type,
        poster_path: r.poster_path || r.profile_path || null,
        backdrop_path: r.backdrop_path || null,
      });
    }
  }

  // 4. Apply smart ranking with fuzzy matching, year boosting, and popularity/vote weighting
  const effectiveCorrection = (spellCorrection && spellCorrection.toLowerCase() !== trimmed.toLowerCase())
    ? spellCorrection
    : (tokenCorrection && tokenCorrection.toLowerCase() !== trimmed.toLowerCase())
      ? tokenCorrection
      : undefined;

  return rankSearchResults(formatted, trimmed, effectiveCorrection);
};

export const getDetails = async (id: number, type: MediaType): Promise<TMDBDetail> => {
  const data = await fetchTMDB(`/${type}/${id}`, {
    append_to_response: 'external_ids,credits,release_dates,content_ratings,keywords,images'
  });
  return { ...data, media_type: type };
};

export const getSeasonDetails = async (tvId: number, seasonNumber: number): Promise<TMDBSeasonDetail> => {
  try {
    return await fetchTMDB(`/tv/${tvId}/season/${seasonNumber}`);
  } catch (e) {
    return {
      id: 0,
      name: `Season ${seasonNumber}`,
      overview: '',
      season_number: seasonNumber,
      poster_path: null,
      episodes: []
    };
  }
};

export const getCollection = async (id: number): Promise<Collection> => {
    return await fetchTMDB(`/collection/${id}`);
};

export const getVideos = async (id: number, type: MediaType): Promise<TMDBVideo[]> => {
  try {
    const data = await fetchTMDB(`/${type}/${id}/videos`);
    return data.results;
  } catch (e) {
    // Suppress warning for 404s or other failures as not all media has videos
    return [];
  }
};

export const getRecommendations = async (id: number, type: MediaType): Promise<TMDBResult[]> => {
  try {
    const data = await fetchTMDB(`/${type}/${id}/recommendations`);
    return data.results.map((item: any) => ({ ...item, media_type: type }));
  } catch (e) {
    return [];
  }
};

export const getSimilarMedia = async (id: number, type: MediaType): Promise<TMDBResult[]> => {
  try {
    const data = await fetchTMDB(`/${type}/${id}/similar`);
    return data.results.map((item: any) => ({ ...item, media_type: type }));
  } catch (e) {
    return [];
  }
};

// Person & Cast
export const getPerson = async (id: number): Promise<PersonDetail> => {
  const data = await fetchTMDB(`/person/${id}`);
  return data;
};

export const getPersonCredits = async (id: number): Promise<TMDBResult[]> => {
  const data = await fetchTMDB(`/person/${id}/combined_credits`);
  return data.cast
    .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
    .sort((a: any, b: any) => b.vote_count - a.vote_count);
};

// Discover
export const getGenres = async (type: MediaType) => {
  const data = await fetchTMDB(`/genre/${type}/list`);
  return data.genres;
};

export const discoverMedia = async (
  type: MediaType, 
  sortBy: string = 'popularity.desc', 
  genreId?: number, 
  year?: number,
  page: number = 1,
  watchProviderId?: number
): Promise<TMDBResult[]> => {
  const params: Record<string, string> = {
    sort_by: sortBy,
    include_adult: 'false',
    include_video: 'false',
    page: page.toString(),
  };

  if (sortBy === 'vote_average.desc') {
    params['vote_count.gte'] = type === MediaType.TV ? '500' : '1500';
  }

  if (genreId) params.with_genres = genreId.toString();
  if (year) {
    if (type === MediaType.MOVIE) params.primary_release_year = year.toString();
    if (type === MediaType.TV) params.first_air_date_year = year.toString();
  }
  if (watchProviderId) {
    params.with_watch_providers = watchProviderId.toString();
    params.watch_region = 'US';
  }

  const data = await fetchTMDB(`/discover/${type}`, params);
  return (data.results || []).map((item: any) => ({ ...item, media_type: type }));
};

export const getProviderMedia = async (
  providerId: number,
  type: MediaType = MediaType.MOVIE,
  page: number = 1,
  genreId?: number,
  sortBy: string = 'popularity.desc'
): Promise<TMDBResult[]> => {
  try {
    const params: Record<string, string> = {
      sort_by: sortBy,
      with_watch_providers: providerId.toString(),
      watch_region: 'US',
      include_adult: 'false',
      include_video: 'false',
      page: page.toString(),
    };
    if (genreId) {
      params.with_genres = genreId.toString();
    }
    const data = await fetchTMDB(`/discover/${type}`, params);
    return (data.results || []).map((item: any) => ({ ...item, media_type: type }));
  } catch (e) {
    console.error(`Failed to fetch media for provider ${providerId}:`, e);
    return [];
  }
};

export interface WatchProviderItem {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority?: number;
}

export interface WatchProvidersData {
  link?: string;
  flatrate?: WatchProviderItem[];
  rent?: WatchProviderItem[];
  buy?: WatchProviderItem[];
}

export const getWatchProviders = async (id: number, type: MediaType): Promise<WatchProvidersData | null> => {
  try {
    const data = await fetchTMDB(`/${type}/${id}/watch/providers`);
    const results = data.results || {};
    // Priority order: US, GB, CA, AU or first country available
    const preferred = results.US || results.GB || results.CA || results.AU || Object.values(results)[0] as any;
    return preferred || null;
  } catch {
    return null;
  }
};