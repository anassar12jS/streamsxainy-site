
export const TMDB_API_KEY = (import.meta as any).env?.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
export const TMDB_BASE_URL = (import.meta as any).env?.VITE_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
// Optimized image resolutions (dramatically reduces page weight and accelerates load times)
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
export const TMDB_BACKDROP_W1280 = 'https://image.tmdb.org/t/p/w1280';
export const TMDB_BACKDROP_W780 = 'https://image.tmdb.org/t/p/w780';
export const TMDB_BACKDROP_W300 = 'https://image.tmdb.org/t/p/w300';
export const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
export const TMDB_POSTER_SMALL = 'https://image.tmdb.org/t/p/w185';
export const TMDB_PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';
export const TORRENTIO_BASE_URL = (import.meta as any).env?.VITE_TORRENTIO_BASE_URL || 'https://torrentio.strem.fun';
