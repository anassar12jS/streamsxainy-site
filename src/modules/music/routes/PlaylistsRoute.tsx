import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw, ThumbsUp, ListMusic, AlertCircle, Search, Play, Trash2,
  Cloud, Loader2, Check, ChevronDown, Sparkles, Music2,
} from 'lucide-react';
import { CardGridSkeleton } from '../components/Skeletons';
import { getLibraryPlaylists } from '../api/innertube';
import { getImportedYouTubePlaylists } from '../api/youtubeAuth';
import {
  getImportedSoundCloudPlaylists, importSoundCloud, deleteSoundCloudPlaylist,
} from '../api/soundcloud';
import { useSessionStore } from '../store/useSessionStore';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import type { Playlist } from '../types';

type SortMode = 'recent' | 'az' | 'tracks';

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Recently added',
  az: 'A – Z',
  tracks: 'Most tracks',
};

const isSoundCloudPlaylist = (pl: Playlist) => pl.id.startsWith('sc-pl-');

const sortPlaylists = (list: Playlist[], mode: SortMode): Playlist[] => {
  const copy = [...list];
  if (mode === 'az') return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (mode === 'tracks') return copy.sort((a, b) => (b.trackCount ?? b.tracks.length) - (a.trackCount ?? a.tracks.length));
  return copy.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
};

const PlaylistCard: React.FC<{
  pl: Playlist;
  onDelete?: () => void;
  confirmingDelete?: boolean;
}> = ({ pl, onDelete, confirmingDelete }) => {
  const navigate = useNavigate();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const sc = isSoundCloudPlaylist(pl);
  const count = pl.trackCount ?? pl.tracks?.length ?? 0;
  const playable = (pl.tracks?.length ?? 0) > 0;

  return (
    <div className="group relative text-left">
      <div
        onClick={() => navigate(`/music/playlist/${pl.id}`)}
        className="cursor-pointer"
      >
        <div className="relative aspect-square rounded-[10px] overflow-hidden bg-[#1e1e1e] mb-2.5 shadow-lg group-hover:shadow-2xl transition-all duration-300 border border-white/[0.06]">
          {pl.id === 'LM' ? (
            <div className="w-full h-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center">
              <ThumbsUp className="w-1/3 h-1/3 text-white fill-white" />
            </div>
          ) : pl.artwork ? (
            <img
              src={pl.artwork}
              alt={pl.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/25">
              <ListMusic className="w-1/3 h-1/3" />
            </div>
          )}

          {/* Source badge */}
          <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide flex items-center gap-1 backdrop-blur-md ${
            sc ? 'bg-[#ff5500]/80 text-white' : 'bg-black/50 text-white/80'
          }`}>
            {sc ? <Cloud className="w-2.5 h-2.5" /> : <Music2 className="w-2.5 h-2.5" />}
            {sc ? 'SC' : 'YT'}
          </span>

          {/* Hover play button */}
          {playable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playTrack(pl.tracks[0], pl.tracks);
              }}
              className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#ff5500] hover:bg-[#ff6600] text-white flex items-center justify-center shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 cursor-pointer"
              title="Play playlist"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          )}
        </div>
      </div>

      <h4 className="text-sm font-semibold text-white truncate group-hover:text-[#ff8c5a] transition-colors">
        {pl.title}
      </h4>
      <p className="text-xs text-[#98989d] truncate mt-0.5">
        {count} {count === 1 ? 'song' : 'songs'}{pl.curator ? ` · ${pl.curator}` : ''}
      </p>

      {/* Delete (SoundCloud playlists only) */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
            confirmingDelete
              ? 'bg-red-500 text-white opacity-100'
              : 'bg-black/60 text-white/70 hover:text-white opacity-0 group-hover:opacity-100'
          }`}
          title={confirmingDelete ? 'Click again to delete' : 'Delete playlist'}
        >
          {confirmingDelete ? <Check className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
};

/** All Playlists: YouTube Music library + imported playlists, with search & sort. */
export const PlaylistsRoute: React.FC = () => {
  const navigate = useNavigate();
  const activeChannel = useSessionStore(state => state.activeChannel);
  const authStatus = useSessionStore(state => state.authStatus);
  const errorMessage = useSessionStore(state => state.errorMessage);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('recent');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // SoundCloud quick-import
  const [scInput, setScInput] = useState('');
  const [scStatus, setScStatus] = useState<string | null>(null);
  const [isScImporting, setIsScImporting] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['ytm-library-playlists', activeChannel?.id || 'default'],
    queryFn: getLibraryPlaylists,
    enabled: authStatus === 'authenticated',
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Re-render when the local library changes (SC/YT imports, playlist edits)
  useEffect(() => {
    const handler = () => forceUpdate();
    window.addEventListener('bitchord:library-updated', handler);
    return () => window.removeEventListener('bitchord:library-updated', handler);
  }, []);

  // Playlists the user imported by link (not part of their library) stay available too.
  const liveIds = new Set((data ?? []).map(p => p.id));
  const imported: Playlist[] = getImportedYouTubePlaylists()
    .map(p => ({ ...p, id: p.id.replace(/^yt-pl-/, '') }))
    .filter(p => p.id !== 'liked-music' && !liveIds.has(p.id));

  // SoundCloud imports live in local storage (IndexedDB) and don't need a YouTube session.
  const scPlaylists = getImportedSoundCloudPlaylists();

  const handleDelete = (pl: Playlist) => {
    if (confirmingDelete !== pl.id) {
      setConfirmingDelete(pl.id);
      window.setTimeout(() => setConfirmingDelete(c => (c === pl.id ? null : c)), 3000);
      return;
    }
    deleteSoundCloudPlaylist(pl.id);
    setConfirmingDelete(null);
  };

  const handleScImport = async () => {
    const input = scInput.trim();
    if (!input || isScImporting) return;
    setIsScImporting(true);
    setScStatus(null);
    try {
      const result = await importSoundCloud(input);
      if (result.playlistId) {
        navigate(`/music/playlist/${result.playlistId}`);
        return;
      }
      setScStatus(`Added "${result.title}" to your songs`);
      setScInput('');
    } catch (e) {
      setScStatus((e as Error).message || 'SoundCloud import failed.');
    } finally {
      setIsScImporting(false);
    }
  };

  const query = search.trim().toLowerCase();
  const matches = (pl: Playlist) =>
    !query || pl.title.toLowerCase().includes(query) || (pl.curator || '').toLowerCase().includes(query);

  const scFiltered = useMemo(
    () => sortPlaylists(scPlaylists.filter(matches), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scPlaylists, search, sort, forceUpdate],
  );
  const ytList = useMemo(() => {
    const all = [...(data ?? []), ...imported];
    return sortPlaylists(all.filter(matches), sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, imported, search, sort, forceUpdate]);

  const totalCount = scFiltered.length + ytList.length;

  const renderGrid = (list: Playlist[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5">
      {list.map(pl => (
        <PlaylistCard
          key={pl.id}
          pl={pl}
          onDelete={isSoundCloudPlaylist(pl) ? () => handleDelete(pl) : undefined}
          confirmingDelete={confirmingDelete === pl.id}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4" style={{ fontFamily: 'var(--bitchord-font)' }}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">All Playlists</h1>
          <p className="text-xs text-[#98989d] mt-1.5">{totalCount} playlist{totalCount === 1 ? '' : 's'}</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching || authStatus !== 'authenticated'}
          className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search + sort + SoundCloud quick import */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a6a6a]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playlists…"
            className="w-full bg-[#141414] border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#6a6a6a] focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="appearance-none bg-[#141414] border border-white/10 rounded-full pl-4 pr-9 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map(m => (
              <option key={m} value={m}>{SORT_LABELS[m]}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a6a6a] pointer-events-none" />
        </div>
      </div>

      {/* SoundCloud quick import */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#ff5500]/10 to-transparent border border-[#ff5500]/20">
        <div className="flex items-center gap-2 mb-2.5">
          <Cloud className="w-4 h-4 text-[#ff5500]" />
          <span className="text-xs font-semibold text-white">Import from SoundCloud</span>
          <span className="text-[11px] text-[#98989d]">— tracks, playlists & artist pages</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={scInput}
            onChange={(e) => setScInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleScImport(); }}
            placeholder="https://soundcloud.com/artist/track-or-set"
            className="flex-1 bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#6a6a6a] focus:outline-none focus:border-[#ff5500]/50 transition-colors"
          />
          <button
            type="button"
            onClick={() => void handleScImport()}
            disabled={isScImporting || !scInput.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-2 transition-all shrink-0"
          >
            {isScImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isScImporting ? 'Importing…' : 'Import'}</span>
          </button>
        </div>
        {scStatus && (
          <p className={`text-xs mt-2 ${scStatus.startsWith('Added') ? 'text-emerald-400' : 'text-red-400'}`}>
            {scStatus}
          </p>
        )}
      </div>

      {authStatus !== 'authenticated' ? (
        <>
          <div className="rounded-2xl bg-[#141414] border border-white/10 p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-white/60 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-white font-semibold">YouTube Music isn't connected</p>
              <p className="text-xs text-[#b3b3b3] mt-1">
                {errorMessage || 'Connect your account from the switcher at the bottom of the sidebar to see your YouTube playlists.'}
              </p>
            </div>
          </div>
          {scFiltered.length === 0 && ytList.length === 0 && !query ? (
            <EmptyState />
          ) : (
            <>
              {scFiltered.length > 0 && (
                <Section title="SoundCloud" icon={<Cloud className="w-4 h-4 text-[#ff5500]" />}>
                  {renderGrid(scFiltered)}
                </Section>
              )}
              {ytList.length > 0 && (
                <Section title="YouTube Music" icon={<Music2 className="w-4 h-4 text-red-500" />}>
                  {renderGrid(ytList)}
                </Section>
              )}
            </>
          )}
        </>
      ) : isLoading ? (
        <CardGridSkeleton count={12} />
      ) : error ? (
        <div className="rounded-2xl bg-[#141414] border border-white/10 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-white/60 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white font-semibold">Couldn't load your playlists</p>
            <p className="text-xs text-[#b3b3b3] mt-1">{(error as Error).message}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-xs font-semibold text-white underline underline-offset-4 cursor-pointer hover:text-white/80"
            >
              Try again
            </button>
          </div>
        </div>
      ) : totalCount === 0 ? (
        <EmptyState hasQuery={!!query} />
      ) : (
        <>
          {scFiltered.length > 0 && (
            <Section title="SoundCloud" icon={<Cloud className="w-4 h-4 text-[#ff5500]" />}>
              {renderGrid(scFiltered)}
            </Section>
          )}
          {ytList.length > 0 && (
            <Section title="YouTube Music" icon={<Music2 className="w-4 h-4 text-red-500" />}>
              {renderGrid(ytList)}
            </Section>
          )}
        </>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="space-y-4">
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
    </div>
    {children}
  </section>
);

const EmptyState: React.FC<{ hasQuery?: boolean }> = ({ hasQuery }) => (
  <div className="py-20 text-center rounded-2xl bg-[#121212] border border-white/5 p-8">
    <Sparkles className="w-9 h-9 text-white/20 mx-auto mb-3" />
    <h3 className="text-base font-semibold text-white">
      {hasQuery ? 'No playlists match your search' : 'No playlists yet'}
    </h3>
    <p className="text-xs text-[#b3b3b3] mt-1.5 max-w-sm mx-auto">
      {hasQuery
        ? 'Try a different search term.'
        : 'Import a SoundCloud track, playlist, or artist above — or connect YouTube Music to see your library playlists.'}
    </p>
  </div>
);

export default PlaylistsRoute;
