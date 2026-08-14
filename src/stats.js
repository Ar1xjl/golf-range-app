// Estadisticas unificadas para variantes tiro-a-tiro y variantes por bloque
// (putting), y el "foco sugerido" basado en el bloque de peor rendimiento
// en las ultimas 3 sesiones. Portado 1:1 desde el prototipo.

import { flatten } from './variants.js';

export function computeStats(session) {
  if (session.type === 'blocks') {
    const blocks = session.blocks;
    const total = blocks.reduce((sum, b) => sum + (b.cantidadReal != null ? b.cantidadReal : (b.cantidadSugerida || 0)), 0);
    const mapTF = (v) => (v === 'Si' ? 1 : (v === 'Parcial' ? 0.5 : (v === 'No' ? 0 : null)));
    const thinkVals = blocks.map((b) => mapTF(b.thinkBox)).filter((v) => v != null);
    const playVals = blocks.map((b) => mapTF(b.playBox)).filter((v) => v != null);
    const resultVals = blocks.map((b) => b.resultado).filter((v) => v != null);
    const pctThink = thinkVals.length ? thinkVals.reduce((a, b) => a + b, 0) / thinkVals.length : 0;
    const pctPlay = playVals.length ? playVals.reduce((a, b) => a + b, 0) / playVals.length : 0;
    const avgResultado = resultVals.length ? resultVals.reduce((a, b) => a + b, 0) / resultVals.length : 0;
    const byBlock = blocks.map((b) => ({ name: b.shortLabel || b.name, avg: b.resultado }));
    return { total, pctThink, pctPlay, avgResultado, byBlock };
  }

  const flat = flatten(session);
  const total = flat.length;
  const think = flat.filter((s) => s.thinkBox).length;
  const play = flat.filter((s) => s.playBox).length;
  const results = flat.filter((s) => s.resultado != null).map((s) => s.resultado);
  const avg = results.length ? results.reduce((a, b) => a + b, 0) / results.length : 0;

  const byBlock = session.blocks.map((b) => {
    const rs = b.shots.filter((s) => s.resultado != null).map((s) => s.resultado);
    return { name: b.shortLabel || b.name, avg: rs.length ? rs.reduce((a, b2) => a + b2, 0) / rs.length : null };
  });

  return { total, pctThink: total ? think / total : 0, pctPlay: total ? play / total : 0, avgResultado: avg, byBlock };
}

// Semana calendario (lunes) como timestamp, para calcular la racha.
function weekStart(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Semanas seguidas (incluyendo la actual) con al menos una sesion.
function computeWeekStreak(dates) {
  if (!dates.length) return 0;
  const weeks = new Set(dates.map(weekStart));
  let streak = 0;
  let cursor = weekStart(new Date());
  while (weeks.has(cursor)) {
    streak++;
    cursor -= 7 * 86400000;
  }
  return streak;
}

// Resumen global para la pantalla de Reportes: junta TODAS las sesiones
// finalizadas (todas las variantes) en una sola foto. `sessions` debe venir
// ya filtrado a finished:true - una sesion a medias no deberia contar en
// ningun promedio.
export function computeGlobalReport(sessions) {
  const sorted = sessions.slice().sort((a, b) => a.id - b.id);
  let totalItems = 0, weightedThink = 0, weightedPlay = 0;
  const trend = [];
  sorted.forEach((s) => {
    const st = computeStats(s);
    totalItems += st.total;
    weightedThink += st.pctThink * st.total;
    weightedPlay += st.pctPlay * st.total;
    trend.push(st.avgResultado);
  });
  const lastDate = sorted.length ? new Date(sorted[sorted.length - 1].date) : null;
  const daysSinceLast = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 86400000) : null;
  return {
    totalSessions: sorted.length,
    totalItems,
    pctThink: totalItems ? weightedThink / totalItems : 0,
    pctPlay: totalItems ? weightedPlay / totalItems : 0,
    daysSinceLast,
    streakWeeks: computeWeekStreak(sorted.map((s) => new Date(s.date))),
    trend,
  };
}

export function suggestFocus(history) {
  if (!history.length) return null;
  const last3 = history.slice(-3);
  const blockAverages = {};
  last3.forEach((s) => {
    const stats = computeStats(s);
    stats.byBlock.forEach((b) => {
      if (b.avg == null) return;
      if (!blockAverages[b.name]) blockAverages[b.name] = [];
      blockAverages[b.name].push(b.avg);
    });
  });
  let worst = null;
  Object.keys(blockAverages).forEach((name) => {
    const vals = blockAverages[name];
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (!worst || avg < worst.avg) worst = { name, avg };
  });
  return worst;
}
