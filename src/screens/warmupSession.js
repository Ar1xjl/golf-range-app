// Pantalla de warm-up: stepper de bloques con timer de referencia (avance
// manual, no auto-avanza al llegar a cero - ver discusion en el chat).

import { WARMUP_PLANS } from '../warmup.js';
import { cancelRowHtml, wireCancelRow } from '../confirmDiscard.js';
import { createWakeLockHandle } from '../wakeLock.js';

// El timer re-renderiza toda la pantalla cada segundo (mismo patron de
// re-render completo que el resto de la app). Singleton de modulo porque
// solo puede haber una pantalla de warm-up activa a la vez - cleanupTicking()
// lo para cuando se navega afuera de esta pantalla (registrado en main.js).
let tickIntervalId = null;
const wakeLock = createWakeLockHandle();
function ensureTicking(render) {
  if (tickIntervalId) return;
  tickIntervalId = setInterval(render, 1000);
  wakeLock.request();
}
export function cleanupWarmupTicking() {
  if (tickIntervalId) { clearInterval(tickIntervalId); tickIntervalId = null; }
  wakeLock.release();
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

export function renderWarmupSession(ctx) {
  const { APP, state, render, db } = ctx;
  ensureTicking(render);

  const ws = state.warmupSession;
  const plan = WARMUP_PLANS[ws.duration];
  const bi = ws.currentBlockIndex;
  const block = plan.blocks[bi];
  const isLast = bi === plan.blocks.length - 1;

  const elapsedInBlock = (Date.now() - ws.blockEnteredAt) / 1000;
  const remaining = block.minutes * 60 - elapsedInBlock;
  const totalElapsed = (Date.now() - ws.startedAt) / 1000;

  const blockBoxes = plan.blocks.map((b, i) => {
    const isActive = i === bi;
    const isDone = i < bi;
    return '<div class="gc-block-box ' + (isActive ? 'active' : '') + ' ' + (isDone ? 'complete' : '') + '" data-block="' + i + '">' +
      '<div class="gc-bb-name">' + b.name + '</div>' +
      '<div class="gc-bb-progress">' + b.minutes + ' min' + (isDone ? ' ✓' : '') + '</div></div>';
  }).join('');

  APP.innerHTML =
    '<div class="gc-sea-banner">Warm-up · ' + plan.label + ' · Tiempo total ' + formatMMSS(totalElapsed) + '</div>' +
    '<div class="gc-body" style="padding-top:16px;">' +
      '<div class="gc-block-nav">' + blockBoxes + '</div>' +
      '<div class="gc-shot-progress">Bloque ' + (bi + 1) + '/' + plan.blocks.length + '</div>' +
      '<div class="gc-card" style="text-align:center;">' +
        '<div class="gc-club-tag">' + block.name + '</div>' +
        '<div class="gc-shotnum" style="margin-top:6px;">' + block.detail + '</div>' +
        '<div class="gc-timer ' + (remaining <= 0 ? 'done' : '') + '">' + formatMMSS(remaining) + '</div>' +
        '<div class="gc-shot-progress" style="margin-bottom:0;">de ' + block.minutes + ' min asignados · a tu ritmo</div>' +
        (isLast ? '<button class="gc-btn gc-btn-ghost gc-btn-sm" id="gc-warmup-tempo-btn" style="margin-top:14px;">🎧 Abrir Tempo Trainer</button>' : '') +
      '</div>' +
      '<div class="gc-row">' +
        '<button class="gc-btn gc-btn-ghost gc-btn-sm" id="gc-prev-btn" ' + (bi === 0 ? 'disabled' : '') + '>Anterior</button>' +
        '<button class="gc-btn gc-btn-primary gc-btn-sm" id="gc-next-btn">' + (isLast ? 'Finalizar' : 'Siguiente bloque') + '</button>' +
      '</div>' +
      '<button class="gc-btn gc-btn-ghost gc-btn-sm" id="gc-exit-btn" style="margin-top:8px;">Salir</button>' +
      cancelRowHtml(state) +
    '</div>';

  function goToBlock(i) {
    ws.currentBlockIndex = i;
    ws.blockEnteredAt = Date.now();
    render();
  }

  document.querySelectorAll('.gc-block-box').forEach((el) => {
    el.onclick = () => goToBlock(parseInt(el.dataset.block, 10));
  });
  document.getElementById('gc-prev-btn').onclick = () => { if (bi > 0) goToBlock(bi - 1); };
  document.getElementById('gc-next-btn').onclick = async () => {
    if (isLast) {
      await db.saveWarmup({ id: ws.id, duration: ws.duration, date: ws.date, finished: true });
      state.screen = 'warmup-done';
      render();
    } else {
      goToBlock(bi + 1);
    }
  };
  document.getElementById('gc-exit-btn').onclick = async () => {
    await db.saveWarmup({ id: ws.id, duration: ws.duration, date: ws.date, finished: false });
    state.confirmingCancel = false;
    state.warmupSession = null;
    state.screen = 'home';
    render();
  };
  wireCancelRow(state, render, () => {
    state.warmupSession = null; state.screen = 'home'; render();
  });
  const tempoBtn = document.getElementById('gc-warmup-tempo-btn');
  if (tempoBtn) tempoBtn.onclick = () => { state.returnScreen = 'warmup-session'; state.screen = 'tempo'; render(); };
}

export function renderWarmupDone(ctx) {
  const { APP, state, render } = ctx;
  APP.innerHTML =
    '<div class="gc-header">' +
      '<div class="gc-eyebrow">Warm-up completo</div>' +
      '<h1 class="gc-title">A jugar</h1>' +
      '<div class="gc-sub">Cuerpo activado y sensaciones confirmadas. Buena vuelta.</div>' +
    '</div>' +
    '<div class="gc-body">' +
      '<button class="gc-btn gc-btn-gold" id="gc-warmup-done-tempo-btn">🎧 Abrir Tempo Trainer</button>' +
      '<div style="height:10px;"></div>' +
      '<button class="gc-btn gc-btn-ghost" id="gc-warmup-done-home-btn">Volver al inicio</button>' +
    '</div>';

  document.getElementById('gc-warmup-done-tempo-btn').onclick = () => { state.returnScreen = 'home'; state.screen = 'tempo'; render(); };
  document.getElementById('gc-warmup-done-home-btn').onclick = () => { state.warmupSession = null; state.screen = 'home'; render(); };
}
