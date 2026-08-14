// Pantalla de sesion tiro-a-tiro (variantes A, B, C, E). Portado desde el prototipo.

import { flatten } from '../variants.js';
import { cancelRowHtml, wireCancelRow } from '../confirmDiscard.js';
import { ensureSessionWakeLock } from '../sessionWakeLock.js';

function seaBanner(session) {
  return '<div class="gc-sea-banner">Sesion #' + (session.sessionNumber || 1) + ' — Variante ' + session.key + ': ' + session.name + '</div>';
}

function blockStartIndex(session, blockIndex) {
  let n = 0;
  for (let b = 0; b < blockIndex; b++) n += session.blocks[b].shots.length;
  return n;
}

function syncShot(session, shot) {
  session.blocks[shot.blockIndex].shots[shot.shotIndex] = {
    objetivo: shot.objetivo, club: shot.club, target: shot.target, trackDistance: shot.trackDistance,
    thinkBox: shot.thinkBox, playBox: shot.playBox, resultado: shot.resultado, distancia: shot.distancia,
  };
}

export function renderShotSession(ctx) {
  const { APP, state, render, persistCurrentSession, finishSession } = ctx;
  ensureSessionWakeLock();
  const flat = flatten(state.session);
  const i = state.currentFlatIndex;
  const shot = flat[i];
  const blockShots = flat.filter((s) => s.blockIndex === shot.blockIndex);
  const shotInBlock = blockShots.findIndex((s) => s.shotIndex === shot.shotIndex) + 1;

  const blockBoxes = state.session.blocks.map((b, bi) => {
    const shots = b.shots;
    const done = shots.filter((s) => s.resultado != null).length;
    const isActive = bi === shot.blockIndex;
    const isComplete = done === shots.length;
    return '<div class="gc-block-box ' + (isActive ? 'active' : '') + ' ' + (isComplete && !isActive ? 'complete' : '') + '" data-block="' + bi + '">' +
      '<div class="gc-bb-name">' + b.shortLabel + '</div>' +
      '<div class="gc-bb-progress">' + done + '/' + shots.length + (isComplete ? ' ✓' : '') + '</div></div>';
  }).join('');

  APP.innerHTML =
    seaBanner(state.session) +
    '<div class="gc-body" style="padding-top:16px;">' +
      '<div class="gc-block-nav">' + blockBoxes + '</div>' +
      '<div class="gc-shot-progress">' + shot.blockName + ' · Tiro ' + shotInBlock + '/' + blockShots.length +
        '<div class="gc-mini-pegs">' + blockShots.map((s) => '<div class="gc-mini-peg ' + (s.shotIndex === shot.shotIndex ? 'active' : (s.resultado != null ? 'done' : '')) + '"></div>').join('') + '</div>' +
      '</div>' +
      '<div class="gc-card">' +
        '<div class="gc-club-tag">' + shot.club + '</div>' +
        '<div class="gc-shotnum">' + shot.objetivo + (shot.target && shot.target !== '-' ? ' · ' + shot.target : '') + '</div>' +
        '<div style="margin-top:16px;">' +
          '<div class="gc-toggle ' + (shot.thinkBox ? 'on' : '') + '" id="gc-think">' +
            '<div><div class="gc-toggle-label">Think Box</div><div class="gc-toggle-hint">Elegiste objetivo y palo antes del tiro</div></div>' +
            '<div class="gc-check">' + (shot.thinkBox ? '✓' : '') + '</div></div>' +
          '<div class="gc-toggle ' + (shot.playBox ? 'on' : '') + '" id="gc-play">' +
            '<div><div class="gc-toggle-label">Play Box</div><div class="gc-toggle-hint">Ejecutaste sin re-analizar</div></div>' +
            '<div class="gc-check">' + (shot.playBox ? '✓' : '') + '</div></div>' +
        '</div>' +
        '<div style="margin-top:10px;">' +
          '<div class="gc-toggle-label" style="margin-bottom:4px;">Post-shot — calidad de la decision</div>' +
          '<div class="gc-result-row">' + [1, 2, 3, 4, 5].map((n) => '<div class="gc-result-peg ' + (shot.resultado === n ? 'sel' : '') + '" data-n="' + n + '">' + n + '</div>').join('') + '</div>' +
        '</div>' +
        (shot.trackDistance ? '<div style="margin-top:14px;"><div class="gc-toggle-label" style="margin-bottom:6px;">Distancia real (opcional, yds)</div>' +
          '<input type="number" id="gc-dist-input" class="gc-d-input" value="' + (shot.distancia != null ? shot.distancia : '') + '" /></div>' : '') +
      '</div>' +
      '<div class="gc-row">' +
        '<button class="gc-btn gc-btn-ghost gc-btn-sm" id="gc-prev-btn" ' + (i === 0 ? 'disabled' : '') + '>Anterior</button>' +
        '<button class="gc-btn gc-btn-primary gc-btn-sm" id="gc-next-btn">' + (i === flat.length - 1 ? 'Finalizar' : 'Siguiente') + '</button>' +
      '</div>' +
      '<button class="gc-btn gc-btn-ghost gc-btn-sm" id="gc-session-tempo-btn" style="margin-top:8px;">🎧 Tempo Trainer</button>' +
      '<button class="gc-btn gc-btn-ghost gc-btn-sm" id="gc-exit-btn" style="margin-top:8px;">Pausar y salir</button>' +
      cancelRowHtml(state) +
    '</div>';

  document.getElementById('gc-think').onclick = () => { shot.thinkBox = !shot.thinkBox; syncShot(state.session, shot); render(); };
  document.getElementById('gc-play').onclick = () => { shot.playBox = !shot.playBox; syncShot(state.session, shot); render(); };
  document.querySelectorAll('.gc-result-peg').forEach((el) => {
    el.onclick = () => { shot.resultado = parseInt(el.dataset.n, 10); syncShot(state.session, shot); render(); };
  });
  if (shot.trackDistance) {
    document.getElementById('gc-dist-input').onchange = (e) => {
      shot.distancia = e.target.value ? parseFloat(e.target.value) : null;
      syncShot(state.session, shot);
    };
  }
  document.querySelectorAll('.gc-block-box').forEach((el) => {
    el.onclick = () => { state.currentFlatIndex = blockStartIndex(state.session, parseInt(el.dataset.block, 10)); render(); };
  });
  document.getElementById('gc-prev-btn').onclick = () => { if (i > 0) { state.currentFlatIndex--; render(); } };
  document.getElementById('gc-next-btn').onclick = async () => {
    if (i === flat.length - 1) { await finishSession(); } else { state.currentFlatIndex++; render(); }
  };
  document.getElementById('gc-session-tempo-btn').onclick = () => {
    state.returnScreen = 'session';
    state.screen = 'tempo';
    render();
  };
  document.getElementById('gc-exit-btn').onclick = async () => {
    await persistCurrentSession(false);
    state.confirmingCancel = false;
    state.screen = 'home'; state.session = null; render();
  };
  wireCancelRow(state, render, () => {
    state.screen = 'home'; state.session = null; render();
  });
}
