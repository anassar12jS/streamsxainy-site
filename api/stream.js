const INSTANCES = [
  "https://pipedapi-libre.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://piped-api.privacy.com.de",
  "https://api.piped.yt",
  "https://pipedapi.kavin.rocks",
];

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  if (!/^[\w-]{11}$/.test(id)) {
    return res.status(400).json({ error: "bad id" });
  }

  for (const base of INSTANCES) {
    try {
      const r = await fetch(`${base}/streams/${id}`);
      if (!r.ok) continue;
      const data = await r.json();
      const best = (data.audioStreams || []).sort((a, b) => b.bitrate - a.bitrate)[0];
      if (best && best.url) {
        return res.status(200).json({ url: best.url });
      }
    } catch (e) {}
  }
  res.status(502).json({ error: "no stream available" });
}