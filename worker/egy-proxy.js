/**
 * EgyDead proxy worker — fetches egydead.ca pages/API and egybestvid.com
 * embeds + HLS on behalf of the Xainy API/player.
 *
 * Why: egydead.ca sits behind a Cloudflare managed challenge that blocks
 * datacenter IPs (Vercel), and s1.egybestvid.com rejects cross-site browser
 * requests (sec-fetch-site), so HLS must be proxied end-to-end.
 *
 * URL shape: https://<worker>/<host>/<path>?<query>
 *   /egydead.ca/api/v1/search/...      -> https://egydead.ca/api/v1/search/...
 *   /egydead.ca/titles/123/x           -> https://egydead.ca/titles/123/x
 *   /egybestvid.com/embed-x.html       -> https://egybestvid.com/embed-x.html
 *   /s1.egybestvid.com/hls2/.../master.m3u8 -> https://s1.egybestvid.com/hls2/...
 *
 * NOT an open proxy: GET only, whitelisted hosts + path prefixes, and the
 * destination host is fixed by the first path segment.
 */

const UPSTREAMS = {
  'egydead.ca': 'https://egydead.ca',
  'egybestvid.com': 'https://egybestvid.com',
  's1.egybestvid.com': 'https://s1.egybestvid.com',
};

// Per-upstream allowed path prefixes (checked against path after host segment).
const ALLOWED = {
  'egydead.ca': [/^\/api\/v1\//, /^\/titles\//, /^\/watch\//, /^\/$/],
  'egybestvid.com': [/^\/embed-[a-z0-9]+\.html$/, /^\/$/],
  's1.egybestvid.com': [/^\/hls2\//],
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

// Rewrite absolute media URLs inside m3u8 playlists back through this worker
// so hls.js keeps every request on the proxy (segments would 403 otherwise).
function rewritePlaylist(body, workerOrigin) {
  return body.replace(/https:\/\/s1\.egybestvid\.com/g, `${workerOrigin}/s1.egybestvid.com`);
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'GET') {
      return new Response('method not allowed', { status: 405, headers: CORS });
    }

    const url = new URL(request.url);
    const workerOrigin = url.origin;
    const [hostSeg, ...rest] = url.pathname.split('/').filter(Boolean);
    const upstreamBase = UPSTREAMS[hostSeg];
    const upstreamPath = '/' + rest.join('/');

    if (!upstreamBase || !(ALLOWED[hostSeg] || []).some(re => re.test(upstreamPath))) {
      return new Response('forbidden', { status: 403, headers: CORS });
    }

    const target = upstreamBase + upstreamPath + url.search;

    try {
      const upstream = await fetch(target, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': UA,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': hostSeg === 's1.egybestvid.com' ? 'https://egybestvid.com/' : upstreamBase + '/',
        },
      });

      const ct = upstream.headers.get('content-type') || '';
      const isPlaylist = /mpegurl|m3u8/i.test(ct) || /\.m3u8(\?|$)/i.test(upstreamPath);

      const headers = new Headers();
      headers.set('Content-Type', isPlaylist ? 'application/vnd.apple.mpegurl' : (ct || 'application/octet-stream'));
      // Signed URLs are time-limited; short cache only.
      headers.set('Cache-Control', isPlaylist ? 'public, max-age=60' : 'public, max-age=3600');
      Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));

      if (isPlaylist) {
        const text = await upstream.text();
        return new Response(rewritePlaylist(text, workerOrigin), { status: upstream.status, headers });
      }
      // Stream segments/other bodies straight through.
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e?.message || e) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
  },
};
