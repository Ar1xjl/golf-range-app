// Pantalla de historial + tendencia por variante. Portado desde el prototipo,
// ampliado con: lista de TODAS las sesiones (finalizadas y sin terminar,
// estas ultimas antes invisibles) y borrado con confirmacion en dos pasos.
// El grafico de tendencia y el foco sugerido siguen usando solo las
// finalizadas - una sesion a medias no deberia mover ese promedio.

import { flatten } from '../variants.js';

// Solo puede haber una fila "confirmando borrado" a la vez. Vive fuera de
// `state` porque es puramente UI efimera de esta pantalla, no algo que
// otras pantallas necesiten leer.
let confirmingDeleteId = null;

function progressLabel(session) {
  if (session.type === 'blocks') {
    const done = session.blocks.filter((b) => b.resultado != null).length;
    return done + '/' + session.blocks.length + ' bloques';
  }
  const flat = flatten(session);
  const done = flat.filter((s) => s.resultado != null).length;
  return done + '/' + flat.length + ' tiros';
}

export async function renderHistory(ctx) {
  const { APP, state, render, db, computeStats, suggestFocus, exportCSV } = ctx;
  const variant = state.session ? state.session.key : state.selectedVariant;
  const finishedHistory = await db.loadAllForVariant(variant);
  const allHistory = await db.getAllSessionsForVariant(variant);
  const focus = suggestFocus(finishedHistory);
  const unfinishedCount = allHistory.length - finishedHistory.length;

  let chart = '';
  if (finishedHistory.length > 1) {
    const vals = finishedHistory.map((s) => computeStats(s).avgResultado);
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

  function deleteControlHtml(id) {
    if (confirmingDeleteId === id) {
      return '<div class="gc-hist-actions">' +
        '<button class="gc-hist-del-btn" data-id="' + id + '" data-action="no">No</button>' +
        '<button class="gc-hist-del-btn confirm-yes" data-id="' + id + '" data-action="yes">Si, borrar</button>' +
        '</div>';
    }
    return '<div class="gc-hist-actions"><button class="gc-hist-del-btn" data-id="' + id + '" data-action="ask">Borrar</button></div>';
  }

  const rowsHtml = allHistory.length === 0 ? '<div class="gc-empty">Todavia no hay sesiones guardadas.</div>' :
    allHistory.slice().reverse().map((s) => {
      const d = new Date(s.date);
      const statusTag = s.finished ? '' : '<span class="gc-status-tag">En progreso</span>';
      const rightText = s.finished
        ? computeStats(s).avgResultado.toFixed(1) + '/5 · TB ' + Math.round(computeStats(s).pctThink * 100) + '%'
        : progressLabel(s);
      return '<div class="gc-hist-entry">' +
        '<div class="gc-hist-row"><span>' + d.toLocaleDateString('es-AR') + statusTag + '</span><span class="gc-mono">' + rightText + '</span></div>' +
        deleteControlHtml(s.id) +
        '</div>';
    }).join('');

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">Historial · Variante ' + variant + '</div>' +
      '<h1 class="gc-title">Tendencia</h1>' +
      '<div class="gc-sub">' + allHistory.length + ' sesion' + (allHistory.length === 1 ? '' : 'es') + ' registrada' + (allHistory.length === 1 ? '' : 's') +
        (unfinishedCount ? ' (' + unfinishedCount + ' sin terminar)' : '') + '</div>' +
    '</div>' +
    '<div class="gc-body">' +
      (focus ? '<div class="gc-focus-banner">Bloque a priorizar: <b>' + focus.name + '</b> (promedio ' + focus.avg.toFixed(1) + '/5 en las ultimas practicas)</div>' : '') +
      (finishedHistory.length > 1 ? '<div class="gc-card"><div class="gc-eyebrow" style="color:var(--green)">Resultado promedio por sesion</div>' + chart + '</div>' : '') +
      '<div class="gc-card">' + rowsHtml + '</div>' +
      (finishedHistory.length ? '<button class="gc-btn gc-btn-ghost" id="gc-export-var-btn">Exportar esta variante a CSV</button>' : '') +
    '</div>';

  document.getElementById('gc-back-btn').onclick = () => { confirmingDeleteId = null; state.screen = 'home'; render(); };
  const exportVarBtn = document.getElementById('gc-export-var-btn');
  if (exportVarBtn) exportVarBtn.onclick = () => exportCSV(variant);

  document.querySelectorAll('.gc-hist-del-btn').forEach((el) => {
    el.onclick = async () => {
      const id = parseInt(el.dataset.id, 10);
      if (el.dataset.action === 'ask') { confirmingDeleteId = id; render(); }
      else if (el.dataset.action === 'no') { confirmingDeleteId = null; render(); }
      else if (el.dataset.action === 'yes') {
        await db.deleteSession(id);
        confirmingDeleteId = null;
        render();
      }
    };
  });
}
