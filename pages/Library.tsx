import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TMDBResult, MediaType, IPTVChannel, ContinueWatchingItem } from '../types';
import { getWatchlist, getFavoriteChannels, getProgress, removeFromProgress, removeFromWatchlist } from '../services/storage';
import { MediaCard } from '../components/MediaCard';
import { 
  Bookmark, Heart, Play, Clock, Tv2, 
  Trash2, X, Compass, Search, Film, Tv, Ghost, Sparkles
} from 'lucide-react';
import { TMDB_POSTER_BASE, BACKDROP_FALLBACK_SVG } from '../constants';

interface LibraryProps {
  onSelect: (item: TMDBResult) => void;
}

export const Library: React.FC<LibraryProps> = ({ onSelect }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<TMDBResult[]>([]);
  const [favChannels, setFavChannels] = useState<IPTVChannel[]>([]);
  const [progressItems, setProgressItems] = useState<ContinueWatchingItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'tv' | 'anime' | 'continue' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    setItems(getWatchlist());
    setFavChannels(getFavoriteChannels());
    setProgressItems(getProgress());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('streamhub_storage_update', loadData);
    window.addEventListener('storage', loadData);
    return () => {
      window.removeEventListener('streamhub_storage_update', loadData);
      window.removeEventListener('storage', loadData);
    };
  }, []);

  const handleResume = (cw: ContinueWatchingItem) => {
    const anilistParam = cw.anilist_id ? `?anilistId=${cw.anilist_id}` : '';
    if (cw.media_type === MediaType.MOVIE) {
      navigate(`/watch/movie/${cw.id}${anilistParam}`);
    } else {
      navigate(`/watch/tv/${cw.id}/${cw.season || 1}/${cw.episode || 1}${anilistParam}`);
    }
  };

  const handleRemoveProgress = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    removeFromProgress(id);
    setProgressItems(prev => prev.filter(i => i.id !== id));
  };

  const handleCardWatchlistChange = (id: number, inWatchlist: boolean) => {
    if (!inWatchlist) {
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const formatTime = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Counts
  const movieCount = items.filter(i => i.media_type === MediaType.MOVIE && !i.anilist_id).length;
  const tvCount = items.filter(i => i.media_type === MediaType.TV && !i.anilist_id).length;
  const animeCount = items.filter(i => Boolean(i.anilist_id)).length;

  const filteredItems = items.filter(item => {
    // Search query filter
    if (searchQuery.trim()) {
      const title = (item.title || item.name || '').toLowerCase();
      if (!title.includes(searchQuery.toLowerCase().trim())) return false;
    }

    if (activeTab === 'movies') return item.media_type === MediaType.MOVIE && !item.anilist_id;
    if (activeTab === 'tv') return item.media_type === MediaType.TV && !item.anilist_id;
    if (activeTab === 'anime') return Boolean(item.anilist_id);
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen animate-fade-in text-[var(--text-main)]">
      
      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] flex items-center gap-3 tracking-tight">
            <Bookmark className="w-8 h-8 text-[rgb(var(--primary-color))]" />
            <span>My Library</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Persistent local storage database of your saved Watchlist, playback resume checkpoints, and favorite TV channels.
          </p>
        </div>

        {/* Tab Controls Bar */}
        <div className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-x-auto max-w-full">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'all' 
                ? 'bg-[rgb(var(--primary-color))] text-white shadow-md' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            All Watchlist ({items.length})
          </button>
          <button 
            onClick={() => setActiveTab('movies')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'movies' 
                ? 'bg-[rgb(var(--primary-color))] text-white shadow-md' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Movies ({movieCount})</span>
          </button>
          <button 
            onClick={() => setActiveTab('tv')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'tv' 
                ? 'bg-[rgb(var(--primary-color))] text-white shadow-md' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Series ({tvCount})</span>
          </button>
          {animeCount > 0 && (
            <button 
              onClick={() => setActiveTab('anime')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'anime' 
                  ? 'bg-pink-600 text-white shadow-md' 
                  : 'text-[var(--text-muted)] hover:text-pink-400'
              }`}
            >
              <Ghost className="w-3.5 h-3.5 text-pink-400" />
              <span>Anime ({animeCount})</span>
            </button>
          )}
          <button 
            onClick={() => setActiveTab('continue')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'continue' 
                ? 'bg-[rgb(var(--primary-color))] text-white shadow-md' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Continue Watching ({progressItems.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('favorites')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'favorites' 
                ? 'bg-[rgb(var(--primary-color))] text-white shadow-md' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>Channels ({favChannels.length})</span>
          </button>
        </div>
      </div>

      {/* Filter / Search within Library */}
      {items.length > 3 && activeTab !== 'continue' && activeTab !== 'favorites' && (
        <div className="mb-6 max-w-md relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within your saved watchlist..."
            className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-main)] text-xs rounded-xl pl-9 pr-8 py-2.5 focus:border-[rgb(var(--primary-color))] outline-none font-medium placeholder-[var(--text-muted)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Continue Watching Section (Shown when 'continue' or 'all' is selected) */}
      {(activeTab === 'all' || activeTab === 'continue') && progressItems.length > 0 && !searchQuery && (
        <div className="mb-12 bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-card)] to-transparent p-5 sm:p-6 rounded-3xl border border-[var(--border-subtle)] shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[rgb(var(--primary-color))]/15 text-[rgb(var(--primary-color))]">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-main)]">Continue Watching Checkpoints</h2>
                <p className="text-[11px] text-[var(--text-muted)]">Saved timestamp positions stored in local storage</p>
              </div>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-mono">{progressItems.length} active</span>
          </div>

          <div className="flex overflow-x-auto space-x-4 pb-2 custom-scrollbar">
            {progressItems.map((item) => {
              const percent = Math.min(
                100,
                Math.max(
                  5,
                  item.progress ?? (
                    item.duration && item.duration > 0
                      ? Math.round(((item.currentTime || 0) / item.duration) * 100)
                      : (item.currentTime && item.currentTime > 0 ? 30 : 15)
                  )
                )
              );
              const timeText = item.currentTime && item.currentTime > 0 ? formatTime(item.currentTime) : null;
              const mediaLabel = item.anilist_id 
                ? `Anime · Ep ${item.episode || 1}` 
                : item.season 
                  ? `S${item.season} · Ep ${item.episode || 1}` 
                  : 'Movie';

              const posterSrc = item.poster_path?.startsWith('http')
                ? item.poster_path
                : item.poster_path
                  ? `${TMDB_POSTER_BASE}${item.poster_path}`
                  : BACKDROP_FALLBACK_SVG;

              return (
                <div 
                  key={`${item.media_type}_${item.id}`} 
                  onClick={() => handleResume(item)}
                  className="w-68 sm:w-72 shrink-0 bg-[var(--bg-main)] rounded-2xl overflow-hidden border border-[var(--border-subtle)] hover:border-[rgb(var(--primary-color))]/60 transition-all cursor-pointer group shadow-md flex flex-col"
                >
                  <div className="relative aspect-[16/9] w-full bg-[var(--bg-hover)] overflow-hidden">
                    <img 
                      src={posterSrc} 
                      alt={item.title} 
                      onError={(e) => {
                        e.currentTarget.src = BACKDROP_FALLBACK_SVG;
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-[rgb(var(--primary-color))] text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                    
                    {/* Remove button */}
                    <button
                      onClick={(e) => handleRemoveProgress(e, item.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-white transition-colors border border-white/10 z-10"
                      title="Remove from history"
                      aria-label="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    {/* Season / Episode Tag */}
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[11px] font-bold text-white border border-white/15 font-mono">
                      {mediaLabel}
                    </span>
                  </div>

                  <div className="p-3.5 flex flex-col justify-between flex-1">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-main)] truncate group-hover:text-[rgb(var(--primary-color))] transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1 font-medium">
                        <span>{percent}% watched</span>
                        {timeText && <span>{timeText} elapsed</span>}
                      </div>
                    </div>
                    <div className="w-full bg-[var(--bg-hover)] h-1.5 rounded-full mt-2.5 overflow-hidden border border-white/5">
                      <div 
                        className="bg-gradient-to-r from-[rgb(var(--primary-color))] to-pink-500 h-full rounded-full transition-all duration-300" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorite Live TV Channels View */}
      {activeTab === 'favorites' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-[var(--text-main)]">Bookmarked Live Channels</h2>
            <span className="text-xs text-[var(--text-muted)]">{favChannels.length} channels</span>
          </div>

          {favChannels.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {favChannels.map((channel, idx) => (
                <div 
                  key={idx} 
                  onClick={() => navigate('/livetv')}
                  className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-2xl flex items-center gap-3.5 hover:border-[rgb(var(--primary-color))]/50 hover:bg-[var(--bg-hover)] transition-all cursor-pointer group shadow-sm"
                >
                  <div className="w-12 h-12 bg-[var(--bg-main)] rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-[var(--border-subtle)] p-1">
                    {channel.logo ? (
                      <img src={channel.logo} alt="" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                    ) : (
                      <Tv2 className="w-5 h-5 text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-[var(--text-main)] group-hover:text-[rgb(var(--primary-color))] transition-colors truncate">
                      {channel.name}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] truncate">{channel.group || 'Live TV'}</p>
                  </div>
                  <Heart className="w-4 h-4 text-red-500 fill-red-500 shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border-subtle)] p-8">
              <Heart className="w-12 h-12 mx-auto mb-3 text-red-500/40" />
              <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">No favorite channels</h3>
              <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto mb-4">
                Bookmark live sports, news, and entertainment channels in Live TV to view them here.
              </p>
              <button
                onClick={() => navigate('/livetv')}
                className="px-6 py-2.5 bg-[rgb(var(--primary-color))] text-white font-bold text-xs rounded-xl shadow-md hover:brightness-110 transition-all"
              >
                Browse Live TV
              </button>
            </div>
          )}
        </div>
      ) : activeTab === 'continue' ? (
        /* Continue Watching Only Tab View */
        progressItems.length === 0 ? (
          <div className="py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border-subtle)] p-8">
            <Clock className="w-12 h-12 mx-auto mb-3 text-amber-400/40" />
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">No active streams</h3>
            <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto">
              Any movie or TV show you start watching will automatically appear here with your saved timestamp.
            </p>
          </div>
        ) : null
      ) : (
        /* Watchlist Grid View (All / Movies / TV / Anime) */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-main)]">
              {activeTab === 'movies' ? 'Saved Movies' : activeTab === 'tv' ? 'Saved TV Series' : activeTab === 'anime' ? 'Saved Anime' : 'All Watchlist Titles'}
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              {filteredItems.length} {filteredItems.length === 1 ? 'title' : 'titles'}
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center bg-[var(--bg-card)] rounded-3xl border border-[var(--border-subtle)] p-8">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-subtle)] flex items-center justify-center mb-4 text-[var(--text-muted)]">
                <Bookmark className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-main)] mb-1">
                {searchQuery ? 'No matching titles found' : 'Your Watchlist is Empty'}
              </h3>
              <p className="max-w-md text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
                {searchQuery 
                  ? `No saved items match "${searchQuery}". Try a different keyword.` 
                  : 'Click the bookmark button on any movie, anime, or series card across StreamHub to build your personal streaming queue.'}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => navigate('/discover')}
                  className="px-5 py-2.5 bg-[var(--bg-main)] border border-[var(--border-subtle)] text-[var(--text-main)] font-bold text-xs rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Explore Discover
                </button>
                <button 
                  onClick={() => navigate('/')}
                  className="px-5 py-2.5 bg-[rgb(var(--primary-color))] text-white font-bold text-xs rounded-xl shadow-md hover:brightness-110 transition-all"
                >
                  Browse Home
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {filteredItems.map(item => (
                <MediaCard 
                  key={`${item.media_type || 'item'}_${item.id}`} 
                  item={item} 
                  onClick={onSelect} 
                  onWatchlistChange={handleCardWatchlistChange}
                />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
