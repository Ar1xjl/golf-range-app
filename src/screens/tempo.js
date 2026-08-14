// Pantalla del Tempo Trainer. Unica pantalla de la app que NO hace un
// re-render completo en cada interaccion (el resto de las pantallas
// reconstruyen todo el innerHTML en cada cambio) - aca hay una animacion
// via requestAnimationFrame corriendo en paralelo al audio, y reconstruir
// el DOM del track/marcador en cada click cortaria esa animacion. El DOM se
// arma una sola vez al entrar a la pantalla y las interacciones lo
// manipulan directo, igual que hacia el prototipo original.
//
// Velocidad (6 presets estilo Garmin Tempo Trainer Pro), reverb, contraste
// dinamico y el motor Relax se disenaron y probaron en un artifact aparte
// ("Tempo Sound Lab") antes de llevarlos aca.

import { createTempoEngine, TEMPO_ORDER, TEMPO_LABELS } from '../tempo/engine.js';

const SETTINGS_ID = 'tempoTrainer';
const ENGINES = ['natural', 'saber', 'relax'];
const ENGINE_LABELS = { natural: 'Natural', saber: 'Saber', relax: 'Relax' };
const ENGINE_NOTES = {
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

// Singleton de modulo: solo puede haber una pantalla de Tempo Trainer activa
// a la vez. cleanupTempo() la apaga por completo (audio + rAF + wake lock)
// y se llama desde main.js en CUALQUIER camino de salida de esta pantalla.
let engine = null;
let prefs = null;
let rafId = null;
let wakeLockSentinel = null;

async function loadPrefs(db) {
  const saved = await db.getSetting(SETTINGS_ID);
  const perEngine = {};
  ENGINES.forEach((k) => {
    perEngine[k] = { ...DEFAULT_PER_ENGINE[k], ...((saved && saved.perEngine && saved.perEngine[k]) || {}) };
  });
  // Valida contra las claves vigentes: alguien que probo la app antes de
  // los presets Garmin (o antes de los renames Sintetico/Organo -> Saber/
  // Relax) puede tener guardado un tempo/soundMode que ya no existe
  // ('medio', 'starwars', 'organ'...). Sin este chequeo, TEMPOS[tempo] o
  // perEngine[soundMode] da undefined y el motor tira una excepcion en
  // silencio apenas se toca Reproducir - el boton no hace nada visible.
  const tempo = TEMPO_ORDER.includes(saved && saved.tempo) ? saved.tempo : DEFAULT_PREFS.tempo;
  const soundMode = ENGINES.includes(saved && saved.soundMode) ? saved.soundMode : DEFAULT_PREFS.soundMode;
  return {
    tempo,
    soundMode,
    tickEnabled: !!(saved && saved.tickEnabled),
    perEngine,
  };
}
function persistPrefs(db) {
  db.saveSetting(SETTINGS_ID, prefs).catch(() => {});
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { wakeLockSentinel = await navigator.wakeLock.request('screen'); } catch (e) { wakeLockSentinel = null; }
}
function releaseWakeLock() {
  if (wakeLockSentinel) { wakeLockSentinel.release().catch(() => {}); wakeLockSentinel = null; }
}

export function cleanupTempo() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (engine) { engine.dispose(); engine = null; }
  releaseWakeLock();
  prefs = null;
}

// "1,00 / 0,33 s" - back/down en segundos con coma decimal, para los
// golfistas mas tecnicos que quieren ver el numero exacto del preset
// (no solo el nombre), sin ocupar una linea vertical extra en el telefono.
function formatSeconds(v) { return v.toFixed(2).replace('.', ','); }
function tempoLabelHtml(tempoKey) {
  const t = engine.getTempoPreset(tempoKey);
  return TEMPO_LABELS[tempoKey] + ' <span class="tt-tempo-detail">(' + formatSeconds(t.back) + ' / ' + formatSeconds(t.down) + ' s)</span>';
}

function drawZones() {
  const t = engine.getTempoPreset(prefs.tempo);
  const total = t.back + t.pause + t.down + t.tail;
  const track = document.getElementById('tt-track');
  if (!track) return;
  const w = track.clientWidth;
  document.getElementById('tt-zone-back').style.width = ((t.back / total) * w) + 'px';
  document.getElementById('tt-zone-down').style.left = (((t.back + t.pause) / total) * w) + 'px';
  document.getElementById('tt-zone-down').style.width = ((t.down / total) * w) + 'px';
}

function stopMarkerLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  const marker = document.getElementById('tt-marker');
  if (marker) marker.style.left = '0px';
}
function startMarkerLoop() {
  const track = document.getElementById('tt-track');
  const marker = document.getElementById('tt-marker');
  if (!track || !marker) return;
  function step() {
    if (!engine.isPlaying()) { rafId = null; return; }
    const { cycleStartPerf, cycleDurationMs } = engine.getCycleTiming();
    const elapsed = performance.now() - cycleStartPerf;
    const frac = Math.max(0, Math.min(1, elapsed / cycleDurationMs));
    marker.style.left = (frac * (track.clientWidth - 6)) + 'px';
    rafId = requestAnimationFrame(step);
  }
  rafId = requestAnimationFrame(step);
}

export async function renderTempo(ctx) {
  const { APP, state, render, db } = ctx;
  if (!prefs) prefs = await loadPrefs(db);
  if (!engine) {
    const eng = prefs.perEngine[prefs.soundMode];
    engine = createTempoEngine({ tempo: prefs.tempo, soundMode: prefs.soundMode, tickEnabled: prefs.tickEnabled, ...eng });
  }

  const backTarget = state.returnScreen || 'home';
  const tempoIdx = Math.max(0, TEMPO_ORDER.indexOf(prefs.tempo));
  const eng = prefs.perEngine[prefs.soundMode];

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">Antes de jugar</div>' +
      '<h1 class="gc-title">Tempo Trainer</h1>' +
      '<div class="gc-sub">El tono baja durante el backswing y sube rapido hacia el impacto. Usa auriculares si podes.</div>' +
    '</div>' +
    '<div class="gc-body">' +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Velocidad de swing</div>' +
        '<div class="tt-tempo-label" id="tt-tempo-label">' + tempoLabelHtml(prefs.tempo) + '</div>' +
        '<input type="range" id="tt-tempo-slider" min="0" max="5" step="1" value="' + tempoIdx + '">' +
        '<div class="tt-tempo-ticks"><span>Amateur</span><span>Pro</span></div>' +

        '<div class="gc-eyebrow" style="color:var(--green); margin-top:18px;">Sonido</div>' +
        '<div class="tt-seg" id="tt-sound-seg">' +
          ENGINES.map((k) => '<div class="tt-seg-btn ' + (prefs.soundMode === k ? 'sel' : '') + '" data-sound="' + k + '">' + ENGINE_LABELS[k] + '</div>').join('') +
        '</div>' +
        '<div class="tt-note" id="tt-engine-note" style="margin-top:10px;">' + ENGINE_NOTES[prefs.soundMode] + '</div>' +

        '<button class="tt-play-btn" id="tt-play-btn">Reproducir</button>' +
        '<div class="tt-track" id="tt-track">' +
          '<div class="tt-track-zone tt-zone-back" id="tt-zone-back"></div>' +
          '<div class="tt-track-zone tt-zone-down" id="tt-zone-down"></div>' +
          '<div class="tt-marker" id="tt-marker" style="left:0px;"></div>' +
        '</div>' +
        '<div class="tt-labels"><span>Direccion</span><span>Cima</span><span>Impacto</span></div>' +
        '<div class="tt-note">Si no escuchas nada, revisa el switch de silencio del costado del telefono — iOS silencia el audio generado por esta app cuando esta activado.</div>' +
      '</div>' +

      '<details class="tt-settings-toggle" id="tt-settings-toggle">' +
        '<summary><span>Ajustes de sonido</span><span class="tt-chevron">+</span></summary>' +
        '<div class="tt-settings-body">' +
          '<div class="tt-sub-card">' +
            '<div class="gc-eyebrow" style="color:var(--green)">Reverb / eco</div>' +
            '<div class="tt-slider-row" style="margin-top:8px;">' +
              '<div class="tt-slider-label">Mezcla (wet) <span class="tt-val" id="tt-wet-val">' + eng.reverbWet + '%</span></div>' +
              '<input type="range" id="tt-wet-slider" min="0" max="60" step="1" value="' + eng.reverbWet + '">' +
            '</div>' +
            '<div class="tt-slider-row">' +
              '<div class="tt-slider-label">Decay (cola) <span class="tt-val" id="tt-decay-val">' + eng.reverbDecay + '</span></div>' +
              '<input type="range" id="tt-decay-slider" min="20" max="78" step="1" value="' + eng.reverbDecay + '">' +
            '</div>' +
          '</div>' +
          '<div class="tt-sub-card">' +
            '<div class="gc-eyebrow" style="color:var(--green)">Dinamica</div>' +
            '<div class="tt-slider-row" style="margin-top:8px;">' +
              '<div class="tt-slider-label">Contraste de volumen <span class="tt-val" id="tt-dyn-val">' + eng.dynamics.toFixed(2) + 'x</span></div>' +
              '<input type="range" id="tt-dyn-slider" min="60" max="170" step="5" value="' + Math.round(eng.dynamics * 100) + '">' +
            '</div>' +
            '<div class="tt-switch-row">' +
              '<div><div class="tt-switch-label">Tic en el impacto</div><div class="tt-switch-hint">Click seco justo en el momento del contacto</div></div>' +
              '<div class="tt-switch ' + (prefs.tickEnabled ? 'on' : '') + '" id="tt-tick-switch"><div class="tt-switch-knob"></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="tt-sub-card">' +
            '<div class="gc-eyebrow" style="color:var(--green)">Tono</div>' +
            '<div class="tt-slider-row" style="margin-top:8px;">' +
              '<div class="tt-slider-label">Grave (backswing) <span class="tt-val" id="tt-low-val">' + eng.freqLow + ' Hz</span></div>' +
              '<input type="range" id="tt-low-slider" min="60" max="600" step="10" value="' + eng.freqLow + '">' +
            '</div>' +
            '<div class="tt-slider-row">' +
              '<div class="tt-slider-label">Agudo (impacto) <span class="tt-val" id="tt-high-val">' + eng.freqHigh + ' Hz</span></div>' +
              '<input type="range" id="tt-high-slider" min="400" max="2200" step="10" value="' + eng.freqHigh + '">' +
            '</div>' +
            '<div class="tt-note">Cada motor recuerda su propio grave/agudo/reverb/dinamica.</div>' +
          '</div>' +
        '</div>' +
      '</details>' +
    '</div>';

  drawZones();

  document.getElementById('gc-back-btn').onclick = () => {
    state.returnScreen = null;
    state.screen = backTarget;
    render();
  };

  document.getElementById('tt-tempo-slider').oninput = (e) => {
    const idx = parseInt(e.target.value, 10);
    prefs.tempo = TEMPO_ORDER[idx];
    document.getElementById('tt-tempo-label').innerHTML = tempoLabelHtml(prefs.tempo);
    engine.setTempo(prefs.tempo);
    drawZones();
    persistPrefs(db);
  };

  document.querySelectorAll('#tt-sound-seg .tt-seg-btn').forEach((el) => {
    el.onclick = () => {
      document.querySelectorAll('#tt-sound-seg .tt-seg-btn').forEach((b) => b.classList.remove('sel'));
      el.classList.add('sel');
      prefs.soundMode = el.dataset.sound;
      const e2 = prefs.perEngine[prefs.soundMode];
      engine.setSoundMode(prefs.soundMode);
      engine.setFreqLow(e2.freqLow); engine.setFreqHigh(e2.freqHigh);
      engine.setReverbWet(e2.reverbWet); engine.setReverbDecay(e2.reverbDecay);
      engine.setDynamics(e2.dynamics);
      document.getElementById('tt-engine-note').textContent = ENGINE_NOTES[prefs.soundMode];
      document.getElementById('tt-wet-slider').value = e2.reverbWet;
      document.getElementById('tt-wet-val').textContent = e2.reverbWet + '%';
      document.getElementById('tt-decay-slider').value = e2.reverbDecay;
      document.getElementById('tt-decay-val').textContent = e2.reverbDecay;
      document.getElementById('tt-dyn-slider').value = Math.round(e2.dynamics * 100);
      document.getElementById('tt-dyn-val').textContent = e2.dynamics.toFixed(2) + 'x';
      document.getElementById('tt-low-slider').value = e2.freqLow;
      document.getElementById('tt-low-val').textContent = e2.freqLow + ' Hz';
      document.getElementById('tt-high-slider').value = e2.freqHigh;
      document.getElementById('tt-high-val').textContent = e2.freqHigh + ' Hz';
      persistPrefs(db);
    };
  });

  const wetSlider = document.getElementById('tt-wet-slider');
  wetSlider.oninput = (e) => {
    eng.reverbWet = parseInt(e.target.value, 10);
    document.getElementById('tt-wet-val').textContent = eng.reverbWet + '%';
    engine.setReverbWet(eng.reverbWet);
  };
  wetSlider.onchange = () => persistPrefs(db);

  const decaySlider = document.getElementById('tt-decay-slider');
  decaySlider.oninput = (e) => {
    eng.reverbDecay = parseInt(e.target.value, 10);
    document.getElementById('tt-decay-val').textContent = eng.reverbDecay;
    engine.setReverbDecay(eng.reverbDecay);
  };
  decaySlider.onchange = () => persistPrefs(db);

  const dynSlider = document.getElementById('tt-dyn-slider');
  dynSlider.oninput = (e) => {
    eng.dynamics = parseInt(e.target.value, 10) / 100;
    document.getElementById('tt-dyn-val').textContent = eng.dynamics.toFixed(2) + 'x';
    engine.setDynamics(eng.dynamics);
  };
  dynSlider.onchange = () => persistPrefs(db);

  document.getElementById('tt-tick-switch').onclick = function () {
    prefs.tickEnabled = !prefs.tickEnabled;
    this.classList.toggle('on', prefs.tickEnabled);
    engine.setTickEnabled(prefs.tickEnabled);
    persistPrefs(db);
  };

  const lowSlider = document.getElementById('tt-low-slider');
  lowSlider.oninput = (e) => {
    eng.freqLow = parseInt(e.target.value, 10);
    document.getElementById('tt-low-val').textContent = eng.freqLow + ' Hz';
    engine.setFreqLow(eng.freqLow);
  };
  lowSlider.onchange = () => persistPrefs(db);

  const highSlider = document.getElementById('tt-high-slider');
  highSlider.oninput = (e) => {
    eng.freqHigh = parseInt(e.target.value, 10);
    document.getElementById('tt-high-val').textContent = eng.freqHigh + ' Hz';
    engine.setFreqHigh(eng.freqHigh);
  };
  highSlider.onchange = () => persistPrefs(db);

  document.getElementById('tt-play-btn').onclick = function () {
    if (!engine.isPlaying()) {
      engine.start();
      requestWakeLock();
      startMarkerLoop();
      this.textContent = 'Detener';
      this.classList.add('playing');
    } else {
      engine.stop();
      releaseWakeLock();
      stopMarkerLoop();
      this.textContent = 'Reproducir';
      this.classList.remove('playing');
    }
  };
}
