import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IPTVChannel } from '../types';
import { 
  Tv2, Search, PictureInPicture, Heart, Globe, Filter, 
  Eye, EyeOff, Clock, Info, Layers, Film, Play, Zap 
} from 'lucide-react';
import { fetchAndParseEPG, getCurrentProgram, EPGData } from '../services/epg';
import Hls from 'hls.js';
import { getRecentChannels, addRecentChannel, isFavoriteChannel, toggleFavoriteChannel } from '../services/storage';
import { initializeIPTVOrgData, getCountryInfo, enrichChannelMetadata, fetchIPTVOrgChannels } from '../services/iptv';
import type { IPTVOrgChannel } from '../services/iptv';
import { Skeleton } from '../components/Skeleton';

// --- Virtual List Component ---
interface ListChildComponentProps {
  index: number;
  style: React.CSSProperties;
  data: {
    channels: IPTVChannel[];
    activeChannel: IPTVChannel | null;
    epg: EPGData;
    onSelect: (c: IPTVChannel) => void;
    onToggleFav: (c: IPTVChannel, e: React.MouseEvent) => void;
  };
}

const List: React.FC<{
  height: number;
  width: number;
  itemCount: number;
  itemSize: number;
  className?: string;
  itemData: any;
  children: React.ComponentType<ListChildComponentProps>;
}> = ({ height, width, itemCount, itemSize, className, itemData, children: Row }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = itemCount * itemSize;
  const overscan = 6;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemSize) - overscan);
  const endIndex = Math.min(itemCount - 1, Math.floor((scrollTop + height) / itemSize) + overscan);

  const items: React.ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    items.push(
      <Row
        key={i}
        index={i}
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: `${itemSize}px`, 
          transform: `translateY(${i * itemSize}px)` 
        }}
        data={itemData}
      />
    );
  }

  return (
    <div 
      className={className} 
      style={{ height, width, overflowY: 'auto', position: 'relative' }} 
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>{items}</div>
    </div>
  );
};

// --- Main LiveTV Component ---
export const LiveTV: React.FC = () => {
  // Data States
  const [playlistUrl] = useState('https://iptv-org.github.io/iptv/index.m3u');
  const [epgData, setEpgData] = useState<EPGData>({ channels: [], programs: {} });
  const [channels, setChannels] = useState<IPTVChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<IPTVChannel | null>(null);
  const [recentChannels, setRecentChannels] = useState<IPTVChannel[]>([]);
  const [orgChannels, setOrgChannels] = useState<IPTVOrgChannel[]>([]);

  // UI States
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'recently-watched'>('name');
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0); // Used to force re-render on fav toggle

  // Advanced Filter States
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [hideNSFW, setHideNSFW] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Refs
  const listContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [listDimensions, setListDimensions] = useState({ width: 0, height: 400 });

  // --- Initialization ---
  useEffect(() => {
    setRecentChannels(getRecentChannels());

    // Initialize IPTV-org data
    initializeIPTVOrgData()
      .then(() => fetchIPTVOrgChannels())
      .then((c) => setOrgChannels(c))
      .catch((e) => console.warn('IPTV Data fetch failed', e));

    fetchPlaylist(playlistUrl);

    // Resize observer
    const node = listContainerRef.current;
    if (node) {
      const ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          setListDimensions({ width: e.contentRect.width, height: e.contentRect.height });
        }
      });
      ro.observe(node);
      return () => ro.disconnect();
    }
  }, []);

  // --- Playlist Fetching ---
  const fetchPlaylist = async (url: string) => {
    setLoading(true);
    try {
      const res = await fetch(url);
      const text = await res.text();

      // Extract EPG URL
      const epgMatch = text.match(/x-tvg-url="([^"]*)"/) || text.match(/url-tvg="([^"]*)"/);
      if (epgMatch && epgMatch[1]) {
        fetchAndParseEPG(epgMatch[1]).then(setEpgData).catch(() => {});
      }

      const lines = text.split('\n');
      const parsed: IPTVChannel[] = [];
      let current: Partial<IPTVChannel> = {};

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('#EXTINF:')) {
          const info = line.substring(8);
          const name = info.split(',').pop() || '';
          const logo = line.match(/tvg-logo="([^"]*)"/)?.[1];
          const group = line.match(/group-title="([^"]*)"/)?.[1] || 'Uncategorized';
          const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1];
          current = { name, logo, group };
          if (tvgId) (current as any).tvgId = tvgId;
        } else if (!line.startsWith('#')) {
          if (current.name) {
            parsed.push({ ...current, url: line } as IPTVChannel);
            current = {};
          }
        }
      }

      // Enrich metadata
      const enriched = orgChannels.length > 0 
        ? parsed.map((ch) => enrichChannelMetadata(ch, orgChannels)) 
        : parsed;
      setChannels(enriched);
    } catch (e) {
      console.error('Failed to fetch playlist', e);
    } finally {
      setLoading(false);
    }
  };

  // --- Video Player Effect ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeChannel) return;
    
    addRecentChannel(activeChannel);
    
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(activeChannel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      return () => hls.destroy();
    } else if (video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = activeChannel.url;
      video.play().catch(() => {});
    }
  }, [activeChannel]);

  // --- Computed Data ---
  const groups = useMemo(() => {
    const s = new Set(channels.map((c) => c.group || 'Uncategorized'));
    return ['All', 'Favorites', ...Array.from(s).sort()];
  }, [channels]);

  const countries = useMemo(() => {
    const list = channels.map((c) => c.country).filter((c): c is string => Boolean(c));
    return Array.from(new Set(list)).sort();
  }, [channels]);

  const languages = useMemo(() => {
    const out = new Set<string>();
    channels.forEach((c) => {
      if (c.language) {
        (Array.isArray(c.language) ? c.language : [c.language]).forEach((l) => out.add(l));
      }
    });
    return Array.from(out).sort();
  }, [channels]);

  const filteredChannels = useMemo(() => {
    let list = channels;

    // Group Filter
    if (activeGroup === 'Favorites') list = list.filter((c) => isFavoriteChannel(c.url));
    else if (activeGroup !== 'All') list = list.filter((c) => c.group === activeGroup);

    // Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    // Country Filter
    if (selectedCountry) list = list.filter((c) => c.country === selectedCountry);

    // Language Filter
    if (selectedLanguage) {
      list = list.filter((c) => {
        if (!c.language) return false;
        const langs = Array.isArray(c.language) ? c.language : [c.language];
        return langs.includes(selectedLanguage);
      });
    }

    // NSFW Filter
    if (hideNSFW) list = list.filter((c) => !c.isNsfw);

    // Sorting
    if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'recently-watched') {
      const recents = getRecentChannels().map(r => r.url);
      list = [...list].sort((a, b) => {
        const indexA = recents.indexOf(a.url);
        const indexB = recents.indexOf(b.url);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }

    return list;
  }, [channels, activeGroup, search, selectedCountry, selectedLanguage, hideNSFW, tick, sortBy]);

  // --- Handlers ---
  const togglePiP = async () => {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (videoRef.current) await videoRef.current.requestPictureInPicture();
  };

  const handleToggleFav = (c: IPTVChannel, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavoriteChannel(c);
    setTick((t) => t + 1);
  };

  const resetFilters = () => {
    setSearch('');
    setActiveGroup('All');
    setSelectedCountry(null);
    setSelectedLanguage(null);
    setSortBy('name');
    setHideNSFW(true);
  };

  // --- Render Row Component ---
  const ChannelRow: React.FC<ListChildComponentProps> = ({ index, style, data }) => {
    const channel = data.channels[index];
    const isFav = isFavoriteChannel(channel.url);
    const tvgId = (channel as any).tvgId;
    const programs = tvgId ? data.epg.programs[tvgId] : undefined;
    const currentProgram = programs ? getCurrentProgram(programs) : null;
    const countryInfo = channel.country ? getCountryInfo(channel.country) : null;
    const [imgError, setImgError] = useState(false);

    const isActive = data.activeChannel?.url === channel.url;

    return (
      <div style={style}>
        <button
          onClick={() => data.onSelect(channel)}
          className={`w-full text-left p-3 flex items-center gap-3 hover:bg-[var(--bg-hover)] h-full group transition-colors ${
            isActive ? 'bg-[rgb(var(--primary-color))]/10 border-l-4 border-[rgb(var(--primary-color))]' : 'border-l-4 border-transparent'
          }`}
        >
          <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative">
            {!imgError && channel.logo ? (
              <img src={channel.logo} className="w-full h-full object-contain" onError={() => setImgError(true)} loading="lazy" alt="" />
            ) : (
              <Tv2 className="w-6 h-6 text-[var(--text-muted)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-bold truncate ${isActive ? 'text-[rgb(var(--primary-color))]' : 'text-[var(--text-main)]'}`}>
                {channel.name}
              </p>
              {countryInfo && <span className="text-xs">{countryInfo.flag}</span>}
              {channel.quality && <span className="text-xs bg-[rgb(var(--primary-color))]/20 text-[rgb(var(--primary-color))] px-2 py-0.5 rounded">{channel.quality}</span>}
            </div>
            {currentProgram ? (
              <p className="text-xs text-[rgb(var(--primary-color))] truncate flex items-center gap-1">
                <Clock className="w-3 h-3" />{currentProgram.title}
              </p>
            ) : (
              <p className="text-xs text-[var(--text-muted)] truncate">{channel.group}</p>
            )}
          </div>
          <div onClick={(e) => data.onToggleFav(channel, e)} className={`p-2 rounded-lg hover:bg-[var(--bg-hover)] ${isFav ? 'text-red-500' : 'text-[var(--text-muted)] opacity-0 group-hover:opacity-100'}`}>
            <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </div>
        </button>
      </div>
    );
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen animate-fade-in flex flex-col h-screen overflow-hidden bg-[var(--bg-main)]">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-card)] p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[rgb(var(--primary-color))]/10 p-2.5 rounded-lg">
              <Tv2 className="w-6 h-6 text-[rgb(var(--primary-color))]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-main)]">Live TV</h1>
              <p className="text-xs text-[var(--text-muted)]">{channels.length} channels • {filteredChannels.length} shown</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Player & Info */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 max-h-[52vh] lg:max-h-none overflow-y-auto custom-scrollbar pr-1">
          
          {/* Video Player */}
          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative group border border-[var(--border-color)]">
            {activeChannel ? (
              <>
                <video ref={videoRef} controls className="w-full h-full" autoPlay />
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={togglePiP} className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors" title="Picture in Picture">
                    <PictureInPicture className="w-5 h-5" />
                  </button>
                </div>
                {/* Program Overlay */}
                {((activeChannel as any).tvgId && epgData.programs[(activeChannel as any).tvgId]) && (
                  <div className="absolute bottom-16 left-4 right-4 bg-black/90 backdrop-blur-md p-4 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <h3 className="text-white font-bold text-sm mb-1">{getCurrentProgram(epgData.programs[(activeChannel as any).tvgId])?.title || 'No Program Data'}</h3>
                    <p className="text-gray-300 text-xs line-clamp-2">{getCurrentProgram(epgData.programs[(activeChannel as any).tvgId])?.desc}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-muted)] bg-gradient-to-b from-black/50 to-black/80">
                <Tv2 className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Select a channel to start watching</p>
              </div>
            )}
          </div>

          {/* Channel Info Card */}
          {activeChannel && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                {activeChannel.logo && (
                  <img src={activeChannel.logo} alt={activeChannel.name} className="w-12 h-12 rounded object-contain bg-white/5 p-1" onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-[var(--text-main)]">{activeChannel.name}</h2>
                  <p className="text-sm text-[var(--text-muted)]">{activeChannel.group}</p>
                </div>
                <button onClick={() => handleToggleFav(activeChannel, {} as React.MouseEvent)} className={`p-3 rounded-full transition-colors ${isFavoriteChannel(activeChannel.url) ? 'bg-red-500/10 text-red-500' : 'bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-red-500'}`}>
                  <Heart className={`w-5 h-5 ${isFavoriteChannel(activeChannel.url) ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {activeChannel.country && getCountryInfo(activeChannel.country) && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-muted)]">{getCountryInfo(activeChannel.country)!.flag} {getCountryInfo(activeChannel.country)!.name}</span>
                  </div>
                )}
                {activeChannel.network && (
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-[var(--text-muted)] truncate">{activeChannel.network}</span>
                  </div>
                )}
                {activeChannel.quality && (
                  <div className="flex items-center gap-2">
                    <span className="text-[rgb(var(--primary-color))] font-semibold">{activeChannel.quality}</span>
                  </div>
                )}
                {activeChannel.isNsfw && (
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-yellow-500" />
                    <span className="text-yellow-500">18+</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Channels */}
          {recentChannels.length > 0 && (
            <div>
              <p className="text-xs font-bold text-[var(--text-muted)] uppercase mb-3 pl-2">Recently Watched</p>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {recentChannels.map((rc, i) => (
                  <button key={i} onClick={() => setActiveChannel(rc)} className={`w-24 shrink-0 aspect-video bg-[var(--bg-card)] rounded-lg border-2 flex items-center justify-center p-2 hover:border-[rgb(var(--primary-color))] group transition-all ${activeChannel?.url === rc.url ? 'border-[rgb(var(--primary-color))] shadow-lg' : 'border-[var(--border-color)]'}`} title={rc.name}>
                    {rc.logo ? (
                      <img src={rc.logo} className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} alt="" />
                    ) : (
                      <Tv2 className="w-6 h-6 text-[var(--text-muted)] group-hover:text-[rgb(var(--primary-color))]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Filters & List */}
        <div className="lg:col-span-1 flex flex-col bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-lg" ref={listContainerRef}>
          <div className="p-4 border-b border-[var(--border-color)] space-y-3">
            {/* Search */}
            <div className="relative">
              <input type="text" placeholder="Search channels..." className="w-full bg-[var(--bg-input)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] outline-none border border-[var(--border-color)] focus:border-[rgb(var(--primary-color))] transition-colors" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
            </div>

            {/* Groups */}
            <div className="flex gap-2 overflow-x-auto pb-2 fancy-scrollbar">
              {groups.map((g) => (
                <button key={g} onClick={() => setActiveGroup(g)} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${activeGroup === g ? 'bg-[rgb(var(--primary-color))] text-white border-[rgb(var(--primary-color))] shadow-lg' : 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)] hover:border-[var(--text-muted)]'}`}>
                  {g === 'All' && <Globe className="w-3 h-3 inline mr-1" />}
                  {g === 'Favorites' && <Heart className="w-3 h-3 inline mr-1" />}
                  {g}
                </button>
              ))}
            </div>

            {/* Advanced Filters Toggle */}
            <button onClick={() => setShowFilters(!showFilters)} className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-main)] flex items-center justify-center gap-2 transition-colors">
              <Filter className="w-3 h-3" />
              Advanced Filters {showFilters ? '▾' : '▸'}
            </button>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="space-y-3 p-3 bg-[var(--bg-input)] rounded-lg border border-[var(--border-color)]">
                {countries.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">Country</label>
                    <select value={selectedCountry || ''} onChange={(e) => setSelectedCountry(e.target.value || null)} className="w-full bg-[var(--bg-input)] text-sm text-[var(--text-main)] border border-[var(--border-color)] rounded px-2 py-1.5 outline-none focus:border-[rgb(var(--primary-color))]">
                      <option value="">All Countries</option>
                      {countries.map((c) => (
                        <option key={c} value={c}>
                          {getCountryInfo(c)?.flag || ''} {getCountryInfo(c)?.name || c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {languages.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">Language</label>
                    <select value={selectedLanguage || ''} onChange={(e) => setSelectedLanguage(e.target.value || null)} className="w-full bg-[var(--bg-input)] text-sm text-[var(--text-main)] border border-[var(--border-color)] rounded px-2 py-1.5 outline-none focus:border-[rgb(var(--primary-color))]">
                      <option value="">All Languages</option>
                      {languages.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Hide 18+</label>
                  <button onClick={() => setHideNSFW(!hideNSFW)} className={`p-2 rounded transition-colors ${hideNSFW ? 'bg-[rgb(var(--primary-color))] text-white' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'}`}>
                    {hideNSFW ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                <button onClick={resetFilters} className="w-full px-2 py-1.5 rounded text-xs font-bold bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">Reset All</button>
              </div>
            )}

            {/* Sort Options */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSortBy('name')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${sortBy === 'name' ? 'bg-[rgb(var(--primary-color))] text-white border-[rgb(var(--primary-color))]' : 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'}`}>A-Z</button>
              <button onClick={() => setSortBy('recently-watched')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${sortBy === 'recently-watched' ? 'bg-[rgb(var(--primary-color))] text-white border-[rgb(var(--primary-color))]' : 'bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'}`}>Recently Watched</button>
            </div>
          </div>

          <div className="p-2 border-b border-[var(--border-color)] flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase">{filteredChannels.length} channels</span>
          </div>

          {/* List Content */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton width="60%" height={13} className="rounded" />
                      <Skeleton width="35%" height={11} className="rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)] flex flex-col items-center justify-center h-full">
                <Tv2 className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">No channels found</p>
              </div>
            ) : (
              <List 
                height={Math.max(200, listDimensions.height - 70)}
                itemCount={filteredChannels.length} 
                itemSize={70} 
                width={listDimensions.width} 
                className="custom-scrollbar" 
                itemData={{ channels: filteredChannels, activeChannel, epg: epgData, onSelect: setActiveChannel, onToggleFav: handleToggleFav }}
              >
                {ChannelRow}
              </List>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTV;