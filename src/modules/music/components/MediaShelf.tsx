import React, { useRef } from 'react';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { MusicTrack } from '../types';
import { useMusicPlayerStore } from '../store/useMusicPlayerStore';

export interface ShelfItem {
  id: string;
  title: string;
  subtitle: string;
  artwork: string;
  badge?: string;
  tracks?: MusicTrack[];
  onClick?: () => void;
}

interface MediaShelfProps {
  title: string;
  subtitle?: string;
  items: ShelfItem[];
  aspectRatio?: 'square' | 'video' | 'portrait';
}

export const MediaShelf: React.FC<MediaShelfProps> = ({
  title,
  subtitle,
  items,
  aspectRatio = 'square',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const setTrack = useMusicPlayerStore(state => state.setTrack);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -480 : 480;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handlePlayItem = (e: React.MouseEvent, item: ShelfItem) => {
    e.stopPropagation();
    if (item.tracks && item.tracks.length > 0) {
      setTrack(item.tracks[0], item.tracks);
    } else if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <div className="space-y-3.5 group/shelf">
      {/* Shelf Header */}
      <div className="flex items-end justify-between px-1">
        <div>
          {subtitle && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#fa243c] font-mono mb-0.5">
              {subtitle}
            </p>
          )}
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {title}
          </h3>
        </div>

        {/* Scroll Arrows */}
        <div className="flex items-center gap-1 opacity-0 group-hover/shelf:opacity-100 transition-opacity">
          <button
            onClick={() => scroll('left')}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scroller Container */}
      <div 
        ref={scrollRef}
        className="flex items-start gap-4 overflow-x-auto pb-4 pt-1 am-scrollbar scroll-smooth"
        style={{ fontFamily: 'var(--bitchord-font)' }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            onClick={item.onClick}
            className="w-40 sm:w-48 shrink-0 group relative cursor-pointer text-left"
          >
            {/* Artwork Container: Apple Music perfectly square with 6-8px border radius */}
            <div className={`relative w-full ${
              aspectRatio === 'video' ? 'aspect-video' : 'aspect-square'
            } rounded-[8px] overflow-hidden bg-[#18181b] border border-white/10 shadow-md mb-2 transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-xl`}>
              <img 
                src={item.artwork} 
                alt={item.title} 
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
              />
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Badge */}
              {item.badge && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-[4px] bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-semibold text-white font-mono">
                  {item.badge}
                </div>
              )}

              {/* Play Button Overlay */}
              <button
                type="button"
                onClick={(e) => handlePlayItem(e, item)}
                className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                title="Play"
              >
                <Play className="w-4 h-4 fill-current ml-0.5 text-black" />
              </button>
            </div>

            {/* Title & Subtitle: Left-aligned in solid white, with smaller muted grey artist names below */}
            <h4 className="text-sm font-semibold text-white truncate text-left group-hover:underline">
              {item.title}
            </h4>
            <p className="text-xs text-[#98989d] truncate mt-0.5 text-left font-normal">
              {item.subtitle}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
