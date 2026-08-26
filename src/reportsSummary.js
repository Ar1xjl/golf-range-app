// Resumen en lenguaje simple para la vista por defecto de Reportes -
// complementa (no reemplaza) los 6 analisis cruzados de reportsStats.js, que
// quedan un toque mas adentro detras de "Ver analisis detallado" (ver
// screens/reports.js). Cada insight reusa esas mismas agregaciones, no son
// metricas nuevas - solo se traducen a una frase con juicio (mejor/peor/
// estable), no solo un numero suelto.

import { computeGapping, computeThirdsFatigue } from './reportsStats.js';
import { computeStats } from './stats.js';

function weightedThinkPct(sessions) {
  let items = 0, weighted = 0;
  sessions.forEach((s) => {
    const st = computeStats(s);
    items += st.total;
    weighted += st.pctThink * st.total;
  });
  return items ? weighted / items : null;
}

// `finished` son sesiones ya filtradas a finished:true, todas las variantes -
// mismo insumo que computeGlobalReport. Devuelve hasta 3 insights; una lista
// vacia significa "todavia no hay suficiente historial", que el caller debe
// mostrar como mensaje aparte (ver reports.js).
export function buildReportInsights(finished) {
  const insights = [];

  // ---------- Think Box: primera mitad del historial vs. segunda mitad ----------
  if (finished.length >= 4) {
    const sorted = finished.slice().sort((a, b) => a.id - b.id);
    const mid = Math.floor(sorted.length / 2);
    const before = weightedThinkPct(sorted.slice(0, mid));
    const after = weightedThinkPct(sorted.slice(mid));
    if (before != null && after != null) {
      const beforePct = Math.round(before * 100);
      const afterPct = Math.round(after * 100);
      if (Math.abs(afterPct - beforePct) >= 3) {
        insights.push({
          icon: afterPct > beforePct ? '✅' : '⚠️',
          text: 'Tu Think Box ' + (afterPct > beforePct ? 'mejoró' : 'bajó') + ': ' + beforePct + '% → ' + afterPct + '%.',
        });
      } else {
        insights.push({ icon: '➖', text: 'Tu Think Box se mantiene estable, alrededor de ' + afterPct + '%.' });
      }
    }
  }

  // ---------- Gapping: palo/objetivo mas parejo, con muestra suficiente ----------
  const gappingRows = computeGapping(finished, null).filter((r) => r.n >= 3);
  if (gappingRows.length) {
    const tightest = gappingRows.reduce((a, b) => (b.max - b.min < a.max - a.min ? b : a));
    insights.push({
      icon: '🎯',
      text: 'Tu tiro más parejo es ' + tightest.label + ' (rango de ' + Math.round(tightest.max - tightest.min) + ' yardas).',
    });
  }

  // ---------- Fatiga: rutina del primer tercio vs. ultimo tercio de la sesion ----------
  const thirds = computeThirdsFatigue(finished);
  if (thirds && thirds.sessionCount >= 3 && thirds.thirds[0].routinePct != null && thirds.thirds[2].routinePct != null) {
    const first = thirds.thirds[0].routinePct;
    const last = thirds.thirds[2].routinePct;
    if (first - last >= 15) {
      insights.push({
        icon: '⚠️',
        text: 'Tu rutina cae en el último tercio de la sesión: ' + Math.round(first) + '% → ' + Math.round(last) + '% — señal de fatiga temprana.',
      });
    } else {
      insights.push({ icon: '✅', text: 'Tu rutina se mantiene pareja durante toda la sesión.' });
    }
  }

  return insights.slice(0, 3);
}
