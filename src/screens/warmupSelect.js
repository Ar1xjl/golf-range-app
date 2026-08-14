// Pantalla para elegir cuanto tiempo hay disponible antes de salir a jugar.

import { WARMUP_PLANS, WARMUP_ORDER, warmupTotalMinutes } from '../warmup.js';

function formatRelative(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} dias`;
}

export async function renderWarmupSelect(ctx) {
  const { APP, state, render, db } = ctx;
  const recent = await db.getRecentWarmups(1);
  const last = recent[0];

  const pillsHtml = WARMUP_ORDER.map((key) => {
    const plan = WARMUP_PLANS[key];
    const sel = state.warmupSelected === key;
    return '<div class="gc-variant-pill ' + (sel ? 'active' : '') + '" data-duration="' + key + '">' +
      '<div><div class="gc-variant-name">' + plan.label + '</div><div class="gc-variant-desc">' + plan.desc + ' · ~' + warmupTotalMinutes(plan) + ' min</div></div>' +
      '</div>';
  }).join('');

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">Antes de jugar</div>' +
      '<h1 class="gc-title">Warm-up</h1>' +
      '<div class="gc-sub">Movilidad, wedges, y siempre terminando en putting. Elegi cuanto tiempo tenes.</div>' +
    '</div>' +
    '<div class="gc-body">' +
      (last ? '<div class="gc-focus-banner">Ultimo warm-up: <b>' + WARMUP_PLANS[last.duration].label + '</b> · ' + formatRelative(last.date) + '</div>' : '') +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Tiempo disponible</div>' +
        pillsHtml +
        '<button class="gc-btn gc-btn-primary" id="gc-warmup-start-btn" style="margin-top:6px;">Empezar warm-up</button>' +
      '</div>' +
    '</div>';

  document.querySelectorAll('.gc-variant-pill').forEach((el) => {
    el.onclick = () => { state.warmupSelected = el.dataset.duration; render(); };
  });
  document.getElementById('gc-back-btn').onclick = () => { state.screen = 'home'; render(); };
  document.getElementById('gc-warmup-start-btn').onclick = () => {
    const now = Date.now();
    state.warmupSession = {
      id: now,
      duration: state.warmupSelected,
      date: new Date(now).toISOString(),
      currentBlockIndex: 0,
      blockEnteredAt: now,
      startedAt: now,
    };
    state.screen = 'warmup-session';
    render();
  };
}
