import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes cache freshness
      gcTime: 1000 * 60 * 60, // 60 minutes garbage collection preservation
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Instant render from cache on repeat page visits
      networkMode: 'offlineFirst',
    },
  },
});