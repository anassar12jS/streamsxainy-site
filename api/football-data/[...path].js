export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return res.status(503).json({ error: 'Football-Data is not configured on this deployment.' });
  }

  const requestUrl = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
  const endpoint = requestUrl.pathname.slice('/api/football-data'.length);
  const allowedPath = endpoint === '/matches' ||
    /^\/competitions\/(?:PD|PL|SA|BL1|FL1|CL)\/(?:standings|scorers)$/.test(endpoint);

  if (!allowedPath) {
    return res.status(404).json({ error: 'Unsupported sports data endpoint.' });
  }

  const upstreamUrl = new URL(`https://api.football-data.org/v4${endpoint}`);
  for (const key of ['dateFrom', 'dateTo', 'limit', 'competitions']) {
    const value = requestUrl.searchParams.get(key);
    if (value) upstreamUrl.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        'X-Auth-Token': token,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    const body = await upstream.text();
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', upstream.ok
      ? 'public, s-maxage=60, stale-while-revalidate=300'
      : 'no-store');
    return res.status(upstream.status).send(body);
  } catch {
    return res.status(502).json({ error: 'Football-Data is temporarily unavailable.' });
  } finally {
    clearTimeout(timeout);
  }
}