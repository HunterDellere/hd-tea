/**
 * terroir-map.mjs — accurate, build-time terroir maps.
 *
 * Renders real-projection SVG maps from vendored Natural Earth data
 * (data/_reference/geo/, public domain, checksummed in MANIFEST.json).
 * No network at build time; no tile services at runtime. The SVG is
 * styled entirely through themed CSS classes, so one map serves both
 * the porcelain (light) and night-kiln (dark) registers.
 *
 * Two renderers:
 *   renderTerroirMap(map, regionName) — a Mercator detail window around
 *     real coordinates: graticule with degree labels, country/province
 *     lines, rivers and lakes where the 50m data has them, authored
 *     markers at true lon/lat, a scale bar, and a country-scale locator
 *     inset showing where the window sits.
 *   renderWorldMap(regions) — the Origins hub map: Natural Earth
 *     projection, land, and a marker for every region entry.
 *
 * Region frontmatter:
 *   map:
 *     center: [117.98, 27.71]      # lon, lat
 *     span_km: 50                  # window width
 *     elevation_label: "200–600 m"
 *     markers:
 *       - { name: "Tianxin 天心岩", lon: 117.96, lat: 27.70, primary: true }
 *     caption: "…"
 *
 * Elevation contours from DEM data are the next planned layer; the
 * frontmatter interface will not change when they land.
 */

import fs from 'node:fs';
import path from 'node:path';
import { geoMercator, geoNaturalEarth1, geoPath, geoGraticule } from 'd3-geo';

const GEO = path.resolve(new URL('.', import.meta.url).pathname, '..', '..', 'data', '_reference', 'geo');

let cache = null;
function loadGeo() {
  if (cache) return cache;
  const read = (f) => JSON.parse(fs.readFileSync(path.join(GEO, f), 'utf8'));
  cache = {
    countries: read('ne_50m_admin_0_countries.json'),
    admin1: read('ne_50m_admin_1_states_provinces_lines.json'),
    rivers: read('ne_50m_rivers_lake_centerlines.json'),
    lakes: read('ne_50m_lakes.json'),
  };
  return cache;
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Pick a graticule step that gives 2–5 lines across the window. */
function niceStep(spanDeg) {
  for (const step of [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10]) {
    if (spanDeg / step <= 5) return step;
  }
  return 20;
}

function fmtDeg(v, isLat) {
  const hemi = isLat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W');
  const abs = Math.abs(v);
  const s = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${s}°${hemi}`;
}

/* ── region detail map ────────────────────────────────────── */

export function renderTerroirMap(map, regionName) {
  if (!map || !Array.isArray(map.center)) return '';
  const geo = loadGeo();
  const W = 640;
  const H = 420;
  const [lon, lat] = map.center;
  const spanKm = map.span_km || 60;

  // Mercator window: scale so spanKm of ground maps to W pixels.
  const spanDegLon = (spanKm * 1000) / (111320 * Math.cos((lat * Math.PI) / 180));
  const scale = W / ((spanDegLon * Math.PI) / 180);
  const projection = geoMercator().center([lon, lat]).scale(scale).translate([W / 2, H / 2])
    .clipExtent([[0, 0], [W, H]]);
  const pathGen = geoPath(projection);

  const spanDegLat = (spanDegLon * H) / W;
  const step = niceStep(Math.max(spanDegLon, spanDegLat));
  const grat = geoGraticule().step([step, step])();

  const layers = [];
  layers.push(`<path class="tm-land" d="${pathGen(geo.countries) || ''}" />`);
  layers.push(`<path class="tm-grat" d="${pathGen(grat) || ''}" />`);
  layers.push(`<path class="tm-lake" d="${pathGen(geo.lakes) || ''}" />`);
  layers.push(`<path class="tm-river" d="${pathGen(geo.rivers) || ''}" />`);
  layers.push(`<path class="tm-admin" d="${pathGen(geo.admin1) || ''}" />`);

  // graticule edge labels
  const labels = [];
  const lonStart = Math.ceil((lon - spanDegLon / 2) / step) * step;
  for (let L = lonStart; L < lon + spanDegLon / 2; L += step) {
    const [x] = projection([L, lat]);
    if (x > 24 && x < W - 24) labels.push(`<text class="tm-grat-label" x="${x.toFixed(0)}" y="${H - 6}" text-anchor="middle">${fmtDeg(L, false)}</text>`);
  }
  const latStart = Math.ceil((lat - spanDegLat / 2) / step) * step;
  for (let L = latStart; L < lat + spanDegLat / 2; L += step) {
    const pt = projection([lon, L]);
    if (pt && pt[1] > 16 && pt[1] < H - 16) labels.push(`<text class="tm-grat-label" x="6" y="${(pt[1] - 3).toFixed(0)}">${fmtDeg(L, true)}</text>`);
  }

  // markers at true coordinates
  const markers = (map.markers || []).map((m) => {
    const pt = projection([m.lon, m.lat]);
    if (!pt) return '';
    const [x, y] = pt;
    const r = m.primary ? 5 : 3.5;
    const ring = m.primary ? `<circle class="tm-marker-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" />` : '';
    const anchor = x > W * 0.72 ? 'end' : 'start';
    const lx = anchor === 'end' ? x - 10 : x + 10;
    return `<circle class="tm-marker" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" />${ring}
      <text class="tm-label" x="${lx.toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="${anchor}">${esc(m.name)}</text>`;
  }).join('\n      ');

  // scale bar: a round-number bar near 1/4 of the window width
  const kmPerPx = spanKm / W;
  const target = spanKm / 4;
  const barKm = [1, 2, 5, 10, 20, 25, 50, 100, 200].reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  const barPx = barKm / kmPerPx;
  const scaleBar = `<g class="tm-scale">
      <line x1="${W - 20 - barPx}" y1="${H - 18}" x2="${W - 20}" y2="${H - 18}" />
      <line x1="${W - 20 - barPx}" y1="${H - 22}" x2="${W - 20 - barPx}" y2="${H - 14}" />
      <line x1="${W - 20}" y1="${H - 22}" x2="${W - 20}" y2="${H - 14}" />
      <text class="tm-grat-label" x="${W - 20 - barPx / 2}" y="${H - 26}" text-anchor="middle">${barKm} km</text>
    </g>`;

  // locator inset: country-scale window with a box on the detail extent
  const insetW = 148;
  const insetH = 100;
  const insetSpanKm = 1600;
  const insetSpanDeg = (insetSpanKm * 1000) / (111320 * Math.cos((lat * Math.PI) / 180));
  const insetScale = insetW / ((insetSpanDeg * Math.PI) / 180);
  const insetProj = geoMercator().center([lon, lat]).scale(insetScale).translate([insetW / 2, insetH / 2])
    .clipExtent([[0, 0], [insetW, insetH]]);
  const insetPath = geoPath(insetProj);
  const boxW = Math.max(4, (spanKm / insetSpanKm) * insetW);
  const boxH = Math.max(4, boxW * (H / W));
  const inset = `<g class="tm-inset" transform="translate(${W - insetW - 12}, 12)">
      <rect class="tm-inset-frame" width="${insetW}" height="${insetH}" rx="4" />
      <g clip-path="url(#tm-inset-clip)">
        <path class="tm-land" d="${insetPath(geo.countries) || ''}" />
        <path class="tm-admin" d="${insetPath(geo.admin1) || ''}" />
        <rect class="tm-inset-box" x="${(insetW - boxW) / 2}" y="${(insetH - boxH) / 2}" width="${boxW}" height="${boxH}" />
      </g>
    </g>`;

  const tag = map.elevation_label ? `<span class="map-tag">Terroir · ${esc(map.elevation_label)}</span>` : '';
  const caption = map.caption ? `<p class="map-caption">${esc(map.caption)}</p>` : '';
  const waterLegend = map.water_label ? `<span class="lg-water"><i></i>${esc(map.water_label)}</span>` : '<span class="lg-water"><i></i>Rivers &amp; lakes</span>';

  return `<div class="map-panel">
    <div class="map-title-row">
      <span class="map-region-name">${esc(regionName)}</span>
      ${tag}
    </div>
    <div class="map-svg-wrap">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of ${esc(regionName)}, ${spanKm} km window centred on ${fmtDeg(lat, true)} ${fmtDeg(lon, false)}">
      <defs><clipPath id="tm-inset-clip"><rect width="${insetW}" height="${insetH}" rx="4" /></clipPath></defs>
      ${layers.join('\n      ')}
      ${labels.join('\n      ')}
      ${markers}
      ${scaleBar}
      ${inset}
      </svg>
    </div>
    <div class="map-legend">
      <span><i></i>Province border</span>
      ${waterLegend}
      <span class="lg-garden"><i></i>Named place</span>
      <span>Natural Earth 50m · Mercator</span>
    </div>
    ${caption}
  </div>`;
}

/* ── origins world map ────────────────────────────────────── */

export function renderWorldMap(regions) {
  const geo = loadGeo();
  const W = 800;
  const H = 420;
  const projection = geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' });
  const pathGen = geoPath(projection);
  const grat = geoGraticule().step([30, 30])();

  const markers = regions
    .filter((r) => Array.isArray(r.coords))
    .map((r) => {
      const pt = projection(r.coords);
      if (!pt) return '';
      const [x, y] = pt;
      return `<a href="../../${r.path}"><circle class="tm-marker" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" />
        <circle class="tm-marker-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" />
        <text class="tm-label" x="${(x + 10).toFixed(1)}" y="${(y - 6).toFixed(1)}">${esc(r.title)}</text></a>`;
    }).join('\n      ');

  return `<div class="map-panel">
    <div class="map-title-row">
      <span class="map-region-name">The tea world</span>
      <span class="map-tag">Regions in the atlas</span>
    </div>
    <div class="map-svg-wrap">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="World map with every region in the atlas marked">
      <path class="tm-sphere" d="${pathGen({ type: 'Sphere' }) || ''}" />
      <path class="tm-grat" d="${pathGen(grat) || ''}" />
      <path class="tm-land" d="${pathGen(geo.countries) || ''}" />
      ${markers}
      </svg>
    </div>
    <p class="map-caption">Every region entry, marked at its true coordinates. Natural Earth projection; the marker links to the region's page and its detail map.</p>
  </div>`;
}
