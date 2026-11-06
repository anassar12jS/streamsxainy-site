import { TMDBResult, MediaType } from '../types';

/**
 * High-frequency cinema, television, and anime titles for instant typo correction
 */
export const CINEMA_DICTIONARY: string[] = [
  // Marvel & DC & Superheroes
  'avengers', 'avengers endgame', 'avengers infinity war', 'the avengers',
  'iron man', 'spider man', 'spiderman', 'spider-man', 'spider man no way home',
  'spider-man into the spider-verse', 'across the spider-verse', 'batman',
  'the batman', 'the dark knight', 'the dark knight rises', 'batman begins',
  'superman', 'deadpool', 'deadpool & wolverine', 'wolverine', 'logan',
  'guardians of the galaxy', 'thor', 'thor ragnarok', 'captain america',
  'black panther', 'doctor strange', 'ant man', 'justice league',
  'wonder woman', 'aquaman', 'the flash', 'x-men', 'fantastic four',
  'the boys', 'invincible', 'gen v',

  // Masterpiece Cinema & Blockbusters
  'inception', 'interstellar', 'oppenheimer', 'dunkirk', 'tenet', 'memento',
  'the prestige', 'gladiator', 'gladiator 2', 'avatar', 'avatar the way of water',
  'avatar fire and ash', 'titanic', 'dune', 'dune part two', 'dune prophecy',
  'blade runner', 'blade runner 2049', 'the matrix', 'john wick', 'fight club',
  'pulp fiction', 'the shawshank redemption', 'the godfather', 'goodfellas',
  'scarface', 'the wolf of wall street', 'shutter island', 'the departed',
  'jurassic park', 'jurassic world', 'star wars', 'the empire strikes back',
  'return of the jedi', 'the force awakens', 'rogue one', 'the mandalorian',
  'the lord of the rings', 'the fellowship of the ring', 'the two towers',
  'the return of the king', 'the hobbit', 'harry potter', 'mission impossible',
  'fast and furious', 'top gun', 'top gun maverick', 'alien', 'aliens',
  'predator', 'prey', 'terminator', 'terminator 2', 'transformers',
  'hunger games', 'the hunger games', 'the maze runner', 'twilight',

  // Modern Releases & Trending
  'heart of the beast', 'the outlaws', 'the roundup', 'aka', 'havoc',
  'smile', 'smile 2', 'the wild robot', 'inside out 2', 'moana 2', 'wicked',
  'nosferatu', 'conclave', 'anora', 'heretic', 'alien romulus', 'beetlejuice',
  'substance', 'the substance', 'a quiet place', 'terrifier 3', 'furiosa',
  'twisters', 'bad boys', 'civil war', 'kingdom of the planet of the apes',

  // Acclaimed Series
  'breaking bad', 'better call saul', 'game of thrones', 'house of the dragon',
  'stranger things', 'the last of us', 'fallout', 'shogun', 'peaky blinders',
  'chernobyl', 'succession', 'the bear', 'ted lasso', 'severance',
  'the white lotus', 'euphoria', 'yellowstone', 'tulsa king', 'reacher',
  'true detective', 'fargo', 'mindhunter', 'ozark', 'narcos', 'money heist',
  'dark', 'black mirror', 'dexter', 'homeland', 'prison break', 'lost',
  'supernatural', 'sherlock', 'doctor who', 'friends', 'the office',
  'modern family', 'brooklyn nine-nine', 'suits', 'grey anatomy',

  // K-Dramas & Asian Cinema
  'squid game', 'the judge from hell', 'all of us are dead', 'the glory',
  'crash landing on you', 'vincenzo', 'itaewon class', 'queen of tears',
  'marry my husband', 'sweet home', 'hellbound', 'signal', 'train to busan',
  'parasite', 'oldboy', 'memories of murder',

  // Major Anime Titles
  'naruto', 'naruto shippuden', 'boruto', 'one piece', 'bleach',
  'thousand year blood war', 'dragon ball', 'dragon ball z', 'dragon ball super',
  'attack on titan', 'demon slayer', 'kimetsu no yaiba', 'jujutsu kaisen',
  'chainsaw man', 'solo leveling', 'death note', 'fullmetal alchemist',
  'hunter x hunter', 'my hero academia', 'tokyo ghoul', 'one punch man',
  'mob psycho 100', 'vinland saga', 'frieren', 'beyond journey end',
  'steins gate', 'code geass', 'cowboy bebop', 'neon genesis evangelion',
  'berserk', 'monster', 'spy x family', 'blue lock', 'haikyuu',
  'black clover', 'fairy tail', 'sword art online', 're zero', 'overlord',
  'dandadan', 'kaiju no 8', 'wind breaker', 'bocchi the rock', 'oshi no ko'
];

/**
 * Common individual word tokens in media titles for per-word spell correction
 */
export const COMMON_MEDIA_WORDS: string[] = Array.from(new Set(
  CINEMA_DICTIONARY.flatMap(title => title.toLowerCase().split(/[\s\-:]+/).filter(w => w.length >= 3))
));

/**
 * Fast Levenshtein distance for fuzzy matching
 */
export const levenshteinDistance = (a: string, b: string): number => {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  let v0 = new Array(bLen + 1);
  let v1 = new Array(bLen + 1);

  for (let i = 0; i <= bLen; i++) v0[i] = i;

  for (let i = 0; i < aLen; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < bLen; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= bLen; j++) v0[j] = v1[j];
  }

  return v1[bLen];
};

/**
 * Normalize text by removing diacritics, punctuation, and multiple spaces
 */
export const normalizeText = (text: string): string => {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Common stopwords in film/TV titles to downweight in token overlap
 */
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by']);

/**
 * Find the best matching correction for an entire query string from the dictionary
 */
export const getSpellCorrection = (query: string): string | null => {
  const q = normalizeText(query);
  if (!q || q.length < 3) return null;

  // 1. Direct match check
  for (const entry of CINEMA_DICTIONARY) {
    if (entry === q) return null; // already exact
  }

  let bestMatch: string | null = null;
  let bestDist = Infinity;
  let bestSim = 0;

  for (const entry of CINEMA_DICTIONARY) {
    const maxLen = Math.max(q.length, entry.length);
    if (Math.abs(q.length - entry.length) > 4) continue;

    const dist = levenshteinDistance(q, entry);
    const sim = 1 - dist / maxLen;

    // Allow up to 2 edits for short titles, or up to 3 edits for long titles (sim >= 0.72)
    const maxAllowedDist = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3;
    if (dist <= maxAllowedDist && sim >= 0.72 && sim > bestSim) {
      bestSim = sim;
      bestDist = dist;
      bestMatch = entry;
    }
  }

  return bestMatch;
};

/**
 * Correct individual misspelled tokens in a multi-word query
 * (e.g. "avengrs infinity war" -> "avengers infinity war")
 */
export const correctQueryTokens = (query: string): string => {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return query;

  let anyModified = false;
  const corrected = words.map(word => {
    if (word.length <= 3 || STOPWORDS.has(word)) return word;

    let best = word;
    let minD = 2; // threshold: max 1 edit for 4-5 letter words, max 2 for 6+ letters
    const maxAllowed = word.length <= 5 ? 1 : 2;

    for (const dictWord of COMMON_MEDIA_WORDS) {
      if (Math.abs(dictWord.length - word.length) > maxAllowed) continue;
      const d = levenshteinDistance(word, dictWord);
      if (d <= maxAllowed && d < minD) {
        minD = d;
        best = dictWord;
        anyModified = true;
      }
    }
    return best;
  });

  return anyModified ? corrected.join(' ') : query;
};

/**
 * Calculate fuzzy match score (0-100) between query and target title
 */
export const fuzzyMatchScore = (query: string, target: string): number => {
  const q = normalizeText(query);
  const t = normalizeText(target);

  if (!q || !t) return 0;

  // Exact match
  if (t === q) return 100;

  // Target starts with query (e.g. query "spider man", target "spider man no way home")
  if (t.startsWith(q)) return 92;

  // Query starts with target (e.g. query "the outlaws 2017", target "the outlaws")
  if (q.startsWith(t) && t.length > 2) return 90;

  // Word boundary match
  if (t.includes(' ' + q) || t.includes(q + ' ')) return 86;

  // Substring match
  if (t.includes(q)) return 82;

  // Token overlap matching
  const qTokens = q.split(' ').filter(w => w.length > 0 && !STOPWORDS.has(w));
  const tTokens = t.split(' ').filter(w => w.length > 0 && !STOPWORDS.has(w));

  if (qTokens.length > 0 && tTokens.length > 0) {
    const matchedTokens = qTokens.filter(qw => 
      tTokens.some(tw => tw === qw || (qw.length >= 4 && (tw.startsWith(qw) || qw.startsWith(tw))))
    );

    if (matchedTokens.length === qTokens.length) {
      return 85;
    }

    if (matchedTokens.length > 0) {
      const ratio = matchedTokens.length / qTokens.length;
      return Math.round(50 + ratio * 30);
    }
  }

  // Levenshtein distance for close typos (e.g. "avengrs" -> "avengers")
  const maxLen = Math.max(q.length, t.length);
  if (Math.abs(q.length - t.length) <= 3) {
    const distance = levenshteinDistance(q, t);
    const similarity = Math.max(0, 100 - (distance / maxLen) * 100);
    if (similarity >= 70) {
      return Math.round(similarity * 0.85);
    }
  }

  return 0;
};

/**
 * Extract 4-digit release year from a query if present (e.g. "The Outlaws 2017" -> "2017")
 */
export const extractYearFromQuery = (query: string): string | null => {
  const match = query.match(/\b(19\d\d|20\d\d)\b/);
  return match ? match[1] : null;
};

/**
 * Compute high-impact relevance score for search results
 * Prevents 0-vote or 1-viewer obscure stubs from stealing top spots from blockbusters!
 */
export const calculateRelevance = (item: TMDBResult, rawQuery: string, spellCorrectedQuery?: string): number => {
  let score = 0;
  const targetYear = extractYearFromQuery(rawQuery);
  const cleanQuery = rawQuery.replace(/\b(19\d\d|20\d\d)\b/g, '').trim() || rawQuery;

  const title = item.title || item.name || '';
  const originalTitle = item.original_title || item.original_name || '';

  const normQuery = normalizeText(cleanQuery);
  const normTitle = normalizeText(title);
  const normOriginal = normalizeText(originalTitle);

  // 1. Title Similarity (0 - 100 pts)
  let titleScore = Math.max(
    fuzzyMatchScore(rawQuery, title),
    fuzzyMatchScore(cleanQuery, title)
  );

  // If a spell-corrected query exists, test against that as well
  if (spellCorrectedQuery) {
    const correctedScore = fuzzyMatchScore(spellCorrectedQuery, title);
    if (correctedScore > titleScore) titleScore = correctedScore;
  }

  // Original Title Match (e.g. Korean / French original title)
  let origScore = 0;
  if (originalTitle) {
    origScore = Math.max(
      fuzzyMatchScore(rawQuery, originalTitle),
      fuzzyMatchScore(cleanQuery, originalTitle)
    );
    if (spellCorrectedQuery) {
      const correctedOrig = fuzzyMatchScore(spellCorrectedQuery, originalTitle);
      if (correctedOrig > origScore) origScore = correctedOrig;
    }
  }

  const bestMatch = Math.max(titleScore, origScore);
  score += bestMatch;

  // 2. Exact Title Bonus (Huge bonus for exact matches)
  if (normTitle === normQuery || normOriginal === normQuery) {
    score += 40;
  } else if (normTitle.startsWith(normQuery)) {
    score += 20;
  }

  // 3. POPULARITY BOOST (0 - 60 pts)
  // High popularity gives a massive advantage over obscure entries
  const pop = Math.max(0, item.popularity || 0);
  if (pop > 0) {
    score += Math.min(60, Math.log10(pop + 1) * 25);
  }
  // Penalize dead popularity
  if (pop < 1.0) {
    score -= 15;
  }

  // 4. VOTE COUNT STRENGTH & LOW-VIEWER PENALTIES (-35 to +65 pts)
  // Solves the "1 viewer movie shows up instead" complaint!
  const votes = item.vote_count || 0;
  if (votes >= 10000) {
    score += 65; // Worldwide blockbuster
  } else if (votes >= 2500) {
    score += 50; // Widely known
  } else if (votes >= 500) {
    score += 35; // Established film/series
  } else if (votes >= 100) {
    score += 20;
  } else if (votes >= 10) {
    score += 8;
  } else if (votes === 0) {
    score -= 35; // Heavy penalty for 0 votes
  } else if (votes <= 2) {
    score -= 20; // Heavy penalty for 1-2 votes
  }

  // 5. Vote Average Quality Bonus (0 - 15 pts)
  if (votes >= 5 && item.vote_average && item.vote_average > 0) {
    score += (item.vote_average / 10) * 15;
  }

  // 6. Visual Presentation & Poster Presence (+15 or -40 pts)
  // Obscure stubs missing posters will never outrank complete entries
  if (item.poster_path && item.backdrop_path) {
    score += 15;
  } else if (!item.poster_path) {
    score -= 40;
  }

  // 7. Year Match Bonus (Massive boost if user specified a year like 2017)
  const itemDate = item.release_date || item.first_air_date || '';
  const itemYear = itemDate.split('-')[0];
  if (targetYear && itemYear) {
    if (itemYear === targetYear) {
      score += 45; // Exact year match
    } else if (Math.abs(parseInt(itemYear) - parseInt(targetYear)) <= 1) {
      score += 15;
    }
  }

  // 8. Anime/Series vs Person tiebreaker
  if (item.media_type === MediaType.PERSON) {
    // Only rank people high if their name is an exact match
    if (normTitle !== normQuery) {
      score -= 25;
    }
  }

  return Math.round(score);
};

/**
 * Filter low-quality results without purging legitimate movies or TV shows!
 * Deduplicates strictly by item ID and MediaType.
 */
export const filterLowQualityResults = (results: TMDBResult[]): TMDBResult[] => {
  const seenIds = new Set<string>();

  return results.filter(item => {
    // Must have a title or name
    const hasName = Boolean(item.title || item.name);
    if (!hasName) return false;

    // Filter out completely blank media stubs (no poster AND no overview)
    const hasImage = Boolean(item.poster_path || item.backdrop_path || item.profile_path);
    if (!hasImage && (!item.overview || item.overview.trim().length === 0)) {
      return false;
    }

    // Filter out explicit adult content
    if (item.adult) return false;

    // Deduplicate strictly by ID + Media Type
    const uniqueKey = `${item.media_type || 'media'}_${item.id}`;
    if (seenIds.has(uniqueKey)) return false;
    seenIds.add(uniqueKey);

    return true;
  });
};

/**
 * Categorize results by type for better organization
 */
export const categorizeResults = (results: TMDBResult[]) => {
  return {
    movies: results.filter(r => r.media_type === MediaType.MOVIE),
    tvShows: results.filter(r => r.media_type === MediaType.TV),
    people: results.filter(r => r.media_type === MediaType.PERSON),
  };
};

/**
 * Main search ranking function
 * Preserves all results and sorts by computed relevance score
 */
export const rankSearchResults = (results: TMDBResult[], query: string, spellCorrectedQuery?: string): TMDBResult[] => {
  if (!query.trim()) return [];

  // 1. Clean and deduplicate results
  const filtered = filterLowQualityResults(results);

  // 2. Score items
  const scored = filtered.map(item => ({
    item,
    score: calculateRelevance(item, query, spellCorrectedQuery),
  }));

  // 3. Sort by relevance descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map(s => s.item);
};

/**
 * Get search suggestions based on prefix and keyword matching
 */
export const getSearchSuggestions = (allResults: TMDBResult[], query: string, limit: number = 6): string[] => {
  if (!query.trim()) return [];

  const q = normalizeText(query);
  const suggestions = new Set<string>();

  // Check dictionary first for typo corrections
  const correction = getSpellCorrection(query);
  if (correction && normalizeText(correction) !== q) {
    suggestions.add(correction.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
  }

  allResults.forEach(item => {
    const title = item.title || item.name || '';
    const norm = normalizeText(title);
    if (norm.startsWith(q) || norm.includes(' ' + q)) {
      suggestions.add(title);
    }
  });

  return Array.from(suggestions).slice(0, limit);
};
