// Agregaciones para los graficos de Reportes (screens/reportsCharts.js +
// screens/reports.js). Separado de stats.js porque stats.js es "una sesion
// a la vez" (computeStats, suggestFocus) y esto es "todo el historial
// cruzado" - unidad de trabajo distinta, mismo dato de origen.
//
// Todo lee de sessions ya filtradas a finished:true (una sesion a medias no
// deberia entrar en ningun promedio - mismo criterio que computeGlobalReport
// en stats.js).

import { flatten } from './variants.js';
import { RESULT_MAX } from './resultScale.js';

const SHOT_VARIANTS = ['A', 'B', 'C', 'E']; // tiro-a-tiro (D es "blocks")

function pctRoutine(shots) {
  // % combinado de Think+Play Box cumplidos, sobre los tiros que ya tienen
  // algun dato registrado (no cuenta tiros sin tocar).
  const withData = shots.filter((s) => s.resultado != null);
  if (!withData.length) return null;
  const hits = withData.reduce((n, s) => n + (s.thinkBox ? 1 : 0) + (s.playBox ? 1 : 0), 0);
  return (hits / (withData.length * 2)) * 100;
}

function avgOf(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

// ---------- P1: Gapping por palo, con dispersion ----------
// Agrupa por (club, target) y no solo por club: en Variante A el mismo palo
// (56°) se usa para dos objetivos de distancia distinta (60 y 100 yds,
// medios swings a proposito) - agrupar solo por club mezclaria dos tiros
// bien ejecutados en una sola barra que parece "muy dispersa" sin serlo.
export function computeGapping(sessions, variantFilter) {
  const buckets = new Map();
  sessions
    .filter((s) => s.type === 'shots' && (!variantFilter || s.key === variantFilter))
    .forEach((s) => {
      flatten(s).forEach((shot) => {
        if (!shot.trackDistance || shot.distancia == null) return;
        const key = shot.club + '|' + shot.target;
        if (!buckets.has(key)) buckets.set(key, { club: shot.club, target: shot.target, distances: [] });
        buckets.get(key).distances.push(shot.distancia);
      });
    });
  const rows = Array.from(buckets.values()).map((b) => ({
    label: b.club + ' (' + b.target + ')',
    n: b.distances.length,
    avg: avgOf(b.distances),
    min: Math.min(...b.distances),
    max: Math.max(...b.distances),
  }));
  rows.sort((a, b) => a.avg - b.avg);
  return rows;
}

// ---------- P2: Think/Play Box (rutina) vs Resultado ----------
// Un punto por bloque de sesion tiro-a-tiro (mas puntos que "un punto por
// sesion", util con poco historial). Variante D queda afuera: ahi Think/Play
// Box es Si/Parcial/No por bloque entero, no hay un "%" granular real que
// cruzar como en las variantes tiro-a-tiro.
export function computeRoutineVsResult(sessions, variantFilter) {
  const points = [];
  sessions
    .filter((s) => s.type === 'shots' && (!variantFilter || s.key === variantFilter))
    .forEach((s) => {
      s.blocks.forEach((b) => {
        const pct = pctRoutine(b.shots);
        const results = b.shots.filter((sh) => sh.resultado != null).map((sh) => sh.resultado);
        const avg = avgOf(results);
        if (pct != null && avg != null) points.push({ pct, avg, n: results.length, blockName: b.shortLabel || b.name });
      });
    });
  return points;
}

// Regresion lineal simple (minimos cuadrados). Solo tiene sentido mostrarla
// con una muestra minima - el caller decide el umbral (8-10 puntos).
export function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((a, p) => a + p.pct, 0);
  const sumY = points.reduce((a, p) => a + p.avg, 0);
  const sumXY = points.reduce((a, p) => a + p.pct * p.avg, 0);
  const sumXX = points.reduce((a, p) => a + p.pct * p.pct, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ---------- P3: Tendencia por bloque, todo el historial ----------
// Una serie por bloque (posicion 0-3 dentro de la variante), a traves de
// TODAS las sesiones finalizadas de esa variante - a diferencia del "foco
// sugerido" del home, que solo mira las ultimas 3. El color de cada serie
// se asigna por INDICE de bloque (0=verde,1=dorado,2=azul,3=ciruela), fijo
// entre variantes, no por nombre (los nombres cambian segun la variante).
export function computeBlockTrend(sessions, variantKey) {
  const vSessions = sessions.filter((s) => s.key === variantKey).sort((a, b) => a.id - b.id);
  if (!vSessions.length) return null;
  const blockCount = vSessions[0].blocks.length;
  const blockNames = vSessions[0].blocks.map((b) => b.shortLabel || b.name);
  const series = Array.from({ length: blockCount }, () => []);
  vSessions.forEach((s) => {
    s.blocks.forEach((b, bi) => {
      if (bi >= blockCount) return;
      let avg;
      if (s.type === 'blocks') {
        avg = b.resultado;
      } else {
        const rs = b.shots.filter((sh) => sh.resultado != null).map((sh) => sh.resultado);
        avg = rs.length ? avgOf(rs) : null;
      }
      series[bi].push(avg);
    });
  });
  return { blockNames, series, sessionCount: vSessions.length };
}

// ---------- P4: Fatiga por tercios ----------
// Por sesion: divide los tiros (en el orden en que quedaron guardados, que
// coincide con el orden real de juego si se completa la sesion en secuencia
// - el flujo normal de la app) en 3 tercios por POSICION, no por bloque
// predefinido. Calcula resultado% y rutina% de cada tercio, y promedia esos
// 3 valores por sesion a traves de todas las sesiones (peso igual por
// sesion, no por cantidad de tiros - una variante con mas tiros no debe
// pesar mas que otra en el patron general).
export function computeThirdsFatigue(sessions) {
  const perSessionThirds = []; // cada item: [third0, third1, third2]
  sessions
    .filter((s) => s.type === 'shots' && SHOT_VARIANTS.includes(s.key))
    .forEach((s) => {
      const flat = flatten(s).filter((sh) => sh.resultado != null);
      if (flat.length < 3) return;
      const size = Math.ceil(flat.length / 3);
      const thirds = [flat.slice(0, size), flat.slice(size, size * 2), flat.slice(size * 2)];
      if (thirds.some((t) => !t.length)) return;
      perSessionThirds.push(thirds.map((t) => ({
        resultPct: (avgOf(t.map((sh) => sh.resultado)) / RESULT_MAX) * 100,
        routinePct: pctRoutine(t),
      })));
    });
  if (!perSessionThirds.length) return null;
  const thirds = [0, 1, 2].map((i) => ({
    resultPct: avgOf(perSessionThirds.map((s) => s[i].resultPct)),
    routinePct: avgOf(perSessionThirds.map((s) => s[i].routinePct).filter((v) => v != null)),
  }));
  return { thirds, sessionCount: perSessionThirds.length };
}

// ---------- P5: Comparacion entre variantes ----------
// Resultado normalizado a % (avg/RESULT_MAX*100) para poder mostrarlo en el
// mismo eje 0-100 que Think%/Play% - sin esto seria un grafico de doble eje
// (resultado 1-3 vs porcentajes), que no se lee bien de un vistazo.
export function computeVariantComparison(sessionsByVariant) {
  return Object.keys(sessionsByVariant).map((key) => {
    const list = sessionsByVariant[key];
    if (!list.length) return { key, empty: true };
    let totalItems = 0, weightedThink = 0, weightedPlay = 0, weightedResult = 0;
    list.forEach((s) => {
      let items, think, play, result;
      if (s.type === 'blocks') {
        const mapTF = (v) => (v === 'Si' ? 1 : (v === 'Parcial' ? 0.5 : (v === 'No' ? 0 : null)));
        const thinkVals = s.blocks.map((b) => mapTF(b.thinkBox)).filter((v) => v != null);
        const playVals = s.blocks.map((b) => mapTF(b.playBox)).filter((v) => v != null);
        const resultVals = s.blocks.map((b) => b.resultado).filter((v) => v != null);
        items = s.blocks.length;
        think = avgOf(thinkVals) || 0;
        play = avgOf(playVals) || 0;
        result = avgOf(resultVals) || 0;
      } else {
        const flat = flatten(s);
        items = flat.length;
        think = items ? flat.filter((sh) => sh.thinkBox).length / items : 0;
        play = items ? flat.filter((sh) => sh.playBox).length / items : 0;
        const rs = flat.filter((sh) => sh.resultado != null).map((sh) => sh.resultado);
        result = avgOf(rs) || 0;
      }
      totalItems += items;
      weightedThink += think * items;
      weightedPlay += play * items;
      weightedResult += result * items;
    });
    return {
      key, empty: false, count: list.length,
      resultPct: totalItems ? (weightedResult / totalItems / RESULT_MAX) * 100 : 0,
      thinkPct: totalItems ? (weightedThink / totalItems) * 100 : 0,
      playPct: totalItems ? (weightedPlay / totalItems) * 100 : 0,
    };
  });
}

// ---------- P6: Circulo de 3 pies vs resultado (Variante D) ----------
export function computeCircleTrend(dSessions) {
  const sorted = dSessions.slice().sort((a, b) => a.id - b.id);
  const points = sorted.map((s, i) => {
    const pctVals = s.blocks.map((b) => b.pctCirculo).filter((v) => v != null);
    const resultVals = s.blocks.map((b) => b.resultado).filter((v) => v != null);
    return {
      i, date: s.date,
      circlePct: pctVals.length ? avgOf(pctVals) : null,
      resultPct: resultVals.length ? (avgOf(resultVals) / RESULT_MAX) * 100 : null,
    };
  }).filter((p) => p.circlePct != null || p.resultPct != null);
  return points;
}
