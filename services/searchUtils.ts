import { TMDBResult, MediaType } from '../types';

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
 * Levenshtein distance for fuzzy matching
 */
export const levenshteinDistance = (a: string, b: string): number => {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix: number[][] = Array(aLen + 1).fill(null).map(() => Array(bLen + 1).fill(0));

  for (let i = 0; i <= aLen; i++) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[aLen][bLen];
};

/**
 * Common stopwords in film/TV titles to downweight in token overlap
 */
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by']);

/**
 * Calculate fuzzy match score (0-100)
 */
export const fuzzyMatchScore = (query: string, target: string): number => {
  const q = normalizeText(query);
  const t = normalizeText(target);

  if (!q || !t) return 0;

  // Exact match
  if (t === q) return 100;

  // Starts with
  if (t.startsWith(q)) return 96;

  // Query starts with target (e.g. query "The Outlaws 2017" starts with target "The Outlaws")
  if (q.startsWith(t) && t.length > 2) return 94;

  // Substring match
  if (t.includes(q)) return 90;

  // Word boundary match
  if (t.includes(' ' + q) || t.includes(q + ' ')) return 88;

  // Token / word overlap matching
  const qTokens = q.split(' ').filter(w => w.length > 0);
  const tTokens = t.split(' ').filter(w => w.length > 0);

  if (qTokens.length > 0 && tTokens.length > 0) {
    const significantQTokens = qTokens.filter(w => !STOPWORDS.has(w) || qTokens.length <= 2);
    const matchedTokens = significantQTokens.filter(qw => 
      tTokens.some(tw => tw === qw || (qw.length >= 4 && (tw.startsWith(qw) || qw.startsWith(tw))))
    );

    if (matchedTokens.length === significantQTokens.length && significantQTokens.length > 0) {
      return 85;
    }

    if (matchedTokens.length > 0) {
      const ratio = matchedTokens.length / significantQTokens.length;
      return Math.round(50 + ratio * 32);
    }
  }

  // Levenshtein distance for typo tolerance (e.g. "outalws" -> "outlaws")
  const maxLen = Math.max(q.length, t.length);
  const distance = levenshteinDistance(q, t);
  const similarity = Math.max(0, 100 - (distance / maxLen) * 100);

  if (similarity > 65) {
    return Math.round(similarity * 0.85);
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
 * Compute relevance score for search results
 */
export const calculateRelevance = (item: TMDBResult, rawQuery: string): number => {
  let score = 0;
  const targetYear = extractYearFromQuery(rawQuery);
  const cleanQuery = rawQuery.replace(/\b(19\d\d|20\d\d)\b/g, '').trim() || rawQuery;

  const title = item.title || item.name || '';
  const originalTitle = item.original_title || item.original_name || '';

  // 1. Primary Title Match (up to 100 pts)
  const titleScore = Math.max(
    fuzzyMatchScore(rawQuery, title),
    fuzzyMatchScore(cleanQuery, title)
  );

  // 2. Original Title Match (e.g. Korean / French title: Beomjoedosi, AKA, etc.)
  const origScore = originalTitle ? Math.max(
    fuzzyMatchScore(rawQuery, originalTitle),
    fuzzyMatchScore(cleanQuery, originalTitle)
  ) : 0;

  const bestMatch = Math.max(titleScore, origScore);
  score += bestMatch * 0.55;

  // 3. Year Match Bonus (Massive boost if user specified a year like 2017)
  const itemDate = item.release_date || item.first_air_date || '';
  const itemYear = itemDate.split('-')[0];
  if (targetYear && itemYear) {
    if (itemYear === targetYear) {
      score += 45; // Exact year match
    } else if (Math.abs(parseInt(itemYear) - parseInt(targetYear)) <= 1) {
      score += 15;
    }
  }

  // 4. Popularity Logarithmic Boost (0 - 25 pts)
  if (item.popularity && item.popularity > 0) {
    const popScore = Math.min(25, Math.log10(item.popularity + 1) * 8);
    score += popScore;
  }

  // 5. Vote Quality & Volume Boost (0 - 15 pts, soft bonus so lower vote items aren't excluded)
  const voteCount = item.vote_count || 0;
  const voteAvg = item.vote_average || 0;
  if (voteCount > 0) {
    const countScore = Math.min(8, Math.log10(voteCount + 1) * 2);
    const avgScore = (voteAvg / 10) * 7;
    score += countScore + avgScore;
  }

  // 6. Overview Keyword Match (0 - 8 pts)
  const overview = (item.overview || '').toLowerCase();
  const qWords = cleanQuery.toLowerCase().split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w));
  if (qWords.length > 0 && overview) {
    const matches = qWords.filter(w => overview.includes(w)).length;
    score += (matches / qWords.length) * 8;
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

    // Filter out completely blank media stubs (no poster AND no backdrop AND no profile)
    const hasImage = Boolean(item.poster_path || item.backdrop_path || item.profile_path);
    if (!hasImage && (!item.overview || item.overview.trim().length === 0)) {
      return false;
    }

    // Filter out explicit adult content
    if (item.adult) return false;

    // Deduplicate strictly by ID + Media Type (never by title, so same-name movies/shows coexist!)
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
export const rankSearchResults = (results: TMDBResult[], query: string): TMDBResult[] => {
  if (!query.trim()) return [];

  // 1. Clean and deduplicate results
  const filtered = filterLowQualityResults(results);

  // 2. Score items
  const scored = filtered.map(item => ({
    item,
    score: calculateRelevance(item, query),
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

  allResults.forEach(item => {
    const title = item.title || item.name || '';
    const norm = normalizeText(title);
    if (norm.startsWith(q) || norm.includes(' ' + q)) {
      suggestions.add(title);
    }
  });

  return Array.from(suggestions).slice(0, limit);
};
