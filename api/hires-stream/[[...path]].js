/**
 * Hi-res lossless audio resolver — multi-source FLAC with automatic failover.
 *
 * Sources (all public, no auth):
 *   - Monochrome  (FLAC/DASH, auto-discovered instances)
 *   - Netease     (FLAC up to 24/96 via losslessbridge + Meting)
 *   - Internet Archive (last-resort FLAC)
 *   - Deezer      (catalog only — rows resolve on any audio source)
 *
 * Qobuz/Tidal upstreams from the original BitChord addon are dead
 * (soundfean suspended, aurix/gglos offline) so they are not wired in.
 *
 * Endpoints:
 *   GET /api/hires-stream?q=...&quality=LOSSLESS   → { tracks }
 *   GET /api/hires-stream/stream?id=mc:123          → stream descriptor
 *   GET /api/hires-stream/health                    → per-provider status
 */

import { searchAll, resolveStream } from './_lib/router.js';

const json = (res, status, body, extraHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extraHeaders,
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};

async function checkProvider(key, url, { headers = {}, timeoutMs = 8000, parse } = {}) {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: ac.signal });
    let reachable = res.ok;
    if (reachable && parse) {
      const body = await res.json();
      reachable = parse(body);
    }
    return { provider: key, reachable, latencyMs: Date.now() - started };
  } catch (err) {
    return { provider: key, reachable: false, latencyMs: Date.now() - started, error: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function health() {
  const checks = await Promise.all([
    checkProvider('monochrome', 'https://raw.githubusercontent.com/monochrome-music/monochrome/main/public/instances.json', {
      parse: (b) => Array.isArray(b?.api) && b.api.length > 0,
    }),
    checkProvider('netease', 'https://api.qijieya.cn/meting/?server=netease&type=search&id=test&limit=1', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeoutMs: 12000,
      parse: (b) => Array.isArray(b),
    }),
    checkProvider('deezer', 'https://api.deezer.com/search?q=test&limit=1', {
      parse: (b) => Array.isArray(b?.data),
    }),
    checkProvider('archive', 'https://archive.org/advancedsearch.php?q=mediatype%3Aaudio&rows=1&output=json', {
      parse: (b) => Array.isArray(b?.response?.docs),
    }),
  ]);
  return {
    ok: checks.some((c) => c.reachable),
    audioSources: ['Monochrome', 'Netease', 'Internet Archive'],
    providers: checks,
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'method not allowed' }, { Allow: 'GET, OPTIONS' });
  }

  const url = new URL(req.url, 'http://localhost');
  let path = url.pathname.replace(/\/+$/, '') || '/';
  // Support both /api/hires-stream and /api/hires-stream/stream/... shapes
  path = path.replace(/^\/api\/hires-stream/, '') || '/';

  if (path === '/' || path === '') {
    return json(res, 200, {
      name: 'xainy-hires',
      description: 'Multi-source lossless FLAC resolver with automatic failover',
      endpoints: ['/api/hires-stream?q=', '/api/hires-stream/stream?id=', '/api/hires-stream/health'],
    });
  }

  if (path === '/health' || url.searchParams.get('health') === '1') {
    try {
      return json(res, 200, await health());
    } catch (err) {
      return json(res, 500, { ok: false, error: String(err?.message || err) });
    }
  }

  if (path === '/search') {
    const query = url.searchParams.get('q') || '';
    if (!query.trim()) return json(res, 200, { tracks: [] });
    try {
      const { tracks, perSource } = await searchAll(query, url.searchParams.get('quality'));
      return json(res, 200, { tracks }, { 'X-Addon-Sources': encodeURIComponent(JSON.stringify(perSource)) });
    } catch (err) {
      return json(res, 200, { tracks: [], error: String(err?.message || err) });
    }
  }

  if (path.startsWith('/stream/')) {
    const id = decodeURIComponent(path.slice('/stream/'.length));
    if (!id) return json(res, 404, { error: 'missing id' });
    const stream = await resolveStream(id, url.searchParams.get('quality'));
    if (!stream) return json(res, 404, { error: 'not available' });
    return json(res, 200, stream);
  }

  // Convenience: /api/hires-stream?id=mc:123 resolves a stream directly
  const directId = url.searchParams.get('id');
  if (directId) {
    const stream = await resolveStream(directId, url.searchParams.get('quality'));
    if (!stream) return json(res, 404, { error: 'not available' });
    return json(res, 200, stream);
  }

  return json(res, 404, { error: 'not found' });
}
