// Gráfico de torta (dona) hecho a mano en SVG.
import { esc } from './utils.js';

export function donut(slices, centerTop, centerBottom) {
  const R = 70, C = 2 * Math.PI * R;
  const total = slices.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  const gap = slices.length > 1 ? 2 : 0;
  const arcs = total
    ? slices
        .map((s) => {
          const len = (s.value / total) * C;
          const dash = Math.max(len - gap, 0.5);
          const el = `<circle r="${R}" cx="90" cy="90" fill="none" stroke="${esc(s.color)}" stroke-width="22"
            stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-offset}" data-action="filter-cat" data-id="${esc(s.id)}"
            style="cursor:pointer"><title>${esc(s.label)}</title></circle>`;
          offset += len;
          return el;
        })
        .join('')
    : `<circle r="${R}" cx="90" cy="90" fill="none" stroke="var(--line)" stroke-width="22"/>`;
  return `<svg viewBox="0 0 180 180" class="donut" role="img" aria-label="Distribución por categoría">
    <g transform="rotate(-90 90 90)">${arcs}</g>
    <text x="90" y="84" text-anchor="middle" class="donut-top">${esc(centerTop)}</text>
    <text x="90" y="106" text-anchor="middle" class="donut-bottom">${esc(centerBottom)}</text>
  </svg>`;
}
