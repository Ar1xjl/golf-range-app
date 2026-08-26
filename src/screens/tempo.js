// Pantalla completa del Tempo Trainer. Es una "vista" sobre
// src/tempo/player.js: no es dueña del motor de audio ni de las
// preferencias (eso ahora es global, para poder sonar en paralelo a una
// sesion via el mini-reproductor) - solo lee su estado y llama a sus
// funciones.
//
// Sigue siendo la unica pantalla que NO hace un re-render completo en cada
// interaccion: la barra/marcador anima via requestAnimationFrame en
// paralelo al audio, y reconstruir su DOM en cada click cortaria esa
// animacion. Eso si es local a esta pantalla (rafId de abajo) - se para al
// salir, pero el audio en si sigue via player.js.
//
// Velocidad (6 presets estilo Garmin Tempo Trainer Pro), reverb, contraste
// dinamico y el motor Relax se disenaron y probaron en un artifact aparte
// ("Tempo Sound Lab") antes de llevarlos aca.

import { TEMPO_LABELS } from '../tempo/engine.js';
import * as player from '../tempo/player.js';
import { MOVEMENT_TYPES, MOVEMENT_LABELS } from '../tempo/player.js';

let rafId = null;

export function cleanupTempoScreen() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

// "1,00 / 0,33 s" - back/down en segundos con coma decimal, para los
// golfistas mas tecnicos que quieren ver el numero exacto del preset
// (no solo el nombre), sin ocupar una linea vertical extra en el telefono.
function formatSeconds(v) { return v.toFixed(2).replace('.', ','); }
function tempoLabelHtml(tempoKey) {
  const t = player.getTempoPreset(tempoKey);
  return TEMPO_LABELS[tempoKey] + ' <span class="tt-tempo-detail">(' + formatSeconds(t.back) + ' / ' + formatSeconds(t.down) + ' s)</span>';
}

function drawZones(tempoKey) {
  const t = player.getTempoPreset(tempoKey);
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
    if (!player.isPlaying()) { rafId = null; return; }
    const { cycleStartPerf, cycleDurationMs } = player.getCycleTiming();
    const elapsed = performance.now() - cycleStartPerf;
    const frac = Math.max(0, Math.min(1, elapsed / cycleDurationMs));
    marker.style.left = (frac * (track.clientWidth - 6)) + 'px';
    rafId = requestAnimationFrame(step);
  }
  rafId = requestAnimationFrame(step);
}

export async function renderTempo(ctx) {
  const { APP, state, render } = ctx;
  if (!player.getPrefs()) await player.initPlayer(ctx.db);
  const prefs = player.getPrefs();

  const backTarget = state.returnScreen || 'home';
  const activeTempo = player.getActiveTempo();
  const activeOrder = player.getActiveTempoOrder();
  const tempoIdx = Math.max(0, activeOrder.indexOf(activeTempo));
  const eng = player.getCurrentEngineSettings();
  const playing = player.isPlaying();

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">Antes de jugar</div>' +
      '<h1 class="gc-title">Tempo Trainer</h1>' +
      '<div class="gc-sub">El tono baja durante el backswing y sube rapido hacia el impacto. Usa auriculares si podes.</div>' +
    '</div>' +
    '<div class="gc-body">' +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Tipo de movimiento</div>' +
        '<div class="tt-seg" id="tt-movement-seg">' +
          MOVEMENT_TYPES.map((k) => '<div class="tt-seg-btn ' + (prefs.movementType === k ? 'sel' : '') + '" data-movement="' + k + '">' + MOVEMENT_LABELS[k] + '</div>').join('') +
        '</div>' +

        '<div class="gc-eyebrow" style="color:var(--green); margin-top:18px;" id="tt-tempo-eyebrow">' + (prefs.movementType === 'putt' ? 'Velocidad de putt' : 'Velocidad de swing') + '</div>' +
        '<div class="tt-tempo-label" id="tt-tempo-label">' + tempoLabelHtml(activeTempo) + '</div>' +
        '<input type="range" id="tt-tempo-slider" min="0" max="' + (activeOrder.length - 1) + '" step="1" value="' + tempoIdx + '">' +
        '<div class="tt-tempo-ticks" id="tt-tempo-ticks">' + (prefs.movementType === 'putt' ? '<span>Lento</span><span>Rapido</span>' : '<span>Amateur</span><span>Pro</span>') + '</div>' +

        '<div class="gc-eyebrow" style="color:var(--green); margin-top:18px;">Sonido</div>' +
        '<div class="tt-seg" id="tt-sound-seg">' +
          player.ENGINES.map((k) => '<div class="tt-seg-btn ' + (prefs.soundMode === k ? 'sel' : '') + '" data-sound="' + k + '">' + player.ENGINE_LABELS[k] + '</div>').join('') +
        '</div>' +
        '<div class="tt-note" id="tt-engine-note" style="margin-top:10px;">' + player.ENGINE_NOTES[prefs.soundMode] + '</div>' +

        '<button class="tt-play-btn ' + (playing ? 'playing' : '') + '" id="tt-play-btn">' + (playing ? 'Detener' : 'Reproducir') + '</button>' +
        '<div class="tt-track" id="tt-track">' +
          '<div class="tt-track-zone tt-zone-back" id="tt-zone-back"></div>' +
          '<div class="tt-track-zone tt-zone-down" id="tt-zone-down"></div>' +
          '<div class="tt-marker" id="tt-marker" style="left:0px;"></div>' +
        '</div>' +
        '<div class="tt-labels"><span>Direccion</span><span>Cima</span><span>Impacto</span></div>' +
        '<div class="tt-note">Si no escuchas nada, revisa el switch de silencio del costado del telefono — iOS silencia el audio generado por esta app cuando esta activado. Sigue sonando si navegas a otra pantalla — mira el mini-reproductor abajo para pararlo.</div>' +
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

  drawZones(activeTempo);
  if (playing) startMarkerLoop();

  document.getElementById('gc-back-btn').onclick = () => {
    state.returnScreen = null;
    state.screen = backTarget;
    render();
  };

  document.getElementById('tt-tempo-slider').oninput = (e) => {
    const idx = parseInt(e.target.value, 10);
    const tempo = player.getActiveTempoOrder()[idx];
    document.getElementById('tt-tempo-label').innerHTML = tempoLabelHtml(tempo);
    player.setTempo(tempo);
    drawZones(tempo);
  };

  document.querySelectorAll('#tt-movement-seg .tt-seg-btn').forEach((el) => {
    el.onclick = () => {
      if (el.dataset.movement === player.getPrefs().movementType) return;
      document.querySelectorAll('#tt-movement-seg .tt-seg-btn').forEach((b) => b.classList.remove('sel'));
      el.classList.add('sel');
      player.setMovementType(el.dataset.movement);

      const newOrder = player.getActiveTempoOrder();
      const newTempo = player.getActiveTempo();
      document.getElementById('tt-tempo-eyebrow').textContent = el.dataset.movement === 'putt' ? 'Velocidad de putt' : 'Velocidad de swing';
      document.getElementById('tt-tempo-label').innerHTML = tempoLabelHtml(newTempo);
      const slider = document.getElementById('tt-tempo-slider');
      slider.max = newOrder.length - 1;
      slider.value = Math.max(0, newOrder.indexOf(newTempo));
      document.getElementById('tt-tempo-ticks').innerHTML = el.dataset.movement === 'putt' ? '<span>Lento</span><span>Rapido</span>' : '<span>Amateur</span><span>Pro</span>';
      drawZones(newTempo);
    };
  });

  document.querySelectorAll('#tt-sound-seg .tt-seg-btn').forEach((el) => {
    el.onclick = () => {
      document.querySelectorAll('#tt-sound-seg .tt-seg-btn').forEach((b) => b.classList.remove('sel'));
      el.classList.add('sel');
      player.setSoundMode(el.dataset.sound);
      const e2 = player.getCurrentEngineSettings();
      document.getElementById('tt-engine-note').textContent = player.ENGINE_NOTES[el.dataset.sound];
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
    };
  });

  const wetSlider = document.getElementById('tt-wet-slider');
  wetSlider.oninput = (e) => {
    eng.reverbWet = parseInt(e.target.value, 10);
    document.getElementById('tt-wet-val').textContent = eng.reverbWet + '%';
    player.setReverbWet(eng.reverbWet);
  };
  wetSlider.onchange = () => player.persistPrefs();

  const decaySlider = document.getElementById('tt-decay-slider');
  decaySlider.oninput = (e) => {
    eng.reverbDecay = parseInt(e.target.value, 10);
    document.getElementById('tt-decay-val').textContent = eng.reverbDecay;
    player.setReverbDecay(eng.reverbDecay);
  };
  decaySlider.onchange = () => player.persistPrefs();

  const dynSlider = document.getElementById('tt-dyn-slider');
  dynSlider.oninput = (e) => {
    eng.dynamics = parseInt(e.target.value, 10) / 100;
    document.getElementById('tt-dyn-val').textContent = eng.dynamics.toFixed(2) + 'x';
    player.setDynamics(eng.dynamics);
  };
  dynSlider.onchange = () => player.persistPrefs();

  document.getElementById('tt-tick-switch').onclick = function () {
    const v = !player.getPrefs().tickEnabled;
    this.classList.toggle('on', v);
    player.setTickEnabled(v);
  };

  const lowSlider = document.getElementById('tt-low-slider');
  lowSlider.oninput = (e) => {
    eng.freqLow = parseInt(e.target.value, 10);
    document.getElementById('tt-low-val').textContent = eng.freqLow + ' Hz';
    player.setFreqLow(eng.freqLow);
  };
  lowSlider.onchange = () => player.persistPrefs();

  const highSlider = document.getElementById('tt-high-slider');
  highSlider.oninput = (e) => {
    eng.freqHigh = parseInt(e.target.value, 10);
    document.getElementById('tt-high-val').textContent = eng.freqHigh + ' Hz';
    player.setFreqHigh(eng.freqHigh);
  };
  highSlider.onchange = () => player.persistPrefs();

  document.getElementById('tt-play-btn').onclick = function () {
    if (!player.isPlaying()) {
      player.play();
      startMarkerLoop();
      this.textContent = 'Detener';
      this.classList.add('playing');
    } else {
      player.stop();
      stopMarkerLoop();
      this.textContent = 'Reproducir';
      this.classList.remove('playing');
    }
  };
}
