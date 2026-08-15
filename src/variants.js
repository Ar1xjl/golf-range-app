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

function buildAlternatingSituations(situations, total) {
  // Como buildSituational, pero interleaving las situaciones (1,2,3,4,1,2,3,4,...)
  // en vez de agruparlas en bloques consecutivos. situations: [ [objetivo, club, target], ... ]
  const arr = [];
  for (let i = 0; i < total; i++) {
    const [objetivo, club, target] = situations[i % situations.length];
    arr.push({ objetivo, club, target, trackDistance: false, thinkBox: false, playBox: false, resultado: null, distancia: null });
  }
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
      { name: 'Control de trayectoria', shortLabel: 'Trayectoria', shots: buildAlternating(
        [['56°', 'Tiro alto'], ['56°', 'Tiro bajo, controlado']], 8, 'Alternar la trayectoria golpe a golpe') },
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
      { name: 'Calentamiento', shortLabel: 'Calentamiento', shots: [
        ...buildShots(6, 'Activacion, sin objetivo de resultado', 'PW / 9H', '-'),
        ...buildShots(6, 'Foco en soltar el swing', 'Driver', '-'),
      ] },
      { name: 'Precision 150-185', shortLabel: 'Precision', shots: buildAlternating(
        [['7 Hierro', '150-160 yds'], ['6 Hierro', '160-170 yds'], ['5 Hierro', '175-185 yds']], 18, 'Blanco especifico, control de distancia', true) },
      { name: 'Recuperacion con hierros', shortLabel: 'Recuperacion', shots: buildAlternatingSituations([
        ['Rough / pelota tapada - salir bajo y limpio', 'Hibrido 3 / H5', 'Bajo y limpio'],
        ['Obstaculo adelante', 'H7', 'Fade / Draw'],
        ['Lie incomodo (pendiente)', 'Hierro medio', 'Contacto solido'],
        ['Layup inteligente (conservador)', 'H 8/9', 'Centro blanco'],
      ], 12) },
      { name: 'Cierre con proposito', shortLabel: 'Cierre', shots: buildShots(8, 'Palo de confianza, cerrar en positivo', 'PW / SW', '<120 yds') },
    ],
  };
}

// ---------- Variant E: Drive y recuperacion ----------
function freshVariantE() {
  return {
    key: 'E', type: 'shots', name: 'Drive y recuperacion',
    blocks: [
      { name: 'Calentamiento', shortLabel: 'Calentamiento', shots: buildShots(6, 'Activacion, sin objetivo de resultado', 'PW / 9H', '-') },
      // 1 de cada 4 tiros es "suelto" (maximo esfuerzo, sin cuidar la linea),
      // intercalado entre los de precision - no todo el bloque en fila.
      // Practicar SIEMPRE con cuidado/tentativo entrena un swing "steering"
      // que no ayuda en la cancha (Bob Rotella, "Golf is Not a Game of
      // Perfect": swings tentativos generan mas errores que confiar en el
      // swing completo); soltarse cada tanto tambien libera tension y evita
      // perder velocidad de cabeza de palo por exceso de control.
      { name: 'Driver: precision de fairway', shortLabel: 'Driver', shots: buildAlternatingSituations([
        ['Blanco angosto, tempo relajado, no buscar distancia maxima', 'Driver', 'Fairway'],
        ['Blanco angosto, tempo relajado, no buscar distancia maxima', 'Driver', 'Fairway'],
        ['Blanco angosto, tempo relajado, no buscar distancia maxima', 'Driver', 'Fairway'],
        ['Suelto - buscá tu velocidad maxima, sin preocuparte por la linea', 'Driver', 'Libre'],
      ], 16) },
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
  C: { label: 'Variante C — Precision hierros largos', desc: '50 tiros · 150-185 yds', factory: freshVariantC },
  D: { label: 'Variante D — Putting semanal', desc: '4 bloques · green real', factory: freshVariantD },
  E: { label: 'Variante E — Drive y recuperacion', desc: '50 tiros · fairway + plan B', factory: freshVariantE },
};

export const VARIANT_ORDER = ['A', 'B', 'C', 'D', 'E'];

export function flatten(session) {
  const flat = [];
  session.blocks.forEach((b, bi) => b.shots.forEach((s, si) => flat.push({ blockIndex: bi, blockName: b.name, shotIndex: si, ...s })));
  return flat;
}

// "3/24 tiros" o "2/4 bloques" - usado tanto en el Historial (fila "En
// progreso") como en el home ("Continuar sesion").
export function sessionProgressLabel(session) {
  if (session.type === 'blocks') {
    const done = session.blocks.filter((b) => b.resultado != null).length;
    return done + '/' + session.blocks.length + ' bloques';
  }
  const flat = flatten(session);
  const done = flat.filter((s) => s.resultado != null).length;
  return done + '/' + flat.length + ' tiros';
}

// Indice (en flatten()) del primer tiro sin responder, para saltar ahi al
// retomar una sesion tiro-a-tiro sin terminar. Si esta todo respondido
// (no deberia pasar en una sesion sin terminar), cae al ultimo tiro.
export function firstIncompleteFlatIndex(session) {
  const flat = flatten(session);
  const idx = flat.findIndex((s) => s.resultado == null);
  return idx === -1 ? Math.max(0, flat.length - 1) : idx;
}
