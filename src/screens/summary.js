// Pantalla de resumen al terminar una sesion. Portado desde el prototipo.

export async function renderSummary(ctx) {
  const { APP, state, render, db, computeStats } = ctx;
  const stats = computeStats(state.session);
  const history = await db.loadAllForVariant(state.session.key);
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const prevStats = prev ? computeStats(prev) : null;
  const diff = prevStats ? (stats.avgResultado - prevStats.avgResultado) : null;

  // Calculado en finishSession() (main.js) al cerrar esta sesion puntual -
  // se consume una sola vez aca, para no repetirlo si se vuelve a esta
  // pantalla por algun camino raro.
  const toast = state.sessionEndToast;
  state.sessionEndToast = null;
  const toastHtml = toast
    ? '<div class="gc-toast-banner"><div class="gc-toast-title">' + toast.title + '</div><div>' + toast.text + '</div></div>'
    : '';

  APP.innerHTML =
    '<div class="gc-header">' +
      '<div class="gc-eyebrow">Sesion completa</div>' +
      '<h1 class="gc-title">Buen trabajo</h1>' +
      '<div class="gc-sub">Variante ' + state.session.key + ' · ' + stats.total + ' ' + (state.session.type === 'blocks' ? 'putts' : 'tiros') + ' registrados</div>' +
    '</div>' +
    '<div class="gc-body">' +
      toastHtml +
      '<div class="gc-card"><div class="gc-stat-grid">' +
        '<div class="gc-stat"><div class="gc-stat-num">' + stats.avgResultado.toFixed(1) + '</div><div class="gc-stat-label">Resultado promedio</div></div>' +
        '<div class="gc-stat"><div class="gc-stat-num">' + Math.round(stats.pctThink * 100) + '%</div><div class="gc-stat-label">Think Box</div></div>' +
        '<div class="gc-stat"><div class="gc-stat-num">' + Math.round(stats.pctPlay * 100) + '%</div><div class="gc-stat-label">Play Box</div></div>' +
        '<div class="gc-stat"><div class="gc-stat-num">' + (diff == null ? '—' : (diff >= 0 ? '+' : '') + diff.toFixed(1)) + '</div><div class="gc-stat-label">vs sesion anterior</div></div>' +
      '</div></div>' +
      '<div class="gc-card"><div class="gc-eyebrow" style="color:var(--green)">Por bloque</div>' +
        stats.byBlock.map((b) => '<div class="gc-hist-row"><span>' + b.name + '</span><span class="gc-mono">' + (b.avg == null ? '—' : b.avg.toFixed(1)) + '</span></div>').join('') +
      '</div>' +
      '<button class="gc-btn gc-btn-gold" id="gc-hist-btn2">Ver historial</button>' +
      '<div style="height:10px;"></div>' +
      '<button class="gc-btn gc-btn-ghost" id="gc-home-btn">Volver al inicio</button>' +
    '</div>';

  document.getElementById('gc-hist-btn2').onclick = () => { state.screen = 'history'; render(); };
  document.getElementById('gc-home-btn').onclick = () => { state.session = null; state.screen = 'home'; render(); };
}
