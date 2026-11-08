import React from 'react';
import { Radio, Play, Pause, Sparkles, Volume2, Globe } from 'lucide-react';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { MusicTrack } from '../types';

export const RadioRoute: React.FC = () => {
  const currentTrack = useMusicPlayerStore(state => state.currentTrack);
  const playbackStatus = useMusicPlayerStore(state => state.playbackStatus);
  const playTrack = useMusicPlayerStore(state => state.playTrack);
  const togglePlayPause = useMusicPlayerStore(state => state.togglePlayPause);

  const stations = APPLE_MUSIC_BROWSE_SECTIONS.liveRadios;

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

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center gap-1 text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Broadcasts
          </span>
          <span className="text-xs text-white/50 font-semibold">
            Apple Music 1 & Curated Streams
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
          Radio
        </h1>
        <p className="text-sm text-white/60 max-w-xl mt-1">
          Tune in to uninterrupted 24/7 streaming stations, curated anime orchestrations, cyberpunk retrowave, and lo-fi chill soundscapes.
        </p>
      </div>

      {/* Featured Big Radio Hero */}
      <div 
        onClick={() => handleStationClick(stations[0] as MusicTrack)}
        className="relative rounded-3xl overflow-hidden border border-white/10 hover:border-emerald-500/50 p-6 sm:p-10 bg-[#161618] cursor-pointer group shadow-2xl transition-all"
      >
        <div 
          className="absolute inset-0 bg-cover bg-center filter blur-xl opacity-30 scale-110 group-hover:scale-105 transition-transform duration-700"
          style={{ backgroundImage: `url(${stations[0].artwork})` }}
        />
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
          <div className="flex items-center gap-6">
            <img 
              src={stations[0].artwork} 
              alt="" 
              className="w-28 h-28 rounded-2xl object-cover shadow-2xl border border-white/10 group-hover:scale-105 transition-transform" 
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  24/7 Live Worldwide
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">
                {stations[0].title}
              </h2>
              <p className="text-sm text-white/70 mt-1">
                {stations[0].artist} · Chill Beats to Relax / Study
              </p>
            </div>
          </div>

          <button
            type="button"
            className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/30 group-hover:scale-110 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            {currentTrack?.id === stations[0].id && playbackStatus === 'playing' ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </button>
        </div>
      </div>

      {/* Grid of All Live Stations */}
      <div className="space-y-4 pt-4">
        <h3 className="text-xl font-bold text-white tracking-tight">
          All Stations
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stations.map((st) => {
            const isThis = currentTrack?.id === st.id;
            const isPlaying = isThis && playbackStatus === 'playing';

            return (
              <div
                key={st.id}
                onClick={() => handleStationClick(st as MusicTrack)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between ${
                  isThis
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                    : 'bg-[#141416] border-white/10 hover:border-white/20 text-white/80 hover:text-white'
                }`}
              >
                <div className="relative aspect-video rounded-2xl overflow-hidden mb-3 bg-black/40 shadow-inner">
                  <img 
                    src={st.artwork} 
                    alt={st.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  />
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>LIVE</span>
                  </div>

                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
                      {isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className={`text-sm font-bold truncate group-hover:text-emerald-400 transition-colors ${isThis ? 'text-emerald-400' : 'text-white'}`}>
                    {st.title}
                  </h4>
                  <p className="text-xs text-white/50 truncate mt-0.5">
                    {st.artist}
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-mono text-white/40">
                    {st.genre}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
