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
