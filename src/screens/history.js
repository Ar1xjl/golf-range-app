// Pantalla de historial + tendencia por variante. Portado desde el prototipo.

export async function renderHistory(ctx) {
  const { APP, state, render, db, computeStats, suggestFocus, exportCSV } = ctx;
  const variant = state.session ? state.session.key : state.selectedVariant;
  const history = await db.loadAllForVariant(variant);
  const focus = suggestFocus(history);

  let chart = '';
  if (history.length > 1) {
    const vals = history.map((s) => computeStats(s).avgResultado);
    const w = 400, h = 90, pad = 10;
    const pts = vals.map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / (vals.length - 1);
      const y = h - pad - (v / 5) * (h - 2 * pad);
      return x + ',' + y;
    }).join(' ');
    const dots = vals.map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / (vals.length - 1);
      const y = h - pad - (v / 5) * (h - 2 * pad);
      return '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="#C79A3E"/>';
    }).join('');
    chart = '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:90px;">' +
      '<polyline points="' + pts + '" fill="none" stroke="#2F5233" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' + dots + '</svg>';
  }

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">Historial · Variante ' + variant + '</div>' +
      '<h1 class="gc-title">Tendencia</h1>' +
      '<div class="gc-sub">' + history.length + ' sesion' + (history.length === 1 ? '' : 'es') + ' registrada' + (history.length === 1 ? '' : 's') + '</div>' +
    '</div>' +
    '<div class="gc-body">' +
      (focus ? '<div class="gc-focus-banner">Bloque a priorizar: <b>' + focus.name + '</b> (promedio ' + focus.avg.toFixed(1) + '/5 en las ultimas practicas)</div>' : '') +
      (history.length ? '<div class="gc-card"><div class="gc-eyebrow" style="color:var(--green)">Resultado promedio por sesion</div>' + chart + '</div>' : '') +
      '<div class="gc-card">' +
        (history.length === 0 ? '<div class="gc-empty">Todavia no hay sesiones guardadas.</div>' :
          history.slice().reverse().map((s) => {
            const st = computeStats(s);
            const d = new Date(s.date);
            return '<div class="gc-hist-row"><span>' + d.toLocaleDateString('es-AR') + '</span><span class="gc-mono">' + st.avgResultado.toFixed(1) + '/5 · TB ' + Math.round(st.pctThink * 100) + '%</span></div>';
          }).join('')) +
      '</div>' +
      (history.length ? '<button class="gc-btn gc-btn-ghost" id="gc-export-var-btn">Exportar esta variante a CSV</button>' : '') +
    '</div>';

  document.getElementById('gc-back-btn').onclick = () => { state.screen = 'home'; render(); };
  const exportVarBtn = document.getElementById('gc-export-var-btn');
  if (exportVarBtn) exportVarBtn.onclick = () => exportCSV(variant);
}
