import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Shuffle, Sparkles, Flame, Radio, Disc, ChevronRight } from 'lucide-react';
import { APPLE_MUSIC_BROWSE_SECTIONS } from '../api/innertube';
import { TrackRow } from '../components/TrackRow';
import { MediaShelf, ShelfItem } from '../components/MediaShelf';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';
import { MusicTrack } from '../types';

export const BrowseRoute: React.FC = () => {
  const navigate = useNavigate();
  const setTrack = useMusicPlayerStore(state => state.setTrack);

  const [activeHeroIdx, setActiveHeroIdx] = useState(0);
  const heroItem = APPLE_MUSIC_BROWSE_SECTIONS.heroSpotlight[activeHeroIdx];

  const handleHeroPlay = () => {
    if (activeHeroIdx === 0) {
      // Dune 2
      setTrack(APPLE_MUSIC_BROWSE_SECTIONS.topTracks[2], APPLE_MUSIC_BROWSE_SECTIONS.topTracks);
    } else if (activeHeroIdx === 1) {
      // Today's Hits
      setTrack(APPLE_MUSIC_BROWSE_SECTIONS.topTracks[4], APPLE_MUSIC_BROWSE_SECTIONS.topTracks);
    } else {
      // Anime
      setTrack(APPLE_MUSIC_BROWSE_SECTIONS.topTracks[3], APPLE_MUSIC_BROWSE_SECTIONS.topTracks);
    }
  };

  const albumShelfItems: ShelfItem[] = APPLE_MUSIC_BROWSE_SECTIONS.featuredAlbums.map(a => ({
    id: a.id,
    title: a.title,
    subtitle: `${a.artist} · ${a.year}`,
    artwork: a.artwork,
    badge: 'ALBUM',
    onClick: () => navigate(`/music/album/${a.id}`),
  }));

  const radioShelfItems: ShelfItem[] = APPLE_MUSIC_BROWSE_SECTIONS.liveRadios.map(r => ({
    id: r.id,
    title: r.title,
    subtitle: `${r.artist} · 24/7 Live`,
    artwork: r.artwork,
    badge: 'LIVE 24/7',
    tracks: [r as MusicTrack],
    onClick: () => setTrack(r as MusicTrack),
  }));

  return (
    <div className="space-y-10 animate-fade-in pb-16">
      
      {/* ========================================================================= */}
      {/* 1. APPLE MUSIC HERO SPOTLIGHT CAROUSEL                                    */}
      {/* ========================================================================= */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#111113]">
        <div 
          className="relative min-h-[300px] sm:min-h-[380px] lg:min-h-[420px] bg-cover bg-center flex flex-col justify-end p-6 sm:p-10 transition-all duration-700"
          style={{ backgroundImage: `url(${heroItem.artwork})` }}
        >
          {/* Subtle gradient vignettes */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent w-full lg:w-2/3" />

          {/* Hero Content */}
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#fa243c] bg-[#fa243c]/20 px-2.5 py-0.5 rounded-full border border-[#fa243c]/30">
                {heroItem.badge}
              </span>
              <span className="text-xs text-white/60 font-semibold">
                Apple Music Exclusive
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              {heroItem.title}
            </h1>

            <p className="text-sm sm:text-base text-white/70 line-clamp-2 max-w-xl">
              {heroItem.description}
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleHeroPlay}
                className="px-6 py-3 rounded-2xl bg-[#fa243c] hover:bg-[#ff3b50] text-white font-bold text-sm shadow-xl shadow-[#fa243c]/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Listen Now</span>
              </button>
            </div>
          </div>

          {/* Hero Indicators */}
          <div className="absolute bottom-6 right-6 z-10 flex items-center gap-2">
            {APPLE_MUSIC_BROWSE_SECTIONS.heroSpotlight.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveHeroIdx(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === activeHeroIdx ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/60'
                }`}
                title={`Slide ${i + 1}`}
              />
            ))}
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TODAY'S TOP TRACKS (TABLE VIEW)                                       */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#fa243c] font-mono">
              Chart Toppers
            </p>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Top Songs: Global
            </h2>
          </div>
          <button
            onClick={() => setTrack(APPLE_MUSIC_BROWSE_SECTIONS.topTracks[0], APPLE_MUSIC_BROWSE_SECTIONS.topTracks)}
            className="text-xs font-bold text-[#fa243c] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Play All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 bg-[#141416] p-3 rounded-2xl border border-white/5">
          {APPLE_MUSIC_BROWSE_SECTIONS.topTracks.slice(0, 8).map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              index={idx}
              playlistContext={APPLE_MUSIC_BROWSE_SECTIONS.topTracks}
            />
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. FEATURED ALBUMS (SPATIAL AUDIO SHELF)                                  */}
      {/* ========================================================================= */}
      <MediaShelf
        title="Featured Albums & Masterpieces"
        subtitle="Lossless Spatial Audio"
        items={albumShelfItems}
      />

      {/* ========================================================================= */}
      {/* 4. LIVE 24/7 BROADCAST RADIOS                                             */}
      {/* ========================================================================= */}
      <MediaShelf
        title="24/7 Live Radio Stations"
        subtitle="Non-Stop Music Broadcasts"
        items={radioShelfItems}
        aspectRatio="video"
      />

    </div>
  );
};
