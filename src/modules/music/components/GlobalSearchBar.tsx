import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search as SearchIcon, X, ArrowUpRight } from 'lucide-react';
import { getSearchSuggestions, SearchSuggestionsResult } from '../api/innertube';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

const suggestionsCache = new Map<string, SearchSuggestionsResult>();

export const GlobalSearchBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const playTrack = useMusicPlayerStore(state => state.playTrack);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResult>({ textSuggestions: [], entitySuggestions: [] });
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync with search route URL if on /music/search
  useEffect(() => {
    if (location.pathname.startsWith('/music/search')) {
      const sp = new URLSearchParams(location.search);
      setQuery(sp.get('q') || '');
    }
  }, [location.pathname, location.search]);

  // Debounce (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Call yt.music.getSearchSuggestions(query) with cache
  useEffect(() => {
    if (!debouncedQuery) {
      setSuggestions({ textSuggestions: [], entitySuggestions: [] });
      setIsOpen(false);
      return;
    }

    const key = debouncedQuery.toLowerCase();
    if (suggestionsCache.has(key)) {
      const cached = suggestionsCache.get(key)!;
      setSuggestions(cached);
      setIsOpen(cached.textSuggestions.length > 0 || cached.entitySuggestions.length > 0);
      return;
    }

    let isCurrent = true;
    getSearchSuggestions(debouncedQuery).then(res => {
      if (isCurrent) {
        suggestionsCache.set(key, res);
        setSuggestions(res);
        setIsOpen(res.textSuggestions.length > 0 || res.entitySuggestions.length > 0);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [debouncedQuery]);

  // Dismiss on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSearchSubmit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setIsOpen(false);
    navigate(`/music/search?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit(query);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full max-w-xl mx-auto mb-6 select-none"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      {/* Search Bar: Wide, pill-shaped (border-radius: 9999px), bg-[#1a1a1a] */}
      <div className="relative flex items-center bg-[#1a1a1a] focus-within:bg-[#202020] border border-white/10 focus-within:border-white/30 rounded-full px-4 py-2.5 shadow-lg transition-all">
        <SearchIcon className="w-4 h-4 text-[#a3a3a3] shrink-0 mr-3 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.textSuggestions.length > 0 || suggestions.entitySuggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search songs, artists, albums, or playlists..."
          className="w-full bg-transparent border-0 outline-none text-xs sm:text-sm text-white placeholder-[#777777]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="p-1 rounded-full text-[#a3a3a3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-1.5"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Top half: Text suggestions */}
          {suggestions.textSuggestions.filter(t => typeof t === 'string' && t.trim().length > 0 && t !== '[object Object]').length > 0 && (
            <div className="p-2 space-y-0.5">
              {suggestions.textSuggestions
                .filter(t => typeof t === 'string' && t.trim().length > 0 && t !== '[object Object]')
                .map((text, i) => (
                <div
                  key={`top-sug-${i}`}
                  onClick={() => handleSearchSubmit(text)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs hover:bg-[#1a1a1a] cursor-pointer transition-colors text-white"
                >
                  <SearchIcon className="w-3 h-3 text-[#777777] shrink-0" />
                  <span className="truncate">{text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bottom half: Rich entities (Songs, Artists, Albums) with thumbnails */}
          {suggestions.entitySuggestions.length > 0 && (
            <div className="p-2 space-y-0.5 bg-[#161616]">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                Entities
              </p>
              {suggestions.entitySuggestions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setIsOpen(false);
                    if (item.type === 'song' && item.track) {
                      playTrack(item.track);
                    } else if (item.type === 'artist' && (item.artistId || item.id)) {
                      navigate(`/music/artist/${item.artistId || item.id}`);
                    } else if (item.type === 'album' && (item.albumId || item.id)) {
                      navigate(`/music/album/${item.albumId || item.id}`);
                    } else {
                      handleSearchSubmit(item.title);
                    }
                  }}
                  className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#1a1a1a] cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img 
                      src={item.artwork} 
                      alt="" 
                      className={`w-7 h-7 object-cover shrink-0 bg-[#222222] ${
                        item.type === 'artist' ? 'rounded-full' : 'rounded-md'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:underline">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-[#a3a3a3] truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3 h-3 text-[#777777] group-hover:text-white shrink-0 ml-2" />
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default GlobalSearchBar;
