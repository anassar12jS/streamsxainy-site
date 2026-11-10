import React, { useState } from 'react';
import { Radio, Play, Pause, Sparkles, Volume2, Globe, Headphones } from 'lucide-react';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { MusicTrack } from '../types';

export const RadioRoute: React.FC = () => {
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);

  const [activeCategory, setActiveCategory] = useState('All');
  const stations = APPLE_MUSIC_BROWSE_SECTIONS.liveRadios;

  const filteredStations = activeCategory === 'All' 
    ? stations 
    : stations.filter(s => s.genre?.toLowerCase().includes(activeCategory.toLowerCase()));

  const handleStationClick = (station: MusicTrack) => {
    if (currentTrack?.id === station.id) {
      if (playbackStatus === 'playing') {
        togglePlayPause();
      } else {
        playTrack(station);
      }
    } else {
      playTrack(station);
    }
  };

  const isFeaturedPlaying = currentTrack?.id === stations[0]?.id && playbackStatus === 'playing';

  return (
    <div 
      className="space-y-8 animate-fade-in pb-32 max-w-7xl mx-auto px-1 sm:px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Broadcasts
          </span>
          <span className="text-xs text-white/50 font-semibold">
            BitChord 24/7 Global Audio Streams
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">
          Live Radio
        </h1>
        <p className="text-sm text-white/60 max-w-xl mt-1">
          Continuous, commercial-free streaming stations: chill lo-fi beats, cyberpunk retrowave, studio orchestral anime, and smooth midnight jazz.
        </p>
      </div>

      {/* Featured Big Radio Hero */}
      {stations[0] && (
        <div 
          onClick={() => handleStationClick(stations[0] as MusicTrack)}
          className="relative rounded-3xl overflow-hidden border border-white/10 hover:border-emerald-500/50 p-6 sm:p-10 bg-[#161618] cursor-pointer group shadow-2xl transition-all"
        >
          <div 
            className="absolute inset-0 bg-cover bg-center filter blur-xl opacity-30 scale-110 group-hover:scale-105 transition-transform duration-700"
            style={{ backgroundImage: `url(${stations[0].artwork})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-6 text-center sm:text-left">
              <img 
                src={stations[0].artwork} 
                alt="" 
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl object-cover shadow-2xl border border-white/10 group-hover:scale-105 transition-transform" 
              />
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                    24/7 Live Stream
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white group-hover:text-emerald-400 transition-colors">
                  {stations[0].title}
                </h2>
                <p className="text-sm text-white/70 mt-1">
                  {stations[0].artist} • Chill Beats to Relax / Study
                </p>

                {/* Animated Equalizer when playing */}
                {isFeaturedPlaying && (
                  <div className="flex items-end gap-1 h-3.5 mt-2.5">
                    <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.7s_infinite] h-2.5" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_1.1s_infinite_0.2s] h-3.5" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.9s_infinite_0.4s] h-1.5" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.8s_infinite_0.1s] h-3" />
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="w-14 h-14 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center shadow-xl group-hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              {isFeaturedPlaying ? (
                <Pause className="w-6 h-6 fill-current text-black" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-1 text-black" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2">
        {['All', 'Lo-Fi', 'Synthwave', 'Anime', 'Jazz'].map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-white text-black shadow-md'
                : 'bg-[#18181b] hover:bg-[#27272a] text-[#b3b3b3] hover:text-white border border-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of All Live Stations */}
      <div className="space-y-4 pt-2">
        <h3 className="text-xl font-bold text-white tracking-tight">
          All Stations
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredStations.map(station => {
            const isPlaying = currentTrack?.id === station.id && playbackStatus === 'playing';

            return (
              <div
                key={station.id}
                onClick={() => handleStationClick(station as MusicTrack)}
                className={`group relative p-4 rounded-2xl bg-[#141416] hover:bg-[#1c1c20] border transition-all cursor-pointer flex flex-col justify-between ${
                  isPlaying ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-white/5 hover:border-white/15'
                }`}
              >
                <div>
                  <div className="relative aspect-video rounded-xl overflow-hidden mb-3.5 bg-black/50">
                    <img 
                      src={station.artwork} 
                      alt={station.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />

                    {/* Live Badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-mono font-bold flex items-center gap-1 shadow-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      LIVE
                    </div>

                    {/* Play/Pause Button on Hover or Playing */}
                    <div className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg transition-transform ${
                      isPlaying ? 'scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                    }`}>
                      {isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </div>
                  </div>

                  <h4 className="font-semibold text-sm text-white group-hover:text-emerald-400 transition-colors truncate">
                    {station.title}
                  </h4>
                  <p className="text-xs text-[#a3a3a3] truncate mt-0.5">
                    {station.artist}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[#777777] mt-3 pt-2.5 border-t border-white/5">
                  <span>{station.genre}</span>
                  {isPlaying ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5" /> ON AIR
                    </span>
                  ) : (
                    <span className="text-white/40">24/7 Stream</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default RadioRoute;
