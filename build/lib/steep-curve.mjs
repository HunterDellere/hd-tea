/**
 * steep-curve.mjs — renders the steep timeline from `steeps:` frontmatter.
 *
 * The signature component of the session register: one dot per infusion,
 * shaded from the tea's own liquor color, rising to peak depth then fading
 * as the leaf gives out. Injected wherever a page body places the
 * <!--STEEP_CURVE--> marker (teas/tisanes with `steeps:` data only).
 *
 * Frontmatter shape:
 *   steeps:
 *     temp_c: 100
 *     grams: 5
 *     ml: 100
 *     vessel: gaiwan
 *     rinse: true            # optional
 *     times: [5, 5, 7, 10, 15, 25, 40, 60, 90]
 *     note: "rises to the third, fades to sweet water"   # optional
 */

import { steepShades } from './liquor.mjs';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderSteepCurve(steeps, liquorHex) {
  if (!steeps || !Array.isArray(steeps.times) || steeps.times.length === 0) return '';
  const times = steeps.times;
  const shades = steepShades(liquorHex || '#cf9434', times.length);

  const params = [];
  if (steeps.temp_c) params.push(`${steeps.temp_c}°C`);
  if (steeps.grams && steeps.ml) params.push(`${steeps.grams} g : ${steeps.ml} ml`);
  if (steeps.vessel) params.push(esc(steeps.vessel));
  if (steeps.rinse) params.push('rinse first');

  const dots = times.map((t, i) => `
      <div class="steep">
        <div class="steep-dot" style="--s-c:${shades[i]}"></div>
        <span class="steep-n">${String(i + 1).padStart(2, '0')}</span>
        <span class="steep-s">${esc(t)}s</span>
      </div>`).join('');

  const note = steeps.note
    ? `<span class="steep-label">Steep curve · <b>${esc(steeps.note)}</b></span>`
    : '<span class="steep-label">Steep curve</span>';

  return `<div class="steep-curve">
    ${note}
    <div class="steep-params">${params.map((p) => `<span>${p}</span>`).join('')}</div>
    <div class="steep-track">${dots}</div>
  </div>`;
}
