import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Cloud, ExternalLink, ListMusic, Loader2, Play, Plus, X } from 'lucide-react';
import { TrackRow } from '../components/TrackRow';
import { MusicTrack, Playlist } from '../types';
import {
  getSoundCloudArtist,
  getImportedSoundCloudPlaylists,
  toSoundCloudTrack,
  addTrackToSoundCloudPlaylist,
  createSoundCloudPlaylist,
} from '../api/soundcloud';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

interface ArtistData {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  tracks: MusicTrack[];
  nextOffset: number | null;
}

export const SoundCloudArtistRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playTrack = useMusicPlayerStore(state => state.playTrack);

  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playlistModalTrack, setPlaylistModalTrack] = useState<MusicTrack | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addedTo, setAddedTo] = useState<string | null>(null);

  const load = useCallback(async (offset = 0, append = false) => {
    if (!id) return;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const data = await getSoundCloudArtist(decodeURIComponent(id), offset);
      const tracks = (data.tracks || []).map(t => toSoundCloudTrack(t, data.name));
      setArtist(prev => {
        if (!prev) return { ...data, tracks };
        const seen = new Set(prev.tracks.map(t => t.id));
        return { ...prev, ...data, tracks: [...prev.tracks, ...tracks.filter(t => !seen.has(t.id))] };
      });
    } catch (e) {
      setError((e as Error).message || 'Could not load this artist.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const openPlaylistModal = (track: MusicTrack) => {
    setPlaylists(getImportedSoundCloudPlaylists());
    setNewPlaylistName(track.title || '');
    setAddedTo(null);
    setPlaylistModalTrack(track);
  };

  const handleAddTo = (playlistId: string) => {
    if (!playlistModalTrack) return;
    const pl = playlists.find(p => p.id === playlistId);
    if (pl && addTrackToSoundCloudPlaylist(playlistId, playlistModalTrack)) {
      setAddedTo(pl.title);
      setTimeout(() => { setPlaylistModalTrack(null); setAddedTo(null); }, 900);
    }
  };

  const handleCreateAndAdd = () => {
    if (!playlistModalTrack) return;
    const name = newPlaylistName.trim() || playlistModalTrack.title || 'SoundCloud Picks';
    const pl = createSoundCloudPlaylist(name, [playlistModalTrack], playlistModalTrack.artwork);
    setAddedTo(pl.title);
    setTimeout(() => { setPlaylistModalTrack(null); setAddedTo(null); }, 900);
  };

  const handleImportArtist = () => {
    if (!artist) return;
    const pl = createSoundCloudPlaylist(
      artist.name,
      artist.tracks,
      artist.avatar || artist.tracks[0]?.artwork || '',
    );
    navigate(`/music/playlist/${pl.id}`);
  };

  const tracks = artist?.tracks || [];

  return (
    <div className="space-y-6 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4">
      <Link
        to="/music/library/playlists"
        className="inline-flex items-center gap-1.5 text-xs text-[#b3b3b3] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Playlists
      </Link>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-white/50">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-[#141414] border border-white/10 p-8 text-center">
          <p className="text-sm text-white/70">{error}</p>
        </div>
      ) : artist ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 p-5 sm:p-7 rounded-2xl bg-[#141414] border border-white/5 shadow-xl">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden bg-[#1e1e1e] ring-2 ring-white/10 shrink-0">
              {artist.avatar ? (
                <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  <Cloud className="w-12 h-12" />
                </div>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#ff5500] bg-[#ff5500]/10 px-2 py-0.5 rounded-full border border-[#ff5500]/20">
                SoundCloud Artist
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-2 truncate">{artist.name}</h1>
              {artist.handle && (
                <a
                  href={`https://soundcloud.com/${artist.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#b3b3b3] hover:text-white mt-1 transition-colors"
                >
                  soundcloud.com/{artist.handle} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <p className="text-xs text-[#98989d] mt-2">{tracks.length}{artist.nextOffset ? '+' : ''} tracks</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tracks.length > 0 && (
                <button
                  type="button"
                  onClick={() => playTrack(tracks[0], tracks)}
                  className="px-5 py-2.5 rounded-full bg-white hover:bg-white/90 text-black text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play
                </button>
              )}
              {tracks.length > 0 && (
                <button
                  type="button"
                  onClick={handleImportArtist}
                  className="px-5 py-2.5 rounded-full bg-[#ff5500]/15 hover:bg-[#ff5500]/25 border border-[#ff5500]/30 text-[#ff8c5a] text-xs font-semibold flex items-center gap-2 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Import as Playlist
                </button>
              )}
            </div>
          </div>

          {/* Tracks */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3.5 py-2 text-[11px] font-semibold text-[#b3b3b3] uppercase tracking-wider border-b border-white/10 mb-2">
              <span>Title</span>
              <span className="hidden sm:block">Artist</span>
              <span className="w-20 text-right">Time</span>
            </div>
            {tracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                showArtwork
                showAlbum={false}
                playlistContext={tracks}
                onAddToPlaylist={openPlaylistModal}
              />
            ))}
            {artist.nextOffset != null && (
              <button
                type="button"
                onClick={() => void load(artist.nextOffset as number, true)}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 transition-colors flex items-center justify-center gap-2"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Load more tracks
              </button>
            )}
          </div>
        </>
      ) : null}

      {/* Add-to-playlist modal */}
      {playlistModalTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setPlaylistModalTrack(null)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-[#1e1e20] border border-white/10 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white truncate">Add to playlist</h3>
                <p className="text-xs text-[#98989d] truncate mt-0.5">{playlistModalTrack.title} — {playlistModalTrack.artist}</p>
              </div>
              <button type="button" onClick={() => setPlaylistModalTrack(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {addedTo ? (
              <p className="text-sm text-emerald-400 py-4 text-center">Added to "{addedTo}"</p>
            ) : (
              <>
                <div className="max-h-56 overflow-y-auto space-y-1 mb-3 am-scrollbar">
                  {playlists.length === 0 && (
                    <p className="text-xs text-[#98989d] py-3 text-center">No SoundCloud playlists yet — create one below.</p>
                  )}
                  {playlists.map(pl => (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => handleAddTo(pl.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 text-left transition-colors"
                    >
                      <div className="w-9 h-9 rounded-md overflow-hidden bg-[#282828] shrink-0">
                        {pl.artwork ? <img src={pl.artwork} alt="" className="w-full h-full object-cover" /> : <ListMusic className="w-4 h-4 m-2.5 text-white/30" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{pl.title}</p>
                        <p className="text-[11px] text-[#98989d]">{pl.trackCount ?? pl.tracks.length} songs</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="New playlist name"
                    className="flex-1 bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#6a6a6a] focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="button"
                    onClick={handleCreateAndAdd}
                    className="px-4 py-2 rounded-xl bg-[#ff5500] hover:bg-[#ff6600] text-white text-xs font-semibold transition-colors shrink-0"
                  >
                    Create
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SoundCloudArtistRoute;
