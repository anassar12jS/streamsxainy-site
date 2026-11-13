import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Search as SearchIcon, X, Play, Mic2, Compass, 
  ChevronRight, ArrowUpRight, Music2
} from 'lucide-react';
import { 
  getSearchSuggestions, searchFullCatalog, 
  SearchSuggestionsResult, FullCatalogSearchResult 
} from '../api/innertube';
import { MusicTrack } from '../types';
import { TrackRow } from '../components/TrackRow';
import { CardGridSkeleton, TrackListSkeleton } from '../components/Skeletons';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

const QUICK_TRENDING_TAGS = [
  'Superheaven', 'Sade', 'Wisp', 'The Weeknd', 'Billie Eilish', 
  'Kendrick Lamar', 'Deftones', 'Frank Ocean', 'Pixies', 
  'Amira Elfeky', 'Radiohead', 'Tyler, The Creator', 'Travis Scott'
];

export const SearchRoute: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryParam = searchParams.get('q') || '';

  const [inputValue, setInputValue] = useState(queryParam);
  const [debouncedInput, setDebouncedInput] = useState(queryParam);
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResult>({ textSuggestions: [], entitySuggestions: [] });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const [catalogResults, setCatalogResults] = useState<FullCatalogSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync state if URL query changes
  useEffect(() => {
    setInputValue(queryParam);
    if (queryParam) {
      executeSearch(queryParam);
    } else {
      setCatalogResults(null);
    }
  }, [queryParam]);

  // Debounce autocomplete suggestions (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInput(inputValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Fetch suggestions when debounced input changes
  useEffect(() => {
    if (!debouncedInput) {
      setSuggestions({ textSuggestions: [], entitySuggestions: [] });
      setIsDropdownOpen(false);
      return;
    }

    let isCurrent = true;
    setIsSuggesting(true);

    getSearchSuggestions(debouncedInput).then(res => {
      if (isCurrent) {
        setSuggestions(res);
        setIsSuggesting(false);
        setIsDropdownOpen(res.textSuggestions.length > 0 || res.entitySuggestions.length > 0);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [debouncedInput]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

const searchCache = new Map<string, FullCatalogSearchResult>();

  const executeSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsDropdownOpen(false);
    setSearchParams({ q });

    const cacheKey = q.toLowerCase();
    if (searchCache.has(cacheKey)) {
      setCatalogResults(searchCache.get(cacheKey)!);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchFullCatalog(q);
      searchCache.set(cacheKey, results);
      setCatalogResults(results);
    } catch (err) {
      console.error('Catalog search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch(inputValue);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleClear = () => {
    setInputValue('');
    setSuggestions({ textSuggestions: [], entitySuggestions: [] });
    setIsDropdownOpen(false);
    setCatalogResults(null);
    setSearchParams({});
  };

  const handleSelectTextSuggestion = (text: string) => {
    setInputValue(text);
    executeSearch(text);
  };

  const handleSelectEntitySuggestion = (entity: SearchSuggestionsResult['entitySuggestions'][0]) => {
    setIsDropdownOpen(false);
    if (entity.type === 'song' && entity.track) {
      playTrack(entity.track);
    } else if (entity.type === 'artist') {
      const artId = entity.artistId || entity.id;
      if (artId) {
        navigate(`/music/artist/${artId}`);
      } else {
        executeSearch(entity.title);
      }
    } else if (entity.type === 'album') {
      const albId = entity.albumId || entity.id;
      if (albId) {
        navigate(`/music/album/${albId}`);
      } else {
        executeSearch(entity.title);
      }
    } else {
      executeSearch(entity.title);
    }
  };

  /**
   * Highlights the matching prefix in white, and the remaining text in gray
   */
  const renderHighlightedText = (rawText: any, currentQuery: string) => {
    let fullText = '';
    if (typeof rawText === 'string') {
      fullText = rawText;
    } else if (rawText && typeof rawText === 'object') {
      fullText = rawText.text || rawText.query || rawText.title || '';
    }
    fullText = String(fullText || '').trim();
    if (!fullText || fullText === '[object Object]' || fullText.startsWith('[object ')) {
      return null;
    }

    const lowerFull = fullText.toLowerCase();
    const lowerQuery = currentQuery.toLowerCase();
    if (!lowerQuery || !lowerFull.startsWith(lowerQuery)) {
      return <span className="text-[#b3b3b3]">{fullText}</span>;
    }
    const matched = fullText.slice(0, currentQuery.length);
    const rest = fullText.slice(currentQuery.length);
    return (
      <>
        <span className="text-white font-semibold">{matched}</span>
        <span className="text-[#b3b3b3] font-normal">{rest}</span>
      </>
    );
  };

  return (
    <div 
      className="space-y-10 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4"
      style={{ fontFamily: 'var(--bitchord-font)' }}
    >
      
      {/* ========================================================================= */}
      {/* 1. TOP CENTER GLOBAL SEARCH BAR & AUTOCOMPLETE DROPDOWN                   */}
      {/* ========================================================================= */}
      <div className="flex flex-col items-center justify-center pt-2 sm:pt-4">
        <div ref={searchContainerRef} className="relative w-full max-w-2xl">
          
          {/* Pill-shaped Input Container: border-radius: 9999px, bg-[#1a1a1a] */}
          <div className="relative flex items-center bg-[#1a1a1a] focus-within:bg-[#202020] border border-white/10 focus-within:border-white/30 rounded-full px-5 py-3 shadow-2xl transition-all">
            <SearchIcon className="w-5 h-5 text-[#b3b3b3] shrink-0 mr-3 pointer-events-none" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (!isDropdownOpen && e.target.value.trim()) {
                  setIsDropdownOpen(true);
                }
              }}
              onFocus={() => {
                if (suggestions.textSuggestions.length > 0 || suggestions.entitySuggestions.length > 0) {
                  setIsDropdownOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search songs, artists, albums, or playlists..."
              className="w-full bg-transparent border-0 outline-none text-sm sm:text-base text-white placeholder-[#777777] font-normal"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-full text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-2"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* RICH AUTOCOMPLETE DROPDOWN */}
          {isDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[#121212] border border-white/10 rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.85)] z-50 overflow-hidden divide-y divide-white/5 animate-in fade-in zoom-in-95 duration-150">
              
              {/* TOP HALF: Text Suggestions (matched portion in white, rest in gray) */}
              {suggestions.textSuggestions.filter(t => typeof t === 'string' && t.trim().length > 0 && t !== '[object Object]').length > 0 && (
                <div className="p-2 space-y-0.5">
                  {suggestions.textSuggestions
                    .filter(t => typeof t === 'string' && t.trim().length > 0 && t !== '[object Object]')
                    .map((text, i) => (
                    <div
                      key={`sug-${i}`}
                      onClick={() => handleSelectTextSuggestion(text)}
                      className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                    >
                      <SearchIcon className="w-3.5 h-3.5 text-[#777777] shrink-0" />
                      <div className="truncate">
                        {renderHighlightedText(text, inputValue)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* BOTTOM HALF: Rich Entities (Songs, Artists, Albums) with thumbnail */}
              {suggestions.entitySuggestions.length > 0 && (
                <div className="p-2 space-y-0.5 bg-[#161616]">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
                    Top Entities
                  </p>
                  {suggestions.entitySuggestions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectEntitySuggestion(item)}
                      className="flex items-center justify-between px-3.5 py-2 rounded-xl hover:bg-[#1a1a1a] cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={item.artwork} 
                          alt="" 
                          className={`w-9 h-9 object-cover shrink-0 bg-[#222222] ${
                            item.type === 'artist' ? 'rounded-full' : 'rounded-lg'
                          }`}
                        />
                        <div className="min-w-0">
                          <h5 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:underline">
                            {item.title}
                          </h5>
                          <p className="text-[11px] text-[#b3b3b3] truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#777777] group-hover:text-white shrink-0 ml-2" />
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* Quick Trending Tags */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-3 no-scrollbar scroll-smooth text-xs">
            <span className="text-[#777777] font-semibold text-[11px] shrink-0 uppercase tracking-wider">
              Trending:
            </span>
            {QUICK_TRENDING_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setInputValue(tag);
                  executeSearch(tag);
                }}
                className="px-3 py-1 rounded-full bg-[#161616] hover:bg-[#1a1a1a] border border-white/5 text-[#b3b3b3] hover:text-white transition-colors shrink-0 cursor-pointer text-xs"
              >
                {tag}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEARCH RESULTS VIEW                                                    */}
      {/* ========================================================================= */}
      {isSearching ? (
        <div className="space-y-8">
          <CardGridSkeleton count={6} cols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" />
          <TrackListSkeleton rows={6} />
        </div>
      ) : catalogResults && catalogResults.topResults.length > 0 ? (
        <div className="space-y-10 animate-fade-in">
          
          {/* SECTION A: TOP RESULTS (CSS Grid of wide rectangular cards bg-[#181818]) */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Top Results
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalogResults.topResults.slice(0, 6).map((track) => (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, catalogResults.topResults)}
                  className="group flex items-center gap-4 p-3 rounded-2xl bg-[#181818] hover:bg-[#1f1f1f] border border-white/5 cursor-pointer transition-colors duration-150 shadow-lg relative"
                >
                  {/* Large image on left */}
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#242426] shrink-0">
                    <img 
                      src={track.artwork} 
                      alt={track.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Title & subtitle on right */}
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40 bg-white/5 px-2 py-0.5 rounded-full inline-block mb-1">
                      Song
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-white truncate group-hover:underline">
                      {track.title}
                    </h3>
                    <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                      {track.artistId ? (
                        <Link
                          to={`/music/artist/${track.artistId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-white hover:underline transition-colors"
                        >
                          {track.artist}
                        </Link>
                      ) : (
                        <span>{track.artist}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#777777] truncate mt-0.5">
                      {track.album || 'Single'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION B: ARTISTS SHELF (Horizontal shelf of large circular avatars) */}
          {catalogResults.artists.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Artists
              </h2>

              <div className="flex items-center gap-5 overflow-x-auto pb-4 pt-1 am-scrollbar">
                {catalogResults.artists.map((artist) => (
                  <div
                    key={artist.id}
                    onClick={() => {
                      if (artist.id) {
                        navigate(`/music/artist/${artist.id}`);
                      }
                    }}
                    className="group flex-shrink-0 w-36 sm:w-44 flex flex-col items-center text-center p-3 rounded-2xl hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                  >
                    <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden mb-3 bg-[#1e1e1e] ring-2 ring-white/10 group-hover:scale-105 transition-transform duration-300 shadow-xl">
                      <img 
                        src={artist.avatar} 
                        alt={artist.name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <h4 className="text-xs sm:text-sm font-semibold text-white truncate max-w-full group-hover:underline">
                      {artist.name}
                    </h4>
                    <p className="text-[11px] text-[#b3b3b3] mt-0.5">
                      {artist.listeners || 'Artist'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION C: ALBUMS SHELF (Horizontal shelf of square album covers) */}
          {catalogResults.albums.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Albums
              </h2>

              <div className="flex items-center gap-4 overflow-x-auto pb-4 pt-1 am-scrollbar">
                {catalogResults.albums.map((alb) => (
                  <div
                    key={alb.id}
                    onClick={() => navigate(`/music/album/${alb.id}`)}
                    className="group flex-shrink-0 w-[170px] sm:w-[190px] bg-[#141414] hover:bg-[#1a1a1a] border border-white/5 rounded-[10px] p-2.5 transition-colors duration-150 cursor-pointer shadow-md text-left"
                  >
                    <div className="relative aspect-square w-full rounded-[8px] overflow-hidden bg-[#242426] mb-2 border border-white/5">
                      <img 
                        src={alb.artwork} 
                        alt={alb.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>

                    <h4 className="font-semibold text-xs sm:text-sm text-white truncate text-left group-hover:underline">
                      {alb.title}
                    </h4>
                    <p className="text-xs text-[#98989d] truncate mt-0.5 text-left font-normal">
                      {(alb as any).artistId ? (
                        <Link
                          to={`/music/artist/${(alb as any).artistId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-white hover:underline transition-colors"
                        >
                          {alb.artist}
                        </Link>
                      ) : (
                        <span>{alb.artist}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#666666] mt-0.5 text-left">
                      {alb.year || 'Album'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION D: MATCHING SONGS TABLE */}
          <div className="space-y-3 pt-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              All Songs
            </h2>

            <div className="space-y-1">
              <div className="flex items-center justify-between px-3.5 py-2 text-[11px] font-semibold text-[#b3b3b3] uppercase tracking-wider border-b border-white/10 mb-1">
                <span># Title</span>
                <span className="hidden md:inline">Album</span>
                <span>Time</span>
              </div>

              {catalogResults.topResults.map((track, idx) => (
                <TrackRow
                  key={`${track.id}-${idx}`}
                  track={track}
                  index={idx}
                  showArtwork={true}
                  showAlbum={true}
                  playlistContext={catalogResults.topResults}
                />
              ))}
            </div>
          </div>

        </div>
      ) : queryParam ? (
        <div className="py-20 text-center text-white/50 bg-[#121212] rounded-2xl border border-white/5 p-8 max-w-md mx-auto">
          <p className="text-base font-semibold text-white">No results found for "{queryParam}"</p>
          <p className="text-xs text-[#b3b3b3] mt-1">Check spelling or try a broader search query.</p>
        </div>
      ) : (
        <div className="py-24 text-center text-white/40 max-w-sm mx-auto space-y-2">
          <SearchIcon className="w-10 h-10 text-white/20 mx-auto" />
          <h3 className="text-base font-semibold text-white">Global Music Search</h3>
          <p className="text-xs text-[#b3b3b3]">
            Type a song, artist, or album title above to discover millions of tracks.
          </p>
        </div>
      )}

    </div>
  );
};
export default SearchRoute;
