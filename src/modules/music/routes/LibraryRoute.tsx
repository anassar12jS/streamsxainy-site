import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Heart, Clock, Play, Shuffle, Music2, Users, Disc, Compass } from 'lucide-react';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { TrackRow } from '../components/TrackRow';
import { MusicTrack } from '../types';

export const LibraryRoute: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const likedTrackIds = useMusicPlayerStore(state => state.likedTrackIds);
  const recentlyPlayed = useMusicPlayerStore(state => state.recentlyPlayed);
  const setTrack = useMusicPlayerStore(state => state.setTrack);

  // Filter all known tracks to find liked ones
  const allKnownTracks = [
    ...APPLE_MUSIC_BROWSE_SECTIONS.topTracks,
    ...recentlyPlayed,
  ];

  const likedTracks = allKnownTracks.filter((track, index, self) => 
    likedTrackIds.includes(track.id) && self.findIndex(t => t.id === track.id) === index
  );

  const activeTab = location.pathname.includes('/liked') 
    ? 'liked' 
    : location.pathname.includes('/artists')
      ? 'artists'
      : location.pathname.includes('/albums')
        ? 'albums'
        : 'recent';

  const handlePlayCollection = (tracks: MusicTrack[], shuffle = false) => {
    if (tracks.length === 0) return;
    let list = [...tracks];
    if (shuffle) list.sort(() => Math.random() - 0.5);
    setTrack(list[0], list);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Library Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#fa243c] bg-[#fa243c]/15 px-2.5 py-0.5 rounded-full border border-[#fa243c]/30">
            Personal Library
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1.5">
            {activeTab === 'liked' ? 'Liked Songs' : 'Recently Added & History'}
          </h1>
          <p className="text-xs sm:text-sm text-white/50 mt-1">
            Your collection of favorited songs, albums, and recent listening history.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 bg-[#141416] p-1 rounded-2xl border border-white/10 overflow-x-auto text-xs font-bold">
          <Link
            to="/music/library"
            className={`px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'recent'
                ? 'bg-[#fa243c] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Recently Added
          </Link>
          <Link
            to="/music/library/liked"
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'liked'
                ? 'bg-[#fa243c] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Liked ({likedTrackIds.length})</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'liked' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
              {likedTracks.length} Songs Favorited
            </span>
            {likedTracks.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlayCollection(likedTracks, false)}
                  className="px-4 py-1.5 rounded-xl bg-[#fa243c] text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer hover:bg-[#ff3b50]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play
                </button>
                <button
                  onClick={() => handlePlayCollection(likedTracks, true)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 cursor-pointer hover:bg-white/15"
                >
                  <Shuffle className="w-3.5 h-3.5" /> Shuffle
                </button>
              </div>
            )}
          </div>

          {likedTracks.length > 0 ? (
            <div className="bg-[#141416] p-3 rounded-3xl border border-white/5 space-y-0.5 shadow-xl">
              {likedTracks.map((track, idx) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={idx}
                  playlistContext={likedTracks}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-white/40 bg-[#141416] rounded-3xl border border-white/10 p-8 max-w-md mx-auto space-y-3">
              <Heart className="w-10 h-10 text-[#fa243c]/50 mx-auto" />
              <h3 className="text-base font-bold text-white">No Liked Songs Yet</h3>
              <p className="text-xs text-white/40">
                Click the heart icon on any song or soundtrack to build your personal Apple Music library.
              </p>
              <button
                onClick={() => navigate('/music')}
                className="mt-2 px-5 py-2.5 rounded-2xl bg-[#fa243c] text-white text-xs font-bold cursor-pointer hover:bg-[#ff3b50]"
              >
                Browse Popular Music
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Recently Played Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
              {recentlyPlayed.length} Recent Tracks
            </span>
            {recentlyPlayed.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePlayCollection(recentlyPlayed, false)}
                  className="px-4 py-1.5 rounded-xl bg-[#fa243c] text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer hover:bg-[#ff3b50]"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play
                </button>
                <button
                  onClick={() => handlePlayCollection(recentlyPlayed, true)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold flex items-center gap-1.5 border border-white/10 cursor-pointer hover:bg-white/15"
                >
                  <Shuffle className="w-3.5 h-3.5" /> Shuffle
                </button>
              </div>
            )}
          </div>

          {recentlyPlayed.length > 0 ? (
            <div className="bg-[#141416] p-3 rounded-3xl border border-white/5 space-y-0.5 shadow-xl">
              {recentlyPlayed.map((track, idx) => (
                <TrackRow
                  key={`${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  playlistContext={recentlyPlayed}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-white/40 bg-[#141416] rounded-3xl border border-white/10 p-8 max-w-md mx-auto space-y-3">
              <Clock className="w-10 h-10 text-white/20 mx-auto" />
              <h3 className="text-base font-bold text-white">Your Listening History is Fresh</h3>
              <p className="text-xs text-white/40">
                Songs you stream will appear here for instant replay and queue building.
              </p>
              <button
                onClick={() => navigate('/music')}
                className="mt-2 px-5 py-2.5 rounded-2xl bg-[#fa243c] text-white text-xs font-bold cursor-pointer hover:bg-[#ff3b50]"
              >
                Start Listening
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
