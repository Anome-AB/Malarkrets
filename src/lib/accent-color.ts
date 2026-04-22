import sharp from "sharp";

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function score(r: number, g: number, b: number): number {
  const [, s, l] = rgbToHsl(r, g, b);
  // 18–52 % lightness band → white text always has contrast.
  // Sweet spot 32 %. Saturation weighted to outrank muddy neutrals.
  if (l < 0.18 || l > 0.52) return 0;
  const lightnessBand = 1 - Math.abs(l - 0.32) * 2.5;
  return s * 2.0 + Math.max(0, lightnessBand);
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

/**
 * Extract a white-text-safe accent colour from an image buffer.
 * Returns a 7-char hex string (e.g. "#a44c35") or null if no pixel scored > 0.
 */
export async function extractAccentColor(buffer: Buffer): Promise<string | null> {
  const { data, info } = await sharp(buffer)
    .resize(80, 80, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bins = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const prev = bins.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    prev.r += r;
    prev.g += g;
    prev.b += b;
    prev.n += 1;
    bins.set(key, prev);
  }

  let best: { s: number; r: number; g: number; b: number } | null = null;
  for (const v of bins.values()) {
    const r = v.r / v.n;
    const g = v.g / v.n;
    const b = v.b / v.n;
    const s = score(r, g, b) * Math.log1p(v.n);
    if (s <= 0) continue;
    if (!best || s > best.s) best = { s, r, g, b };
  }

  if (!best) return null;
  return `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`;
}
