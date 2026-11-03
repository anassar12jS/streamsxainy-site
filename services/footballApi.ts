import { LeagueTable, LeagueTeamStanding, LEAGUE_TABLES } from '../data/sportsStandings';
import { getTeamLogoUrl } from '../data/clubLogos';
import { LeagueTopScorer, SportsMatch } from '../types';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/v2/sports/soccer';
const ESPN_SCOREBOARD_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Map StreamHub league IDs to Football-Data.org competition codes
export const FD_LEAGUE_MAP: Record<string, string> = {
  laliga: 'PD',
  pl: 'PL',
  seriea: 'SA',
  bundesliga: 'BL1',
  ligue1: 'FL1',
  ucl: 'CL'
};

// Map StreamHub league IDs to ESPN soccer slugs (unlimited fallback)
export const ESPN_LEAGUE_MAP: Record<string, string> = {
  laliga: 'esp.1',
  pl: 'eng.1',
  seriea: 'ita.1',
  bundesliga: 'ger.1',
  ligue1: 'fra.1',
  ucl: 'uefa.champions'
};

export interface LiveStandingsResult {
  leagueId: string;
  name: string;
  season: string;
  isLive: boolean;
  standings: LeagueTeamStanding[];
  lastUpdated: number;
  source: 'football-data.org' | 'espn' | 'botola-inwi' | 'curated-2026/2027';
}

// Memory caches
const standingsMemoryCache: Record<string, { data: LiveStandingsResult; timestamp: number }> = {};
const scorersMemoryCache: Record<string, { data: LeagueTopScorer[]; timestamp: number }> = {};
let liveMatchesCache: { data: SportsMatch[]; timestamp: number } | null = null;

const STANDINGS_CACHE_TTL = 15 * 60 * 1000; // 15 mins
const SCORERS_CACHE_TTL = 30 * 60 * 1000;   // 30 mins
const MATCHES_CACHE_TTL = 2 * 60 * 1000;    // 2 mins

/**
 * Fetch from the same-origin Vercel proxy; credentials stay on the server.
 */
const fetchFootballData = async (endpoint: string): Promise<any> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`/api/football-data${endpoint}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error(`Football-Data endpoint ${endpoint} failed with status ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Parse Football-Data.org standings into clean LeagueTeamStanding[]
 */
const parseFootballDataStandings = (data: any, fallbackTable: LeagueTable): LeagueTeamStanding[] => {
  const table = data?.standings?.[0]?.table;
  if (!Array.isArray(table) || table.length === 0) return [];

  return table.map((item: any, idx: number) => {
    const rank = item.position || idx + 1;
    const teamName = item.team?.shortName || item.team?.name || 'Club';
    
    // Resolve logo with fallback
    let logo = item.team?.crest || getTeamLogoUrl(teamName);
    if (!logo && fallbackTable.standings) {
      const match = fallbackTable.standings.find(s => 
        s.team.toLowerCase().includes(teamName.toLowerCase()) || 
        teamName.toLowerCase().includes(s.team.toLowerCase())
      );
      if (match?.logo) logo = match.logo;
    }

    // Determine tournament / relegation zone
    let zone: 'ucl' | 'uel' | 'conf' | 'relegation' | undefined = undefined;
    if (rank <= 4) zone = 'ucl';
    else if (rank === 5) zone = 'uel';
    else if (rank === 6) zone = 'conf';
    else if (rank >= (table.length - 2)) zone = 'relegation';

    // Parse recent form (e.g. "W,D,L,W,W")
    let form: ('W' | 'D' | 'L')[] = ['W', 'D', 'W', 'W', 'D'];
    if (item.form && typeof item.form === 'string') {
      const letters = item.form.replace(/[^WDL]/g, '').split('');
      if (letters.length > 0) {
        form = letters.slice(-5) as ('W' | 'D' | 'L')[];
      }
    }

    return {
      pos: rank,
      team: teamName,
      logo: logo || '',
      played: item.playedGames || 0,
      won: item.won || 0,
      drawn: item.draw || 0,
      lost: item.lost || 0,
      gf: item.goalsFor || 0,
      ga: item.goalsAgainst || 0,
      gd: item.goalDifference || 0,
      points: item.points || 0,
      form,
      zone
    };
  });
};

/**
 * Parse ESPN Open Sports Standings (Unlimited requests fallback)
 */
const fetchEspnStandings = async (slug: string, fallbackTable: LeagueTable): Promise<LeagueTeamStanding[]> => {
  const url = `${ESPN_API_BASE}/${slug}/standings`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);

  if (!res.ok) throw new Error(`ESPN standings failed for ${slug}`);
  const data = await res.json();
  const entries = data?.children?.[0]?.standings?.entries;
  if (!Array.isArray(entries) || entries.length === 0) return [];

  return entries.map((entry: any, index: number) => {
    const statsMap: Record<string, number> = {};
    if (Array.isArray(entry.stats)) {
      entry.stats.forEach((s: any) => {
        statsMap[s.name] = parseInt(s.displayValue || '0', 10);
      });
    }

    const rank = entry.rank || statsMap.rank || index + 1;
    const teamName = entry.team?.displayName || entry.team?.name || 'Club';
    let logo = entry.team?.logo || getTeamLogoUrl(teamName);

    let zone: 'ucl' | 'uel' | 'conf' | 'relegation' | undefined = undefined;
    if (rank <= 4) zone = 'ucl';
    else if (rank === 5) zone = 'uel';
    else if (rank === 6) zone = 'conf';
    else if (rank >= (entries.length - 2)) zone = 'relegation';

    let form: ('W' | 'D' | 'L')[] = ['W', 'D', 'W', 'W', 'D'];
    if (entry.form && typeof entry.form === 'string') {
      form = entry.form.split('').map((c: string) => c === 'W' ? 'W' : c === 'D' ? 'D' : 'L').slice(-5);
    }

    return {
      pos: rank,
      team: teamName,
      logo: logo || '',
      played: statsMap.gamesPlayed || 0,
      won: statsMap.wins || 0,
      drawn: statsMap.ties || 0,
      lost: statsMap.losses || 0,
      gf: statsMap.pointsFor || 0,
      ga: statsMap.pointsAgainst || 0,
      gd: statsMap.pointDifferential || 0,
      points: statsMap.points || 0,
      form,
      zone
    };
  });
};

/**
 * Primary function: Get live league standings with 3-tier resilience
 */
export const getLiveLeagueStandings = async (leagueId: string): Promise<LiveStandingsResult> => {
  const fallbackTable = LEAGUE_TABLES.find(l => l.id === leagueId) || LEAGUE_TABLES[0];

  // Botola has no live standings provider configured yet; identify the bundled table as a snapshot.
  if (leagueId === 'botola') {
    return {
      leagueId: 'botola',
      name: fallbackTable.name,
      season: fallbackTable.season,
      isLive: false,
      standings: fallbackTable.standings,
      lastUpdated: 0,
      source: 'curated-2026/2027'
    };
  }

  // 1. Check Memory Cache
  const memCached = standingsMemoryCache[leagueId];
  if (memCached && Date.now() - memCached.timestamp < STANDINGS_CACHE_TTL) {
    return memCached.data;
  }

  // 2. Check LocalStorage Cache
  try {
    const lsKey = `streamhub_standings_${leagueId}`;
    const lsItem = localStorage.getItem(lsKey);
    if (lsItem) {
      const parsed = JSON.parse(lsItem);
      if (parsed && Date.now() - parsed.lastUpdated < STANDINGS_CACHE_TTL) {
        standingsMemoryCache[leagueId] = { data: parsed, timestamp: parsed.lastUpdated };
        return parsed;
      }
    }
  } catch {
    // continue
  }

  const fdCode = FD_LEAGUE_MAP[leagueId];
  const espnSlug = ESPN_LEAGUE_MAP[leagueId];

  // 3. Tier 1: Football-Data.org (Official European Data with User Token)
  if (fdCode) {
    try {
      const data = await fetchFootballData(`/competitions/${fdCode}/standings`);
      const standings = parseFootballDataStandings(data, fallbackTable);
      
      if (standings.length > 0) {
        const result: LiveStandingsResult = {
          leagueId,
          name: data.competition?.name || fallbackTable.name,
          season: data.season ? `${data.season.startDate?.slice(0, 4)}/${data.season.endDate?.slice(0, 4)}` : '2026/2027',
          isLive: true,
          standings,
          lastUpdated: Date.now(),
          source: 'football-data.org'
        };

        standingsMemoryCache[leagueId] = { data: result, timestamp: Date.now() };
        try {
          localStorage.setItem(`streamhub_standings_${leagueId}`, JSON.stringify(result));
        } catch { /* ignore */ }

        return result;
      }
    } catch (e) {
      console.warn(`[FootballAPI] Football-Data standings failed for ${leagueId}, falling back to ESPN:`, e);
    }
  }

  // 4. Tier 2: ESPN Open Sports API (Unlimited Free Real-Time Standings)
  if (espnSlug) {
    try {
      const espnStandings = await fetchEspnStandings(espnSlug, fallbackTable);
      if (espnStandings.length > 0) {
        const result: LiveStandingsResult = {
          leagueId,
          name: fallbackTable.name,
          season: '2026/2027',
          isLive: true,
          standings: espnStandings,
          lastUpdated: Date.now(),
          source: 'espn'
        };

        standingsMemoryCache[leagueId] = { data: result, timestamp: Date.now() };
        try {
          localStorage.setItem(`streamhub_standings_${leagueId}`, JSON.stringify(result));
        } catch { /* ignore */ }

        return result;
      }
    } catch (e) {
      console.warn(`[FootballAPI] ESPN standings failed for ${espnSlug}:`, e);
    }
  }

  // 5. Tier 3: Curated 2026/2027 Verified Fallback
  return {
    leagueId,
    name: fallbackTable.name,
    season: fallbackTable.season || '2026/2027',
    isLive: false,
    standings: fallbackTable.standings,
    lastUpdated: 0,
    source: 'curated-2026/2027'
  };
};

/**
 * Get top scorers for a competition
 */
export const getLeagueTopScorers = async (leagueId: string): Promise<LeagueTopScorer[]> => {
  if (leagueId === 'botola') return []; // no live Botola scorer source is configured

  const fdCode = FD_LEAGUE_MAP[leagueId];
  if (!fdCode) return [];

  const memCached = scorersMemoryCache[leagueId];
  if (memCached && Date.now() - memCached.timestamp < SCORERS_CACHE_TTL) {
    return memCached.data;
  }

  try {
    const data = await fetchFootballData(`/competitions/${fdCode}/scorers?limit=10`);
    if (Array.isArray(data.scorers) && data.scorers.length > 0) {
      const parsed: LeagueTopScorer[] = data.scorers.map((s: any, idx: number) => ({
        rank: idx + 1,
        name: s.player?.name || 'Player',
        team: s.team?.name || s.team?.shortName || '',
        teamLogo: s.team?.crest || getTeamLogoUrl(s.team?.name || ''),
        goals: s.goals || 0,
        assists: s.assists || 0,
        playedGames: s.playedGames || 0
      }));

      scorersMemoryCache[leagueId] = { data: parsed, timestamp: Date.now() };
      return parsed;
    }
  } catch (e) {
    console.warn(`[FootballAPI] Top scorers fetch failed for ${leagueId}:`, e);
  }

  return [];
};

/**
/**
 * Helper to format date as YYYYMMDD for ESPN API
 */
const toEspnDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

/**
 * Fetch live soccer scoreboards & multi-day fixtures from ESPN
 * (unlimited free requests, live clocks, real scores, goal events & weekend schedules)
 */
export const fetchEspnLiveScoreboard = async (): Promise<SportsMatch[]> => {
  const primaryLeagues = [
    'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions', 'uefa.europa'
  ];
  const secondaryLeagues = [
    'ned.1', 'por.1', 'tur.1', 'eng.2', 'esp.2', 'uefa.europa.conf', 'usa.1', 'bra.1', 'mex.1'
  ];

  const now = new Date();
  const todayStr = toEspnDateStr(now);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const tomorrowStr = toEspnDateStr(tomorrow);
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  const yesterdayStr = toEspnDateStr(yesterday);

  // Determine next Friday, Saturday, Sunday for key European league matchdays
  const weekendDateStrings: string[] = [];
  for (let offset = 2; offset <= 6; offset++) {
    const futureDate = new Date(Date.now() + offset * 24 * 3600 * 1000);
    const dayOfWeek = futureDate.getDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      weekendDateStrings.push(toEspnDateStr(futureDate));
    }
  }

  // Build target query requests:
  // 1. Current round / live for all leagues (no date param)
  // 2. Yesterday's results for top European leagues (scores & stats)
  // 3. Tomorrow's upcoming fixtures for top European leagues
  // 4. Weekend matchdays for primary leagues
  const requests: { slug: string; dateParam?: string }[] = [];

  // All leagues get their active round
  [...primaryLeagues, ...secondaryLeagues].forEach(slug => {
    requests.push({ slug });
  });

  // Top leagues get yesterday, tomorrow, and weekend fixtures
  primaryLeagues.forEach(slug => {
    requests.push({ slug, dateParam: yesterdayStr });
    requests.push({ slug, dateParam: tomorrowStr });
    weekendDateStrings.slice(0, 2).forEach(dateParam => {
      requests.push({ slug, dateParam });
    });
  });

  const matches: SportsMatch[] = [];
  const seenEventIds = new Set<string>();

  const promises = requests.map(async ({ slug, dateParam }) => {
    try {
      const url = dateParam
        ? `${ESPN_SCOREBOARD_BASE}/${slug}/scoreboard?dates=${dateParam}`
        : `${ESPN_SCOREBOARD_BASE}/${slug}/scoreboard`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;

      const data = await res.json();
      const events = data?.events;
      if (!Array.isArray(events)) return;
      const competition = data?.leagues?.[0]?.name || slug.replace('.', ' ');

      for (const ev of events) {
        if (!ev.id || seenEventIds.has(String(ev.id))) continue;
        seenEventIds.add(String(ev.id));

        const comp = ev.competitions?.[0];
        if (!comp || !Array.isArray(comp.competitors) || comp.competitors.length < 2) continue;

        const homeComp = comp.competitors.find((c: any) => c.homeAway === 'home') || comp.competitors[0];
        const awayComp = comp.competitors.find((c: any) => c.homeAway === 'away') || comp.competitors[1];

        const homeName = homeComp.team?.shortDisplayName || homeComp.team?.displayName || homeComp.team?.name || 'Home';
        const awayName = awayComp.team?.shortDisplayName || awayComp.team?.displayName || awayComp.team?.name || 'Away';

        const homeLogo = homeComp.team?.logo || getTeamLogoUrl(homeName);
        const awayLogo = awayComp.team?.logo || getTeamLogoUrl(awayName);

        const state = comp.status?.type?.state; // 'in' = live, 'post' = finished, 'pre' = scheduled
        const detail = comp.status?.type?.detail || '';
        const isFinished = state === 'post' || detail === 'FT' || detail.toLowerCase().includes('final') || comp.status?.type?.completed === true;
        const isLive = !isFinished && state === 'in';

        let score = undefined;
        if (isLive || isFinished || (homeComp.score !== undefined && awayComp.score !== undefined)) {
          const hScore = parseInt(homeComp.score || '0', 10);
          const aScore = parseInt(awayComp.score || '0', 10);
          score = {
            home: isNaN(hScore) ? 0 : hScore,
            away: isNaN(aScore) ? 0 : aScore
          };
        }

        const date = new Date(ev.date).getTime();
        const displayClock = isFinished ? (detail || 'FT') : (comp.status?.displayClock || detail || (isLive ? 'LIVE' : undefined));

        // Parse real goal incidents and cards
        const matchEvents: any[] = [];
        if (Array.isArray(comp.details)) {
          comp.details.forEach((det: any) => {
            const text = (det.type?.text || '').toLowerCase();
            const isGoal = text.includes('goal');
            const isCard = text.includes('card');
            const minuteVal = parseInt(det.clock?.displayValue || '0', 10) || 0;
            const athlete = det.athletesInvolved?.[0]?.displayName || 'Incident';
            const isHomeTeam = String(det.team?.id) === String(homeComp.team?.id);

            if (isGoal) {
              matchEvents.push({
                minute: minuteVal,
                type: 'goal' as const,
                player: athlete,
                team: isHomeTeam ? 'home' as const : 'away' as const,
                description: det.type?.text || 'Goal'
              });
            } else if (isCard) {
              matchEvents.push({
                minute: minuteVal,
                type: text.includes('red') ? 'red_card' as const : 'yellow_card' as const,
                player: athlete,
                team: isHomeTeam ? 'home' as const : 'away' as const,
                description: det.type?.text
              });
            }
          });
        }

        matches.push({
          id: `espn-${ev.id}`,
          title: `${homeName} vs ${awayName}`,
          date,
          category: 'football',
          competition,
          venue: comp.venue?.fullName || ev.venue?.fullName,
          venueCity: comp.venue?.address?.city || ev.venue?.address?.city,
          teams: {
            home: { name: homeName, logo: homeLogo },
            away: { name: awayName, logo: awayLogo }
          },
          sources: [],
          popular: ['eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions', 'uefa.europa', 'usa.1', 'bra.1', 'mex.1'].includes(slug),
          score,
          status: isFinished ? 'FINISHED' : (isLive ? 'IN_PLAY' : 'SCHEDULED'),
          minute: displayClock,
          events: matchEvents
        });
      }
    } catch {
      // ignore
    }
  });

  await Promise.allSettled(promises);

  // Expand live coverage across popular sports with ESPN's free public scoreboards.
  const multiSportUrls = [
    { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', cat: 'basketball' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard', cat: 'american football' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', cat: 'american football' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard', cat: 'ice hockey' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard', cat: 'baseball' },
    { url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard', cat: 'basketball' }
  ];

  const extraPromises = multiSportUrls.map(async ({ url, cat }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;

      const data = await res.json();
      const events = data?.events;
      if (!Array.isArray(events)) return;
      const competition = data?.leagues?.[0]?.name || cat;

      for (const ev of events) {
        const comp = ev.competitions?.[0];
        if (!comp || !Array.isArray(comp.competitors) || comp.competitors.length < 2) continue;

        const homeComp = comp.competitors.find((c: any) => c.homeAway === 'home') || comp.competitors[0];
        const awayComp = comp.competitors.find((c: any) => c.homeAway === 'away') || comp.competitors[1];

        const homeName = homeComp.team?.displayName || homeComp.team?.name || 'Home';
        const awayName = awayComp.team?.displayName || awayComp.team?.name || 'Away';
        const homeLogo = homeComp.team?.logo || getTeamLogoUrl(homeName);
        const awayLogo = awayComp.team?.logo || getTeamLogoUrl(awayName);

        const state = comp.status?.type?.state;
        const detail = comp.status?.type?.detail || '';
        const isFinished = state === 'post' || detail === 'Final' || comp.status?.type?.completed === true;
        const isLive = !isFinished && state === 'in';

        let score = undefined;
        if (isLive || isFinished || (homeComp.score !== undefined && awayComp.score !== undefined)) {
          const hScore = parseInt(homeComp.score || '0', 10);
          const aScore = parseInt(awayComp.score || '0', 10);
          score = {
            home: isNaN(hScore) ? 0 : hScore,
            away: isNaN(aScore) ? 0 : aScore
          };
        }

        const date = new Date(ev.date).getTime();
        const displayClock = isFinished ? (detail || 'Final') : (comp.status?.displayClock || detail || (isLive ? 'LIVE' : undefined));

        matches.push({
          id: `espn-${ev.id}`,
          title: `${homeName} vs ${awayName}`,
          date,
          category: cat,
          competition,
          venue: comp.venue?.fullName || ev.venue?.fullName,
          venueCity: comp.venue?.address?.city || ev.venue?.address?.city,
          teams: {
            home: { name: homeName, logo: homeLogo },
            away: { name: awayName, logo: awayLogo }
          },
          sources: [],
          popular: /\/(?:basketball\/nba|football\/nfl|hockey\/nhl|baseball\/mlb)\//.test(url),
          score,
          status: isFinished ? 'FINISHED' : (isLive ? 'IN_PLAY' : 'SCHEDULED'),
          minute: displayClock
        });
      }
    } catch {
      // ignore
    }
  });

  await Promise.allSettled(extraPromises);
  return matches;
};

/**
 * Get live matches across subscribed competitions with real-time scores
 */
export const getLiveMatchesFromApi = async (): Promise<SportsMatch[]> => {
  if (liveMatchesCache && Date.now() - liveMatchesCache.timestamp < MATCHES_CACHE_TTL) {
    return liveMatchesCache.data;
  }

  const resultMatches: SportsMatch[] = [];

  // 1. Fetch ESPN live scoreboards (unlimited, live clock, real scores)
  try {
    const espnMatches = await fetchEspnLiveScoreboard();
    if (espnMatches.length > 0) {
      resultMatches.push(...espnMatches);
    }
  } catch (e) {
    console.warn('[FootballAPI] ESPN live matches failed:', e);
  }

  // 2. Try Football-Data /v4/matches
    try {
      const data = await fetchFootballData('/matches');
      if (Array.isArray(data.matches)) {
        data.matches.forEach((m: any) => {
          const homeName = m.homeTeam?.name || m.homeTeam?.shortName || 'Home';
          const awayName = m.awayTeam?.name || m.awayTeam?.shortName || 'Away';
          const date = new Date(m.utcDate).getTime();
          const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'LIVE';

          resultMatches.push({
            id: `fd-${m.id}`,
            title: `${homeName} vs ${awayName}`,
            date,
            category: 'football',
            teams: {
              home: {
                name: homeName,
                logo: m.homeTeam?.crest || getTeamLogoUrl(homeName)
              },
              away: {
                name: awayName,
                logo: m.awayTeam?.crest || getTeamLogoUrl(awayName)
              }
            },
            sources: [],
            popular: m.competition?.code === 'PD' || m.competition?.code === 'PL' || m.competition?.code === 'CL',
            competition: m.competition?.name,
            venue: m.venue,
            score: (isLive || m.status === 'FINISHED') ? {
              home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0,
              away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0
            } : undefined,
            status: m.status
          });
        });
      }
    } catch (e) {
      console.warn('[FootballAPI] Live matches fetch failed:', e);
    }

  if (resultMatches.length > 0) {
    liveMatchesCache = { data: resultMatches, timestamp: Date.now() };
  }

  return resultMatches;
};
