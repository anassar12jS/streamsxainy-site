/**
 * Extracts dominant colors from an artwork image for ambient player backgrounds.
 * Results are cached per URL. Returns null when the image can't be sampled
 * (CORS-tainted canvas, missing image, etc.) — callers should fall back gracefully.
 */

export type AmbientColors = [string, string];

const cache = new Map<string, Promise<AmbientColors | null>>();
const MAX_CACHE = 60;

function hex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

async function sample(url: string): Promise<AmbientColors | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();

  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  // Bucket pixels into hue bins, weight by saturation & skip near-black/white
  const bins = new Map<number, { weight: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l < 0.12 || l > 0.92 || s < 0.15) continue; // skip blacks, whites, grays
    const bin = Math.floor(h / 30) * 30;
    const weight = s * (1 - Math.abs(l - 0.55) * 1.4);
    const cur = bins.get(bin) ?? { weight: 0, r: 0, g: 0, b: 0 };
    cur.weight += weight;
    cur.r += r * weight; cur.g += g * weight; cur.b += b * weight;
    bins.set(bin, cur);
  }
  if (bins.size === 0) return null;

  const sorted = [...bins.values()].sort((a, b) => b.weight - a.weight);
  const pick = (bin: typeof sorted[0]) =>
    hex(bin.r / bin.weight, bin.g / bin.weight, bin.b / bin.weight);

  const primary = pick(sorted[0]);
  const secondary = sorted.length > 1 ? pick(sorted[1]) : primary;
  return [primary, secondary];
}

export function getArtworkColors(url?: string | null): Promise<AmbientColors | null> {
  if (!url) return Promise.resolve(null);
  let p = cache.get(url);
  if (!p) {
    p = sample(url).catch(() => null);
    if (cache.size >= MAX_CACHE) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    cache.set(url, p);
  }
  return p;
}
