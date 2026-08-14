// Reportes y estadisticas: resumen de TODA la practica, todas las
// variantes juntas. Complementa (no reemplaza) el Historial por variante -
// ese sigue siendo el lugar para el detalle sesion por sesion de una sola
// variante; esto es el vistazo general. Accesible desde el menu.

import { computeGlobalReport } from '../stats.js';

export async function renderReports(ctx) {
  const { APP, state, render, db, computeStats, VARIANT_DEFS, VARIANT_ORDER } = ctx;
  const allSessions = await db.getAllSessions();
  const finished = allSessions.filter((s) => s.finished);
  const report = computeGlobalReport(finished);

  const variantRows = [];
  for (const key of VARIANT_ORDER) {
    const hist = await db.loadAllForVariant(key);
    const v = VARIANT_DEFS[key];
    const name = v.label.split('—')[1].trim();
    if (!hist.length) { variantRows.push({ key, name, empty: true }); continue; }
    const last = hist[hist.length - 1];
    const prev = hist.length > 1 ? hist[hist.length - 2] : null;
    const lastStats = computeStats(last);
    const diff = prev ? lastStats.avgResultado - computeStats(prev).avgResultado : null;
    variantRows.push({ key, name, avg: lastStats.avgResultado, diff, count: hist.length });
  }

  let trendChart = '';
  if (report.trend.length > 1) {
    const vals = report.trend;
    const w = 400, h = 90, pad = 10;
    const pts = vals.map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / (vals.length - 1);
      const y = h - pad - (v / 5) * (h - 2 * pad);
      return x + ',' + y;
    }).join(' ');
    const dots = vals.map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / (vals.length - 1);
      const y = h - pad - (v / 5) * (h - 2 * pad);
      return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#C79A3E"/>';
    }).join('');
    trendChart = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:90px;">' +
      '<polyline points="' + pts + '" fill="none" stroke="#2F5233" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' + dots + '</svg>';
  }

  const variantRowsHtml = variantRows.map((r) => {
    if (r.empty) return '<div class="gc-hist-row"><span>' + r.key + ' — ' + r.name + '</span><span class="gc-mono" style="color:var(--ink-soft);">sin datos</span></div>';
    const arrow = r.diff == null ? '' : (r.diff >= 0 ? ' ▲' : ' ▼');
    return '<div class="gc-hist-row"><span>' + r.key + ' — ' + r.name + ' <span style="color:var(--ink-soft);">(' + r.count + ')</span></span><span class="gc-mono">' + r.avg.toFixed(1) + '/5' + arrow + '</span></div>';
  }).join('');

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">Menu</div>' +
      '<h1 class="gc-title">Reportes</h1>' +
      '<div class="gc-sub">Resumen de toda tu practica, todas las variantes.</div>' +
    '</div>' +
    '<div class="gc-body">' +
      (report.totalSessions === 0
        ? '<div class="gc-card"><div class="gc-empty">Todavia no hay sesiones finalizadas para mostrar un reporte.</div></div>'
        : '<div class="gc-card"><div class="gc-stat-grid">' +
            '<div class="gc-stat"><div class="gc-stat-num">' + report.totalSessions + '</div><div class="gc-stat-label">Sesiones totales</div></div>' +
            '<div class="gc-stat"><div class="gc-stat-num">' + report.totalItems + '</div><div class="gc-stat-label">Tiros/putts registrados</div></div>' +
            '<div class="gc-stat"><div class="gc-stat-num">' + report.streakWeeks + '</div><div class="gc-stat-label">Semanas seguidas</div></div>' +
            '<div class="gc-stat"><div class="gc-stat-num">' + (report.daysSinceLast == null ? '—' : report.daysSinceLast) + '</div><div class="gc-stat-label">Dias desde la ultima</div></div>' +
          '</div></div>' +
          (report.trend.length > 1 ? '<div class="gc-card"><div class="gc-eyebrow" style="color:var(--green)">Resultado promedio por sesion (todas las variantes)</div>' + trendChart + '</div>' : '') +
          '<div class="gc-card"><div class="gc-stat-grid">' +
            '<div class="gc-stat"><div class="gc-stat-num">' + Math.round(report.pctThink * 100) + '%</div><div class="gc-stat-label">Think Box global</div></div>' +
            '<div class="gc-stat"><div class="gc-stat-num">' + Math.round(report.pctPlay * 100) + '%</div><div class="gc-stat-label">Play Box global</div></div>' +
          '</div></div>' +
          '<div class="gc-card"><div class="gc-eyebrow" style="color:var(--green)">Por variante</div>' + variantRowsHtml + '</div>') +
    '</div>';

  document.getElementById('gc-back-btn').onclick = () => { state.screen = 'menu'; render(); };
}
