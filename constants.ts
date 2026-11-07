
export const TMDB_API_KEY = (import.meta as any).env?.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
export const TMDB_BASE_URL = (import.meta as any).env?.VITE_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
// Optimized image resolutions (dramatically reduces page weight and accelerates load times)
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
export const TMDB_IMAGE_ORIGINAL = 'https://image.tmdb.org/t/p/original';
export const TMDB_BACKDROP_W1280 = 'https://image.tmdb.org/t/p/w1280';
export const TMDB_BACKDROP_W780 = 'https://image.tmdb.org/t/p/w780';
export const TMDB_BACKDROP_W300 = 'https://image.tmdb.org/t/p/w300';
export const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
export const TMDB_POSTER_SMALL = 'https://image.tmdb.org/t/p/w185';
export const TMDB_PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';
export const TORRENTIO_BASE_URL = (import.meta as any).env?.VITE_TORRENTIO_BASE_URL || 'https://torrentio.strem.fun';

export const POSTER_FALLBACK_SVG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22450%22%20viewBox%3D%220%200%20300%20450%22%3E%3Crect%20fill%3D%22%2318181b%22%20width%3D%22300%22%20height%3D%22450%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20fill%3D%22%2371717a%22%20font-family%3D%22sans-serif%22%20font-size%3D%2216%22%3ENo%20Poster%3C%2Ftext%3E%3C%2Fsvg%3E';
export const BACKDROP_FALLBACK_SVG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22500%22%20height%3D%22281%22%20viewBox%3D%220%200%20500%20281%22%3E%3Crect%20fill%3D%22%2318181b%22%20width%3D%22500%22%20height%3D%22281%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20fill%3D%22%2371717a%22%20font-family%3D%22sans-serif%22%20font-size%3D%2216%22%3ENo%20Preview%3C%2Ftext%3E%3C%2Fsvg%3E';
export const AVATAR_FALLBACK_SVG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22120%22%20height%3D%22160%22%20viewBox%3D%220%200%20120%20160%22%3E%3Crect%20fill%3D%22%2318181b%22%20width%3D%22120%22%20height%3D%22160%22%2F%3E%3Ccircle%20cx%3D%2260%22%20cy%3D%2260%22%20r%3D%2226%22%20fill%3D%22%233f3f46%22%2F%3E%3Cpath%20d%3D%22M24%20140c0-20%2016-36%2036-36s36%2016%2036%2036%22%20fill%3D%22%233f3f46%22%2F%3E%3C%2Fsvg%3E';

