// Definicion de las 5 variantes de sesion y sus builders de tiros/bloques.
// Portado 1:1 desde el prototipo original.

// ---------- Shot builders (per-tiro variants: A, B, C, E) ----------
function buildShots(count, objetivo, club, target, trackDistance) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({ objetivo, club, target, trackDistance: !!trackDistance, thinkBox: false, playBox: false, resultado: null, distancia: null });
  }
  return arr;
}

function buildAlternating(pattern, total, objetivo, trackDistance) {
  const arr = [];
  for (let i = 0; i < total; i++) {
    const [club, target] = pattern[i % pattern.length];
    arr.push({ objetivo, club, target, trackDistance: !!trackDistance, thinkBox: false, playBox: false, resultado: null, distancia: null });
  }
  return arr;
}

function buildSituational(situations) {
  // situations: [ [objetivo, club, target, count], ... ]
  const arr = [];
  situations.forEach(([objetivo, club, target, count]) => {
    for (let i = 0; i < count; i++) arr.push({ objetivo, club, target, trackDistance: false, thinkBox: false, playBox: false, resultado: null, distancia: null });
  });
  return arr;
}

// ---------- Variant A: Approach corto <120 yds ----------
function freshVariantA() {
  return {
    key: 'A', type: 'shots', name: 'Approach corto (<120 yds)',
    blocks: [
      { name: 'Calentamiento', shortLabel: 'Calentamiento', shots: buildShots(6, 'Activacion, sin objetivo de resultado', '56° / PW', '-') },
      { name: 'Precision por distancia', shortLabel: 'Precision', shots: buildAlternating(
        [['60°', '40 yds'], ['56°', '60 yds'], ['52°', '80 yds'], ['56°', '100 yds']], 24, 'Blanco especifico', true) },
      { name: 'Control de trayectoria', shortLabel: 'Trayectoria', shots: buildShots(8, 'Alternar tiro alto y bajo/controlado', '56°', 'Alto vs bajo') },
      { name: 'Simulacion de presion (up-and-down)', shortLabel: 'Presion', shots: buildShots(12, 'Posicion variada, registrar si queda a 1 putt', '60/56/52°', 'Salvar par') },
    ],
  };
}

// ---------- Variant B: Distancia media 120-150 yds ----------
function freshVariantB() {
  return {
    key: 'B', type: 'shots', name: 'Distancia media (120-150 yds)',
    blocks: [
      { name: 'Calentamiento', shortLabel: 'Calentamiento', shots: buildShots(6, 'Activacion, sin objetivo de resultado', 'PW / 9H', '-') },
      { name: 'Precision por distancia', shortLabel: 'Precision', shots: buildAlternating(
        [['PW', '120-130 yds'], ['9 Hierro', '130-140 yds'], ['8 Hierro', '140-150 yds'], ['9 Hierro', '130-140 yds']], 24, 'Blanco especifico', true) },
      { name: 'Control de viento / trayectoria', shortLabel: 'Viento', shots: buildShots(8, 'Trayectoria baja para viento', '9 Hierro', 'Bajo control') },
      { name: 'Simulacion de presion (10-Shot Shootout)', shortLabel: 'Presion', shots: buildShots(12, 'Alternar palo y blanco, rutina completa', 'PW / 9 / 8', 'Blanco variable') },
    ],
  };
}

// ---------- Variant C: Precision hierros largos 150-185 yds ----------
function freshVariantC() {
  return {
    key: 'C', type: 'shots', name: 'Precision hierros largos (150-185 yds)',
    blocks: [
      { name: 'Calentamiento', shortLabel: 'Calentamiento', shots: buildShots(4, 'Activacion, sin objetivo de resultado', 'PW / 9H', '-') },
      { name: 'Precision 150-185', shortLabel: 'Precision', shots: buildAlternating(
        [['7 Hierro', '150-160 yds'], ['6 Hierro', '160-170 yds'], ['5 Hierro', '175-185 yds']], 16, 'Blanco especifico, control de distancia', true) },
      { name: 'Simulacion de presion', shortLabel: 'Presion', shots: buildShots(8, 'Rutina completa, blanco variable', '5H / 6H / 7H', 'Blanco variable') },
      { name: 'Cierre con proposito', shortLabel: 'Cierre', shots: buildShots(4, 'Palo de confianza, cerrar en positivo', 'PW / SW', '<120 yds') },
    ],
  };
}

// ---------- Variant E: Drive y recuperacion ----------
function freshVariantE() {
  return {
    key: 'E', type: 'shots', name: 'Drive y recuperacion',
    blocks: [
      { name: 'Calentamiento', shortLabel: 'Calentamiento', shots: buildShots(6, 'Activacion, sin objetivo de resultado', 'PW / 9H', '-') },
      { name: 'Driver: precision de fairway', shortLabel: 'Driver', shots: buildShots(16, 'Blanco angosto, tempo relajado, no buscar distancia maxima', 'Driver', 'Fairway') },
      { name: 'Recuperacion (54-Shot Challenge)', shortLabel: 'Recuperacion', shots: buildSituational([
        ['Situacion 1: rough / pelota tapada - salir limpio', 'Hibrido 3 (19°)', 'Zona approach', 5],
        ['Situacion 2: obstaculo adelante - pegar bajo', 'Hierro medio', 'Pasar bajo', 5],
        ['Situacion 3: lie incomodo (pendiente)', 'Hierro medio', 'Contacto solido', 5],
        ['Situacion 4: layup inteligente (conservador)', '8/9 Hierro', 'Centro blanco', 5],
      ]) },
      { name: 'Cierre con proposito', shortLabel: 'Cierre', shots: buildShots(8, 'Approach de confianza, terminar en positivo', 'PW / SW', '<120 yds') },
    ],
  };
}

// ---------- Variant D: Putting semanal (registro por bloque) ----------
function freshVariantD() {
  return {
    key: 'D', type: 'blocks', name: 'Putting semanal',
    blocks: [
      { name: 'Calibracion de velocidad', shortLabel: 'Calibracion', objetivo: '5-6 putts desde ~15 pies, sentir la velocidad del green', cantidadSugerida: 6, cantidadReal: null, thinkBox: null, playBox: null, resultado: null, pctCirculo: null, notas: '' },
      { name: 'Ladder de distancia', shortLabel: 'Ladder', objetivo: 'Putts a 10/15/20/25/30 pies, dejar dentro del circulo de 3 pies', cantidadSugerida: 15, cantidadReal: null, thinkBox: null, playBox: null, resultado: null, pctCirculo: null, notas: '' },
      { name: 'Putts cortos de consolidacion', shortLabel: 'Consolidacion', objetivo: 'Jugar el putt de vuelta de cada lag del bloque anterior', cantidadSugerida: 15, cantidadReal: null, thinkBox: null, playBox: null, resultado: null, pctCirculo: null, notas: '' },
      { name: 'Simulacion de presion', shortLabel: 'Presion', objetivo: '6-8 posiciones distintas (distancia y quiebre variados), rutina completa', cantidadSugerida: 8, cantidadReal: null, thinkBox: null, playBox: null, resultado: null, pctCirculo: null, notas: '' },
    ],
  };
}

export const VARIANT_DEFS = {
  A: { label: 'Variante A — Approach corto', desc: '50 tiros · <120 yds', factory: freshVariantA },
  B: { label: 'Variante B — Distancia media', desc: '50 tiros · 120-150 yds', factory: freshVariantB },
  C: { label: 'Variante C — Precision hierros largos', desc: '32 tiros · 150-185 yds', factory: freshVariantC },
  D: { label: 'Variante D — Putting semanal', desc: '4 bloques · green real', factory: freshVariantD },
  E: { label: 'Variante E — Drive y recuperacion', desc: '50 tiros · fairway + plan B', factory: freshVariantE },
};

export const VARIANT_ORDER = ['A', 'B', 'C', 'D', 'E'];

export function flatten(session) {
  const flat = [];
  session.blocks.forEach((b, bi) => b.shots.forEach((s, si) => flat.push({ blockIndex: bi, blockName: b.name, shotIndex: si, ...s })));
  return flat;
}
