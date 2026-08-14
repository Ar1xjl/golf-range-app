// Pantalla del Tempo Trainer. Unica pantalla de la app que NO hace un
// re-render completo en cada interaccion (el resto de las pantallas
// reconstruyen todo el innerHTML en cada cambio) - aca hay una animacion
// via requestAnimationFrame corriendo en paralelo al audio, y reconstruir
// el DOM del track/marcador en cada click de un segmented control cortaria
// esa animacion. En cambio, se construye el DOM una sola vez al entrar a la
// pantalla y las interacciones lo manipulan directo, igual que hacia el
// prototipo original (que tampoco tenia un re-render abstraido).

import { createTempoEngine } from '../tempo/engine.js';

const SETTINGS_ID = 'tempoTrainer';
const DEFAULT_PREFS = { tempo: 'medio', soundMode: 'natural', freqLow: 260, freqHigh: 950, tickEnabled: false };

// Singleton de modulo: solo puede haber una pantalla de Tempo Trainer activa
// a la vez. cleanupTempo() la apaga por completo (audio + rAF + wake lock)
// y se llama desde main.js en CUALQUIER camino de salida de esta pantalla.
let engine = null;
let prefs = null;
let rafId = null;
let wakeLockSentinel = null;

async function loadPrefs(db) {
  const saved = await db.getSetting(SETTINGS_ID);
  return saved ? { ...DEFAULT_PREFS, ...saved } : { ...DEFAULT_PREFS };
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
  if (!engine) engine = createTempoEngine(prefs);

  const backTarget = state.returnScreen || 'home';

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
        '<div class="tt-seg" id="tt-tempo-seg">' +
          '<div class="tt-seg-btn ' + (prefs.tempo === 'lento' ? 'sel' : '') + '" data-tempo="lento">Lento</div>' +
          '<div class="tt-seg-btn ' + (prefs.tempo === 'medio' ? 'sel' : '') + '" data-tempo="medio">Medio</div>' +
          '<div class="tt-seg-btn ' + (prefs.tempo === 'rapido' ? 'sel' : '') + '" data-tempo="rapido">Rapido</div>' +
        '</div>' +
        '<div class="gc-eyebrow" style="color:var(--green); margin-top:16px;">Sonido</div>' +
        '<div class="tt-seg" id="tt-sound-seg">' +
          '<div class="tt-seg-btn ' + (prefs.soundMode === 'natural' ? 'sel' : '') + '" data-sound="natural">Natural (swoosh)</div>' +
          '<div class="tt-seg-btn ' + (prefs.soundMode === 'organ' ? 'sel' : '') + '" data-sound="organ">Organo</div>' +
          '<div class="tt-seg-btn ' + (prefs.soundMode === 'starwars' ? 'sel' : '') + '" data-sound="starwars">Star Wars</div>' +
        '</div>' +
        '<div class="tt-slider-row">' +
          '<div class="tt-slider-label">Tono grave (backswing) <span class="tt-val" id="tt-low-val">' + prefs.freqLow + ' Hz</span></div>' +
          '<input type="range" id="tt-low-slider" min="60" max="600" value="' + prefs.freqLow + '" step="10">' +
        '</div>' +
        '<div class="tt-slider-row">' +
          '<div class="tt-slider-label">Tono agudo (impacto) <span class="tt-val" id="tt-high-val">' + prefs.freqHigh + ' Hz</span></div>' +
          '<input type="range" id="tt-high-slider" min="400" max="2200" value="' + prefs.freqHigh + '" step="10">' +
        '</div>' +
        '<div class="tt-switch-row">' +
          '<div><div class="tt-switch-label">Tic en el impacto</div><div class="tt-switch-hint">Click seco justo en el momento del contacto</div></div>' +
          '<div class="tt-switch ' + (prefs.tickEnabled ? 'on' : '') + '" id="tt-tick-switch"><div class="tt-switch-knob"></div></div>' +
        '</div>' +
        '<button class="tt-play-btn" id="tt-play-btn">Reproducir</button>' +
        '<div class="tt-track" id="tt-track">' +
          '<div class="tt-track-zone tt-zone-back" id="tt-zone-back"></div>' +
          '<div class="tt-track-zone tt-zone-down" id="tt-zone-down"></div>' +
          '<div class="tt-marker" id="tt-marker" style="left:0px;"></div>' +
        '</div>' +
        '<div class="tt-labels"><span>Direccion</span><span>Cima</span><span>Impacto</span></div>' +
        '<div class="tt-note">Si no escuchas nada, revisa el switch de silencio del costado del telefono — iOS silencia el audio generado por esta app cuando esta activado. Proporcion 3:1 (backswing:downswing) en las 3 velocidades. "Natural" usa ruido filtrado (textura de viento). "Organo" usa sintesis aditiva (fundamental + 2 armonicos). "Star Wars" usa ring-modulation. Los tres siguen la misma curva de velocidad de la cabeza del palo.</div>' +
      '</div>' +
    '</div>';

  drawZones();

  document.getElementById('gc-back-btn').onclick = () => {
    state.returnScreen = null;
    state.screen = backTarget;
    render();
  };

  document.querySelectorAll('#tt-tempo-seg .tt-seg-btn').forEach((el) => {
    el.onclick = () => {
      document.querySelectorAll('#tt-tempo-seg .tt-seg-btn').forEach((b) => b.classList.remove('sel'));
      el.classList.add('sel');
      prefs.tempo = el.dataset.tempo;
      engine.setTempo(prefs.tempo);
      drawZones();
      persistPrefs(db);
    };
  });

  document.querySelectorAll('#tt-sound-seg .tt-seg-btn').forEach((el) => {
    el.onclick = () => {
      document.querySelectorAll('#tt-sound-seg .tt-seg-btn').forEach((b) => b.classList.remove('sel'));
      el.classList.add('sel');
      prefs.soundMode = el.dataset.sound;
      engine.setSoundMode(prefs.soundMode);
      persistPrefs(db);
    };
  });

  const lowSlider = document.getElementById('tt-low-slider');
  lowSlider.oninput = (e) => {
    prefs.freqLow = parseInt(e.target.value, 10);
    document.getElementById('tt-low-val').textContent = prefs.freqLow + ' Hz';
    engine.setFreqLow(prefs.freqLow);
  };
  lowSlider.onchange = () => persistPrefs(db);

  const highSlider = document.getElementById('tt-high-slider');
  highSlider.oninput = (e) => {
    prefs.freqHigh = parseInt(e.target.value, 10);
    document.getElementById('tt-high-val').textContent = prefs.freqHigh + ' Hz';
    engine.setFreqHigh(prefs.freqHigh);
  };
  highSlider.onchange = () => persistPrefs(db);

  document.getElementById('tt-tick-switch').onclick = function () {
    prefs.tickEnabled = !prefs.tickEnabled;
    this.classList.toggle('on', prefs.tickEnabled);
    engine.setTickEnabled(prefs.tickEnabled);
    persistPrefs(db);
  };

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
