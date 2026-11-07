import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Play, Pause, Heart, Sparkles, Disc3, Radio, Flame, 
  Trophy, Shuffle, Music2, Clock, Plus, Check, Volume2, 
  ExternalLink, ArrowRight, Compass, Shield, Headphones
} from 'lucide-react';
import { useMusic } from '../services/MusicContext';
import { 
  MusicTrack, PlaylistCollection, FEATURED_PLAYLISTS, 
  CURATED_CINEMA_TRACKS, CURATED_ANIME_TRACKS, CURATED_GLOBAL_HITS, 
  CURATED_LOFI_STATIONS, CURATED_GAMING_TRACKS, searchMusicOnline, 
  formatDuration 
} from '../services/musicService';

export const MusicPage: React.FC = () => {
  const { 
    currentTrack, 
    isPlaying, 
    playTrack, 
    togglePlayPause, 
    toggleLike, 
    isLiked, 
    addToQueue,
    likedTracks,
    setIsExpanded,
  } = useMusic();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'featured' | 'cinema' | 'anime' | 'hits' | 'lofi' | 'gaming' | 'liked'>('featured');
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistCollection | null>(null);
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute search online via iTunes / Deezer / Local catalog
  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let isMounted = true;
    setIsSearching(true);

    searchMusicOnline(debouncedQuery).then(results => {
      if (isMounted) {
        setSearchResults(results);
        setIsSearching(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  // Active track list based on selected category tab
  const activeTabTracks = useMemo(() => {
    switch (activeTab) {
      case 'cinema':
        return CURATED_CINEMA_TRACKS;
      case 'anime':
        return CURATED_ANIME_TRACKS;
      case 'hits':
        return CURATED_GLOBAL_HITS;
      case 'lofi':
        return CURATED_LOFI_STATIONS;
      case 'gaming':
        return CURATED_GAMING_TRACKS;
      case 'liked':
        return likedTracks;
      default:
        return [...CURATED_CINEMA_TRACKS, ...CURATED_ANIME_TRACKS, ...CURATED_GLOBAL_HITS];
    }
  }, [activeTab, likedTracks]);

  const handlePlayCollection = (tracks: MusicTrack[], startTrack?: MusicTrack, shuffle = false) => {
    if (!tracks || tracks.length === 0) return;
    let queueList = [...tracks];
    if (shuffle) {
      queueList.sort(() => Math.random() - 0.5);
    }
    const initial = startTrack || queueList[0];
    playTrack(initial, queueList);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300 pb-36">
      
      {/* ========================================================================= */}
      {/* 1. HERO HEADER                                                            */}
      {/* ========================================================================= */}
      <div className="relative border-b border-white/10 bg-gradient-to-b from-rose-950/25 via-black/40 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/15 px-3 py-1 rounded-full border border-rose-500/30 shadow-sm">
                  <Headphones className="w-3.5 h-3.5" /> BitChord Audio Studio
                </span>
                <span className="flex items-center gap-1 text-xs font-bold text-white/80 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Native Streaming
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Ad-Free
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                StreamHub <span className="bg-gradient-to-r from-rose-400 to-pink-500 bg-clip-text text-transparent">Music</span>
              </h1>
              <p className="text-sm text-[var(--text-muted)] max-w-2xl mt-2 leading-relaxed">
                Stream millions of songs, blockbuster cinema soundtracks, trending anime openings, and 24/7 background lo-fi radio natively within StreamHub.
              </p>
            </div>

            {/* Quick Play Action Bar */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => handlePlayCollection(CURATED_CINEMA_TRACKS, undefined, true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-sm shadow-xl shadow-rose-500/25 cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle Cinema OSTs</span>
              </button>

              <button
                onClick={() => handlePlayCollection(CURATED_LOFI_STATIONS, CURATED_LOFI_STATIONS[0])}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Play Live Lo-Fi</span>
              </button>
            </div>

          </div>

          {/* Real-time Search Box */}
          <div className="mt-8 max-w-2xl relative">
            <div className="relative flex items-center bg-[var(--bg-card)] border border-white/15 focus-within:border-rose-500/80 rounded-2xl px-4 py-3 shadow-xl transition-all">
              <Search className="w-5 h-5 text-rose-400 mr-3 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any song, artist, anime opening, movie soundtrack, or genre..."
                className="w-full bg-transparent border-0 outline-none text-sm sm:text-base text-white placeholder-white/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-white/40 hover:text-white px-2 py-1 rounded cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE AREA                                                    */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">

        {/* ----------------------------------------------------------------------- */}
        {/* A. SEARCH RESULTS SECTION (WHEN USER IS SEARCHING)                     */}
        {/* ----------------------------------------------------------------------- */}
        {debouncedQuery ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-rose-400" />
                <h2 className="text-xl font-bold text-white">
                  Search Results for <span className="text-rose-400">"{debouncedQuery}"</span>
                </h2>
                <span className="text-xs font-mono text-white/50">
                  ({searchResults.length} found)
                </span>
              </div>
              {searchResults.length > 0 && (
                <button
                  onClick={() => handlePlayCollection(searchResults)}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play All Results</span>
                </button>
              )}
            </div>

            {isSearching ? (
              <div className="py-20 flex flex-col items-center justify-center text-white/50 gap-3">
                <Disc3 className="w-8 h-8 animate-spin text-rose-500" />
                <span className="text-sm font-semibold">Searching music databases...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-16 text-center text-white/50 bg-[var(--bg-card)] rounded-3xl border border-white/10 p-8">
                <p className="text-base font-bold text-white">No tracks found matching "{debouncedQuery}"</p>
                <p className="text-xs text-white/40 mt-1">Try another keyword, artist name, or explore curated soundscapes below.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResults.map((track) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isThisPlaying = isCurrent && isPlaying;
                  const liked = isLiked(track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayCollection(searchResults, track)}
                      className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-rose-500/15 border-rose-500/40 text-white ring-1 ring-rose-500/30'
                          : 'bg-[var(--bg-card)] border-white/10 hover:border-white/25 hover:bg-white/5 text-white/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md bg-black/40">
                          <img src={track.artwork} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className={`absolute inset-0 flex items-center justify-center ${isThisPlaying ? 'bg-black/50' : 'bg-black/40 opacity-0 group-hover:opacity-100'} transition-opacity`}>
                            {isThisPlaying ? (
                              <Pause className="w-5 h-5 text-rose-400 fill-current" />
                            ) : (
                              <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                            )}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <h4 className={`text-sm font-bold truncate group-hover:text-rose-400 transition-colors ${isCurrent ? 'text-rose-400' : 'text-white'}`}>
                            {track.title}
                          </h4>
                          <p className="text-xs text-white/50 truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono text-white/40">
                          {formatDuration(track.duration)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(track);
                          }}
                          className={`p-2 rounded-lg transition-colors ${liked ? 'text-rose-400' : 'text-white/30 hover:text-white'}`}
                        >
                          <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* ----------------------------------------------------------------------- */}
        {/* B. FEATURED PLAYLIST COLLECTIONS CAROUSEL                               */}
        {/* ----------------------------------------------------------------------- */}
        {!debouncedQuery && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 font-mono">
                  Curated Soundtracks
                </span>
                <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
                  Featured Collections & Radios
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {FEATURED_PLAYLISTS.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => setSelectedPlaylist(pl)}
                  className="group relative rounded-3xl overflow-hidden border border-white/10 hover:border-rose-500/50 bg-[var(--bg-card)] p-4 cursor-pointer hover:scale-[1.02] transition-all duration-300 shadow-xl"
                >
                  <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 bg-black/50 shadow-inner">
                    <img 
                      src={pl.artwork} 
                      alt={pl.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    {/* Hover Play Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayCollection(pl.tracks);
                      }}
                      className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                      title="Play Collection"
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </button>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors line-clamp-1">
                    {pl.title}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">
                    {pl.subtitle}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                      {pl.tracks.length} Tracks
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* C. SELECTED PLAYLIST MODAL / INLINE VIEW                                 */}
        {/* ----------------------------------------------------------------------- */}
        {selectedPlaylist && !debouncedQuery && (
          <div className="bg-[var(--bg-card)] border border-rose-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl animate-fade-in space-y-6">
            
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 pb-6 border-b border-white/10">
              <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <img 
                  src={selectedPlaylist.artwork} 
                  alt={selectedPlaylist.title} 
                  className="w-32 h-32 rounded-2xl object-cover shadow-2xl border border-white/15" 
                />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                    Playlist
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mt-1.5">
                    {selectedPlaylist.title}
                  </h3>
                  <p className="text-sm text-white/60 mt-1">
                    {selectedPlaylist.subtitle} · {selectedPlaylist.tracks.length} Songs
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => handlePlayCollection(selectedPlaylist.tracks)}
                  className="px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-500/30 cursor-pointer transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play All</span>
                </button>
                <button
                  onClick={() => handlePlayCollection(selectedPlaylist.tracks, undefined, true)}
                  className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 border border-white/10 cursor-pointer transition-all"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Shuffle</span>
                </button>
                <button
                  onClick={() => setSelectedPlaylist(null)}
                  className="px-3 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Tracklist Table */}
            <div className="space-y-1">
              {selectedPlaylist.tracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const isThisPlaying = isCurrent && isPlaying;
                const liked = isLiked(track.id);

                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayCollection(selectedPlaylist.tracks, track)}
                    className={`flex items-center justify-between gap-4 p-3 rounded-2xl cursor-pointer transition-all ${
                      isCurrent 
                        ? 'bg-rose-500/15 text-white border border-rose-500/30 ring-1 ring-rose-500/30' 
                        : 'hover:bg-white/5 text-white/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="w-6 text-center text-xs font-mono text-white/40">
                        {idx + 1}
                      </span>
                      <img src={track.artwork} alt="" className="w-10 h-10 rounded-xl object-cover shadow" />
                      <div className="min-w-0">
                        <h4 className={`text-sm font-bold truncate ${isCurrent ? 'text-rose-400' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p className="text-xs text-white/50 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-mono text-white/40">
                        {formatDuration(track.duration)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(track);
                        }}
                        className={`p-2 rounded-lg transition-colors ${liked ? 'text-rose-400' : 'text-white/30 hover:text-white'}`}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* D. CATEGORY TABS & TRACKLIST EXPLORER                                    */}
        {/* ----------------------------------------------------------------------- */}
        {!debouncedQuery && (
          <div className="space-y-6">
            
            {/* Nav Pill Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-2">
              {[
                { id: 'featured', label: 'All Featured', icon: Sparkles },
                { id: 'cinema', label: 'Cinema OSTs', icon: Flame },
                { id: 'anime', label: 'Anime Soundtracks', icon: Disc3 },
                { id: 'hits', label: 'Global Hits', icon: Trophy },
                { id: 'lofi', label: '24/7 Lo-Fi Radios', icon: Radio },
                { id: 'gaming', label: 'Gaming Legends', icon: Compass },
                { id: 'liked', label: `Liked Songs (${likedTracks.length})`, icon: Heart },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isActive 
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 ring-1 ring-rose-400' 
                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-white hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tracks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeTabTracks.map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                const isThisPlaying = isCurrent && isPlaying;
                const liked = isLiked(track.id);

                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayCollection(activeTabTracks, track)}
                    className={`group p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent 
                        ? 'bg-rose-500/15 border-rose-500/40 text-white ring-1 ring-rose-500/30' 
                        : 'bg-[var(--bg-card)] border-white/10 hover:border-white/20 hover:bg-white/5 text-white/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md bg-black/40">
                        <img src={track.artwork} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className={`absolute inset-0 flex items-center justify-center ${isThisPlaying ? 'bg-black/50' : 'bg-black/40 opacity-0 group-hover:opacity-100'} transition-opacity`}>
                          {isThisPlaying ? (
                            <Pause className="w-5 h-5 text-rose-400 fill-current" />
                          ) : (
                            <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h4 className={`text-sm font-bold truncate group-hover:text-rose-400 transition-colors ${isCurrent ? 'text-rose-400' : 'text-white'}`}>
                          {track.title}
                        </h4>
                        <p className="text-xs text-white/50 truncate mt-0.5">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-white/40">
                        {track.isRadio ? 'LIVE' : formatDuration(track.duration)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(track);
                        }}
                        className={`p-2 rounded-lg transition-colors ${liked ? 'text-rose-400' : 'text-white/30 hover:text-white'}`}
                        title={liked ? 'Unlike' : 'Like'}
                      >
                        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeTab === 'liked' && likedTracks.length === 0 && (
              <div className="py-16 text-center text-white/50 bg-[var(--bg-card)] rounded-3xl border border-white/10 p-8">
                <Heart className="w-8 h-8 text-rose-500/50 mx-auto mb-2" />
                <p className="text-base font-bold text-white">No liked songs yet</p>
                <p className="text-xs text-white/40 mt-1">Click the heart icon on any track to save it here for quick access.</p>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
};
export default MusicPage;
