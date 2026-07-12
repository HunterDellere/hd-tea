/**
 * liquor.mjs — color math for the cup atom and steep curve.
 *
 * Every tea/tisane authors a single `liquor: "#hex"` in frontmatter (the
 * mid-tone of its brewed liquor). The build derives the highlight and the
 * depth for the cup's radial gradient, and the per-steep shades for the
 * steep curve. Color is data here: the derivations are fixed so two teas
 * with the same liquor hex always render identically.
 */

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix hexA toward hexB by t in [0,1]. */
export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

/** The three stops of a cup gradient from one authored liquor hex. */
export function cupStops(liquorHex) {
  return {
    hi: mix(liquorHex, '#fff8e8', 0.5),
    mid: liquorHex,
    deep: mix(liquorHex, '#1a0e06', 0.38),
  };
}

/** Inline style attribute for the cup atom. */
export function cupStyle(liquorHex) {
  const { hi, mid, deep } = cupStops(liquorHex);
  return `--cup-hi:${hi};--cup-mid:${mid};--cup-deep:${deep}`;
}

/**
 * Per-steep dot shades. Intensity rises to a peak (steep 2–3 for most
 * gongfu sessions) then fades toward pale as the leaf gives out. `n` is
 * the steep count; returns n hex values derived from the liquor.
 */
export function steepShades(liquorHex, n) {
  const { hi, deep } = cupStops(liquorHex);
  const peak = Math.min(2, n - 1); // zero-indexed peak at steep 3 (or earlier for short sessions)
  const shades = [];
  for (let i = 0; i < n; i += 1) {
    if (i <= peak) {
      // approach full depth
      const t = peak === 0 ? 1 : i / peak;
      shades.push(mix(liquorHex, deep, 0.35 * t));
    } else {
      // fade toward the highlight
      const t = (i - peak) / Math.max(1, n - 1 - peak);
      shades.push(mix(liquorHex, hi, 0.85 * t));
    }
  }
  return shades;
}
