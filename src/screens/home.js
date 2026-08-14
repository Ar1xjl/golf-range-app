// Pantalla de inicio: elegir variante, ver ultima sesion, foco sugerido,
// continuar una sesion sin terminar, o entrar al historial. Exportar CSV
// y Acerca de viven en el menu (icono hamburguesa).

import { sessionProgressLabel, firstIncompleteFlatIndex } from '../variants.js';

export async function renderHome(ctx) {
  const { APP, state, render, db, computeStats, suggestFocus, VARIANT_DEFS, VARIANT_ORDER } = ctx;
  const sel = state.selectedVariant;
  const sessions = await db.loadAllForVariant(sel);
  const unfinished = await db.getUnfinishedSessionForVariant(sel);
  const focus = suggestFocus(sessions);
  const last = sessions[sessions.length - 1];
  const lastStats = last ? computeStats(last) : null;

  let focusHtml = '';
  if (focus) {
    focusHtml = '<div class="gc-focus-banner">Foco sugerido para la proxima sesion: <b>' + focus.name + '</b><br>' +
      'es el bloque con menor resultado promedio en tus ultimas practicas (' + focus.avg.toFixed(1) + '/5).</div>';
  }

  let lastHtml = '';
  if (lastStats) {
    lastHtml = '<div class="gc-card">' +
      '<div class="gc-eyebrow" style="color:var(--green)">Ultima sesion — ' + VARIANT_DEFS[sel].label.split('—')[1].trim() + '</div>' +
      '<div class="gc-stat-grid">' +
      '<div class="gc-stat"><div class="gc-stat-num">' + lastStats.avgResultado.toFixed(1) + '</div><div class="gc-stat-label">Resultado promedio</div></div>' +
      '<div class="gc-stat"><div class="gc-stat-num">' + Math.round(lastStats.pctThink * 100) + '%</div><div class="gc-stat-label">Think Box</div></div>' +
      '</div></div>';
  }

  const pillsHtml = VARIANT_ORDER.map((key) => {
    const v = VARIANT_DEFS[key];
    return '<div class="gc-variant-pill ' + (key === sel ? 'active' : '') + '" data-variant="' + key + '">' +
      '<div><div class="gc-variant-name">' + v.label + '</div><div class="gc-variant-desc">' + v.desc + '</div></div>' +
      '</div>';
  }).join('');

  const startAreaHtml = unfinished
    ? '<button class="gc-btn gc-btn-primary" id="gc-continue-btn" style="margin-top:6px;">Continuar sesion (' + sessionProgressLabel(unfinished) + ')</button>' +
      '<button class="gc-btn gc-btn-ghost gc-btn-sm" id="gc-start-new-btn" style="margin-top:8px;">Empezar una sesion nueva</button>'
    : '<button class="gc-btn gc-btn-primary" id="gc-start-btn" style="margin-top:6px;">Empezar sesion</button>';

  const preRoundHtml =
    '<div class="gc-card">' +
      '<div class="gc-eyebrow" style="color:var(--green)">Antes de jugar</div>' +
      '<div class="gc-variant-pill" id="gc-warmup-entry">' +
        '<div><div class="gc-variant-name">Warm-up</div><div class="gc-variant-desc">Elegi cuanto tiempo tenes</div></div>' +
      '</div>' +
      '<div class="gc-variant-pill" id="gc-tempo-entry" style="margin-bottom:0;">' +
        '<div><div class="gc-variant-name">🎧 Tempo Trainer</div><div class="gc-variant-desc">Ritmo 3:1 con audio</div></div>' +
      '</div>' +
    '</div>';

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-menu-btn" id="gc-menu-btn" aria-label="Menu">☰</button>' +
      '<div class="gc-eyebrow">Practica de golf · Juan</div>' +
      '<h1 class="gc-title">GolfSaber</h1>' +
      '<div class="gc-sub">Elegi una variante y entrena con proposito.</div>' +
    '</div>' +
    '<div class="gc-body">' +
      preRoundHtml + focusHtml + lastHtml +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Elegir variante</div>' +
        pillsHtml +
        startAreaHtml +
      '</div>' +
      (sessions.length ? '<button class="gc-btn gc-btn-ghost" id="gc-hist-btn">Ver historial (' + sessions.length + ')</button>' : '') +
    '</div>';

  document.getElementById('gc-menu-btn').onclick = () => { state.screen = 'menu'; render(); };
  document.getElementById('gc-warmup-entry').onclick = () => { state.screen = 'warmup-select'; render(); };
  document.getElementById('gc-tempo-entry').onclick = () => { state.returnScreen = 'home'; state.screen = 'tempo'; render(); };

  // [data-variant]: distingue las 5 pills de variante de las de "Antes de
  // jugar" de arriba, que comparten la misma clase gc-variant-pill por estilo
  // pero no tienen data-variant.
  document.querySelectorAll('.gc-variant-pill[data-variant]').forEach((el) => {
    el.onclick = () => { state.selectedVariant = el.dataset.variant; render(); };
  });
  async function startNewSession() {
    const factory = VARIANT_DEFS[state.selectedVariant].factory;
    state.session = factory();
    state.session.id = Date.now();
    state.session.date = new Date().toISOString();
    state.session.finished = false;
    state.session.sessionNumber = (await db.countForVariant(state.selectedVariant)) + 1;
    state.currentFlatIndex = 0;
    state.confirmingCancel = false;
    state.screen = 'session';
    render();
  }
  if (unfinished) {
    document.getElementById('gc-continue-btn').onclick = () => {
      state.session = unfinished;
      state.currentFlatIndex = unfinished.type === 'blocks' ? 0 : firstIncompleteFlatIndex(unfinished);
      state.confirmingCancel = false;
      state.screen = 'session';
      render();
    };
    document.getElementById('gc-start-new-btn').onclick = startNewSession;
  } else {
    document.getElementById('gc-start-btn').onclick = startNewSession;
  }
  const histBtn = document.getElementById('gc-hist-btn');
  if (histBtn) histBtn.onclick = () => { state.screen = 'history'; render(); };
}
