import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, Shuffle, Heart, Music2, Share2, Sparkles, ArrowLeft, Disc, Loader2, Check, Cloud, Trash2, Search, Pencil, Download, Link2, GripVertical, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { TrackRow } from '../components/TrackRow';
import { getPlaylistDetails } from '../api/innertube';
import { getImportedSoundCloudPlaylist, deleteSoundCloudPlaylist, removeTrackFromSoundCloudPlaylist, updateSoundCloudPlaylist } from '../api/soundcloud';
import { MusicTrack, Playlist } from '../types';
import { ARTWORK_PLACEHOLDER } from '../api/ytmParse';

export const PlaylistRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const navigate = useNavigate();
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const appendToQueue = useMusicPlayerStore(state => state.appendToQueue);

  const { data: playlist, isLoading, error, refetch } = useQuery<Playlist | null>({
    queryKey: ['music-playlist', id],
    queryFn: () => {
      if (!id) return Promise.resolve(null);
      if (id.startsWith('sc-pl-')) return Promise.resolve(getImportedSoundCloudPlaylist(id));
      return getPlaylistDetails(id);
    },
    enabled: Boolean(id),
    // Local SoundCloud playlists live in localStorage and can be created after
    // this route first mounts — never serve a stale 'not found' for them.
    staleTime: id?.startsWith('sc-pl-') ? 0 : 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const tracks: MusicTrack[] = playlist?.tracks || [];
  const isScPlaylist = Boolean(id?.startsWith('sc-pl-'));

  const [query, setQuery] = React.useState('');
  const [editOpen, setEditOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [shareFlash, setShareFlash] = React.useState(false);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [dropIdx, setDropIdx] = React.useState<number | null>(null);

  const filteredTracks = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.artist?.toLowerCase().includes(q) ||
      t.album?.toLowerCase().includes(q) ||
      t.genre?.toLowerCase().includes(q)
    );
  }, [tracks, query]);

  const playlistStats = React.useMemo(() => {
    const totalSec = tracks.reduce((acc, t) => acc + (t.duration > 0 ? t.duration : 0), 0);
    const genreCount = new Map<string, number>();
    tracks.forEach(t => {
      const g = (t.genre || '').trim();
      if (g) genreCount.set(g, (genreCount.get(g) || 0) + 1);
    });
    let topGenre = '';
    let topN = 0;
    genreCount.forEach((n, g) => { if (n > topN) { topN = n; topGenre = g; } });
    return { totalSec, topGenre };
  }, [tracks]);
  const [addedFlash, setAddedFlash] = React.useState(false);
  const addedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddAll = () => {
    if (!tracks.length) return;
    appendToQueue(tracks);
    setAddedFlash(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedFlash(false), 1600);
  };

  const handlePlayAll = (shuffle = false) => {
    if (tracks.length === 0) return;
    let list = [...tracks];
    if (shuffle) list.sort(() => Math.random() - 0.5);
    playTrack(list[0], list);
  };

  const handleShare = async () => {
    if (!id) return;
    const url = `${window.location.origin}/music/playlist/${id}`;
    const payload = { title: playlist?.title || 'Playlist', text: `Listen to ${playlist?.title || 'this playlist'} on Xainy Music`, url };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareFlash(true);
      window.setTimeout(() => setShareFlash(false), 1600);
    } catch {}
  };

  const handleExportM3u = () => {
    if (!playlist || tracks.length === 0) return;
    const lines: string[] = ['#EXTM3U'];
    tracks.forEach(t => {
      const label = `${t.artist || 'Unknown Artist'} - ${t.title}`;
      const uri = t.audioUrl?.startsWith('http')
        ? t.audioUrl
        : t.soundcloudUrl
          ? t.soundcloudUrl
          : t.youtubeId
            ? `https://music.youtube.com/watch?v=${t.youtubeId}`
            : '';
      lines.push(`#EXTINF:${Math.round(t.duration || -1)},${label}`);
      if (uri) lines.push(uri);
    });
    const blob = new Blob([lines.join('\n')], { type: 'audio/x-mpegurl' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(playlist.title || 'playlist').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'playlist'}.m3u`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const openEdit = () => {
    if (!playlist) return;
    setEditTitle(playlist.title || '');
    setEditDesc(playlist.description || '');
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!id || !isScPlaylist || !playlist) return;
    const title = editTitle.trim() || playlist.title;
    updateSoundCloudPlaylist(id, {
      title,
      description: editDesc.trim() || undefined,
      artwork: playlist.artwork,
    });
    setEditOpen(false);
    void refetch();
  };

  const pickCover = (art: string) => {
    if (!id || !isScPlaylist || !art) return;
    updateSoundCloudPlaylist(id, { artwork: art });
    void refetch();
  };

  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    if (!isScPlaylist) return;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch {}
  };
  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    if (!isScPlaylist || dragIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIdx(idx);
  };
  const handleDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!isScPlaylist || !id || dragIdx === null || dragIdx === idx) {
      setDragIdx(null); setDropIdx(null); return;
    }
    const next = [...tracks];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    updateSoundCloudPlaylist(id, { tracks: next });
    setDragIdx(null); setDropIdx(null);
    void refetch();
  };
  const handleDragEnd = () => { setDragIdx(null); setDropIdx(null); };

  const handleDeletePlaylist = () => {
    if (!id || !isScPlaylist) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      window.setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    deleteSoundCloudPlaylist(id);
    navigate('/music/library/playlists');
  };

  const handleRemoveTrack = (track: MusicTrack) => {
    if (!id || !isScPlaylist) return;
    removeTrackFromSoundCloudPlaylist(id, track.id);
    void refetch();
  };

  return (
    <div 
      className="space-y-8 animate-fade-in pb-4 max-w-7xl mx-auto px-1 sm:px-4"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      {/* Back button */}
      <Link 
        to="/music" 
        className="inline-flex items-center gap-1.5 text-xs text-[#b3b3b3] hover:text-white transition-colors pt-1 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Music Home</span>
      </Link>

      {/* SKELETON LOADER */}
      {isLoading ? (
        <div className="space-y-8 animate-pulse">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-2 pb-8 border-b border-white/10">
            <div className="w-48 h-48 sm:w-56 sm:h-56 lg:w-60 lg:h-60 rounded-xl bg-[#1a1a1a] shrink-0" />
            <div className="space-y-3 w-full max-w-lg">
              <div className="w-24 h-4 bg-[#1a1a1a] rounded-full" />
              <div className="w-3/4 h-8 bg-[#1a1a1a] rounded-lg" />
              <div className="w-1/2 h-5 bg-[#1a1a1a] rounded-md" />
              <div className="flex gap-3 pt-2">
                <div className="w-24 h-10 bg-[#1a1a1a] rounded-full" />
                <div className="w-24 h-10 bg-[#1a1a1a] rounded-full" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-[#141414] rounded-xl" />
            ))}
          </div>
        </div>
      ) : playlist ? (
        <>
          {/* 1. Playlist Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 pt-2 pb-8 border-b border-white/10">
            {/* Large 1:1 Artwork */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-60 lg:h-60 rounded-xl overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.8)] border border-white/10 shrink-0 bg-[#121212]">
              <img 
                src={playlist.artwork} 
                alt={playlist.title} 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ARTWORK_PLACEHOLDER;
                }}
                className="w-full h-full object-cover" 
              />
            </div>

            {/* Metadata & Actions */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 space-y-2 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start">
                <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  {playlist.title}
                </h1>
                {isScPlaylist && (
                  <span className="px-2 py-1 rounded-full bg-[#ff5500]/15 border border-[#ff5500]/30 text-[#ff8c5a] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Cloud className="w-3 h-3" /> SoundCloud
                  </span>
                )}
              </div>

              <p className="text-xs text-[#98989d] font-normal">
                Playlist • {new Date().getFullYear()} • {playlist.curator || 'Curated'} • {tracks.length} tracks
                {playlistStats.totalSec > 0 && ` • ${Math.floor(playlistStats.totalSec / 3600) > 0 ? `${Math.floor(playlistStats.totalSec / 3600)}h ` : ''}${Math.round((playlistStats.totalSec % 3600) / 60)}m total`}
                {playlistStats.topGenre && ` • ${playlistStats.topGenre}`}
              </p>
              {playlist.description && !editOpen && (
                <p className="text-xs text-[#b3b3b3] max-w-xl">{playlist.description}</p>
              )}

              {/* Action Buttons: Shuffle (Circle), Play (Pill), + (Circle) */}
              <div className="flex items-center gap-3 pt-3">
                {/* Shuffle Button (Circle) */}
                <button
                  type="button"
                  onClick={() => handlePlayAll(true)}
                  disabled={tracks.length === 0}
                  className="w-10 h-10 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                  title="Shuffle playlist"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                {/* Play Button (Pill) */}
                <button
                  type="button"
                  onClick={() => handlePlayAll(false)}
                  disabled={tracks.length === 0}
                  className="px-8 py-2.5 rounded-full bg-white hover:bg-white/95 disabled:opacity-40 text-black font-semibold text-sm shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play</span>
                </button>

                {/* Add to Queue Button (Circle) */}
                <button
                  type="button"
                  onClick={handleAddAll}
                  disabled={tracks.length === 0}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${
                    addedFlash ? 'bg-emerald-400 text-black' : 'bg-white hover:bg-white/90 text-black disabled:opacity-40'
                  }`}
                  title={addedFlash ? 'Added to queue' : 'Add all tracks to queue'}
                >
                  {addedFlash ? <Check className="w-4 h-4" strokeWidth={3} /> : <span className="text-lg font-light leading-none">+</span>}
                </button>

                {/* Delete playlist (SoundCloud imports only) */}
                {isScPlaylist && (
                  <button
                    type="button"
                    onClick={handleDeletePlaylist}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${
                      confirmingDelete ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white border border-white/10'
                    }`}
                    title={confirmingDelete ? 'Click again to delete playlist' : 'Delete playlist'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {/* Edit (SoundCloud playlists only) */}
                {isScPlaylist && (
                  <button
                    type="button"
                    onClick={openEdit}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                    title="Edit playlist (name, cover, description)"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}

                {/* Share */}
                <button
                  type="button"
                  onClick={handleShare}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg ${
                    shareFlash ? 'bg-emerald-400 text-black' : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/10'
                  }`}
                  title={shareFlash ? 'Link copied!' : 'Share playlist'}
                >
                  {shareFlash ? <Check className="w-4 h-4" strokeWidth={3} /> : <Link2 className="w-4 h-4" />}
                </button>

                {/* Export .m3u */}
                <button
                  type="button"
                  onClick={handleExportM3u}
                  disabled={tracks.length === 0}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg disabled:opacity-40"
                  title="Export as .m3u playlist"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Edit panel (SoundCloud playlists) */}
          {editOpen && isScPlaylist && playlist && (
            <div className="rounded-2xl border border-white/10 bg-[#141416] p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Edit Playlist</h3>
                <button onClick={() => setEditOpen(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid sm:grid-cols-[140px_1fr] gap-4">
                {/* Cover picker */}
                <div>
                  <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Cover art</p>
                  <div className="flex sm:grid grid-cols-4 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto am-scrollbar pr-1">
                    {Array.from(new Set(tracks.map(t => t.artwork).filter(Boolean))).slice(0, 12).map(art => (
                      <button
                        key={art}
                        type="button"
                        onClick={() => pickCover(art)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          playlist.artwork === art ? 'border-white scale-105' : 'border-white/10 hover:border-white/40'
                        }`}
                        title="Use as cover"
                      >
                        <img src={art} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                    {tracks.filter(t => t.artwork).length === 0 && (
                      <p className="text-[11px] text-white/40 col-span-full">No artwork in tracks</p>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Name</label>
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      className="mt-1 w-full bg-[#1e1e22] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Description</label>
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={3}
                      className="mt-1 w-full bg-[#1e1e22] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40 resize-none"
                      maxLength={500}
                      placeholder="What's this playlist about?"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="px-5 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 transition-colors cursor-pointer"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Tracklist Table */}
          <div className="space-y-0.5">
            {/* Search inside playlist */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${tracks.length} tracks...`}
                className="w-full sm:w-72 bg-[#141416] border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/40"
              />
            </div>
            {/* Table Column Headers matching screenshot */}
            <div className="grid grid-cols-12 px-3 sm:px-4 py-2 text-[12px] font-semibold text-[#98989d] border-b border-white/[0.08] mb-1 select-none">
              <div className="col-span-12 sm:col-span-6 md:col-span-5 text-left">Song</div>
              <div className="hidden sm:block sm:col-span-3 md:col-span-3 text-left">Artist</div>
              <div className="hidden md:block md:col-span-3 text-left">Album</div>
              <div className="hidden sm:block sm:col-span-3 md:col-span-1 text-right">Time</div>
            </div>

            {filteredTracks.length > 0 ? (
              filteredTracks.map((track) => {
                const idx = tracks.indexOf(track);
                return (
                  <div
                    key={`${track.id}-${idx}`}
                    draggable={isScPlaylist && !query}
                    onDragStart={handleDragStart(idx)}
                    onDragOver={handleDragOver(idx)}
                    onDrop={handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    className={`relative flex items-center transition-colors rounded-xl ${
                      dropIdx === idx && dragIdx !== null && dragIdx !== idx ? 'bg-white/[0.07]' : ''
                    } ${dragIdx === idx ? 'opacity-40' : ''}`}
                  >
                    {isScPlaylist && !query && (
                      <GripVertical className="w-3.5 h-3.5 text-white/20 shrink-0 mr-1 cursor-grab active:cursor-grabbing" />
                    )}
                    <div className="flex-1 min-w-0">
                      <TrackRow
                        track={track}
                        index={idx}
                        showArtwork={true}
                        playlistContext={tracks}
                        onRemoveFromPlaylist={isScPlaylist ? handleRemoveTrack : undefined}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-sm text-[#777]">
                {query ? 'No tracks match your search.' : 'No tracks found in this playlist.'}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="py-20 text-center text-white/50">
          <Disc className="w-10 h-10 mx-auto mb-2 text-white/30" />
          <p className="text-base font-semibold text-white">Playlist Not Found</p>
          <p className="text-xs text-[#b3b3b3] mt-1">
            {error ? (error as Error).message : `Unable to locate playlist "${id}".`}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 text-xs font-semibold text-white underline underline-offset-4 cursor-pointer hover:text-white/80"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
};

export default PlaylistRoute;
