/**
 * YouTube InnerTube API proxy — lets the site reach youtubei endpoints from
 * browsers that can't use the companion extension (phones, no-extension users).
 *
 * Server-side fetch has no CORS restrictions, so this forwards a whitelisted
 * set of YouTube API calls and returns the raw response. Public catalog only —
 * no cookies/auth are forwarded, so library/liked-songs still need the extension.
 */

const ALLOWED_HOSTS = new Set([
  'youtubei.googleapis.com',
  'music.youtube.com',
  'www.youtube.com',
]);

// Only InnerTube API paths — never arbitrary YouTube URLs
const ALLOWED_PATH_RE = /^\/youtubei\//;

const MAX_BODY_BYTES = 256 * 1024;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, method = 'POST', headers = {}, body } = req.body || {};
  if (typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url' });
  }

  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid url' });
  }

  if (!ALLOWED_HOSTS.has(target.hostname) || !ALLOWED_PATH_RE.test(target.pathname)) {
    return res.status(403).json({ error: 'Endpoint not allowed' });
  }

  const upstreamMethod = ['GET', 'POST', 'HEAD'].includes(String(method).toUpperCase())
    ? String(method).toUpperCase()
    : 'POST';

  // Forward only safe headers — never cookies or auth material
  const forwardHeaders = {
    'Content-Type': headers['content-type'] || headers['Content-Type'] || 'application/json',
    'Accept': headers['accept'] || headers['Accept'] || '*/*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'X-YouTube-Client-Name': headers['x-youtube-client-name'] || headers['X-YouTube-Client-Name'] || '',
    'X-YouTube-Client-Version': headers['x-youtube-client-version'] || headers['X-YouTube-Client-Version'] || '',
    'X-Goog-AuthUser': headers['x-goog-authuser'] || headers['X-Goog-AuthUser'] || '0',
    'Origin': 'https://music.youtube.com',
    'Referer': 'https://music.youtube.com/',
  };
  // Strip empties
  for (const k of Object.keys(forwardHeaders)) {
    if (!forwardHeaders[k]) delete forwardHeaders[k];
  }

  let upstreamBody;
  if (upstreamMethod !== 'GET' && upstreamMethod !== 'HEAD' && body !== undefined && body !== null) {
    upstreamBody = typeof body === 'string' ? body : JSON.stringify(body);
    if (upstreamBody.length > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Body too large' });
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch(url, {
      method: upstreamMethod,
      headers: forwardHeaders,
      body: upstreamBody,
      signal: controller.signal,
      redirect: 'follow',
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'application/json';

    // JSON responses pass through as text; everything else is base64
    const isText = /json|text|javascript|xml/.test(contentType);
    res.status(upstream.status).json({
      status: upstream.status,
      headers: { 'content-type': contentType },
      bodyEncoding: isText ? 'text' : 'base64',
      body: isText ? buf.toString('utf8') : buf.toString('base64'),
    });
  } catch (err) {
    res.status(502).json({ error: 'Upstream request failed', message: String(err?.message || err) });
  } finally {
    clearTimeout(timeout);
  }
}
