// Predictive Route Preloader: Loads code-split bundles on pointer hover/focus/idle

const preloadedRoutes = new Set<string>();

export const preloadRoute = (target: string): void => {
  const normalized = target.toLowerCase().trim();
  
  if (preloadedRoutes.has(normalized)) return;
  preloadedRoutes.add(normalized);

  try {
    if (normalized.includes('discover')) {
      import('../pages/Discover');
    } else if (normalized.includes('anime')) {
      import('../pages/Anime');
    } else if (normalized.includes('livetv') || normalized.includes('live-tv')) {
      import('../pages/LiveTV');
    } else if (normalized.includes('library')) {
      import('../pages/Library');
    } else if (normalized.includes('music')) {
      import('../src/modules/music/MusicModule');
    } else if (normalized.includes('sports/watch') || normalized.includes('sportsplayer')) {
      import('../pages/SportsPlayer');
    } else if (normalized.includes('sports')) {
      import('../pages/Sports');
    } else if (normalized.includes('movie') || normalized.includes('tv') || normalized.includes('details')) {
      import('../pages/Details');
    } else if (normalized.includes('search')) {
      import('../pages/Search');
    } else if (normalized.includes('watch') || normalized.includes('player')) {
      import('../pages/VidyPlayer');
    }
  } catch (err) {
    // Ignore prefetch errors; normal lazy fallback will take over on navigation
    console.debug('Route prefetch deferred:', err);
  }
};

export const warmIdleRoutes = (): void => {
  if (typeof window === 'undefined') return;
  
  const scheduleIdle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1000));
  
  scheduleIdle(() => {
    preloadRoute('discover');
    preloadRoute('details');
    preloadRoute('sports');
  });
};
