import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = "", 
  width, 
  height, 
  variant = 'rectangular' 
}) => {
  const baseClasses = "skeleton-loader bg-[var(--bg-hover)] animate-pulse";
  const variantClasses = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-xl",
  };

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`} 
      style={style}
    />
  );
};

export const PosterSkeleton = () => (
    <div className="flex flex-col gap-2">
        <Skeleton className="aspect-[2/3] w-full" />
        <Skeleton variant="text" height={16} width="80%" />
        <Skeleton variant="text" height={12} width="40%" />
    </div>
);

export const RowSkeleton = () => (
    <div className="mb-12">
        <Skeleton variant="text" width={200} height={32} className="mb-5 ml-4" />
        <div className="flex gap-4 px-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="min-w-[160px] md:min-w-[200px]">
                    <PosterSkeleton />
                </div>
            ))}
        </div>
    </div>
);