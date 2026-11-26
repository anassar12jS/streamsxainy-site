import React, { useState, useEffect, useMemo } from 'react';
import { getTeamLogoUrl, getTeamBrand } from '../data/clubLogos';
import {
  loadFootballLogosIndex,
  resolveFootballLogoSync,
  getLeagueLogoUrl,
  subscribeFootballLogosReady,
  isNonFootballSport,
} from '../services/footballLogos';

export interface TeamLogoProps {
  name: string;
  logo?: string;
  competition?: string;
  category?: string;
  className?: string;
  size?: string;
  kind?: 'team' | 'league' | 'any';
}

export const TeamLogo: React.FC<TeamLogoProps> = React.memo(
  ({
    name,
    logo,
    competition,
    category,
    className = 'w-10 h-10',
    size = 'text-xs',
    kind = 'team',
  }) => {
    const [logosRevision, setLogosRevision] = useState(0);

    useEffect(() => {
      if (isNonFootballSport(category)) return;
      void loadFootballLogosIndex();
      return subscribeFootballLogosReady(() => {
        setLogosRevision((v) => v + 1);
      });
    }, [category]);

    const footballLogosUrl = useMemo(() => {
      if (!name || isNonFootballSport(category)) return undefined;
      return resolveFootballLogoSync(name, { competition, category, kind });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, competition, category, kind, logosRevision]);

    const fallbackUrl = useMemo(() => {
      return getTeamLogoUrl(name, logo, {
        competition,
        category,
        preferFootballLogos: false,
      });
    }, [name, logo, competition, category]);

    const primaryUrl = footballLogosUrl || fallbackUrl;

    const [currentSrc, setCurrentSrc] = useState(primaryUrl);
    const [triedFallback, setTriedFallback] = useState(false);
    const [retriedWithProxy, setRetriedWithProxy] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);

    const brand = useMemo(() => getTeamBrand(name), [name]);

    const initials = useMemo(() => {
      const parts = (name || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return 'FC';
      if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
      return parts.map((n) => n[0]).slice(0, 3).join('').toUpperCase();
    }, [name]);

    useEffect(() => {
      setCurrentSrc(primaryUrl);
      setTriedFallback(false);
      setRetriedWithProxy(false);
      setImgFailed(!primaryUrl);
    }, [primaryUrl]);

    const handleImgError = () => {
      // 1. If football-logos.cc URL failed (e.g. missing/blocked), fall back to API/verified logo
      if (!triedFallback && fallbackUrl && currentSrc !== fallbackUrl) {
        setTriedFallback(true);
        setRetriedWithProxy(false);
        setCurrentSrc(fallbackUrl);
        return;
      }

      // 2. Retry non-football-logos.cc external images via wsrv.nl
      if (
        !retriedWithProxy &&
        currentSrc &&
        currentSrc.startsWith('http') &&
        !currentSrc.includes('wsrv.nl') &&
        !currentSrc.includes('football-logos.cc')
      ) {
        setRetriedWithProxy(true);
        setCurrentSrc(`https://wsrv.nl/?url=${encodeURIComponent(currentSrc)}&w=96&output=png`);
        return;
      }

      setImgFailed(true);
    };

    if (currentSrc && !imgFailed) {
      return (
        <div
          className={`relative shrink-0 flex items-center justify-center p-1 bg-[var(--bg-main)]/90 rounded-xl border border-[var(--border-subtle)] shadow-sm ${className}`}
        >
          <img
            src={currentSrc}
            alt={name}
            className="w-full h-full object-contain drop-shadow-md transition-transform hover:scale-110"
            onError={handleImgError}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    return (
      <div
        className={`rounded-xl flex flex-col items-center justify-center font-black shrink-0 shadow-md border border-white/20 select-none overflow-hidden relative ${className}`}
        style={{
          background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.secondary} 100%)`,
          color: brand.primary === '#FFFFFF' ? '#0f172a' : '#FFFFFF',
        }}
        title={name}
      >
        <span className={`${size} tracking-tighter drop-shadow-sm`}>{initials}</span>
      </div>
    );
  }
);

export interface LeagueLogoProps {
  name?: string;
  fallbackEmoji?: string;
  className?: string;
  emojiClassName?: string;
}

export const LeagueLogo: React.FC<LeagueLogoProps> = React.memo(
  ({ name, fallbackEmoji = '🏆', className = 'w-5 h-5', emojiClassName = 'text-base leading-none' }) => {
    const [logosRevision, setLogosRevision] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      void loadFootballLogosIndex();
      return subscribeFootballLogosReady(() => {
        setLogosRevision((v) => v + 1);
      });
    }, []);

    const leagueUrl = useMemo(() => {
      if (!name) return undefined;
      return getLeagueLogoUrl(name);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, logosRevision]);

    useEffect(() => {
      setFailed(false);
    }, [leagueUrl]);

    if (leagueUrl && !failed) {
      return (
        <span
          className={`inline-flex items-center justify-center shrink-0 rounded-md bg-white/90 p-0.5 shadow-sm ${className}`}
        >
          <img
            src={leagueUrl}
            alt={name || 'League'}
            className="w-full h-full object-contain"
            onError={() => setFailed(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </span>
      );
    }

    return <span className={`shrink-0 inline-flex items-center justify-center ${emojiClassName}`}>{fallbackEmoji}</span>;
  }
);
