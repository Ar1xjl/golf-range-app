// Renderers de los graficos de Reportes. HTML/CSS para barras (mas simple y
// robusto en mobile que calcular geometria SVG para algo que ya resuelve
// bien flexbox), SVG a mano para lineas/scatter (donde si hace falta
// posicionar puntos en un plano) - mismo patron que ya usaba el trend chart
// original de reports.js/history.js, generalizado a mas de una serie.
//
// Paleta: --chart-green/--chart-gold/--chart-blue/--chart-plum (styles.css)
// - 4 tonos categoricos validados (banda de luminosidad, piso de croma,
// separacion CVD adyacente y de vision normal) entre si y contra la
// superficie de las cards. Asignacion de color siempre por INDICE fijo
// (nunca por nombre/rank), y nunca color solo: todo valor importante tiene
// tambien una etiqueta de texto en tinta (nunca el texto en el color de la
// serie).

import { RESULT_MAX } from '../resultScale.js';

const BLOCK_COLORS = ['var(--chart-green)', 'var(--chart-gold)', 'var(--chart-blue)', 'var(--chart-plum)'];

function emptyMini(msg) {
  return '<div class="gc-chart-empty">' + msg + '</div>';
}

function legendHtml(items) {
  return '<div class="gc-chart-legend">' + items.map((it) =>
    '<span class="gc-chart-legend-item"><span class="gc-chart-swatch" style="background:' + it.color + '"></span>' + it.label + '</span>'
  ).join('') + '</div>';
}

function noteHtml(text) {
  return '<div class="gc-chart-note">' + text + '</div>';
}

// ---------- P1: Gapping por palo ----------
export function renderGapping(rows) {
  if (!rows.length) return emptyMini('Todavia no hay tiros con distancia real registrada (Variantes A/B/C, bloque de Precision).');
  const maxVal = Math.max(...rows.map((r) => r.max));
  const scale = (v) => (v / maxVal) * 100;
  const rowsHtml = rows.map((r) => {
    const avgPct = scale(r.avg), minPct = scale(r.min), maxPct = scale(r.max);
    return '<div class="gc-gap-row">' +
      '<div class="gc-gap-label">' + r.label + ' <span class="gc-mono" style="color:var(--ink-soft);">n=' + r.n + '</span></div>' +
      '<div class="gc-gap-track">' +
        '<div class="gc-gap-range" style="left:' + minPct + '%; width:' + (maxPct - minPct) + '%;"></div>' +
        '<div class="gc-gap-bar" style="width:' + avgPct + '%;"></div>' +
      '</div>' +
      '<div class="gc-gap-value">' + Math.round(r.avg) + ' yds promedio <span style="color:var(--ink-soft);">· rango ' + Math.round(r.min) + '-' + Math.round(r.max) + '</span></div>' +
    '</div>';
  }).join('');
  return rowsHtml;
}

// ---------- P2: Rutina vs Resultado (scatter) ----------
export function renderRoutineScatter(points, linearRegression) {
  if (points.length < 3) return emptyMini('Faltan bloques con Think/Play Box y resultado registrados para graficar esto.');
  const w = 320, h = 160, padL = 26, padR = 10, padT = 10, padB = 24;
  const xScale = (pct) => padL + (pct / 100) * (w - padL - padR);
  const yScale = (val) => (h - padB) - ((val - 1) / (RESULT_MAX - 1)) * (h - padT - padB);
  const dots = points.map((p) =>
    '<circle cx="' + xScale(p.pct).toFixed(1) + '" cy="' + yScale(p.avg).toFixed(1) + '" r="4" fill="var(--chart-green)" stroke="var(--bg-card)" stroke-width="2"/>'
  ).join('');
  let regLine = '';
  const showTrend = points.length >= 8;
  if (showTrend) {
    const reg = linearRegression(points);
    if (reg) {
      const clamp = (y) => Math.max(1, Math.min(RESULT_MAX, y));
      const y1 = clamp(reg.intercept), y2 = clamp(reg.slope * 100 + reg.intercept);
      regLine = '<line x1="' + xScale(0).toFixed(1) + '" y1="' + yScale(y1).toFixed(1) + '" x2="' + xScale(100).toFixed(1) + '" y2="' + yScale(y2).toFixed(1) + '" stroke="var(--ink-soft)" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round"/>';
    }
  }
  const axisY = '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (h - padB) + '" stroke="var(--line)" stroke-width="1"/>';
  const axisX = '<line x1="' + padL + '" y1="' + (h - padB) + '" x2="' + (w - padR) + '" y2="' + (h - padB) + '" stroke="var(--line)" stroke-width="1"/>';
  const yTicks = Array.from({ length: RESULT_MAX }, (_, i) => i + 1).map((v) =>
    '<text x="' + (padL - 6) + '" y="' + (yScale(v) + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="var(--ink-soft)" font-family="IBM Plex Mono, monospace">' + v + '</text>'
  ).join('');
  const xTicks = [0, 50, 100].map((v) =>
    '<text x="' + xScale(v).toFixed(1) + '" y="' + (h - padB + 14) + '" text-anchor="middle" font-size="9" fill="var(--ink-soft)" font-family="IBM Plex Mono, monospace">' + v + '%</text>'
  ).join('');
  const svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px;">' + axisY + axisX + regLine + dots + yTicks + xTicks + '</svg>';
  const note = showTrend
    ? 'Linea punteada: tendencia sobre n=' + points.length + ' bloques.'
    : 'n=' + points.length + ' bloques (hacen falta 8 para mostrar la linea de tendencia).';
  return svg + noteHtml(note);
}

// ---------- P3: Tendencia por bloque, todo el historial ----------
export function renderBlockTrend(data) {
  if (!data || data.sessionCount < 2) return emptyMini('Hace falta mas de 1 sesion finalizada de esta variante.');
  const w = 320, h = 120, padL = 22, padR = 10, padT = 10, padB = 16;
  const n = data.sessionCount;
  const xScale = (i) => padL + (n === 1 ? 0 : (i / (n - 1)) * (w - padL - padR));
  const yScale = (v) => (h - padB) - ((v - 1) / (RESULT_MAX - 1)) * (h - padT - padB);
  const lines = data.series.map((seriesVals, si) => {
    const pts = seriesVals.map((v, i) => (v == null ? null : { x: xScale(i), y: yScale(v) })).filter(Boolean);
    if (pts.length < 2) return '';
    return '<polyline points="' + pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') + '" fill="none" stroke="' + BLOCK_COLORS[si] + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  }).join('');
  const axisY = '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (h - padB) + '" stroke="var(--line)" stroke-width="1"/>';
  const axisX = '<line x1="' + padL + '" y1="' + (h - padB) + '" x2="' + (w - padR) + '" y2="' + (h - padB) + '" stroke="var(--line)" stroke-width="1"/>';
  const svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px;">' + axisY + axisX + lines + '</svg>';
  const legend = legendHtml(data.blockNames.map((name, i) => ({ color: BLOCK_COLORS[i], label: name })));
  return svg + legend;
}

// ---------- Barras agrupadas (P4 y P5) ----------
export function renderGroupedBars(groups, seriesDefs) {
  const h = 90;
  const cols = groups.map((g) => {
    const bars = g.values.map((v, i) => {
      const val = Math.max(0, Math.min(100, v || 0));
      const bh = Math.round((val / 100) * h);
      return '<div class="gc-grp-bar-wrap">' +
        '<div class="gc-grp-bar-val">' + Math.round(val) + '</div>' +
        '<div class="gc-grp-bar" style="height:' + bh + 'px;background:' + seriesDefs[i].color + ';"></div>' +
      '</div>';
    }).join('');
    return '<div class="gc-grp-col">' +
      '<div class="gc-grp-bars" style="height:' + (h + 16) + 'px;">' + bars + '</div>' +
      '<div class="gc-grp-label">' + g.label + '</div>' +
    '</div>';
  }).join('');
  return '<div class="gc-grp-chart">' + cols + '</div>' + legendHtml(seriesDefs);
}

// ---------- P4: Fatiga por tercios ----------
export function renderThirdsFatigue(data) {
  if (!data) return emptyMini('Faltan sesiones tiro-a-tiro finalizadas para calcular esto.');
  const groups = data.thirds.map((t, i) => ({
    label: 'Tercio ' + (i + 1),
    values: [t.resultPct, t.routinePct != null ? t.routinePct : 0],
  }));
  const seriesDefs = [
    { color: 'var(--chart-green)', label: 'Resultado (% del maximo)' },
    { color: 'var(--chart-gold)', label: 'Rutina cumplida (%)' },
  ];
  return renderGroupedBars(groups, seriesDefs) + noteHtml('Promedio de ' + data.sessionCount + ' sesiones (peso igual por sesion).');
}

// ---------- P5: Comparacion entre variantes ----------
export function renderVariantComparison(rows, variantLabels) {
  const withData = rows.filter((r) => !r.empty);
  if (withData.length < 2) return emptyMini('Faltan al menos 2 variantes con sesiones finalizadas para comparar.');
  const groups = rows.map((r) => ({
    label: r.key + (r.empty ? ' (sin datos)' : ' (' + r.count + ')'),
    values: r.empty ? [0, 0, 0] : [r.resultPct, r.thinkPct, r.playPct],
  }));
  const seriesDefs = [
    { color: 'var(--chart-green)', label: 'Resultado (% del maximo)' },
    { color: 'var(--chart-gold)', label: 'Think Box (%)' },
    { color: 'var(--chart-blue)', label: 'Play Box (%)' },
  ];
  return renderGroupedBars(groups, seriesDefs);
}

// ---------- P6: Circulo de 3 pies vs resultado (Variante D) ----------
export function renderCircleTrend(points) {
  if (points.length < 2) return emptyMini('Hace falta mas de 1 sesion finalizada de Variante D.');
  const w = 320, h = 120, padL = 26, padR = 10, padT = 10, padB = 16;
  const n = points.length;
  const xScale = (i) => padL + (n === 1 ? 0 : (i / (n - 1)) * (w - padL - padR));
  const yScale = (v) => (h - padB) - (v / 100) * (h - padT - padB);
  const lineFor = (key, color) => {
    const pts = points.map((p, i) => (p[key] == null ? null : { x: xScale(i), y: yScale(p[key]) })).filter(Boolean);
    if (pts.length < 2) return '';
    return '<polyline points="' + pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  };
  const axisY = '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (h - padB) + '" stroke="var(--line)" stroke-width="1"/>';
  const axisX = '<line x1="' + padL + '" y1="' + (h - padB) + '" x2="' + (w - padR) + '" y2="' + (h - padB) + '" stroke="var(--line)" stroke-width="1"/>';
  const svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:' + h + 'px;">' + axisY + axisX +
    lineFor('resultPct', 'var(--chart-green)') + lineFor('circlePct', 'var(--chart-gold)') + '</svg>';
  const legend = legendHtml([
    { color: 'var(--chart-green)', label: 'Resultado (% del maximo)' },
    { color: 'var(--chart-gold)', label: '% en circulo de 3 pies' },
  ]);
  return svg + legend;
}
