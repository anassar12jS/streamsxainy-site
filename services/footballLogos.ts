// ---------------------------------------------------------------------------
// Live Sports badge & crest resolver powered by Leo4815162342/football-logos
// (https://github.com/Leo4815162342/football-logos · football-logos.cc)
// Resolves 5,500+ club, national team, league, and tournament PNG crests.
// ---------------------------------------------------------------------------

export interface FootballLogoEntry {
  id: string;
  name: string;
  categoryId: string;
  alt?: string[];
  native?: string;
  h: string;
  hasPng?: boolean;
  hasSvg?: boolean;
  variantCount?: number;
}

export interface FootballLogoResolveOptions {
  competition?: string;
  category?: string;
  kind?: 'team' | 'league' | 'any';
}

const INDEX_URL = 'https://football-logos.cc/ac-v3.json';
const ASSETS_BASE = 'https://assets.football-logos.cc';
const CACHE_NAME = 'streamhub-football-logos-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;

const CONFEDERATION_IDS = new Set([
  'fifa',
  'uefa',
  'conmebol',
  'concacaf',
  'afc',
  'caf',
  'ofc',
]);

// Priority boost for major football nations/competitions when two clubs share
// an identical short name (e.g. "Barcelona" Spain vs "Barcelona SC" Ecuador).
const CATEGORY_POPULARITY_SCORE: Record<string, number> = {
  tournaments: 45,
  england: 42,
  spain: 42,
  italy: 40,
  germany: 40,
  france: 38,
  portugal: 32,
  netherlands: 32,
  brazil: 30,
  argentina: 30,
  turkey: 28,
  scotland: 26,
  belgium: 26,
  morocco: 26,
  'saudi-arabia': 25,
  usa: 24,
  mexico: 24,
  egypt: 22,
  greece: 20,
  austria: 20,
  switzerland: 20,
  ukraine: 18,
  denmark: 18,
  norway: 18,
  sweden: 18,
  poland: 18,
  croatia: 18,
  russia: 16,
  japan: 16,
  'south-korea': 16,
  colombia: 16,
};

// Map ESPN / StreamFree / Football-Data league names & IDs to canonical queries + category hints
const COMPETITION_ALIASES: Record<string, { query: string; categoryHint?: string }> = {
  laliga: { query: 'La Liga', categoryHint: 'spain' },
  'la liga': { query: 'La Liga', categoryHint: 'spain' },
  'la liga ea sports': { query: 'La Liga', categoryHint: 'spain' },
  'spanish laliga': { query: 'La Liga', categoryHint: 'spain' },
  'spanish primera division': { query: 'La Liga', categoryHint: 'spain' },
  'primera division': { query: 'La Liga', categoryHint: 'spain' },
  'primera division de espana': { query: 'La Liga', categoryHint: 'spain' },
  pl: { query: 'Premier League', categoryHint: 'england' },
  epl: { query: 'Premier League', categoryHint: 'england' },
  'premier league': { query: 'Premier League', categoryHint: 'england' },
  'english premier league': { query: 'Premier League', categoryHint: 'england' },
  'efl championship': { query: 'EFL Championship', categoryHint: 'england' },
  'english league championship': { query: 'EFL Championship', categoryHint: 'england' },
  seriea: { query: 'Serie A', categoryHint: 'italy' },
  'serie a': { query: 'Serie A', categoryHint: 'italy' },
  'serie a enilive': { query: 'Serie A', categoryHint: 'italy' },
  'italian serie a': { query: 'Serie A', categoryHint: 'italy' },
  bundesliga: { query: 'Bundesliga', categoryHint: 'germany' },
  'german bundesliga': { query: 'Bundesliga', categoryHint: 'germany' },
  ligue1: { query: 'Ligue 1', categoryHint: 'france' },
  'ligue 1': { query: 'Ligue 1', categoryHint: 'france' },
  'ligue 1 mcdonald s': { query: 'Ligue 1', categoryHint: 'france' },
  'french ligue 1': { query: 'Ligue 1', categoryHint: 'france' },
  ucl: { query: 'UEFA Champions League', categoryHint: 'tournaments' },
  'ucl league phase': { query: 'UEFA Champions League', categoryHint: 'tournaments' },
  'champions league': { query: 'UEFA Champions League', categoryHint: 'tournaments' },
  'uefa champions league': { query: 'UEFA Champions League', categoryHint: 'tournaments' },
  uel: { query: 'UEFA Europa League', categoryHint: 'tournaments' },
  'europa league': { query: 'UEFA Europa League', categoryHint: 'tournaments' },
  'uefa europa league': { query: 'UEFA Europa League', categoryHint: 'tournaments' },
  'uefa conference league': { query: 'UEFA Conference League', categoryHint: 'tournaments' },
  'uefa europa conference league': { query: 'UEFA Conference League', categoryHint: 'tournaments' },
  'botola pro': { query: 'Botola Pro', categoryHint: 'morocco' },
  'eredivisie': { query: 'Eredivisie', categoryHint: 'netherlands' },
  'dutch eredivisie': { query: 'Eredivisie', categoryHint: 'netherlands' },
  'primeira liga': { query: 'Primeira Liga', categoryHint: 'portugal' },
  'portuguese primeira liga': { query: 'Primeira Liga', categoryHint: 'portugal' },
  'super lig': { query: 'Süper Lig', categoryHint: 'turkey' },
  'turkish super lig': { query: 'Süper Lig', categoryHint: 'turkey' },
  mls: { query: 'MLS - Major League Soccer', categoryHint: 'usa' },
  'liga mx': { query: 'Liga MX', categoryHint: 'mexico' },
  'mexican liga bbva mx': { query: 'Liga MX', categoryHint: 'mexico' },
  'brasileirao': { query: 'Brazilian Serie A', categoryHint: 'brazil' },
  'brazilian serie a': { query: 'Brazilian Serie A', categoryHint: 'brazil' },
  'saudi pro league': { query: 'Saudi Pro League', categoryHint: 'saudi-arabia' },
  'world cup': { query: 'FIFA World Cup 2026', categoryHint: 'tournaments' },
  'fifa world cup': { query: 'FIFA World Cup 2026', categoryHint: 'tournaments' },
  'copa america': { query: 'Copa America', categoryHint: 'tournaments' },
  'nations league': { query: 'UEFA Nations League', categoryHint: 'tournaments' },
};

// Short-form / colloquial club names commonly returned by ESPN, StreamFree & PPV feeds
const TEAM_QUERY_ALIASES: Record<string, string> = {
  'man city': 'Manchester City',
  'man utd': 'Manchester United',
  'man united': 'Manchester United',
  spurs: 'Tottenham',
  'tottenham hotspur': 'Tottenham',
  wolves: 'Wolverhampton Wanderers',
  'nottm forest': 'Nottingham Forest',
  'nottingham': 'Nottingham Forest',
  'brighton': 'Brighton & Hove Albion',
  'brighton hove albion': 'Brighton & Hove Albion',
  'west ham': 'West Ham United',
  'newcastle': 'Newcastle United',
  'west brom': 'West Bromwich Albion',
  'leeds': 'Leeds United',
  'leicester': 'Leicester City',
  'ipswich': 'Ipswich Town',
  'coventry': 'Coventry City',
  'atleti': 'Atlético Madrid',
  'atletico': 'Atlético Madrid',
  'atletico de madrid': 'Atlético Madrid',
  'athletic bilbao': 'Athletic Club',
  'athletic club bilbao': 'Athletic Club',
  'bilbao': 'Athletic Club',
  'betis': 'Real Betis',
  'sociedad': 'Real Sociedad',
  'celta': 'Celta Vigo',
  'rayo': 'Rayo Vallecano',
  'inter milan': 'Inter',
  'internazionale': 'Inter',
  'fc internazionale milano': 'Inter',
  'milan': 'AC Milan',
  'juve': 'Juventus',
  'as roma': 'Roma',
  'psg': 'PSG',
  'paris saint germain': 'PSG',
  'marseille': 'Olympique de Marseille',
  'olympique marseille': 'Olympique de Marseille',
  'lyon': 'Olympique Lyonnais',
  'stade rennais': 'Rennes',
  'losc lille': 'Lille',
  'bayern': 'Bayern Munich',
  'bayern munchen': 'Bayern Munich',
  'dortmund': 'Borussia Dortmund',
  'bvb': 'Borussia Dortmund',
  'leverkusen': 'Bayer Leverkusen',
  'gladbach': 'Borussia Mönchengladbach',
  'monchengladbach': 'Borussia Mönchengladbach',
  'frankfurt': 'Eintracht Frankfurt',
  'fc cologne': '1. FC Köln',
  'cologne': '1. FC Köln',
  'union berlin': '1. FC Union Berlin',
  'hamburg sv': 'Hamburger SV',
  'feyenoord rotterdam': 'Feyenoord',
  'raja ca': 'Raja Casablanca',
  'raja club athletic': 'Raja Casablanca',
  'wydad athletic club': 'Wydad AC',
  'wydad': 'Wydad AC',
  'far rabat': 'AS FAR',
  'renaissance de berkane': 'RS Berkane',
  'mas fes': 'MAS Fes',
  'maghreb de fes': 'MAS Fes',
  'ir tanger': 'Ittihad Tanger',
  'usa': 'USA National Team',
  'united states': 'USA National Team',
  'netherlands': 'Netherlands National Team',
  'holland': 'Netherlands National Team',
  'atlas lions': 'Morocco National Team',
  'morocco national team': 'Morocco National Team',
};

const NON_FOOTBALL_KEYWORDS = [
  'basket',
  'nba',
  'ncaa',
  'wnba',
  'american football',
  'nfl',
  'hock',
  'nhl',
  'base',
  'mlb',
  'fight',
  'ufc',
  'mma',
  'box',
  'wrestl',
  'motor',
  'racing',
  'f1',
  'nascar',
  'motogp',
  'tenn',
  'cric',
  'rugby',
  'golf',
];

export const isNonFootballSport = (category?: string): boolean => {
  if (!category) return false;
  const lower = category.toLowerCase();
  return NON_FOOTBALL_KEYWORDS.some((kw) => lower.includes(kw));
};

export const normalizeLogoText = (input: string): string =>
  (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[⚽🏎️🥊🏀🏈🎾]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’`.]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const stripClubAffixes = (input: string): string => {
  const tokens = normalizeLogoText(input)
    .split(' ')
    .filter(Boolean)
    .filter(
      (t) =>
        !/^(fc|cf|afc|sc|ac|rcd|ca|ud|sd|sv|as|ss|vfb|bvb|tsv|fk|sk|sl|cp|cd|rc|ogc|osc|losc|ssc|us|calcio|club|de|la|el|the|1)$/.test(
          t
        ) && !/^(18\d{2}|19\d{2}|20\d{2}|04|05|07|96|98)$/.test(t)
    );
  return tokens.join(' ').trim();
};

const LEAGUE_ENTRY_PATTERN =
  /(premier-league|la-liga|serie-a|bundesliga|ligue-1|botola|eredivisie|primeira-liga|super-lig|champions-league|europa-league|conference-league|world-cup|nations-league|copa-|cup$|championship$|division$|liga-|mls$)/i;

const isLeagueLikeEntry = (entry: FootballLogoEntry): boolean =>
  entry.categoryId === 'tournaments' || LEAGUE_ENTRY_PATTERN.test(entry.id);

export const buildFootballLogoUrl = (entry: Pick<FootballLogoEntry, 'id' | 'categoryId' | 'h'>): string => {
  if (!entry?.id || !entry?.categoryId || !entry?.h) return '';
  const isConfederation =
    entry.categoryId === 'tournaments' && CONFEDERATION_IDS.has(entry.id.split('--')[0]);
  const folder = isConfederation ? 'logos' : `logos/${entry.categoryId}`;
  return `${ASSETS_BASE}/${folder}/64x64/${entry.id}.${entry.h}.png`;
};

const inferCategoryHintFromCompetition = (competition?: string): string | undefined => {
  if (!competition) return undefined;
  const norm = normalizeLogoText(competition);
  if (COMPETITION_ALIASES[norm]?.categoryHint) {
    return COMPETITION_ALIASES[norm].categoryHint;
  }
  if (/(premier league|efl|fa cup|carabao|english|england)/.test(norm)) return 'england';
  if (/(la liga|laliga|copa del rey|segunda|spanish|spain)/.test(norm)) return 'spain';
  if (/(serie a|serie b|coppa italia|italian|italy)/.test(norm)) return 'italy';
  if (/(bundesliga|dfb|german|germany)/.test(norm)) return 'germany';
  if (/(ligue 1|ligue 2|coupe de france|french|france)/.test(norm)) return 'france';
  if (/(eredivisie|knvb|dutch|netherlands)/.test(norm)) return 'netherlands';
  if (/(primeira liga|taca de portugal|portuguese|portugal)/.test(norm)) return 'portugal';
  if (/(botola|morocco|moroccan)/.test(norm)) return 'morocco';
  if (/(super lig|turkish|turkey)/.test(norm)) return 'turkey';
  if (/(scottish|scotland|premiership)/.test(norm)) return 'scotland';
  if (/(saudi|roshn)/.test(norm)) return 'saudi-arabia';
  if (/(mls|major league soccer|us open cup)/.test(norm)) return 'usa';
  if (/(liga mx|mexican)/.test(norm)) return 'mexico';
  if (/(brasileirao|brazilian|copa do brasil)/.test(norm)) return 'brazil';
  if (/(argentina|primera division)/.test(norm)) return 'argentina';
  if (/(egyptian)/.test(norm)) return 'egypt';
  if (/(champions league|europa league|conference league|world cup|euro 20|nations league|afcon|copa america)/.test(norm)) {
    return 'tournaments';
  }
  return undefined;
};

const isInternationalCompetition = (competition?: string): boolean => {
  if (!competition) return false;
  return /(world cup|euro\b|nations league|afcon|africa cup|copa america|asian cup|gold cup|qualifiers|friendly|international)/i.test(
    competition
  );
};

export interface FootballLogoIndex {
  entries: FootballLogoEntry[];
  exactMap: Map<string, FootballLogoEntry[]>;
  strippedMap: Map<string, FootballLogoEntry[]>;
}

const pushToBucket = (map: Map<string, FootballLogoEntry[]>, key: string, entry: FootballLogoEntry) => {
  if (!key) return;
  let bucket = map.get(key);
  if (!bucket) {
    bucket = [];
    map.set(key, bucket);
  }
  if (!bucket.includes(entry)) bucket.push(entry);
};

export const buildFootballLogoIndex = (entries: FootballLogoEntry[]): FootballLogoIndex => {
  const exactMap = new Map<string, FootballLogoEntry[]>();
  const strippedMap = new Map<string, FootballLogoEntry[]>();

  for (const entry of entries) {
    if (!entry?.id || !entry?.name || !entry?.h || entry.hasPng === false) continue;

    const names = [entry.name, ...(entry.alt || []), entry.native || ''].filter(Boolean);
    for (const rawName of names) {
      const exact = normalizeLogoText(rawName);
      pushToBucket(exactMap, exact, entry);

      const stripped = stripClubAffixes(rawName);
      if (stripped && stripped !== exact) {
        pushToBucket(strippedMap, stripped, entry);
      }
    }

    // Index hyphenated slug without dashes too (e.g. "real-madrid" -> "real madrid")
    pushToBucket(exactMap, normalizeLogoText(entry.id), entry);
  }

  return { entries, exactMap, strippedMap };
};

export const matchFootballLogoEntry = (
  rawQuery: string,
  index: FootballLogoIndex,
  options?: FootballLogoResolveOptions
): FootballLogoEntry | undefined => {
  if (!rawQuery || isNonFootballSport(options?.category)) return undefined;

  const kind = options?.kind || 'team';
  const rawNorm = normalizeLogoText(rawQuery);
  if (!rawNorm) return undefined;

  // Apply explicit alias maps first
  const compAlias = kind === 'league' ? COMPETITION_ALIASES[rawNorm] : undefined;
  const teamAlias = kind !== 'league' ? TEAM_QUERY_ALIASES[rawNorm] : undefined;
  const effectiveQuery = compAlias?.query || teamAlias || rawQuery;
  const effectiveNorm = normalizeLogoText(effectiveQuery);
  const strippedQuery = stripClubAffixes(effectiveQuery);

  const categoryHint = compAlias?.categoryHint || inferCategoryHintFromCompetition(options?.competition);
  const international = isInternationalCompetition(options?.competition);

  const candidates = new Map<FootballLogoEntry, number>();
  const addCandidates = (list: FootballLogoEntry[] | undefined, baseScore: number) => {
    if (!list) return;
    for (const entry of list) {
      const prev = candidates.get(entry) ?? -1000;
      if (baseScore > prev) candidates.set(entry, baseScore);
    }
  };

  addCandidates(index.exactMap.get(effectiveNorm), 120);
  if (effectiveNorm !== rawNorm) {
    addCandidates(index.exactMap.get(rawNorm), 115);
  }
  if (strippedQuery && strippedQuery.length >= 3) {
    addCandidates(index.strippedMap.get(strippedQuery), 85);
    addCandidates(index.exactMap.get(strippedQuery), 95);
  }

  // If searching for a national team by country name (e.g. "Morocco" or "Spain")
  if (kind !== 'league' && !effectiveNorm.includes('national team')) {
    const natKey = `${effectiveNorm} national team`;
    addCandidates(index.exactMap.get(natKey), international ? 130 : 75);
  }

  if (candidates.size === 0) return undefined;

  let bestEntry: FootballLogoEntry | undefined;
  let bestScore = -Infinity;

  for (const [entry, base] of candidates.entries()) {
    let score = base;
    const isLeague = isLeagueLikeEntry(entry);
    const isNatTeam = entry.id.endsWith('-national-team');

    // Separate clubs vs tournaments/leagues cleanly
    if (kind === 'team' && isLeague) score -= 120;
    if (kind === 'league' && !isLeague) score -= 90;

    // Exact display name match beats alt alias
    if (normalizeLogoText(entry.name) === effectiveNorm) score += 25;
    if (entry.id === effectiveNorm.replace(/\s+/g, '-')) score += 20;

    // Disambiguate using competition country hint
    if (categoryHint && entry.categoryId === categoryHint) score += 65;

    // National team vs club disambiguation
    if (international && isNatTeam) score += 45;
    if (!international && isNatTeam && normalizeLogoText(entry.name) !== effectiveNorm) score -= 10;

    // Major football leagues & multi-variant iconic clubs win over obscure namesakes
    score += CATEGORY_POPULARITY_SCORE[entry.categoryId] || 0;
    score += Math.min(entry.variantCount || 1, 15);

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestScore > 20 ? bestEntry : undefined;
};

// ---------------------------------------------------------------------------
// Singleton browser loader + reactive subscribers (CacheStorage + memory)
// ---------------------------------------------------------------------------
let activeIndex: FootballLogoIndex | null = null;
let loadPromise: Promise<boolean> | null = null;
let lastFailedAt = 0;
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
};

export const isFootballLogosReady = (): boolean => activeIndex !== null;

export const subscribeFootballLogosReady = (cb: () => void): (() => void) => {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
};

async function readCachedIndexJson(): Promise<FootballLogoEntry[] | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(INDEX_URL);
    if (!cached) return null;
    const fetchedAt = Number(cached.headers.get('x-streamhub-fetched-at') || '0');
    if (fetchedAt && Date.now() - fetchedAt > CACHE_TTL_MS) return null;
    const data = await cached.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function writeCachedIndexJson(rawText: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      INDEX_URL,
      new Response(rawText, {
        headers: {
          'content-type': 'application/json',
          'x-streamhub-fetched-at': String(Date.now()),
        },
      })
    );
  } catch {}
}

export const loadFootballLogosIndex = async (): Promise<boolean> => {
  if (activeIndex) return true;
  if (loadPromise) return loadPromise;
  if (Date.now() - lastFailedAt < RETRY_DELAY_MS) return false;

  loadPromise = (async () => {
    try {
      // 1. Try CacheStorage first for instant warm loads
      const cached = await readCachedIndexJson();
      if (cached && cached.length > 0) {
        activeIndex = buildFootballLogoIndex(cached);
        notifySubscribers();
        return true;
      }

      // 2. Fetch fresh index from football-logos.cc (CORS: *)
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(INDEX_URL, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rawText = await res.text();
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid football-logos index');
      }

      activeIndex = buildFootballLogoIndex(parsed);
      void writeCachedIndexJson(rawText);
      notifySubscribers();
      return true;
    } catch {
      lastFailedAt = Date.now();
      return false;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
};

export const resolveFootballLogoSync = (
  query: string,
  options?: FootballLogoResolveOptions
): string | undefined => {
  if (!query || isNonFootballSport(options?.category)) return undefined;
  if (!activeIndex) {
    if (typeof window !== 'undefined') void loadFootballLogosIndex();
    return undefined;
  }
  const entry = matchFootballLogoEntry(query, activeIndex, options);
  return entry ? buildFootballLogoUrl(entry) : undefined;
};

export const getLeagueLogoUrl = (leagueIdOrName: string): string | undefined => {
  return resolveFootballLogoSync(leagueIdOrName, {
    competition: leagueIdOrName,
    kind: 'league',
  });
};
