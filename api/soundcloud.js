// SoundCloud resolver: turns public track/set URLs into playable stream URLs.
// GET /api/soundcloud?action=resolve&url=<permalink>  -> metadata for a track or playlist
// GET /api/soundcloud?action=stream&url=<permalink>   -> { streamUrl, isHls } for one track
//
// api-v2.soundcloud.com does not send CORS headers, so all API calls happen here.
// The final media URL (playback.media-streaming.soundcloud.cloud / *.sndcdn.com)
// does send Access-Control-Allow-Origin: *, so the browser player can consume it.

const UA = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept': 'application/json',
};

// Public web client_id (not a secret). Refreshed automatically when it expires.
const FALLBACK_CLIENT_ID = 'zptpq4vZZZ4J6VrymLG2ojbWTJeLI0vJ';
let clientId = FALLBACK_CLIENT_ID;
let clientIdRefresh = null;

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Scrapes a fresh client_id out of SoundCloud's JS bundles (server-side, no CORS). */
async function refreshClientId() {
  if (clientIdRefresh) return clientIdRefresh;
  clientIdRefresh = (async () => {
    try {
      const html = await fetch('https://soundcloud.com/', { headers: UA }).then(r => r.text());
      const srcs = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js[^"]*)"/g)].map(m => m[1]);
      for (const src of srcs.slice(0, 14)) {
        try {
          const js = await fetch(src, { headers: UA }).then(r => r.text());
          const m = js.match(/client_id:"([A-Za-z0-9]+)"/);
          if (m) { clientId = m[1]; return clientId; }
        } catch {}
      }
    } catch {}
    return clientId;
  })().finally(() => { clientIdRefresh = null; });
  return clientIdRefresh;
}

/** GET a SoundCloud API/transcoding URL with client_id; retries once after a 401. */
async function scGet(url) {
  const withKey = (cid) => {
    const u = new URL(url);
    u.searchParams.set('client_id', cid);
    return u.toString();
  };
  let res = await fetch(withKey(clientId), { headers: UA });
  if (res.status === 401) {
    await refreshClientId();
    res = await fetch(withKey(clientId), { headers: UA });
  }
  return res;
}

const API = 'https://api-v2.soundcloud.com';

function artwork(url, size = 't500x500') {
  if (!url) return '';
  return String(url).replace(/-large\.(jpg|png)/, `-${size}.$1`).replace(/-(small|t300x300)\.(jpg|png)/, `-${size}.$1`);
}

function trackJson(t) {
  const user = t.user || {};
  return {
    id: String(t.id),
    title: t.title || 'Untitled',
    artist: user.username || user.full_name || 'Unknown artist',
    artistId: user.id != null ? String(user.id) : '',
    artistUrl: user.permalink_url || '',
    artwork: artwork(t.artwork_url),
    duration: Math.round((t.duration || t.full_duration || 0) / 1000),
    url: t.permalink_url || '',
  };
}

function transcodingScore(t) {
  const protocol = t.format?.protocol || '';
  const quality = t.quality || '';
  let s = 0;
  if (protocol === 'progressive') s += 120;
  else if (protocol === 'hls') s += 70;
  if (quality === 'hq') s += 30;
  else if (quality === 'sq') s += 20;
  else if (quality === 'lq') s += 10;
  if (t.preset === 'abr_sq' || t.preset === 'abr_hq') s += 15;
  return s;
}

async function resolveTrackStream(track) {
  const candidates = (track.media?.transcodings || [])
    .map(t => ({ t, s: transcodingScore(t) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 4)
    .map(x => x.t);
  if (!candidates.length) return { error: 'This track has no playable stream.' };

  // Some advertised transcodings 404 — try the next-best candidate before giving up.
  for (const transcoding of candidates) {
    if (!transcoding?.url) continue;
    try {
      const res = await scGet(transcoding.url);
      if (!res.ok) continue;
      const body = await res.json().catch(() => ({}));
      if (!body?.url) continue;
      return {
        streamUrl: body.url,
        isHls: transcoding.format?.protocol === 'hls',
      };
    } catch {}
  }
  return { error: 'Stream resolution failed for every available format.' };
}

/**
 * Playlist payloads only hydrate the first few tracks — the rest come back as
 * stubs ({id, kind} only). Bulk-fetch those by id and restore playlist order.
 */
async function hydratePlaylistTracks(list) {
  const byId = new Map();
  const stubIds = [];
  for (const t of list) {
    if (!t || t.kind !== 'track' || t.id == null) continue;
    if (t.title && t.permalink_url) byId.set(String(t.id), t);
    else stubIds.push(String(t.id));
  }
  for (let i = 0; i < stubIds.length; i += 50) {
    try {
      const r = await scGet(`${API}/tracks?ids=${stubIds.slice(i, i + 50).join(',')}`);
      if (!r.ok) continue;
      const arr = await r.json().catch(() => []);
      for (const t of Array.isArray(arr) ? arr : []) {
        if (t?.id != null) byId.set(String(t.id), t);
      }
    } catch {}
  }
  return list
    .map(t => byId.get(String(t?.id)))
    .filter(t => t && t.title && t.permalink_url);
}

/** Artist payload: profile + a page of their tracks. */
async function artistPayload(user, offset) {
  const name = user.username || user.full_name || 'Unknown artist';
  let tracks = [];
  let nextOffset = null;
  try {
    const r = await scGet(`${API}/users/${user.id}/tracks?limit=50&offset=${offset}`);
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      tracks = (data.collection || [])
        .filter(t => t && t.kind === 'track')
        .map(trackJson);
      nextOffset = data.next_href ? offset + 50 : null;
    }
  } catch {}
  return {
    kind: 'artist',
    id: String(user.id),
    name,
    handle: user.permalink || '',
    avatar: artwork(user.avatar_url, 't300x300'),
    tracks,
    nextOffset,
  };
}

export default async function handler(req, res) {
  const q = req.query || {};
  const url = String(q.url || '').trim();
  const action = String(q.action || 'resolve');
  const id = String(q.id || '').trim();
  const offset = Math.max(0, parseInt(q.offset || '0', 10) || 0);
  const hasId = action === 'stream' && /^\d+$/.test(id);
  const hasArtistId = action === 'artist' && /^\d+$/.test(id);
  if (!url && !hasId && !hasArtistId) return json(res, 400, { error: 'Missing url parameter.' });
  if (url && !/soundcloud\.com\//i.test(url) && !/^https?:\/\//i.test(url)) {
    return json(res, 400, { error: 'Provide a SoundCloud track or playlist URL.' });
  }

  try {
    // Stream by numeric track id — covers tracks imported before playlist
    // hydration existed (stored as `sc-<id>` with no permalink).
    if (hasId) {
      const tr = await scGet(`${API}/tracks/${id}`);
      if (!tr.ok) return json(res, tr.status === 404 ? 404 : 502, { error: `SoundCloud lookup failed (${tr.status}).` });
      const data = await tr.json();
      if (data.kind !== 'track') return json(res, 422, { error: 'Not a SoundCloud track.' });
      const meta = trackJson(data);
      const stream = await resolveTrackStream(data);
      if (stream.error) return json(res, 422, { error: stream.error });
      return json(res, 200, { kind: 'track', ...meta, ...stream });
    }

    // Artist by numeric user id.
    if (hasArtistId) {
      const ur = await scGet(`${API}/users/${id}`);
      if (!ur.ok) return json(res, ur.status === 404 ? 404 : 502, { error: `SoundCloud lookup failed (${ur.status}).` });
      const user = await ur.json();
      return json(res, 200, await artistPayload(user, offset));
    }

    const r = await scGet(`${API}/resolve?url=${encodeURIComponent(url)}`);
    if (!r.ok) {
      const code = r.status === 401 ? 502 : r.status === 404 ? 404 : 502;
      return json(res, code, { error: `SoundCloud lookup failed (${r.status}).` });
    }
    const data = await r.json();

    if (data.kind === 'track') {
      const meta = trackJson(data);
      if (action === 'stream') {
        // Playlist/resolve payloads often omit media.transcodings — refetch the full track.
        let full = data;
        if (!(data.media?.transcodings || []).length) {
          const tr = await scGet(`${API}/tracks/${data.id}`);
          if (tr.ok) full = await tr.json().catch(() => data);
        }
        const stream = await resolveTrackStream(full);
        if (stream.error) return json(res, 422, { error: stream.error });
        return json(res, 200, { kind: 'track', ...meta, ...stream });
      }
      return json(res, 200, { kind: 'track', ...meta });
    }

    // Artist permalink resolves to kind 'user' — return profile + tracks.
    if (data.kind === 'user') {
      return json(res, 200, await artistPayload(data, offset));
    }

    if (data.kind === 'playlist' || data.kind === 'album') {
      const rawTracks = (data.tracks || []).filter(t => t && t.kind === 'track');
      const hydrated = await hydratePlaylistTracks(rawTracks);
      const tracks = hydrated.map(trackJson);
      if (!tracks.length) return json(res, 404, { error: 'This playlist has no playable tracks.' });
      return json(res, 200, {
        kind: 'playlist',
        id: String(data.id),
        title: data.title || 'SoundCloud Playlist',
        artwork: artwork(data.artwork_url) || tracks[0]?.artwork || '',
        curator: data.user?.username || '',
        tracks,
      });
    }

    return json(res, 422, { error: `Unsupported SoundCloud kind: ${data.kind}` });
  } catch (e) {
    return json(res, 502, { error: e?.message || 'SoundCloud request failed.' });
  }
}
