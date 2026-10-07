// Pantalla de historial: TODAS las sesiones juntas (todas las variantes,
// finalizadas y sin terminar), la mas reciente arriba, cada fila con fecha y
// variante. Antes era por variante (la seleccionada en el home), lo que
// obligaba a cambiar de variante para ver el resto y escondia el boton si
// esa variante puntual no tenia sesiones finalizadas.
//
// - Tocar una sesion "En progreso" la retoma (misma logica que tocar la
//   variante en el home, pero sobre ESA sesion puntual - puede haber mas de
//   una sin terminar por variante via "Empezar una sesion nueva").
// - Filtro opcional por variante (chips arriba): con una variante elegida
//   aparecen el foco sugerido y el grafico de tendencia, que solo tienen
//   sentido dentro de una misma variante (D es putting, no se mezcla). Ambos
//   siguen usando solo las finalizadas - una sesion a medias no deberia
//   mover ese promedio.
// - Borrado con confirmacion en dos pasos.

import { sessionProgressLabel, firstIncompleteFlatIndex } from '../variants.js';
import { RESULT_MAX } from '../resultScale.js';

// UI efimera de esta pantalla (no la necesita ninguna otra), por eso vive
// fuera de `state`. Solo puede haber una fila "confirmando borrado" a la vez.
let confirmingDeleteId = null;
let variantFilter = null; // null = todas

function variantShortName(VARIANT_DEFS, key) {
  const def = VARIANT_DEFS[key];
  const parts = def ? def.label.split('—') : [];
  return parts.length > 1 ? parts[1].trim() : '';
}

function formatDate(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric', year: '2-digit' });
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return day + ' · ' + time;
}

function trendChartHtml(finished, computeStats) {
  if (finished.length < 2) return '';
  const vals = finished.map((s) => computeStats(s).avgResultado);
  const w = 400, h = 90, pad = 10;
  const xy = (v, i) => [pad + (i * (w - 2 * pad)) / (vals.length - 1), h - pad - (v / RESULT_MAX) * (h - 2 * pad)];
  const pts = vals.map((v, i) => xy(v, i).join(',')).join(' ');
  const dots = vals.map((v, i) => {
    const [x, y] = xy(v, i);
    return '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="#C79A3E"/>';
  }).join('');
  return '<div class="gc-card"><div class="gc-eyebrow" style="color:var(--green)">Resultado promedio por sesion</div>' +
    '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:90px;">' +
    '<polyline points="' + pts + '" fill="none" stroke="#2F5233" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' + dots + '</svg></div>';
}

export async function renderHistory(ctx) {
  const { APP, state, render, db, computeStats, suggestFocus, exportCSV, VARIANT_DEFS, VARIANT_ORDER } = ctx;
  const all = (await db.getAllSessions()).sort((a, b) => b.id - a.id);
  // Si se borro la ultima sesion de la variante filtrada, el filtro sigue
  // valiendo (muestra vacio) - el usuario lo saca con "Todas".
  const shown = variantFilter ? all.filter((s) => s.key === variantFilter) : all;
  const unfinishedCount = shown.filter((s) => !s.finished).length;

  let focusHtml = '';
  let chartHtml = '';
  if (variantFilter) {
    const finished = shown.filter((s) => s.finished).sort((a, b) => a.id - b.id);
    const focus = suggestFocus(finished);
    if (focus) focusHtml = '<div class="gc-focus-banner">Bloque a priorizar: <b>' + focus.name + '</b> (promedio ' + focus.avg.toFixed(1) + '/' + RESULT_MAX + ' en las ultimas practicas)</div>';
    chartHtml = trendChartHtml(finished, computeStats);
  }

  const presentKeys = VARIANT_ORDER.filter((k) => all.some((s) => s.key === k));
  const chipsHtml = presentKeys.length > 1
    ? '<div class="gc-hist-filter">' +
        '<button class="gc-hist-chip' + (variantFilter ? '' : ' active') + '" data-filter="">Todas</button>' +
        presentKeys.map((k) => '<button class="gc-hist-chip' + (variantFilter === k ? ' active' : '') + '" data-filter="' + k + '">' + k + '</button>').join('') +
      '</div>'
    : '';

  function deleteControlHtml(id) {
    if (confirmingDeleteId === id) {
      return '<div class="gc-hist-actions">' +
        '<button class="gc-hist-del-btn" data-id="' + id + '" data-action="no">No</button>' +
        '<button class="gc-hist-del-btn confirm-yes" data-id="' + id + '" data-action="yes">Si, borrar</button>' +
        '</div>';
    }
    return '<div class="gc-hist-actions"><button class="gc-hist-del-btn" data-id="' + id + '" data-action="ask">Borrar</button></div>';
  }

  const rowsHtml = shown.length === 0 ? '<div class="gc-empty">Todavia no hay sesiones guardadas.</div>' :
    shown.map((s) => {
      const resumable = !s.finished;
      let rightHtml;
      if (resumable) {
        rightHtml = '<span class="gc-hist-resume">Continuar ▸</span>';
      } else {
        const st = computeStats(s);
        rightHtml = '<span class="gc-mono">' + st.avgResultado.toFixed(1) + '/' + RESULT_MAX + ' · TB ' + Math.round(st.pctThink * 100) + '%</span>';
      }
      // El borrar va dentro del area tocable de la fila: su handler hace
      // stopPropagation para no disparar el "retomar".
      return '<div class="gc-hist-entry' + (resumable ? ' resumable' : '') + '"' + (resumable ? ' data-resume="' + s.id + '"' : '') + '>' +
        '<div class="gc-hist-row">' +
          '<span class="gc-hist-variant"><b>' + s.key + '</b> · ' + variantShortName(VARIANT_DEFS, s.key) + '</span>' +
          rightHtml +
        '</div>' +
        '<div class="gc-hist-meta">' +
          '<span>' + formatDate(s.date) + (resumable ? '<span class="gc-status-tag">' + sessionProgressLabel(s) + '</span>' : '') + '</span>' +
          deleteControlHtml(s.id) +
        '</div>' +
        '</div>';
    }).join('');

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">Historial' + (variantFilter ? ' · Variante ' + variantFilter : '') + '</div>' +
      '<h1 class="gc-title">Sesiones</h1>' +
      '<div class="gc-sub">' + shown.length + ' sesion' + (shown.length === 1 ? '' : 'es') + ' registrada' + (shown.length === 1 ? '' : 's') +
        (unfinishedCount ? ' (' + unfinishedCount + ' sin terminar)' : '') + '</div>' +
    '</div>' +
    '<div class="gc-body">' +
      chipsHtml + focusHtml + chartHtml +
      '<div class="gc-card">' + rowsHtml + '</div>' +
      (shown.some((s) => s.finished) ? '<button class="gc-btn gc-btn-ghost" id="gc-export-var-btn">' +
        (variantFilter ? 'Exportar variante ' + variantFilter + ' a CSV' : 'Exportar todo a CSV') + '</button>' : '') +
    '</div>';

  document.getElementById('gc-back-btn').onclick = () => {
    confirmingDeleteId = null;
    variantFilter = null;
    state.session = null;
    state.screen = 'home';
    render();
  };
  const exportVarBtn = document.getElementById('gc-export-var-btn');
  if (exportVarBtn) exportVarBtn.onclick = () => exportCSV(variantFilter || undefined);

  document.querySelectorAll('.gc-hist-chip').forEach((el) => {
    el.onclick = () => { variantFilter = el.dataset.filter || null; confirmingDeleteId = null; render(); };
  });

  document.querySelectorAll('.gc-hist-entry[data-resume]').forEach((el) => {
    el.onclick = () => {
      const session = all.find((s) => s.id === parseInt(el.dataset.resume, 10));
      if (!session) return;
      // Misma forma de retomar que el home (ver home.js): directo a la
      // pantalla de sesion, en el primer tiro sin responder.
      confirmingDeleteId = null;
      state.selectedVariant = session.key;
      state.session = session;
      state.currentFlatIndex = session.type === 'blocks' ? 0 : firstIncompleteFlatIndex(session);
      state.confirmingCancel = false;
      state.screen = 'session';
      render();
    };
  });

  document.querySelectorAll('.gc-hist-del-btn').forEach((el) => {
    el.onclick = async (e) => {
      e.stopPropagation();
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
