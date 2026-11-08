import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Disc, Play, Sparkles, Filter } from 'lucide-react';
import { searchInnerTube } from '../api/innertube';
import { MusicTrack } from '../types';
import { TrackRow } from '../components/TrackRow';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

const QUICK_TAGS = [
  'Hans Zimmer', 'Dune', 'Oppenheimer', 'Interstellar', 
  'Attack on Titan', 'Demon Slayer', 'Billie Eilish', 
  'The Weeknd', 'RADWIMPS', 'Cyberpunk', 'Lo-Fi Chill'
];

export const SearchRoute: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  
  const [searchInput, setSearchInput] = useState(queryParam);
  const [debouncedQuery, setDebouncedQuery] = useState(queryParam);
  const [results, setResults] = useState<MusicTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const playTrack = useMusicPlayerStore(state => state.playTrack);

  // Sync state if URL query changes
  useEffect(() => {
    setSearchInput(queryParam);
    setDebouncedQuery(queryParam);
  }, [queryParam]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Execute search online
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    setIsLoading(true);

    searchInnerTube(debouncedQuery).then(res => {
      if (isCurrent) {
        setResults(res);
        setIsLoading(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [debouncedQuery]);

  const handleTagClick = (tag: string) => {
    setSearchInput(tag);
    setSearchParams({ q: tag });
  };

  const topResult = results[0];

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Search Bar & Quick Tags */}
      <div className="space-y-4">
        <div className="relative max-w-2xl">
          <SearchIcon className="w-5 h-5 text-[#fa243c] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setSearchParams(e.target.value.trim() ? { q: e.target.value.trim() } : {});
            }}
            placeholder="Search artists, songs, soundtracks, or anime..."
            className="w-full bg-[#18181b] border border-white/10 focus:border-[#fa243c] rounded-2xl pl-12 pr-4 py-3.5 text-base text-white placeholder-white/40 focus:outline-none transition-all shadow-xl"
          />
        </div>

        {/* Quick Tag Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 am-scrollbar text-xs">
          <span className="text-white/40 font-mono text-[11px] shrink-0 uppercase tracking-wider">
            Trending:
          </span>
          {QUICK_TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results View */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center text-white/50 gap-3">
          <Disc className="w-8 h-8 animate-spin text-[#fa243c]" />
          <p className="text-sm font-semibold">Searching Apple Music & BitChord catalogues...</p>
        </div>
      ) : debouncedQuery && results.length > 0 ? (
        <div className="space-y-8">
          
          {/* Top Result Card + Songs Split View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Top Result Spotlight */}
            {topResult && (
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#fa243c] font-mono">
                  Top Result
                </span>
                <div 
                  onClick={() => playTrack(topResult, results)}
                  className="p-5 rounded-3xl bg-[#141416] border border-white/10 hover:border-[#fa243c]/50 transition-all cursor-pointer group flex flex-col justify-between h-[230px] shadow-xl relative overflow-hidden"
                >
                  <div className="flex items-start gap-4">
                    <img 
                      src={topResult.artwork} 
                      alt="" 
                      className="w-24 h-24 rounded-2xl object-cover shadow-xl border border-white/10 group-hover:scale-105 transition-transform" 
                    />
                    <div className="min-w-0">
                      <h3 className="text-lg font-black text-white group-hover:text-[#fa243c] transition-colors line-clamp-2">
                        {topResult.title}
                      </h3>
                      <p className="text-xs text-white/60 mt-1 truncate">
                        {topResult.artist}
                      </p>
                      <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-white/70">
                        {topResult.album || 'Single'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <span className="text-xs text-white/40 font-mono">
                      Song
                    </span>
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full bg-[#fa243c] text-white flex items-center justify-center shadow-lg group-hover:scale-110 active:scale-95 transition-transform"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Songs Results List */}
            <div className="lg:col-span-2 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#fa243c] font-mono">
                Matching Songs ({results.length})
              </span>
              <div className="bg-[#141416] p-2.5 rounded-3xl border border-white/5 space-y-0.5 shadow-xl">
                {results.slice(0, 7).map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={idx}
                    playlistContext={results}
                  />
                ))}
              </div>
            </div>

          </div>

          {/* Remaining Tracks Grid */}
          {results.length > 7 && (
            <div className="space-y-3 pt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40 font-mono">
                All Song Results
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 bg-[#141416] p-3 rounded-3xl border border-white/5">
                {results.slice(7).map((track, idx) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={idx + 7}
                    playlistContext={results}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      ) : debouncedQuery ? (
        <div className="py-20 text-center text-white/50 bg-[#141416] rounded-3xl border border-white/10 p-8 max-w-md mx-auto">
          <p className="text-base font-bold text-white">No results found for "{debouncedQuery}"</p>
          <p className="text-xs text-white/40 mt-1">Check spelling or try a different song or artist query.</p>
        </div>
      ) : (
        <div className="py-24 text-center text-white/40 max-w-sm mx-auto space-y-2">
          <SearchIcon className="w-10 h-10 text-white/20 mx-auto" />
          <h3 className="text-base font-bold text-white/80">Search Apple Music</h3>
          <p className="text-xs text-white/40">
            Find millions of full-length tracks, soundtracks, anime openings, and albums.
          </p>
        </div>
      )}

    </div>
  );
};
