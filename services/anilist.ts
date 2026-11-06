

import { AniListResult, TMDBResult, TMDBDetail, MediaType } from '../types';

const GRAPHQL_URL = 'https://graphql.anilist.co';

const fetchAniList = async (query: string, variables: any = {}) => {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables
    })
  };

  const response = await fetch(GRAPHQL_URL, options);
  
  if (!response.ok) {
      if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please wait a moment.");
      }
      throw new Error(`AniList API Error: ${response.status}`);
  }

  const json = await response.json();
  
  if (json.errors) {
      console.error("AniList GraphQL Errors:", json.errors);
      throw new Error(json.errors[0]?.message || "Unknown AniList Error");
  }

  return json.data ? json.data.Page.media : [];
};

const ANIME_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus, $season: MediaSeason, $seasonYear: Int, $genre: String) {
  Page (page: $page, perPage: $perPage) {
    media (type: ANIME, sort: $sort, status: $status, season: $season, seasonYear: $seasonYear, genre: $genre) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        extraLarge
      }
      bannerImage
      description
      averageScore
      format
      status
      seasonYear
      genres
      nextAiringEpisode {
        airingAt
        timeUntilAiring
        episode
      }
    }
  }
}
`;

export const getTrendingAnime = async (): Promise<AniListResult[]> => {
  return fetchAniList(ANIME_QUERY, {
    page: 1,
    perPage: 12,
    sort: 'TRENDING_DESC'
  });
};

export const getPopularAnime = async (): Promise<AniListResult[]> => {
  return fetchAniList(ANIME_QUERY, {
    page: 1,
    perPage: 20,
    sort: 'POPULARITY_DESC'
  });
};

export const getTopRatedAnime = async (): Promise<AniListResult[]> => {
  return fetchAniList(ANIME_QUERY, {
    page: 1,
    perPage: 20,
    sort: 'SCORE_DESC'
  });
};

export const getAnimeByGenre = async (genre: string): Promise<AniListResult[]> => {
  return fetchAniList(ANIME_QUERY, {
    page: 1,
    perPage: 20,
    genre,
    sort: 'POPULARITY_DESC'
  });
};

export const getUpcomingAnime = async (): Promise<AniListResult[]> => {
  return fetchAniList(ANIME_QUERY, {
    page: 1,
    perPage: 12,
    sort: 'POPULARITY_DESC',
    status: 'NOT_YET_RELEASED'
  });
};

export const getSeasonAnime = async (): Promise<AniListResult[]> => {
    // Rough season calculation
    const month = new Date().getMonth();
    let season = 'WINTER';
    if (month >= 2 && month <= 4) season = 'SPRING';
    else if (month >= 5 && month <= 7) season = 'SUMMER';
    else if (month >= 8 && month <= 10) season = 'FALL';

    return fetchAniList(ANIME_QUERY, {
        page: 1,
        perPage: 20,
        season: season,
        seasonYear: new Date().getFullYear(),
        sort: 'POPULARITY_DESC'
    });
};

export const getAiringAnime = async (): Promise<AniListResult[]> => {
  return fetchAniList(ANIME_QUERY, {
    page: 1,
    perPage: 16,
    status: 'RELEASING',
    sort: 'POPULARITY_DESC'
  });
};

// Known popular anime franchises with official English dubs
const POPULAR_DUBBED_ANIME_KEYWORDS = [
  'titan', 'slayer', 'jujutsu', 'hero', 'solo leveling', 'chainsaw', 'frieren',
  'death note', 'alchemist', 'bleach', 'naruto', 'one piece', 'hunter', 'vinland',
  'bocchi', 'spy x family', 'cyberpunk', 'kaiju', 'dungeon', 'horimiya', 'dr. stone',
  'black clover', 'tokyo ghoul', 'overlord', 're:zero', 'sword art', 'fairy tail',
  'wind breaker', 'hell\'s paradise', 'mashle', 'mob psycho', 'haikyuu', 'blue lock'
];

export const isAnimeDubbed = (title: string): boolean => {
  const lower = title.toLowerCase();
  return POPULAR_DUBBED_ANIME_KEYWORDS.some(k => lower.includes(k));
};

// Helper to convert AniList result to our app's TMDBResult format for display cards
export const mapAniListToTMDB = (anime: AniListResult): TMDBResult => {
    const title = anime.title.english || anime.title.romaji;
    return {
        id: anime.id,
        anilist_id: anime.id,
        title: title,
        name: title,
        original_title: anime.title.native || anime.title.romaji,
        original_name: anime.title.native || anime.title.romaji,
        popularity: (anime as any).popularity || 0,
        // Use 'large' for cards to load faster, fallback to extraLarge
        poster_path: anime.coverImage.large || anime.coverImage.extraLarge, 
        backdrop_path: anime.bannerImage || anime.coverImage.extraLarge,
        overview: anime.description,
        media_type: MediaType.TV, // Anime is generally TV
        vote_average: (anime.averageScore || 0) / 10,
        vote_count: (anime as any).popularity ? Math.round(((anime as any).popularity) / 10) : 100,
        first_air_date: anime.seasonYear ? anime.seasonYear.toString() : '', 
        next_airing_episode: anime.nextAiringEpisode,
        is_dubbed: isAnimeDubbed(title),
    };
};

import { getSpellCorrection } from './searchUtils';

/**
 * Search AniList by query returning a list of anime results with typo tolerance
 */
export const searchAnimeList = async (search: string): Promise<AniListResult[]> => {
  if (!search || !search.trim()) return [];
  const clean = search.trim();
  const correction = getSpellCorrection(clean);
  const termsToTry = [clean];
  if (correction && correction.toLowerCase() !== clean.toLowerCase()) {
    // Put corrected term first so it retrieves matches even if raw query had a typo
    termsToTry.unshift(correction);
  }

  const query = `
    query ($search: String) {
      Page (page: 1, perPage: 16) {
        media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
            extraLarge
          }
          bannerImage
          description
          averageScore
          popularity
          format
          status
          seasonYear
          genres
          nextAiringEpisode {
            airingAt
            episode
          }
        }
      }
    }
  `;
  try {
    for (const term of termsToTry) {
      const list = await fetchAniList(query, { search: term });
      if (list && list.length > 0) {
        return list;
      }
    }
    return [];
  } catch {
    return [];
  }
};

/**
 * Search AniList for anime by title to find its AniList ID
 */
export const searchAnimeByTitle = async (title: string): Promise<number | null> => {
  if (!title || !title.trim()) return null;
  const cleanTitle = title.trim();
  const correction = getSpellCorrection(cleanTitle);
  const titlesToTry = [cleanTitle];
  if (correction && correction.toLowerCase() !== cleanTitle.toLowerCase()) {
    titlesToTry.push(correction);
  }

  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title {
          romaji
          english
        }
      }
    }
  `;
  try {
    for (const t of titlesToTry) {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { search: t }
        })
      });
      if (!response.ok) continue;
      const json = await response.json();
      const id = json?.data?.Media?.id;
      if (id) return id;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Fetch complete Anime details directly from AniList by its AniList ID
 */
export const getAnimeById = async (id: number): Promise<AniListResult | null> => {
  if (!id || id <= 0) return null;
  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          large
          extraLarge
        }
        bannerImage
        description
        averageScore
        format
        status
        episodes
        duration
        seasonYear
        genres
        nextAiringEpisode {
          airingAt
          episode
        }
      }
    }
  `;
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { id }
      })
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json?.data?.Media || null;
  } catch {
    return null;
  }
};

/**
 * Convert AniList full result to TMDBDetail format so Details page works flawlessly
 */
export const mapAniListToTMDBDetail = (anime: AniListResult): TMDBDetail => {
  const isUnreleased = anime.status === 'NOT_YET_RELEASED';
  const nextAirEp = anime.nextAiringEpisode?.episode;
  const epCount = anime.episodes && anime.episodes > 0 
    ? anime.episodes 
    : (nextAirEp ? Math.max(nextAirEp, 12) : (isUnreleased ? 0 : 24));

  const displayTitle = anime.title.english || anime.title.romaji;
  const poster = anime.coverImage?.extraLarge || anime.coverImage?.large || '';
  const banner = anime.bannerImage || poster;
  
  const episodesListCount = epCount > 0 ? epCount : (isUnreleased ? 1 : 12);
  const episodesList = Array.from({ length: episodesListCount }, (_, i) => {
    const epNum = i + 1;
    const isUpcoming = isUnreleased || (nextAirEp !== undefined && epNum >= nextAirEp);
    const airDateStr = (anime.nextAiringEpisode && epNum === nextAirEp)
      ? new Date(anime.nextAiringEpisode.airingAt * 1000).toISOString().split('T')[0]
      : (isUpcoming ? '' : (anime.seasonYear ? `${anime.seasonYear}-01-01` : ''));

    return {
      id: epNum,
      name: isUnreleased ? `Episode ${epNum} (Upcoming - Unreleased)` : `Episode ${epNum}${isUpcoming ? ' (Upcoming)' : ''}`,
      overview: isUpcoming
        ? `Episode ${epNum} of ${displayTitle} has not yet aired.${anime.nextAiringEpisode && epNum === nextAirEp ? ` Scheduled to air on ${airDateStr}.` : ' Premiering in an upcoming broadcast season.'}`
        : `Episode ${epNum} of ${displayTitle}. Stream directly in Japanese with subtitles or English dub.`,
      episode_number: epNum,
      season_number: 1,
      air_date: airDateStr,
      airing_at: (anime.nextAiringEpisode && epNum === nextAirEp) ? anime.nextAiringEpisode.airingAt : undefined,
      is_upcoming: isUpcoming,
      still_path: banner || poster || null,
      vote_average: isUpcoming ? 0 : (anime.averageScore || 80) / 10,
      runtime: anime.duration || 24,
    };
  });

  const cleanDesc = anime.description 
    ? anime.description.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    : 'No description available for this anime series.';

  return {
    id: anime.id,
    anilist_id: anime.id,
    title: displayTitle,
    name: displayTitle,
    original_title: anime.title.native || anime.title.romaji,
    original_name: anime.title.native || anime.title.romaji,
    overview: cleanDesc,
    poster_path: anime.coverImage.extraLarge || anime.coverImage.large,
    backdrop_path: anime.bannerImage || anime.coverImage.extraLarge,
    vote_average: (anime.averageScore || 80) / 10,
    vote_count: 2500,
    media_type: MediaType.TV,
    status: anime.status || 'Released',
    first_air_date: anime.seasonYear ? `${anime.seasonYear}-01-01` : '',
    number_of_seasons: 1,
    number_of_episodes: isUnreleased ? 0 : epCount,
    episode_run_time: anime.duration ? [anime.duration] : [24],
    genres: (anime.genres || []).map((g, idx) => ({ id: idx + 1, name: g })),
    seasons: [
      {
        id: 1,
        season_number: 1,
        name: 'Season 1',
        episode_count: isUnreleased ? 0 : epCount,
        overview: cleanDesc,
        air_date: anime.seasonYear ? `${anime.seasonYear}-01-01` : '',
        poster_path: anime.coverImage.large,
      }
    ],
    season_detail_fallback: {
      id: 1,
      name: 'Season 1',
      overview: cleanDesc,
      season_number: 1,
      poster_path: anime.coverImage.large || null,
      episodes: episodesList,
    },
  };
};