// ---------------------------------------------------------------------------
// Shared streaming provider registry + per-mirror health scoring.
// Single source of truth for VidyPlayer and the Details page server picker.
// ---------------------------------------------------------------------------

export const PROVIDERS = [
  { id: 'direct', name: 'Direct Streams', speed: 'Fast ⚡', quality: 'MP4 · Addons', badge: 'No Ads' },
  { id: 'ishowstream', name: 'iShowStream', speed: 'Ultra Fast ⚡', quality: '4K · 1080p', badge: 'Fastest' },
  { id: 'vidapi', name: 'VidAPI', speed: 'Fast ⚡', quality: '1080p', badge: 'New' },
  { id: 'vidy', name: 'Vidy Prime', speed: 'Fast ⚡', quality: '1080p', badge: 'Popular' },
  { id: 'vidlypro', name: 'Vidly Pro', speed: 'Ultra ⚡', quality: '4K · 1080p', badge: 'Fast 4K' },
  { id: 'vidlink', name: 'VidLink Pro', speed: 'Instant 🚀', quality: 'FHD · Audio', badge: 'Top Rated' },
  { id: 'vidsrc-sh', name: 'VidSrc Direct', speed: 'Fast ⚡', quality: '1080p Auto', badge: 'Stable' },
  { id: 'cinemaos', name: 'CinemaOS', speed: 'Fast 💎', quality: 'High Bitrate', badge: 'Cinema' },
  { id: 'vidsrc-wtf', name: 'VidSrc WTF', speed: 'Fast ⚡', quality: '1080p', badge: 'Mirror 1' },
  { id: 'videasy-xyz', name: 'Videasy XYZ', speed: 'Adaptive 🌐', quality: 'Multi-Res', badge: 'Mirror 2' },
  { id: 'vidfastpro', name: 'VidFast HQ', speed: 'Rapid ⚡', quality: '1080p', badge: 'Mirror 3' },
  { id: 'vidsrc-to', name: 'VidSrc TO', speed: 'Fast ⚡', quality: '1080p', badge: 'Mirror 4' },
  { id: 'vidsrc-me', name: 'VidSrc ME', speed: 'Fast ⚡', quality: '1080p', badge: 'Mirror 5' },
  { id: '2embed', name: '2Embed', speed: 'Fast ⚡', quality: '1080p', badge: 'Mirror 6' },
  { id: 'multiembed', name: 'MultiEmbed', speed: 'Fast ⚡', quality: '1080p', badge: 'Mirror 7' },
] as const;

export type ProviderId = typeof PROVIDERS[number]['id'];

export const ANIME_PROVIDERS = [
  { id: 'aniembed', name: 'AniEmbed', server: 1 },
  { id: 'megavid', name: 'MegaVid', server: 2 },
  { id: 'vidly', name: 'Vidly Pro', server: 3 },
  { id: 'anixo', name: 'Anixo', server: 4 },
  { id: 'ishowstream', name: 'iShowStream', server: 5 },
] as const;

export type AnimeProviderId = typeof ANIME_PROVIDERS[number]['id'];

// ---------------------------------------------------------------------------
// Provider health scoring: remembers which mirrors actually play video vs time
// out, so failover prefers healthy servers and dead ones get skipped.
// ---------------------------------------------------------------------------
interface ProviderHealthEntry { ok: number; fail: number }
type ProviderHealthBook = Record<string, ProviderHealthEntry>;
const HEALTH_KEY = 'vidy:provider-health';

export const getHealthBook = (): ProviderHealthBook => {
  try {
    const raw = localStorage.getItem(HEALTH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const bumpProviderHealth = (key: string, field: 'ok' | 'fail') => {
  try {
    const book = getHealthBook();
    const rawEntry = book[key];
    const entry: ProviderHealthEntry = {
      ok: Number(rawEntry?.ok) || 0,
      fail: Number(rawEntry?.fail) || 0,
    };
    entry[field] = Math.min(entry[field] + 1, 999);
    book[key] = entry;
    localStorage.setItem(HEALTH_KEY, JSON.stringify(book));
  } catch {}
};

export const providerHealthScore = (key: string): number => {
  const e = getHealthBook()?.[key];
  return e ? (Number(e.ok) || 0) - (Number(e.fail) || 0) : 0;
};

/** Providers sorted by observed health (stable — ties keep declared order). */
export const providersByHealth = <T extends { id: string }>(list: readonly T[], prefix: string): T[] =>
  [...list].sort((a, b) => providerHealthScore(`${prefix}:${b.id}`) - providerHealthScore(`${prefix}:${a.id}`));

export const healthDotClass = (book: ProviderHealthBook, key: string): string => {
  const e = book && typeof book === 'object' ? book[key] : undefined;
  const score = e ? (Number(e.ok) || 0) - (Number(e.fail) || 0) : 0;
  if (score > 0) return 'bg-emerald-400';
  if (score < 0) return 'bg-rose-400';
  return 'bg-zinc-500';
};
