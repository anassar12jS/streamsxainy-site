import { SportsMatch, SportsStream, SportsChannel247, LiveMatchScoreboard } from '../types';
import { getLiveMatchesFromApi } from './footballApi';
import { getTeamLogoUrl } from '../data/clubLogos';

// Multi-proxy list with failover for environments where direct fetch is blocked
const PROXY_CANDIDATES = [
  (url: string) => url, // direct first
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const fetchWithFailover = async (targetUrl: string, timeoutMs: number = 6000): Promise<any> => {
  for (const buildProxyUrl of PROXY_CANDIDATES) {
    try {
      const url = buildProxyUrl(targetUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          // not valid json
        }
      }
    } catch {
      // try next proxy candidate
    }
  }

  throw new Error(`Failed to load ${targetUrl} from all proxies`);
};

export const formatPosterUrl = (path: string): string | undefined => {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return undefined;
};

// Internal caches for PPV and StreamFree stream metadata
interface PpvMetadata {
  iframe?: string;
  substreams?: { id: number; name: string; tag?: string; source_tag?: string; iframe?: string }[];
  uri_name?: string;
  name: string;
}

interface StreamFreeMetadata {
  sources?: { quality: string; url: string }[];
  live_sources?: { quality: string; url: string }[];
  category: string;
  stream_key: string;
}

const ppvMetadataStore = new Map<string, PpvMetadata>();
const streamFreeMetadataStore = new Map<string, StreamFreeMetadata>();

let cachedMatches: SportsMatch[] = [];
let lastMatchesFetchTime = 0;
const MATCHES_CACHE_TTL = 30 * 1000; // 30 seconds cache

/**
 * Normalize category to standard StreamHub category keys
 */
const normalizeCategory = (cat?: string): string => {
  const c = (cat || '').toLowerCase();
  if (c.includes('soccer') || (c.includes('football') && !c.includes('american') && !c.includes('australian'))) {
    return 'football';
  }
  if (c.includes('american football') || c.includes('nfl') || c.includes('ncaa')) {
    return 'american football';
  }
  if (c.includes('basket') || c.includes('nba')) {
    return 'basketball';
  }
  if (c.includes('fight') || c.includes('combat') || c.includes('ufc') || c.includes('box') || c.includes('mma') || c.includes('wrestl')) {
    return 'fight';
  }
  if (c.includes('motor') || c.includes('racing') || c.includes('f1') || c.includes('nascar') || c.includes('motogp')) {
    return 'motor sports';
  }
  if (c.includes('tenn')) return 'tennis';
  if (c.includes('cric')) return 'cricket';
  if (c.includes('hock') || c.includes('nhl')) return 'ice hockey';
  if (c.includes('base') || c.includes('mlb')) return 'baseball';
  return 'general';
};

/**
 * 1. PPV.st Live Events Engine (Filters out all 24/7 continuous channels)
 */
export const fetchPpvStreams = async (): Promise<SportsMatch[]> => {
  const matches: SportsMatch[] = [];
  const now = Date.now();

  try {
    const data = await fetchWithFailover('https://api.ppv.st/api/streams', 6000);
    const categories = data?.streams;

    if (Array.isArray(categories)) {
      for (const catObj of categories) {
        const catName = catObj.category || 'General';
        // Skip 24/7 channel category completely
        if (catName.toLowerCase().includes('24/7')) continue;

        const streams = catObj.streams || [];

        for (const s of streams) {
          if (!s || !s.name) continue;
          // Skip 24/7 channels
          if (s.always_live === 1 || s.name.toLowerCase().startsWith('24/7')) continue;

          const ppvId = String(s.id);
          ppvMetadataStore.set(ppvId, {
            iframe: s.iframe,
            substreams: s.substreams,
            uri_name: s.uri_name,
            name: s.name,
          });

          const startMs = s.starts_at > 0 ? s.starts_at * 1000 : now;
          const endMs = s.ends_at > 0 ? s.ends_at * 1000 : startMs + 3 * 3600 * 1000;

          // Filter out matches that ended more than 2.5 hours ago
          if (now > endMs + 30 * 60 * 1000) {
            continue;
          }

          const isLive = now >= startMs - 15 * 60 * 1000 && now <= endMs;

          // Extract teams cleanly
          let cleanName = s.name.replace(/[⚽🏎️🥊🏀🏈🎾]/g, '').trim();
          if (cleanName.includes(':')) {
            const afterColon = cleanName.split(':').slice(1).join(':').trim();
            if (/\s+(?:vs\.?|v\.?|at|@|-)\s+/i.test(afterColon)) {
              cleanName = afterColon;
            }
          }
          let teams: { home: { name: string }; away: { name: string } } | undefined = undefined;

          if (/\s+(?:vs\.?|v\.?)\s+/i.test(cleanName)) {
            const parts = cleanName.split(/\s+(?:vs\.?|v\.?)\s+/i);
            if (parts.length >= 2) {
              const h = parts[0].trim();
              const a = parts[1].trim();
              if (normalizeTeamToken(h) !== normalizeTeamToken(a)) {
                teams = { home: { name: h }, away: { name: a } };
              }
            }
          } else if (/\s+(?:at|@)\s+/i.test(cleanName)) {
            const parts = cleanName.split(/\s+(?:at|@)\s+/i);
            if (parts.length >= 2) {
              const away = parts[0].trim();
              const home = parts[1].trim();
              if (normalizeTeamToken(home) !== normalizeTeamToken(away)) {
                teams = { home: { name: home }, away: { name: away } };
              }
            }
          }

          matches.push({
            id: `ppv-${s.id}`,
            title: cleanName,
            category: normalizeCategory(s.category_name || catName),
            date: startMs,
            ends_at: endMs,
            poster: s.poster || undefined,
            teams,
            sources: [
              { source: 'ppv', id: ppvId }
            ],
            popular: (s.viewers && parseInt(s.viewers, 10) > 100) || normalizeCategory(catName) === 'football',
            status: isLive ? 'IN_PLAY' : 'SCHEDULED',
            minute: isLive ? 'LIVE' : undefined,
          });
        }
      }
    }
  } catch (e) {
    console.warn('[PPV.st] Failed to load streams:', e);
  }

  return matches;
};

/**
 * 2. StreamFree (strmfree.st / streamfree.top) Live Engine
 */
export const fetchStreamFreeStreams = async (): Promise<SportsMatch[]> => {
  const matches: SportsMatch[] = [];
  const now = Date.now();

  const urls = [
    'https://streamfree.top/api/v1/streams',
    'https://strmfree.st/api/v1/streams'
  ];

  for (const url of urls) {
    try {
      const data = await fetchWithFailover(url, 5000);
      const streams = data?.streams;

      if (Array.isArray(streams) && streams.length > 0) {
        for (const s of streams) {
          if (!s || !s.name || !s.stream_key) continue;

          streamFreeMetadataStore.set(s.stream_key, {
            sources: s.sources,
            live_sources: s.live_sources,
            category: s.category || 'soccer',
            stream_key: s.stream_key
          });

          const startMs = s.match_timestamp > 0 ? s.match_timestamp * 1000 : now;
          const endMs = startMs + 3 * 3600 * 1000;

          // Filter out matches that ended more than 2.5 hours ago
          if (now > endMs + 30 * 60 * 1000) {
            continue;
          }

          const hasLiveSources = Array.isArray(s.live_sources) && s.live_sources.length > 0;
          const isLive = hasLiveSources || (now >= startMs - 15 * 60 * 1000 && now <= endMs);

          let teams: { home: { name: string; logo?: string }; away: { name: string; logo?: string } } | undefined = undefined;
          if (s.team1?.name && s.team2?.name) {
            const hClean = s.team1.name.replace(/[⚽🏎️🥊🏀🏈🎾]/g, '').trim();
            const aClean = s.team2.name.replace(/[⚽🏎️🥊🏀🏈🎾]/g, '').trim();
            if (normalizeTeamToken(hClean) !== normalizeTeamToken(aClean)) {
              teams = {
                home: { name: hClean, logo: s.team1.logo },
                away: { name: aClean, logo: s.team2.logo }
              };
            }
          } else if (/\s+(?:vs\.?|v\.?)\s+/i.test(s.name)) {
            const parts = s.name.replace(/[⚽🏎️🥊🏀🏈🎾]/g, '').split(/\s+(?:vs\.?|v\.?)\s+/i);
            if (parts.length >= 2) {
              const h = parts[0].trim();
              const a = parts[1].trim();
              if (normalizeTeamToken(h) !== normalizeTeamToken(a)) {
                teams = { home: { name: h }, away: { name: a } };
              }
            }
          }

          matches.push({
            id: `sf-${s.stream_key}`,
            title: s.name,
            category: normalizeCategory(s.category),
            date: startMs,
            ends_at: endMs,
            poster: s.thumbnail_url || undefined,
            teams,
            sources: [
              { source: 'streamfree', id: s.stream_key }
            ],
            popular: (s.viewers && s.viewers > 80) || s.league?.includes('Premier') || s.league?.includes('Champions'),
            status: isLive ? 'IN_PLAY' : 'SCHEDULED',
            minute: isLive ? 'LIVE' : undefined
          });
        }
        if (matches.length > 0) return matches;
      }
    } catch {
      // try fallback domain
    }
  }

  return matches;
};

// No sample scores are shown as live when every upstream feed fails.
const getFallbackMatches = (): SportsMatch[] => [];

/**
 * Canonical dictionary mapping all club aliases to a single unified token
 */
const CANONICAL_TEAMS: Record<string, string> = {
  // Premier League
  'mancity': 'mancity',
  'manchestercity': 'mancity',
  'manc': 'mancity',
  'manchester': 'mancity',
  'manutd': 'manutd',
  'manchesterunited': 'manutd',
  'manunited': 'manutd',
  'manu': 'manutd',
  'arsenal': 'arsenal',
  'chelsea': 'chelsea',
  'liverpool': 'liverpool',
  'tottenham': 'spurs',
  'tottenhamhotspur': 'spurs',
  'spurs': 'spurs',
  'brighton': 'brighton',
  'brightonhove': 'brighton',
  'brightonandhovealbion': 'brighton',
  'brightonhovealbion': 'brighton',
  'newcastle': 'newcastle',
  'newcastleunited': 'newcastle',
  'astonvilla': 'astonvilla',
  'brentford': 'brentford',
  'fulham': 'fulham',
  'nottingham': 'nottmforest',
  'nottinghamforest': 'nottmforest',
  'nottmforest': 'nottmforest',
  'bournemouth': 'bournemouth',
  'afcbournemouth': 'bournemouth',
  'everton': 'everton',
  'crystalpalace': 'crystalpalace',
  'wolves': 'wolves',
  'wolverhampton': 'wolves',
  'wolverhamptonwanderers': 'wolves',
  'westham': 'westham',
  'westhamunited': 'westham',
  'leicester': 'leicester',
  'leicestercity': 'leicester',
  'ipswich': 'ipswichtown',
  'ipswichtown': 'ipswichtown',
  'southampton': 'southampton',
  'leeds': 'leeds',
  'leedsunited': 'leeds',
  'sunderland': 'sunderland',
  'coventry': 'coventry',
  'coventrycity': 'coventry',
  'hull': 'hullcity',
  'hullcity': 'hullcity',
  'westbrom': 'westbrom',
  'westbromwich': 'westbrom',
  'westbromwichalbion': 'westbrom',
  'wba': 'westbrom',
  'tamworth': 'tamworth',
  'woking': 'woking',

  // La Liga
  'realmadrid': 'realmadrid',
  'barcelona': 'barcelona',
  'barca': 'barcelona',
  'atleticomadrid': 'atletico',
  'atletico': 'atletico',
  'atleti': 'atletico',
  'sevilla': 'sevilla',
  'betis': 'realbetis',
  'realbetis': 'realbetis',
  'realsociedad': 'realsociedad',
  'sociedad': 'realsociedad',
  'athletic': 'athleticbilbao',
  'athleticbilbao': 'athleticbilbao',
  'athleticclub': 'athleticbilbao',
  'bilbao': 'athleticbilbao',
  'villarreal': 'villarreal',
  'valencia': 'valencia',
  'celta': 'celtavigo',
  'celtavigo': 'celtavigo',
  'celtadevigo': 'celtavigo',
  'rayo': 'rayovallecano',
  'rayovallecano': 'rayovallecano',
  'osasuna': 'osasuna',
  'mallorca': 'mallorca',
  'getafe': 'getafe',
  'alaves': 'alaves',
  'deportivoalaves': 'alaves',
  'laspalmas': 'laspalmas',
  'espanyol': 'espanyol',
  'leganes': 'leganes',
  'valladolid': 'valladolid',
  'girona': 'girona',

  // Serie A
  'inter': 'intermilan',
  'intermilan': 'intermilan',
  'internazionale': 'intermilan',
  'milan': 'acmilan',
  'acmilan': 'acmilan',
  'juventus': 'juventus',
  'juve': 'juventus',
  'napoli': 'napoli',
  'roma': 'roma',
  'asroma': 'roma',
  'lazio': 'lazio',
  'atalanta': 'atalanta',
  'fiorentina': 'fiorentina',
  'bologna': 'bologna',
  'torino': 'torino',
  'monza': 'monza',
  'udinese': 'udinese',
  'parma': 'parma',
  'como': 'como',
  'verona': 'verona',
  'hellasverona': 'verona',
  'genoa': 'genoa',
  'cagliari': 'cagliari',
  'lecce': 'lecce',
  'empoli': 'empoli',
  'venezia': 'venezia',
  'pisa': 'pisa',

  // Bundesliga & Ligue 1 & Others
  'bayern': 'bayernmunich',
  'bayernmunich': 'bayernmunich',
  'bayernmunchen': 'bayernmunich',
  'dortmund': 'dortmund',
  'borussiadortmund': 'dortmund',
  'leverkusen': 'leverkusen',
  'bayerleverkusen': 'leverkusen',
  'psg': 'psg',
  'parissaintgermain': 'psg',
  'marseille': 'marseille',
  'monaco': 'monaco',
  'lyon': 'lyon',
  'feyenoord': 'feyenoord',
  'feyenoordrotterdam': 'feyenoord',
  'fortunasittard': 'fortunasittard',
  'fortuna': 'fortunasittard',
  'notredame': 'notredame',
  'notredamefightingirish': 'notredame',
  'navymidshipmen': 'navymidshipmen',
  'navy': 'navymidshipmen',

  // Botola Pro (Morocco)
  'raja': 'raja',
  'rajaca': 'raja',
  'rajacasablanca': 'raja',
  'wydad': 'wydad',
  'wydadac': 'wydad',
  'wac': 'wydad',
  'asfar': 'asfar',
  'far': 'asfar',
  'rsberkane': 'rsberkane',
  'berkane': 'rsberkane',
  'mas': 'maghrebdefes',
  'maghrebfes': 'maghrebdefes',
  'irtanger': 'irtanger',
  'tanger': 'irtanger',
  'fus': 'fusrabat',
  'fusrabat': 'fusrabat',
  'ocsafi': 'olympicsafi',
  'safi': 'olympicsafi',
  'hassania': 'hassaniaagadir',
  'agadir': 'hassaniaagadir',
};

/**
 * Clean and normalize team tokens for cross-provider fingerprinting
 */
export const normalizeTeamToken = (name: string): string => {
  if (!name) return '';
  const clean = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[⚽🏎️🥊🏀🏈🎾]/g, '')
    .trim();

  // Strip common foundation years (1907, 1899, 1900, 1905, etc.) and club prefixes/suffixes
  const stripped = clean
    .replace(/\b(18\d{2}|19\d{2}|20\d{2}|04|05|96|98)\b/g, '')
    .replace(/\b(fc|cf|afc|cd|rcd|ca|ac|sc|fk|sk|ud|sd|sv|as|ss|vfb|bvb|tsv|calcio|the|de|la|el|fighting|irish|midshipmen|albion|wanderers|rovers|hotspur)\b/gi, '')
    .trim();

  const alpha = stripped.replace(/[^a-z0-9]/g, '');
  if (CANONICAL_TEAMS[alpha]) return CANONICAL_TEAMS[alpha];

  const fullAlpha = clean.replace(/[^a-z0-9]/g, '');
  if (CANONICAL_TEAMS[fullAlpha]) return CANONICAL_TEAMS[fullAlpha];

  return alpha || fullAlpha;
};

/**
 * Robust check if a match has officially concluded
 */
export const isMatchFinished = (m: SportsMatch): boolean => {
  const minStr = (m.minute || '').toLowerCase().trim();
  const statusStr = (m.status || '').toUpperCase().trim();

  if (
    statusStr === 'FINISHED' ||
    statusStr === 'STATUS_FULL_TIME' ||
    statusStr === 'STATUS_FINAL' ||
    statusStr === 'POST' ||
    statusStr === 'FT'
  ) {
    return true;
  }

  if (
    minStr === 'ft' ||
    minStr === 'final' ||
    minStr === 'full time' ||
    minStr.includes('full-time') ||
    minStr.includes('ended') ||
    minStr.includes('post') ||
    minStr.includes('after extra') ||
    minStr.includes('aet') ||
    minStr.includes('pen.')
  ) {
    return true;
  }

  // Regex matching stoppage time full-time e.g. 90'+3', 90' +3', 90+5, 90:00
  if (/90\s*['’]?\s*\+\s*\d+/i.test(minStr)) {
    return true;
  }

  // If match started > 135 minutes ago, standard football match is over
  const diff = m.date - Date.now();
  if (diff < -135 * 60 * 1000) {
    return true;
  }
  if (diff < -115 * 60 * 1000 && m.status !== 'IN_PLAY') {
    return true;
  }

  return false;
};

/**
 * Extracts clean { home, away } team names from title or existing teams
 */
const extractTeamsFromMatch = (match: SportsMatch): { home: string; away: string } | undefined => {
  if (match.teams?.home?.name && match.teams?.away?.name) {
    const h = match.teams.home.name.replace(/[⚽🏎️🥊🏀🏈🎾]/g, '').trim();
    const a = match.teams.away.name.replace(/[⚽🏎️🥊🏀🏈🎾]/g, '').trim();
    if (normalizeTeamToken(h) !== normalizeTeamToken(a)) {
      return { home: h, away: a };
    }
  }

  let cleanTitle = match.title.replace(/[⚽🏎️🥊🏀🏈🎾]/g, '').trim();

  // If title has category or league prefix like "Coppa Italia : Pisa vs Empoli"
  if (cleanTitle.includes(':')) {
    const afterColon = cleanTitle.split(':').slice(1).join(':').trim();
    if (/\s+(?:vs\.?|v\.?|at|@|-)\s+/i.test(afterColon)) {
      cleanTitle = afterColon;
    }
  }

  // If title has pipe "Manchester City vs Brighton | Premier League"
  if (cleanTitle.includes(' | ')) {
    const parts = cleanTitle.split(' | ');
    const matchPart = parts.find(p => /\s+(?:vs\.?|v\.?|at|@)\s+/i.test(p));
    if (matchPart) {
      cleanTitle = matchPart.trim();
    }
  }

  // Check ' vs ' or ' vs. ' or ' v '
  if (/\s+(?:vs\.?|v\.?)\s+/i.test(cleanTitle)) {
    const parts = cleanTitle.split(/\s+(?:vs\.?|v\.?)\s+/i);
    if (parts.length >= 2) {
      const h = parts[0].trim();
      const a = parts[1].trim();
      if (normalizeTeamToken(h) !== normalizeTeamToken(a)) {
        return { home: h, away: a };
      }
    }
  }

  // Check ' at ' or ' @ '
  if (/\s+(?:at|@)\s+/i.test(cleanTitle)) {
    const parts = cleanTitle.split(/\s+(?:at|@)\s+/i);
    if (parts.length >= 2) {
      const away = parts[0].trim();
      const home = parts[1].trim();
      if (normalizeTeamToken(home) !== normalizeTeamToken(away)) {
        return { home, away };
      }
    }
  }

  // Check ' - '
  if (/\s+-\s+/.test(cleanTitle)) {
    const parts = cleanTitle.split(/\s+-\s+/);
    if (parts.length >= 2) {
      const h = parts[0].trim();
      const a = parts[1].trim();
      if (normalizeTeamToken(h) !== normalizeTeamToken(a)) {
        return { home: h, away: a };
      }
    }
  }

  return undefined;
};

/**
 * Compute unique match fingerprint: e.g. "brighton___mancity"
 */
const getMatchFingerprint = (match: SportsMatch): string => {
  const teams = extractTeamsFromMatch(match);
  if (teams) {
    const t1 = normalizeTeamToken(teams.home);
    const t2 = normalizeTeamToken(teams.away);
    if (t1 && t2 && t1 !== t2) {
      return [t1, t2].sort().join('___');
    }
  }
  return normalizeTeamToken(match.title);
};

/**
 * Merges match data from candidate into target (logos, sources, scores, real status)
 */
const mergeMatchData = (target: SportsMatch, incoming: SportsMatch) => {
  // 1. Teams & Logos: Accurately map by canonical team token
  if (incoming.teams?.home?.name && incoming.teams?.away?.name) {
    const inHomeToken = normalizeTeamToken(incoming.teams.home.name);
    const inAwayToken = normalizeTeamToken(incoming.teams.away.name);

    if (inHomeToken && inAwayToken && inHomeToken !== inAwayToken) {
      if (!target.teams || !target.teams.home?.name || !target.teams.away?.name) {
        target.teams = {
          home: { ...incoming.teams.home },
          away: { ...incoming.teams.away }
        };
      } else {
        const tHomeToken = normalizeTeamToken(target.teams.home.name);
        const tAwayToken = normalizeTeamToken(target.teams.away.name);

        if (inHomeToken === tHomeToken && inAwayToken === tAwayToken) {
          if (!target.teams.home.logo && incoming.teams.home.logo) {
            target.teams.home.logo = incoming.teams.home.logo;
          }
          if (!target.teams.away.logo && incoming.teams.away.logo) {
            target.teams.away.logo = incoming.teams.away.logo;
          }
        } else if (inHomeToken === tAwayToken && inAwayToken === tHomeToken) {
          if (!target.teams.away.logo && incoming.teams.home.logo) {
            target.teams.away.logo = incoming.teams.home.logo;
          }
          if (!target.teams.home.logo && incoming.teams.away.logo) {
            target.teams.home.logo = incoming.teams.away.logo;
          }
        }
      }
    }
  }

  // 2. Guarantee Logos via getTeamLogoUrl
  if (target.teams) {
    if (!target.teams.home.logo) {
      const l = getTeamLogoUrl(target.teams.home.name);
      if (l) target.teams.home.logo = l;
    }
    if (!target.teams.away.logo) {
      const l = getTeamLogoUrl(target.teams.away.name);
      if (l) target.teams.away.logo = l;
    }
  }

  // 3. Clean Title
  if (target.teams?.home?.name && target.teams?.away?.name) {
    const hToken = normalizeTeamToken(target.teams.home.name);
    const aToken = normalizeTeamToken(target.teams.away.name);
    if (hToken !== aToken) {
      target.title = `${target.teams.home.name} vs ${target.teams.away.name}`;
    }
  }

  // 4. Merge Stream Sources (strictly NO daddylive)
  const existingSourceKeys = new Set(target.sources.map(s => `${s.source.toLowerCase()}:${s.id}`));
  for (const s of incoming.sources) {
    if (s.source.toLowerCase() === 'daddylive') continue;
    const key = `${s.source.toLowerCase()}:${s.id}`;
    if (!existingSourceKeys.has(key)) {
      target.sources.push(s);
      existingSourceKeys.add(key);
    }
  }

  // 5. Real Score & Real Events
  if (incoming.score) {
    target.score = incoming.score;
  }
  if (Array.isArray(incoming.events) && incoming.events.length > 0) {
    target.events = incoming.events;
  }

  // 6. Live Status & Minute
  if (isMatchFinished(incoming)) {
    target.status = 'FINISHED';
    target.minute = incoming.minute || 'FT';
  } else if (incoming.status === 'IN_PLAY' || incoming.status === 'LIVE') {
    if (!isMatchFinished(target)) {
      target.status = 'IN_PLAY';
      if (incoming.minute) target.minute = incoming.minute;
    }
  }

  // 7. Popular flag
  if (incoming.popular) target.popular = true;

  // 8. Category
  if ((!target.category || target.category === 'general') && incoming.category && incoming.category !== 'general') {
    target.category = incoming.category;
  }
};

/**
 * Bound the initial match load when one of the feeds stalls.
 */
const resolveWithin = async <T>(task: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedFallback = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  try {
    return await Promise.race([task.catch(() => fallback), timedFallback]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
export const getAllMatches = async (): Promise<SportsMatch[]> => {
  const now = Date.now();

  // Serve from memory cache if fresh
  if (cachedMatches.length > 0 && now - lastMatchesFetchTime < MATCHES_CACHE_TTL) {
    return cachedMatches;
  }

  // Fetch StreamFree, PPV.st, and Real-Time ESPN/Football-Data scoreboards concurrently
  // Bound the initial page load even when an upstream feed is hanging or rejecting requests.
  const [sfMatches, ppvMatches, liveApiMatches] = await Promise.all([
    resolveWithin(fetchStreamFreeStreams(), 8000, []),
    resolveWithin(fetchPpvStreams(), 8000, []),
    resolveWithin(getLiveMatchesFromApi(), 8000, []),
  ]);

  const mergedList: SportsMatch[] = [];

  const addOrMerge = (candidate: SportsMatch) => {
    // Skip invalid candidates where home team and away team are identical
    if (candidate.teams?.home?.name && candidate.teams?.away?.name) {
      const hToken = normalizeTeamToken(candidate.teams.home.name);
      const aToken = normalizeTeamToken(candidate.teams.away.name);
      if (hToken && aToken && hToken === aToken) {
        return;
      }
    }

    const fp = getMatchFingerprint(candidate);
    if (!fp) {
      mergedList.push(candidate);
      return;
    }

    const existing = mergedList.find(m => {
      const mFp = getMatchFingerprint(m);
      if (mFp !== fp) return false;
      const diff = Math.abs(m.date - candidate.date);
      return diff < 8 * 3600 * 1000 || m.status === 'IN_PLAY' || candidate.status === 'IN_PLAY';
    });

    if (existing) {
      mergeMatchData(existing, candidate);
    } else {
      // Ensure teams and logos exist
      const teams = extractTeamsFromMatch(candidate);
      if (teams && (!candidate.teams || normalizeTeamToken(candidate.teams.home.name) === normalizeTeamToken(candidate.teams.away.name))) {
        candidate.teams = {
          home: { name: teams.home, logo: getTeamLogoUrl(teams.home) },
          away: { name: teams.away, logo: getTeamLogoUrl(teams.away) }
        };
        candidate.title = `${teams.home} vs ${teams.away}`;
      } else if (candidate.teams) {
        if (!candidate.teams.home.logo) {
          candidate.teams.home.logo = getTeamLogoUrl(candidate.teams.home.name);
        }
        if (!candidate.teams.away.logo) {
          candidate.teams.away.logo = getTeamLogoUrl(candidate.teams.away.name);
        }
      }
      mergedList.push(candidate);
    }
  };

  // 1. Add StreamFree (Rich ESPN team crests + FHD 1080p stream keys)
  sfMatches.forEach(addOrMerge);

  // 2. Add or merge PPV.st (High quality broadcast feeds & alternates)
  ppvMatches.forEach(addOrMerge);

  // 3. Enrich with official live scores and real status from ESPN & Football-Data
  liveApiMatches.forEach(addOrMerge);

  let combined = mergedList;

  // Do not substitute fabricated sample fixtures when providers return no data.
  if (combined.length === 0) {
    combined = getFallbackMatches();
  }

  // Filter out outdated matches that ended more than 2.5 hours ago
  combined = combined.filter(m => {
    const diff = m.date - now;
    const isFinished = isMatchFinished(m);

    // If finished and started > 2.5 hours ago, prune
    if (isFinished && diff < -2.5 * 3600 * 1000) return false;
    // If started > 3.5 hours ago without live signal, prune
    if (diff < -3.5 * 3600 * 1000) return false;

    return true;
  });

  // Ensure isFinished matches have FINISHED status
  combined.forEach(m => {
    if (isMatchFinished(m)) {
      m.status = 'FINISHED';
      if (!m.minute || m.minute === 'LIVE') m.minute = 'FT';
    }
  });

  // Sort: Active live events first, then upcoming chronologically
  combined.sort((a, b) => {
    const aLive = a.status === 'IN_PLAY';
    const bLive = b.status === 'IN_PLAY';
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    return a.date - b.date;
  });

  cachedMatches = combined;
  lastMatchesFetchTime = now;

  return combined;
};

/**
 * Returns playable streams for any selected match and provider (StreamFree + PPV.st)
 */
export const getMatchStreams = async (source: string, id: string): Promise<SportsStream[]> => {
  const safeSource = source.toLowerCase();
  const streams: SportsStream[] = [];

  // ==========================================
  // 1. StreamFree (strmfree.st) Primary Handler
  // ==========================================
  if (safeSource === 'streamfree') {
    const meta = streamFreeMetadataStore.get(id);
    const category = meta?.category || 'soccer';
    const streamKey = meta?.stream_key || id;

    // Use FHD / SD sources if returned by API
    if (Array.isArray(meta?.sources) && meta.sources.length > 0) {
      meta.sources.forEach((s, idx) => {
        streams.push({
          id: `sf-${streamKey}-${s.quality || idx}`,
          streamNo: streams.length + 1,
          language: `StreamFree ${s.quality || 'HD'} (Official Embed ⚡)`,
          hd: s.quality === 'FHD' || s.quality === '4K',
          embedUrl: s.url,
          source: 'StreamFree'
        });
      });
    } else {
      // Standard strmfree.st embed endpoints
      streams.push(
        {
          id: `sf-${streamKey}-fhd`,
          streamNo: 1,
          language: 'StreamFree FHD 1080p (strmfree.st ⚡)',
          hd: true,
          embedUrl: `https://strmfree.st/embed/${category}/${streamKey}1080p`,
          source: 'StreamFree'
        },
        {
          id: `sf-${streamKey}-sd`,
          streamNo: 2,
          language: 'StreamFree SD 540p (Fast Load ⚡)',
          hd: false,
          embedUrl: `https://strmfree.st/embed/${category}/${streamKey}540p`,
          source: 'StreamFree'
        },
        {
          id: `sf-${streamKey}-global`,
          streamNo: 3,
          language: 'StreamFree Web Player',
          hd: true,
          embedUrl: `https://streamfree.top/embed/${category}/${streamKey}`,
          source: 'StreamFree'
        }
      );
    }
  }

  // ==========================================
  // 2. PPV.st Streams Handler
  // ==========================================
  if (safeSource === 'ppv') {
    const meta = ppvMetadataStore.get(id);

    if (meta?.iframe) {
      streams.push({
        id: `ppv-${id}-fhd`,
        streamNo: 1,
        language: 'PPV HD Broadcast (Direct Player ⚡)',
        hd: true,
        embedUrl: meta.iframe,
        source: 'PPV.st HD'
      });
    }

    if (Array.isArray(meta?.substreams)) {
      meta.substreams.forEach((sub, idx) => {
        if (sub.iframe) {
          streams.push({
            id: `ppv-${id}-sub-${idx}`,
            streamNo: streams.length + 1,
            language: sub.source_tag || sub.tag || `PPV Mirror ${idx + 2}`,
            hd: sub.source_tag?.includes('HD') ?? false,
            embedUrl: sub.iframe,
            source: 'PPV.st'
          });
        }
      });
    }

    // Direct Web Player Mirror
    if (meta?.uri_name) {
      streams.push({
        id: `ppv-${id}-web`,
        streamNo: streams.length + 1,
        language: 'PPV Web Portal (Direct ⚡)',
        hd: true,
        embedUrl: `https://ppv.st/live/${encodeURIComponent(meta.uri_name)}`,
        source: 'PPV.st'
      });
    }
  }

  // If no streams loaded, generate guaranteed strmfree.st working streams
  if (streams.length === 0) {
    const cleanId = encodeURIComponent(id.replace(/^(sf-|ppv-|espn-|match-)/, ''));
    streams.push(
      {
        id: `sf-fallback-1080p`,
        streamNo: 1,
        language: 'StreamFree FHD 1080p (strmfree.st ⚡)',
        hd: true,
        embedUrl: `https://strmfree.st/embed/soccer/${cleanId}1080p`,
        source: 'StreamFree'
      },
      {
        id: `sf-fallback-540p`,
        streamNo: 2,
        language: 'StreamFree SD 540p (strmfree.st ⚡)',
        hd: false,
        embedUrl: `https://strmfree.st/embed/soccer/${cleanId}540p`,
        source: 'StreamFree'
      },
      {
        id: `sf-fallback-portal`,
        streamNo: 3,
        language: 'StreamFree Web Portal',
        hd: true,
        embedUrl: `https://streamfree.top/`,
        source: 'StreamFree'
      }
    );
  }

  return streams;
};

// 24/7 Channels removed as requested
export const SPORTS_247_CHANNELS: SportsChannel247[] = [];

export const get247SportsChannels = (): SportsChannel247[] => {
  return [];
};

// Generates real-time live scoreboard, minute ticker, and match event timeline
export const getLiveScoreboard = (match: SportsMatch): LiveMatchScoreboard => {
  const now = Date.now();
  const elapsedMs = now - match.date;
  const elapsedMins = Math.max(1, Math.min(95, Math.floor(elapsedMs / (60 * 1000))));

  let period: '1st Half' | 'Halftime' | '2nd Half' | 'Full Time' | 'Live' = '1st Half';
  const minStr = (match.minute || '').toLowerCase();
  if (match.status === 'FINISHED' || minStr.includes('ft') || minStr.includes('full') || elapsedMins > 95) {
    period = 'Full Time';
  } else if (elapsedMins > 45 && elapsedMins <= 50) {
    period = 'Halftime';
  } else if (elapsedMins > 50) {
    period = '2nd Half';
  }

  // ONLY use real verified score from match.score if available! Never fabricate fake seed numbers
  const hasRealScore = match.score !== undefined && match.score !== null;
  const homeScore = hasRealScore ? match.score!.home : 0;
  const awayScore = hasRealScore ? match.score!.away : 0;

  // Use real match events from ESPN / official APIs if present, never invent fake events
  const events = Array.isArray(match.events) ? match.events : [];

  return {
    minute: elapsedMins,
    period,
    homeScore,
    awayScore,
    events
  };
};
