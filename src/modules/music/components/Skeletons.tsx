import React from 'react';

/** Horizontal shelf skeleton — title bar + row of square cards, matches MediaShelf layout */
export const ShelfSkeleton: React.FC<{ cards?: number }> = ({ cards = 6 }) => (
  <div className="space-y-3 animate-pulse">
    <div className="h-5 w-40 rounded-lg bg-white/10" />
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="shrink-0 w-36 sm:w-44">
          <div className="aspect-square rounded-xl bg-white/[0.07] mb-2.5" />
          <div className="h-3.5 w-3/4 rounded bg-white/[0.07] mb-1.5" />
          <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
        </div>
      ))}
    </div>
  </div>
);

/** Stacked shelf skeletons for the home feed */
export const FeedSkeleton: React.FC = () => (
  <div className="space-y-10 py-2">
    <ShelfSkeleton cards={7} />
    <ShelfSkeleton cards={6} />
    <ShelfSkeleton cards={8} />
  </div>
);

/** Track-list skeleton — matches TrackRow layout (small square art + two text lines + duration) */
export const TrackListSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <div className="space-y-1 animate-pulse py-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-2 py-2.5">
        <div className="w-11 h-11 rounded-lg bg-white/[0.07] shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3.5 w-2/5 rounded bg-white/[0.08]" />
          <div className="h-3 w-1/4 rounded bg-white/[0.05]" />
        </div>
        <div className="h-3 w-10 rounded bg-white/[0.05]" />
      </div>
    ))}
  </div>
);

/** Album/playlist grid skeleton — square cards with text below */
export const CardGridSkeleton: React.FC<{ count?: number; cols?: string }> = ({
  count = 12,
  cols = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
}) => (
  <div className={`grid ${cols} gap-4 animate-pulse`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i}>
        <div className="aspect-square rounded-xl bg-white/[0.07] mb-2.5" />
        <div className="h-3.5 w-3/4 rounded bg-white/[0.08] mb-1.5" />
        <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
      </div>
    ))}
  </div>
);
