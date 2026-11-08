import React, { useState, useEffect, useRef } from 'react';
import { Play, Download, Sparkles, Trophy, Music, Disc, Clock, Share2, Layers } from 'lucide-react';
import { replayRecorder } from '../api/replay';
import { ReplayStats, MusicTrack } from '../types';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

export const ReplayRoute: React.FC = () => {
  const [stats, setStats] = useState<ReplayStats>(() => replayRecorder.getStats());
  const [isExporting, setIsExporting] = useState(false);
  const posterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const setTrack = useMusicPlayerStore(state => state.setTrack);

  useEffect(() => {
    setStats(replayRecorder.getStats());
  }, []);

  const handleDownloadPoster = () => {
    const canvas = posterCanvasRef.current;
    if (!canvas) return;

    setIsExporting(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1920;

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#1c0a10');
    grad.addColorStop(0.3, '#380a1c');
    grad.addColorStop(0.7, '#120d18');
    grad.addColorStop(1, '#08080a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Decorative Blur Glow
    ctx.fillStyle = 'rgba(250, 36, 60, 0.25)';
    ctx.beginPath();
    ctx.arc(540, 400, 350, 0, Math.PI * 2);
    ctx.fill();

    // Top BitChord Replay Logo & Year
    ctx.fillStyle = '#fa243c';
    ctx.font = 'bold 36px "DM Sans", sans-serif';
    ctx.fillText('BITCHORD REPLAY', 90, 160);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 120px "DM Sans", sans-serif';
    ctx.fillText(`${stats.year}`, 90, 290);

    // Total Minutes Pill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.roundRect(90, 340, 900, 180, 32);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 32px "DM Sans", sans-serif';
    ctx.fillText('MINUTES STREAMED', 140, 410);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 84px "DM Sans", sans-serif';
    ctx.fillText(`${stats.totalMinutesListened.toLocaleString()} mins`, 140, 490);

    // Top Songs List
    ctx.fillStyle = '#fa243c';
    ctx.font = 'bold 34px "DM Sans", sans-serif';
    ctx.fillText('TOP SONGS', 90, 600);

    const topSongs = stats.topTracks.slice(0, 5);
    let yPos = 680;
    topSongs.forEach((item, i) => {
      ctx.fillStyle = '#fa243c';
      ctx.font = 'bold 44px "DM Sans", sans-serif';
      ctx.fillText(`#${i + 1}`, 90, yPos);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px "DM Sans", sans-serif';
      ctx.fillText(item.track.title.substring(0, 24), 180, yPos);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '500 28px "DM Sans", sans-serif';
      ctx.fillText(`${item.track.artist} · ${item.plays} plays`, 180, yPos + 38);

      yPos += 120;
    });

    // Top Artists
    ctx.fillStyle = '#fa243c';
    ctx.font = 'bold 34px "DM Sans", sans-serif';
    ctx.fillText('TOP ARTISTS', 90, 1320);

    const topArtists = stats.topArtists.slice(0, 4);
    let aPos = 1390;
    topArtists.forEach((a, i) => {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px "DM Sans", sans-serif';
      ctx.fillText(`${i + 1}. ${a.name}`, 90, aPos);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '500 26px "DM Sans", sans-serif';
      ctx.fillText(`${a.plays} songs played · ${a.minutes} min`, 90, aPos + 34);

      aPos += 90;
    });

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '500 28px "DM Sans", sans-serif';
    ctx.fillText('StreamHub BitChord Music · Apple Music Web Experience', 90, 1820);

    // Trigger download
    setTimeout(() => {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `BitChord-Replay-${stats.year}.png`;
      a.click();
      setIsExporting(false);
    }, 200);
  };

  return (
    <div className="space-y-10 animate-fade-in pb-24 max-w-7xl mx-auto px-1 sm:px-4">
      
      {/* Hidden Canvas for High-Res Poster Export */}
      <canvas ref={posterCanvasRef} className="hidden" />

      {/* 1. Hero Spotlight */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-12 border border-white/10 bg-gradient-to-br from-[#2a0e18] via-[#161618] to-[#0a0a0c] shadow-2xl flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6">
        <div className="space-y-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#fa243c] bg-[#fa243c]/20 px-3 py-1 rounded-full border border-[#fa243c]/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#fa243c]" /> Apple Music Replay
            </span>
            <span className="text-xs font-mono text-white/50">
              {stats.year}
            </span>
          </div>

          <h1 className="text-3xl sm:text-6xl font-black text-white tracking-tight">
            Replay '{stats.year.toString().slice(-2)}
          </h1>
          <p className="text-sm sm:text-base text-white/70 max-w-xl">
            See your most listened songs, top artists, and streaming milestones throughout the year.
          </p>
        </div>

        <button
          onClick={handleDownloadPoster}
          disabled={isExporting}
          className="px-6 py-3 rounded-2xl bg-[#fa243c] hover:bg-[#ff3b50] text-white font-bold text-xs shadow-xl shadow-[#fa243c]/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'Generating Poster...' : 'Share Replay Poster'}</span>
        </button>
      </div>

      {/* 2. Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        <div className="p-6 rounded-3xl bg-[#141416] border border-white/5 shadow-xl flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#fa243c]/15 text-[#fa243c] flex items-center justify-center shrink-0">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider font-semibold">
              Time Listened
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
              {stats.totalMinutesListened} <span className="text-sm font-medium text-white/60">mins</span>
            </h3>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-[#141416] border border-white/5 shadow-xl flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Trophy className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider font-semibold">
              Total Plays
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
              {stats.totalPlays} <span className="text-sm font-medium text-white/60">tracks</span>
            </h3>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-[#141416] border border-white/5 shadow-xl flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
            <Music className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider font-semibold">
              Top Song
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white mt-0.5 truncate max-w-[180px]">
              {stats.topTracks[0]?.track.title || 'Cornfield Chase'}
            </h3>
          </div>
        </div>

      </div>

      {/* 3. Top Songs & Top Artists Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Top Songs */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Your Top Songs</span>
            <span className="text-xs font-mono text-white/40 font-normal">({stats.topTracks.length})</span>
          </h2>

          <div className="bg-[#141416] p-3 rounded-3xl border border-white/5 space-y-1 shadow-xl">
            {stats.topTracks.map((item, idx) => (
              <div
                key={item.track.id}
                onClick={() => setTrack(item.track)}
                className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className={`w-6 text-center font-black text-sm ${
                    idx === 0 ? 'text-[#fa243c]' : idx === 1 ? 'text-amber-400' : idx === 2 ? 'text-rose-400' : 'text-white/40'
                  }`}>
                    {idx + 1}
                  </span>

                  <img 
                    src={item.track.artwork} 
                    alt="" 
                    className="w-11 h-11 rounded-xl object-cover shrink-0 shadow border border-white/5" 
                  />

                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#fa243c] transition-colors">
                      {item.track.title}
                    </h4>
                    <p className="text-[11px] text-white/50 truncate">
                      {item.track.artist}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-white/80">
                    {item.plays} plays
                  </span>
                  <p className="text-[10px] text-white/40 font-mono">
                    {item.minutes} min
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Artists */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Your Top Artists</span>
            <span className="text-xs font-mono text-white/40 font-normal">({stats.topArtists.length})</span>
          </h2>

          <div className="bg-[#141416] p-3 rounded-3xl border border-white/5 space-y-1 shadow-xl">
            {stats.topArtists.map((artist, idx) => (
              <div
                key={artist.name}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className={`w-6 text-center font-black text-sm ${
                    idx === 0 ? 'text-[#fa243c]' : 'text-white/40'
                  }`}>
                    {idx + 1}
                  </span>

                  <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 ring-1 ring-white/10 bg-[#242426]">
                    <img 
                      src={artist.avatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&auto=format&fit=crop&q=80'} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {artist.name}
                    </h4>
                    <p className="text-[11px] text-white/50 truncate">
                      {artist.plays} songs played
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-white/80">
                    {artist.minutes} mins
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
