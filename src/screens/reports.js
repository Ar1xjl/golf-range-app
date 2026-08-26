// Reportes y estadisticas: resumen de TODA la practica, todas las
// variantes juntas, mas 6 analisis cruzados (gapping, rutina vs resultado,
// tendencia por bloque, fatiga por tercios, comparacion entre variantes,
// circulo de 3 pies) - cada uno cruza al menos dos variables o muestra
// dispersion/tendencia, no son metricas sueltas sin contexto. Complementa
// al Historial (detalle sesion por sesion de UNA variante), no lo reemplaza.
//
// Los filtros de variante de cada card son UI efimera de esta pantalla
// (no algo que otras pantallas necesiten leer) - viven en modulo, mismo
// patron que confirmingDeleteId en history.js.
//
// Los 6 analisis viven detras de "Ver analisis detallado" (showDetail, mas
// abajo) - por defecto se ve un resumen en lenguaje simple
// (buildReportInsights, en reportsSummary.js) mas los stats globales de
// siempre, que ya son bastante legibles de por si. El detalle no se saco,
// solo se movio un toque mas adentro: quien quiere el scatter/regresion lo
// sigue teniendo entero.

import { computeGlobalReport } from '../stats.js';
import { RESULT_MAX } from '../resultScale.js';
import { buildReportInsights } from '../reportsSummary.js';
import {
  computeGapping, computeRoutineVsResult, linearRegression, computeBlockTrend,
  computeThirdsFatigue, computeVariantComparison, computeCircleTrend,
} from '../reportsStats.js';
import {
  renderGapping, renderRoutineScatter, renderBlockTrend, renderThirdsFatigue,
  renderVariantComparison, renderCircleTrend,
} from './reportsCharts.js';

let gappingFilter = null; // null = todas las variantes A/B/C
let routineFilter = null; // null = todas (A/B/C/E)
let blockTrendVariant = null; // se inicializa a la primera con >=2 sesiones
let showDetail = false; // false = solo el resumen en lenguaje simple

function filterRowHtml(name, options, current) {
  return '<div class="gc-report-filter" data-filter="' + name + '">' +
    options.map((o) => '<div class="gc-report-filter-btn ' + (o.value === current ? 'sel' : '') + '" data-value="' + (o.value == null ? '' : o.value) + '">' + o.label + '</div>').join('') +
  '</div>';
}

export async function renderReports(ctx) {
  const { APP, state, render, db, VARIANT_ORDER } = ctx;
  const allSessions = await db.getAllSessions();
  const finished = allSessions.filter((s) => s.finished);
  const report = computeGlobalReport(finished);

  if (!finished.length) {
    APP.innerHTML =
      '<div class="gc-header">' +
        '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
        '<div class="gc-eyebrow">Menu</div>' +
        '<h1 class="gc-title">Reportes</h1>' +
      '</div>' +
      '<div class="gc-body"><div class="gc-card"><div class="gc-empty">Todavia no hay sesiones finalizadas para mostrar un reporte.</div></div></div>';
    document.getElementById('gc-back-btn').onclick = () => { state.screen = 'menu'; render(); };
    return;
  }

  // ---------- Resumen global (ya existia) ----------
  let trendChart = '';
  if (report.trend.length > 1) {
    const vals = report.trend;
    const w = 320, h = 90, pad = 10;
    const pts = vals.map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / (vals.length - 1);
      const y = h - pad - (v / RESULT_MAX) * (h - 2 * pad);
      return x + ',' + y;
    }).join(' ');
    const dots = vals.map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / (vals.length - 1);
      const y = h - pad - (v / RESULT_MAX) * (h - 2 * pad);
      return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="var(--chart-gold)"/>';
    }).join('');
    trendChart = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:90px;">' +
      '<polyline points="' + pts + '" fill="none" stroke="var(--chart-green)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' + dots + '</svg>';
  }

  // ---------- P1: Gapping por palo ----------
  const gappingRows = computeGapping(finished, gappingFilter);
  const gappingFilterHtml = filterRowHtml('gapping',
    [{ value: null, label: 'Todas' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }],
    gappingFilter);

  // ---------- P2: Rutina vs Resultado ----------
  const routinePoints = computeRoutineVsResult(finished, routineFilter);
  const routineFilterHtml = filterRowHtml('routine',
    [{ value: null, label: 'Todas' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'E', label: 'E' }],
    routineFilter);

  // ---------- P3: Tendencia por bloque ----------
  if (!blockTrendVariant || !finished.some((s) => s.key === blockTrendVariant)) {
    blockTrendVariant = VARIANT_ORDER.find((k) => finished.filter((s) => s.key === k).length >= 2) || VARIANT_ORDER.find((k) => finished.some((s) => s.key === k)) || VARIANT_ORDER[0];
  }
  const blockTrendData = computeBlockTrend(finished, blockTrendVariant);
  const blockTrendFilterHtml = filterRowHtml('blockTrend',
    VARIANT_ORDER.map((k) => ({ value: k, label: k })), blockTrendVariant);

  // ---------- P4: Fatiga por tercios ----------
  const thirdsData = computeThirdsFatigue(finished);

  // ---------- P5: Comparacion entre variantes ----------
  const sessionsByVariant = {};
  VARIANT_ORDER.forEach((k) => { sessionsByVariant[k] = finished.filter((s) => s.key === k); });
  const comparisonRows = computeVariantComparison(sessionsByVariant);

  // ---------- P6: Circulo de 3 pies (Variante D) ----------
  const circlePoints = computeCircleTrend(finished.filter((s) => s.key === 'D'));

  // ---------- Resumen en lenguaje simple (nuevo, vista por defecto) ----------
  const insights = buildReportInsights(finished);
  const insightsHtml = '<div class="gc-card">' +
    (insights.length
      ? insights.map((i) => '<div class="gc-insight-row"><span>' + i.icon + '</span><span>' + i.text + '</span></div>').join('')
      : '<div class="gc-empty">Todavia estamos juntando suficientes datos para un resumen - segui practicando o mira el detalle abajo.</div>') +
    '</div>' +
    '<button class="gc-btn gc-btn-ghost" id="gc-detail-toggle">' +
      (showDetail ? 'Ocultar analisis detallado ‹' : 'Ver analisis detallado (6) ›') +
    '</button>';

  const detailHtml = !showDetail ? '' :
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Gapping por palo</div>' +
        '<div class="gc-toggle-hint" style="margin-bottom:10px;">Distancia real promedio y rango (min-max) por palo/objetivo. Solo cuenta tiros con distancia cargada (Precision de A/B/C).</div>' +
        gappingFilterHtml + renderGapping(gappingRows) +
      '</div>' +

      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Rutina vs. resultado</div>' +
        '<div class="gc-toggle-hint" style="margin-bottom:10px;">Cada punto es un bloque: % de Think+Play Box cumplido vs. resultado promedio de ese bloque.</div>' +
        routineFilterHtml + renderRoutineScatter(routinePoints, linearRegression) +
      '</div>' +

      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Tendencia por bloque</div>' +
        '<div class="gc-toggle-hint" style="margin-bottom:10px;">Resultado promedio de cada bloque a traves de TODO el historial (no solo las ultimas 3 sesiones, como el foco sugerido del home) - distingue una racha mala puntual de una debilidad persistente.</div>' +
        blockTrendFilterHtml + renderBlockTrend(blockTrendData) +
      '</div>' +

      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Fatiga y calentamiento</div>' +
        '<div class="gc-toggle-hint" style="margin-bottom:10px;">Tus tiros divididos en 3 tercios por posicion dentro de la sesion (no por bloque). Si la barra dorada (rutina) cae antes que la verde (resultado), es una señal de alerta temprana.</div>' +
        renderThirdsFatigue(thirdsData) +
      '</div>' +

      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Comparacion entre variantes</div>' +
        '<div class="gc-toggle-hint" style="margin-bottom:10px;">Resultado (normalizado a %) y Think/Play Box de cada variante - una variante sistematicamente mas baja es señal de revisar el enfoque, no solo repetir mas.</div>' +
        renderVariantComparison(comparisonRows) +
      '</div>' +

      (circlePoints.length ? '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Circulo de 3 pies (Variante D)</div>' +
        '<div class="gc-toggle-hint" style="margin-bottom:10px;">% en circulo de 3 pies vs. resultado promedio, sesion a sesion - si se despegan, el puntaje subjetivo no esta siguiendo al dato objetivo.</div>' +
        renderCircleTrend(circlePoints) +
      '</div>' : '');

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">Menu</div>' +
      '<h1 class="gc-title">Reportes</h1>' +
      '<div class="gc-sub">Resumen de toda tu practica, todas las variantes.</div>' +
    '</div>' +
    '<div class="gc-body">' +
      '<div class="gc-card">' +
        '<div class="gc-stat-grid">' +
          '<div class="gc-stat"><div class="gc-stat-num">' + report.totalSessions + '</div><div class="gc-stat-label">Sesiones totales</div></div>' +
          '<div class="gc-stat"><div class="gc-stat-num">' + report.totalItems + '</div><div class="gc-stat-label">Tiros/putts registrados</div></div>' +
        '</div>' +
        '<div class="gc-stat-grid" style="margin-top:10px;">' +
          '<div class="gc-stat"><div class="gc-stat-num">' + report.streakWeeks + '</div><div class="gc-stat-label">Semanas seguidas</div></div>' +
          '<div class="gc-stat"><div class="gc-stat-num">' + (report.daysSinceLast != null ? report.daysSinceLast : '—') + '</div><div class="gc-stat-label">Dias desde la ultima</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="gc-card">' +
        '<div class="gc-stat-grid">' +
          '<div class="gc-stat"><div class="gc-stat-num">' + Math.round(report.pctThink * 100) + '%</div><div class="gc-stat-label">Think Box global</div></div>' +
          '<div class="gc-stat"><div class="gc-stat-num">' + Math.round(report.pctPlay * 100) + '%</div><div class="gc-stat-label">Play Box global</div></div>' +
        '</div>' +
      '</div>' +
      (report.trend.length > 1 ? '<div class="gc-card"><div class="gc-eyebrow" style="color:var(--green)">Resultado promedio por sesion (todas las variantes)</div>' + trendChart + '</div>' : '') +

      insightsHtml + detailHtml +
    '</div>';

  document.getElementById('gc-back-btn').onclick = () => { state.screen = 'menu'; render(); };
  document.getElementById('gc-detail-toggle').onclick = () => { showDetail = !showDetail; render(); };

  document.querySelectorAll('.gc-report-filter').forEach((row) => {
    row.querySelectorAll('.gc-report-filter-btn').forEach((btn) => {
      btn.onclick = () => {
        const val = btn.dataset.value || null;
        if (row.dataset.filter === 'gapping') gappingFilter = val;
        else if (row.dataset.filter === 'routine') routineFilter = val;
        else if (row.dataset.filter === 'blockTrend') blockTrendVariant = val;
        render();
      };
    });
  });
}
