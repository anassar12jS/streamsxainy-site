import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TMDBResult, MediaType } from '../types';
import { TMDB_POSTER_BASE, TMDB_POSTER_SMALL } from '../constants';
import { getDetails } from '../services/tmdb';
import { isInWatchlist, addToWatchlist, removeFromWatchlist } from '../services/storage';
import { preloadRoute } from '../services/routePreloader';
import { Star, Play, Bookmark, Check } from 'lucide-react';

const FALLBACK_POSTER_SVG = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22450%22%20viewBox%3D%220%200%20300%20450%22%3E%3Crect%20fill%3D%22%2318181b%22%20width%3D%22300%22%20height%3D%22450%22%2F%3E%3Ctext%20fill%3D%22%2371717a%22%20font-family%3D%22sans-serif%22%20font-size%3D%2214%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3ENo%20Poster%3C%2Ftext%3E%3C%2Fsvg%3E';

interface MediaCardProps {
  item: TMDBResult;
  onClick: (item: TMDBResult) => void;
  onWatchlistChange?: (id: number, inWatchlist: boolean) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onClick, onWatchlistChange }) => {
  const queryClient = useQueryClient();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    if (item.id) {
      setInWatchlist(isInWatchlist(item.id));
    }
  }, [item.id]);

  const title = item.title || item.name || 'Untitled';
  const date = item.release_date || item.first_air_date;
  const year = date ? date.split('-')[0] : '';

  const isTmdbPoster = Boolean(item.poster_path && !item.poster_path.startsWith('http'));
  const posterUrl = item.poster_path?.startsWith('http')
    ? item.poster_path
    : item.poster_path
      ? `${TMDB_POSTER_BASE}${item.poster_path}`
      : FALLBACK_POSTER_SVG;

  const posterSrcSet = isTmdbPoster && item.poster_path
    ? `${TMDB_POSTER_SMALL}${item.poster_path} 185w, ${TMDB_POSTER_BASE}${item.poster_path} 342w`
    : undefined;

  const handleIntentPrefetch = () => {
    preloadRoute('details');
    if (item.id && item.media_type && item.media_type !== MediaType.PERSON) {
      queryClient.prefetchQuery({
        queryKey: ['details', item.id, item.media_type],
        queryFn: () => getDetails(item.id, item.media_type),
        staleTime: 1000 * 60 * 10,
      });
    }
  };

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.id) return;
    if (inWatchlist) {
      removeFromWatchlist(item.id);
      setInWatchlist(false);
      onWatchlistChange?.(item.id, false);
    } else {
      addToWatchlist(item);
      setInWatchlist(true);
      onWatchlistChange?.(item.id, true);
    }
  };

  const mediaLabel = item.anilist_id
    ? 'Anime'
    : item.media_type === MediaType.TV
      ? 'Series'
      : item.media_type === MediaType.MOVIE
        ? 'Movie'
        : item.media_type === MediaType.PERSON
          ? 'Talent'
          : 'Media';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View details for ${title}`}
      className="group relative flex-shrink-0 w-[148px] sm:w-[170px] md:w-[185px] text-left cursor-pointer transition-transform duration-200 hover:-translate-y-1 hover:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary-color))] rounded-xl select-none"
      style={{ containIntrinsicSize: '185px 278px' }}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(item);
        }
      }}
      onMouseEnter={handleIntentPrefetch}
      onTouchStart={handleIntentPrefetch}
      onFocus={handleIntentPrefetch}
    >
      {/* Poster Container */}
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[var(--bg-card)] relative border border-[var(--border-subtle)] group-hover:border-[rgb(var(--primary-color))]/60 transition-all duration-300 shadow-lg shadow-black/35 group-hover:shadow-[0_14px_32px_-10px_rgba(var(--primary-color),0.35)]">

        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-zinc-900 transition-opacity duration-300 pointer-events-none ${
            isImageLoaded ? 'opacity-0' : 'opacity-100 animate-pulse'
          }`}
        />

        <img
          src={posterUrl}
          srcSet={posterSrcSet}
          sizes="(max-width: 640px) 148px, (max-width: 768px) 170px, 185px"
          alt={title}
          width={185}
          height={278}
          className={`w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06] ${
            isImageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsImageLoaded(true)}
          onError={(e) => {
            setIsImageLoaded(true);
            e.currentTarget.onerror = null;
            e.currentTarget.src = FALLBACK_POSTER_SVG;
          }}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/25 opacity-75 group-hover:opacity-95 transition-opacity" />

        {/* Hover Play Affordance */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-[rgb(var(--primary-color))] text-white flex items-center justify-center shadow-xl shadow-[rgb(var(--primary-color))]/45 scale-90 group-hover:scale-100 transition-transform duration-200">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>

        {/* Watchlist Action */}
        {item.media_type !== MediaType.PERSON && (
          <button
            type="button"
            onClick={handleToggleWatchlist}
            aria-label={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            title={inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
            className={`absolute top-2 left-2 p-1.5 rounded-md backdrop-blur-md transition-opacity duration-150 ${
              inWatchlist
                ? 'bg-[rgb(var(--primary-color))] text-white opacity-100'
                : 'bg-black/65 text-white/80 hover:text-white hover:bg-black/85 opacity-0 group-hover:opacity-100'
            }`}
          >
            {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Rating Readout */}
        {typeof item.vote_average === 'number' && item.vote_average > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[11px] font-medium text-amber-400 flex items-center gap-1 font-mono tabular-nums z-10">
            <Star className="w-3 h-3 fill-amber-400" />
            <span>{item.vote_average.toFixed(1)}</span>
          </div>
        )}

        {/* Airing Countdown or Anime Audio */}
        {item.next_airing_episode ? (
          <div className="absolute bottom-2 inset-x-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-medium text-emerald-400 flex items-center justify-between z-10 font-mono tabular-nums">
            <span>Ep {item.next_airing_episode.episode}</span>
            <span className="text-[10px] text-zinc-300">
              {item.next_airing_episode.airingAt - Math.floor(Date.now() / 1000) <= 0
                ? 'Airing'
                : item.next_airing_episode.airingAt - Math.floor(Date.now() / 1000) > 86400
                  ? `${Math.floor((item.next_airing_episode.airingAt - Math.floor(Date.now() / 1000)) / 86400)}d`
                  : `${Math.floor((item.next_airing_episode.airingAt - Math.floor(Date.now() / 1000)) / 3600)}h`}
            </span>
          </div>
        ) : item.anilist_id ? (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
            <span className="bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-semibold text-zinc-200 font-mono">
              SUB
            </span>
            {item.is_dubbed && (
              <span className="bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-semibold text-amber-300 font-mono">
                DUB
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Metadata */}
      <div className="mt-2.5 px-0.5">
        <h3 className="text-[13px] sm:text-sm font-semibold truncate text-[var(--text-main)] group-hover:text-[rgb(var(--primary-color))] transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-0.5">
          {year && <span className="font-mono tabular-nums">{year}</span>}
          {year && <span aria-hidden="true">·</span>}
          <span>{mediaLabel}</span>
        </div>
      </div>
    </div>
  );
};
