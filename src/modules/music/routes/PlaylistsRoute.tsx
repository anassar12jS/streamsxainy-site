import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ThumbsUp, ListMusic, AlertCircle, Loader2 } from 'lucide-react';
import { getLibraryPlaylists } from '../api/innertube';
import { getImportedYouTubePlaylists } from '../api/youtubeAuth';
import { useSessionStore } from '../store/useSessionStore';
import type { Playlist } from '../types';

/** All Playlists: the signed-in YouTube Music library, live (like BitChord's playlists page). */
export const PlaylistsRoute: React.FC = () => {
  const navigate = useNavigate();
  const activeChannel = useSessionStore(state => state.activeChannel);
  const authStatus = useSessionStore(state => state.authStatus);
  const errorMessage = useSessionStore(state => state.errorMessage);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['ytm-library-playlists', activeChannel?.id || 'default'],
    queryFn: getLibraryPlaylists,
    enabled: authStatus === 'authenticated',
    staleTime: 1000 * 60 * 3,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  // Playlists the user imported by link (not part of their library) stay available too.
  const liveIds = new Set((data ?? []).map(p => p.id));
  const imported: Playlist[] = getImportedYouTubePlaylists()
    .map(p => ({ ...p, id: p.id.replace(/^yt-pl-/, '') }))
    .filter(p => p.id !== 'liked-music' && !liveIds.has(p.id));

  const playlists = [...(data ?? []), ...imported];

  return (
    <div className="space-y-8 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4" style={{ fontFamily: 'var(--bitchord-font)' }}>
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">All Playlists</h1>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching || authStatus !== 'authenticated'}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {authStatus !== 'authenticated' ? (
        <div className="rounded-2xl bg-[#141414] border border-white/10 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white font-semibold">YouTube Music isn't connected</p>
            <p className="text-xs text-[#b3b3b3] mt-1">
              {errorMessage || 'Connect your account from the switcher at the bottom of the sidebar.'}
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-3 text-[#b3b3b3] text-sm py-16 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading your playlists…
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-[#141414] border border-white/10 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white font-semibold">Couldn't load your playlists</p>
            <p className="text-xs text-[#b3b3b3] mt-1">{(error as Error).message}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5">
          {playlists.map(pl => (
            <div
              key={pl.id}
              onClick={() => navigate(`/music/playlist/${pl.id}`)}
              className="group cursor-pointer text-left"
            >
              <div className="relative aspect-square rounded-[8px] overflow-hidden bg-[#1e1e1e] mb-2 shadow-md group-hover:scale-[1.02] transition-transform duration-200 border border-white/5">
                {pl.id === 'LM' ? (
                  <div className="w-full h-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                    <ThumbsUp className="w-1/3 h-1/3 text-white fill-white" />
                  </div>
                ) : pl.artwork ? (
                  <img src={pl.artwork} alt={pl.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30">
                    <ListMusic className="w-1/3 h-1/3" />
                  </div>
                )}
              </div>
              <h4 className="text-sm font-semibold text-white truncate text-left group-hover:underline">{pl.title}</h4>
              <p className="text-xs text-[#98989d] truncate mt-0.5 text-left">{pl.subtitle}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaylistsRoute;
