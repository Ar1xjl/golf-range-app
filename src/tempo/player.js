// "Reproductor" global del Tempo Trainer: motor de audio + preferencias +
// wake lock, como singleton que sobrevive a la navegacion entre pantallas.
//
// Antes, el engine vivia adentro de screens/tempo.js y se destruia (dispose)
// cada vez que se salia de esa pantalla - a proposito, para nunca dejar
// audio sonando en segundo plano sin que el usuario lo vea. Pero eso hacia
// imposible usar el Tempo Trainer "en paralelo" a una sesion de practica
// (pedido real: escucharlo mientras registras tiros). La solucion no es
// dejarlo sonando sin avisar (ese es justo el problema que tuvimos con
// pestañas de prueba olvidadas) - es sacarlo de la pantalla y darle una UI
// propia, chica y siempre visible mientras suena (el mini-reproductor,
// #gc-mini-player en index.html), con un boton de Detener a mano sin
// importar en que pantalla estes.
//
// screens/tempo.js (la pantalla completa) pasa a ser una "vista" sobre este
// modulo: lee prefs de aca, y sus controles llaman a las funciones de aca
// en vez de manejar su propio engine.

import { createTempoEngine, TEMPO_ORDER, TEMPO_LABELS, getTempoPreset } from './engine.js';
import { createWakeLockHandle } from '../wakeLock.js';

export const ENGINES = ['natural', 'saber', 'relax'];
export const ENGINE_LABELS = { natural: 'Natural', saber: 'Saber', relax: 'Relax' };
export const ENGINE_NOTES = {
  natural: 'Ruido filtrado (bandpass), textura de swoosh/viento.',
  saber: 'Ring-modulation + waveshaper, timbre de sable de luz.',
  relax: 'Cuenco tibetano: parciales inarmonicos con leve beating. Sube el reverb para el efecto completo.',
};
// Cada motor recuerda su propio grave/agudo/reverb/dinamica - los ratios
// inarmonicos del Relax se van a zona de silbido con fundamentales altos
// (un cuenco real tampoco cubre 5 octavas), asi que arranca en una banda
// mas angosta y con mas cola de reverb que Natural/Saber.
const DEFAULT_PER_ENGINE = {
  natural: { freqLow: 260, freqHigh: 950, reverbWet: 0, reverbDecay: 45, dynamics: 1.0 },
  saber: { freqLow: 260, freqHigh: 950, reverbWet: 0, reverbDecay: 45, dynamics: 1.0 },
  relax: { freqLow: 440, freqHigh: 460, reverbWet: 48, reverbDecay: 55, dynamics: 1.5 },
};
const DEFAULT_PREFS = { tempo: 'pro-medium', soundMode: 'natural', tickEnabled: false };
const SETTINGS_ID = 'tempoTrainer';

let dbRef = null;
let prefs = null;
let engine = null;
let miniPlayerEl = null;
let onOpenFull = null;
const wakeLock = createWakeLockHandle();

async function loadPrefsFromDb(db) {
  const saved = await db.getSetting(SETTINGS_ID);
  const perEngine = {};
  ENGINES.forEach((k) => {
    perEngine[k] = { ...DEFAULT_PER_ENGINE[k], ...((saved && saved.perEngine && saved.perEngine[k]) || {}) };
  });
  // Valida contra las claves vigentes: alguien que probo la app antes de
  // los presets Garmin (o antes de los renames Sintetico/Organo -> Saber/
  // Relax) puede tener guardado un tempo/soundMode que ya no existe. Sin
  // este chequeo, TEMPOS[tempo] o perEngine[soundMode] da undefined y el
  // motor tira una excepcion en silencio apenas se toca Reproducir.
  const tempo = TEMPO_ORDER.includes(saved && saved.tempo) ? saved.tempo : DEFAULT_PREFS.tempo;
  const soundMode = ENGINES.includes(saved && saved.soundMode) ? saved.soundMode : DEFAULT_PREFS.soundMode;
  return { tempo, soundMode, tickEnabled: !!(saved && saved.tickEnabled), perEngine };
}

function persist() {
  if (dbRef && prefs) dbRef.saveSetting(SETTINGS_ID, prefs).catch(() => {});
}

// Se llama una sola vez desde main.js al arrancar la app. onOpenFull es el
// callback que main.js registra para navegar a la pantalla completa cuando
// se toca el mini-reproductor (asi este modulo no necesita saber nada de
// state/render de la app).
export async function initPlayer(db, opts) {
  dbRef = db;
  onOpenFull = (opts && opts.onOpenFull) || null;
  miniPlayerEl = document.getElementById('gc-mini-player');
  prefs = await loadPrefsFromDb(db);
}

async function ensureLoaded() {
  if (!prefs && dbRef) prefs = await loadPrefsFromDb(dbRef);
}

export function getPrefs() { return prefs; }
export function getCurrentEngineSettings() { return prefs.perEngine[prefs.soundMode]; }

function getEngineInstance() {
  if (!engine) {
    const eng = prefs.perEngine[prefs.soundMode];
    engine = createTempoEngine({ tempo: prefs.tempo, soundMode: prefs.soundMode, tickEnabled: prefs.tickEnabled, ...eng });
  }
  return engine;
}

export function isPlaying() { return !!engine && engine.isPlaying(); }
export function getCycleTiming() { return engine ? engine.getCycleTiming() : { cycleStartPerf: 0, cycleDurationMs: 1 }; }

export async function play() {
  await ensureLoaded();
  getEngineInstance().start();
  wakeLock.request();
  renderMiniPlayer();
}

// Unico lugar donde el engine se destruye por completo (audioCtx.close()) -
// solo cuando el usuario lo pide, desde la pantalla completa o desde el
// mini-reproductor. Nunca al navegar: ese es justo el punto de este modulo.
export function stop() {
  if (engine) { engine.dispose(); engine = null; }
  wakeLock.release();
  renderMiniPlayer();
}

export function setTempo(v) {
  prefs.tempo = v;
  if (engine) engine.setTempo(v);
  persist();
  renderMiniPlayer();
}

export function setSoundMode(v) {
  prefs.soundMode = v;
  const e = prefs.perEngine[v];
  if (engine) {
    engine.setSoundMode(v);
    engine.setFreqLow(e.freqLow); engine.setFreqHigh(e.freqHigh);
    engine.setReverbWet(e.reverbWet); engine.setReverbDecay(e.reverbDecay);
    engine.setDynamics(e.dynamics);
  }
  persist();
}

// Frecuencia/reverb/dinamica: viven en el objeto perEngine (mutado directo
// por la pantalla via getCurrentEngineSettings()) y solo se persisten
// cuando la pantalla llama a persistPrefs() explicitamente (en el
// 'onchange' del slider, no en cada 'oninput' mientras arrastras).
export function setFreqLow(v) { if (engine) engine.setFreqLow(v); }
export function setFreqHigh(v) { if (engine) engine.setFreqHigh(v); }
export function setReverbWet(v) { if (engine) engine.setReverbWet(v); }
export function setReverbDecay(v) { if (engine) engine.setReverbDecay(v); }
export function setDynamics(v) { if (engine) engine.setDynamics(v); }
export function setTickEnabled(v) { prefs.tickEnabled = v; if (engine) engine.setTickEnabled(v); persist(); }
export function persistPrefs() { persist(); }

function renderMiniPlayer() {
  if (!miniPlayerEl) return;
  if (!isPlaying()) {
    miniPlayerEl.innerHTML = '';
    document.body.classList.remove('has-mini-player');
    return;
  }
  document.body.classList.add('has-mini-player');
  miniPlayerEl.innerHTML =
    '<div class="gc-mini-player-inner" id="gc-mini-open">' +
      '<span class="gc-mini-dot"></span>' +
      '<span class="gc-mini-label">🎧 ' + TEMPO_LABELS[prefs.tempo] + '</span>' +
      '<button class="gc-mini-stop" id="gc-mini-stop">Detener</button>' +
    '</div>';
  document.getElementById('gc-mini-stop').onclick = (e) => { e.stopPropagation(); stop(); };
  document.getElementById('gc-mini-open').onclick = () => { if (onOpenFull) onOpenFull(); };
}

export { getTempoPreset };
