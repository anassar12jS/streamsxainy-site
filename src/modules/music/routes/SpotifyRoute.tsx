import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Music2, Heart, Loader2, AlertTriangle, LogIn, RefreshCw } from 'lucide-react';
import {
  getSpotifyAuthState,
  getSpotifyPlaylists,
  signInSpotify,
  SpotifyPlaylist,
} from '../data/spotify';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { ARTWORK_PLACEHOLDER } from '../api/ytmParse';

const FALLBACK_ART = ARTWORK_PLACEHOLDER;

export const SpotifyRoute: React.FC = () => {
  const extensionConnected = useMusicPlayerStore(state => state.extensionConnected);

  const authQuery = useQuery({
    queryKey: ['spotify-auth'],
    queryFn: getSpotifyAuthState,
    enabled: extensionConnected,
    staleTime: 1000 * 30,
    // Poll while waiting for the user to finish Spotify sign-in in the other tab
    refetchInterval: (query) => (query.state.data?.authenticated ? false : 5000),
    retry: 1,
  });

  const playlistsQuery = useQuery({
    queryKey: ['spotify-playlists'],
    queryFn: () => getSpotifyPlaylists(0),
    enabled: Boolean(authQuery.data?.authenticated),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const authed = authQuery.data?.authenticated === true;
  const playlists: any[] = playlistsQuery.data || [];

  return (
    <div className="space-y-8 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4">
      <Link
        to="/music"
        className="inline-flex items-center gap-1.5 text-xs text-[#b3b3b3] hover:text-white transition-colors pt-1 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Music Home</span>
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 pt-2">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
          <Music2 className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Spotify Playlists
          </h1>
          <p className="text-xs text-[#98989d] mt-0.5">
            Your Spotify library, played through Xainy Music
          </p>
        </div>
      </div>

      {/* States */}
      {!extensionConnected ? (
        <div className="py-20 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400/70" />
          <p className="text-base font-semibold text-white">Extension required</p>
          <p className="text-xs text-[#b3b3b3] mt-1 max-w-sm mx-auto">
            Spotify playlists load through the Xainy Music companion extension. Install it, then come back.
          </p>
        </div>
      ) : authQuery.isLoading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-sm text-[#b3b3b3]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Checking Spotify connection…</span>
        </div>
      ) : !authed ? (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <LogIn className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white">Connect your Spotify account</p>
            <p className="text-xs text-[#b3b3b3] mt-1.5 leading-relaxed">
              {authQuery.data?.browserSignedIn
                ? 'The extension can see your Spotify session — enable Spotify in the extension popup to load playlists.'
                : 'Sign in to Spotify in this browser once — the extension reads your session to fetch your playlists. No password is stored by Xainy Music.'}
            </p>
            {authQuery.data?.problem && (
              <p className="text-[11px] text-amber-400/80 mt-2">{authQuery.data.problem}</p>
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => { void signInSpotify(); authQuery.refetch(); }}
              className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in to Spotify</span>
            </button>
            <button
              type="button"
              onClick={() => authQuery.refetch()}
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>I've signed in</span>
            </button>
          </div>
        </div>
      ) : playlistsQuery.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="aspect-square rounded-xl bg-[#1a1a1a]" />
              <div className="h-3.5 w-3/4 rounded bg-[#1a1a1a]" />
              <div className="h-3 w-1/2 rounded bg-[#1a1a1a]" />
            </div>
          ))}
        </div>
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {playlists.map((pl: any) => {
            const id = pl.id || pl.uri?.split(':').pop();
            if (!id) return null;
            const img = pl.imageUrl || pl.images?.[0]?.url || FALLBACK_ART;
            const count = pl.total ?? pl.tracks?.total;
            return (
              <Link
                key={id}
                to={`/music/spotify/${id}`}
                className="group space-y-2 cursor-pointer"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/5 group-hover:border-emerald-500/40 transition-colors">
                  <img
                    src={img}
                    alt={pl.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {id === 'liked' && (
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/60 to-indigo-900/60 flex items-center justify-center">
                      <Heart className="w-10 h-10 text-white fill-white/80" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                    {pl.name}
                  </p>
                  <p className="text-[11px] text-[#98989d] truncate mt-0.5">
                    {pl.owner ? `By ${pl.owner}` : 'Spotify'}
                    {typeof count === 'number' ? ` • ${count} songs` : ''}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center">
          <Music2 className="w-10 h-10 mx-auto mb-2 text-white/30" />
          <p className="text-base font-semibold text-white">No playlists found</p>
          <p className="text-xs text-[#b3b3b3] mt-1">Your Spotify playlists will appear here once the extension can read your library.</p>
        </div>
      )}
    </div>
  );
};

export default SpotifyRoute;
