// Pantalla de inicio: elegir variante, ver ultima sesion, foco sugerido,
// entrar al historial o exportar todo a CSV. Portado desde el prototipo.

export async function renderHome(ctx) {
  const { APP, state, render, db, computeStats, suggestFocus, exportCSV, VARIANT_DEFS, VARIANT_ORDER } = ctx;
  const sel = state.selectedVariant;
  const sessions = await db.loadAllForVariant(sel);
  const fullSessions = await db.getAllSessions();
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
      '<div class="gc-eyebrow">Practica de golf · Juan</div>' +
      '<h1 class="gc-title">Registro de rango</h1>' +
      '<div class="gc-sub">Elegi una variante y registra tu practica.</div>' +
    '</div>' +
    '<div class="gc-body">' +
      preRoundHtml + focusHtml + lastHtml +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Elegir variante</div>' +
        pillsHtml +
        '<button class="gc-btn gc-btn-primary" id="gc-start-btn" style="margin-top:6px;">Empezar sesion</button>' +
      '</div>' +
      (sessions.length ? '<button class="gc-btn gc-btn-ghost" id="gc-hist-btn">Ver historial (' + sessions.length + ')</button>' : '') +
      (fullSessions.length ? '<button class="gc-btn gc-btn-ghost" id="gc-export-btn" style="margin-top:10px;">Exportar todo a CSV</button>' : '') +
      '<div style="text-align:center; margin-top:22px;">' +
        '<button class="gc-nav-back" id="gc-about-btn" style="color:var(--ink-soft); margin-bottom:0;">Acerca de esta app</button>' +
      '</div>' +
    '</div>';

  document.getElementById('gc-warmup-entry').onclick = () => { state.screen = 'warmup-select'; render(); };
  document.getElementById('gc-tempo-entry').onclick = () => { state.returnScreen = 'home'; state.screen = 'tempo'; render(); };

  // [data-variant]: distingue las 5 pills de variante de las de "Antes de
  // jugar" de arriba, que comparten la misma clase gc-variant-pill por estilo
  // pero no tienen data-variant.
  document.querySelectorAll('.gc-variant-pill[data-variant]').forEach((el) => {
    el.onclick = () => { state.selectedVariant = el.dataset.variant; render(); };
  });
  document.getElementById('gc-start-btn').onclick = async () => {
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
  };
  const histBtn = document.getElementById('gc-hist-btn');
  if (histBtn) histBtn.onclick = () => { state.screen = 'history'; render(); };
  const exportBtn = document.getElementById('gc-export-btn');
  if (exportBtn) exportBtn.onclick = () => exportCSV(null);
  document.getElementById('gc-about-btn').onclick = () => { state.screen = 'about'; render(); };
}
