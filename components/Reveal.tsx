import React from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Kept for API compatibility */
  delay?: number;
  as?: 'div' | 'section' | 'article';
}

export const Reveal: React.FC<RevealProps> = ({ children, className = '', as = 'div' }) => {
  const Tag = as as any;
  return <Tag className={className}>{children}</Tag>;
};
