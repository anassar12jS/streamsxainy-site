/**
 * Hi-res lossless audio resolver — multi-source FLAC with automatic failover.
 *
 * Sources (all public, no auth):
 *   - Monochrome  (FLAC/DASH, auto-discovered instances)
 *   - Netease     (FLAC up to 24/96 via losslessbridge + Meting)
 *   - Internet Archive (last-resort FLAC)
 *   - Deezer      (catalog only — rows resolve on any audio source)
 *
 * Qobuz/Tidal upstreams are dead (soundfean suspended, aurix/gglos offline).
 * Shared provider code lives in server/hires/ (outside api/ so Vercel only
 * builds this one function).
 *
 *   GET /api/hires-stream?q=...&quality=LOSSLESS  → { tracks }
 *   GET /api/hires-stream?id=mc:123&quality=...  → stream descriptor
 *   GET /api/hires-stream?health=1               → per-provider status
 */

import { searchAll, resolveStream } from '../server/hires/router.js';

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

// Hosts we are willing to proxy audio from — prevents open-proxy abuse.
const PROXY_ALLOWED_SUFFIXES = ['monochrome.st', 'qqdl.site', '126.net', 'archive.org', 'music.163.com'];

function isProxyableHost(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return PROXY_ALLOWED_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

/**
 * Stream-proxy for upstream FLAC URLs that lack CORS headers.
 * The player's Web Audio graph requires CORS-clean media, so we fetch
 * upstream server-side and pipe it back same-origin. Range requests are
 * forwarded so seeking keeps working.
 */
async function proxyStream(req, res, targetUrl) {
  if (!isProxyableHost(targetUrl)) {
    return json(res, 403, { error: 'host not allowed' });
  }
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: '*/*',
  };
  if (req.headers.range) headers.Range = req.headers.range;

  let upstream;
  try {
    upstream = await fetch(targetUrl, { headers, redirect: 'follow' });
  } catch (err) {
    return json(res, 502, { error: `upstream unreachable: ${err?.message || err}` });
  }

  const outHeaders = {
    'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
    'Cache-Control': 'no-store',
  };
  for (const h of ['content-length', 'content-range']) {
    const v = upstream.headers.get(h);
    if (v) outHeaders[h === 'content-length' ? 'Content-Length' : 'Content-Range'] = v;
  }
  res.writeHead(upstream.status, outHeaders);

  if (!upstream.body) {
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch {
    // upstream aborted mid-stream — nothing more we can do
  } finally {
    res.end();
  }
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

  const proxyTarget = url.searchParams.get('proxy');
  if (proxyTarget) {
    return proxyStream(req, res, proxyTarget);
  }

  if (url.searchParams.get('health') === '1') {
    try {
      return json(res, 200, await health());
    } catch (err) {
      return json(res, 500, { ok: false, error: String(err?.message || err) });
    }
  }

  const directId = url.searchParams.get('id');
  if (directId) {
    const stream = await resolveStream(directId, url.searchParams.get('quality'));
    if (!stream) return json(res, 404, { error: 'not available' });
    return json(res, 200, stream);
  }

  const query = url.searchParams.get('q') || '';
  if (!query.trim()) {
    return json(res, 200, {
      name: 'xainy-hires',
      description: 'Multi-source lossless FLAC resolver with automatic failover',
      endpoints: ['?q=', '?id=', '?health=1'],
    });
  }

  try {
    const { tracks, perSource } = await searchAll(query, url.searchParams.get('quality'));
    return json(res, 200, { tracks }, { 'X-Addon-Sources': encodeURIComponent(JSON.stringify(perSource)) });
  } catch (err) {
    return json(res, 200, { tracks: [], error: String(err?.message || err) });
  }
}
