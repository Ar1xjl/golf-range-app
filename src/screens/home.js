// Pantalla de inicio: elegir variante, ver ultima sesion, foco sugerido,
// entrar al historial. Exportar CSV y Acerca de viven en el menu (icono
// hamburguesa).
//
// Tocar una variante lleva DIRECTO a la pantalla de esa sesion (retomando
// la sin terminar si existe, o armando una nueva en memoria para
// explorarla antes de "Iniciar" - ver sessionShots.js/sessionBlocks.js).
// Ya no hay un boton "Empezar sesion" separado en el home.

import { firstIncompleteFlatIndex } from '../variants.js';
import { RESULT_MAX } from '../resultScale.js';

export async function renderHome(ctx) {
  const { APP, state, render, db, computeStats, suggestFocus, VARIANT_DEFS, VARIANT_ORDER, computeGlobalReport, computeWeekCount } = ctx;
  const sel = state.selectedVariant;
  const sessions = await db.loadAllForVariant(sel);
  const focus = suggestFocus(sessions);
  const last = sessions[sessions.length - 1];
  const lastStats = last ? computeStats(last) : null;
  const prev = sessions.length > 1 ? sessions[sessions.length - 2] : null;
  const prevStats = prev ? computeStats(prev) : null;

  // Racha y meta semanal: cuentan TODAS las variantes (A-E), no solo la
  // seleccionada - es "cuanto practicaste esta semana", no "cuanto
  // practicaste esta variante". Mismo criterio que Reportes (computeGlobalReport).
  const allFinished = (await db.getAllSessions()).filter((s) => s.finished);
  const report = computeGlobalReport(allFinished);
  const weekCount = computeWeekCount(allFinished);
  const weeklyGoal = await db.getSetting('weeklyGoal');

  let weekCardHtml;
  if (weeklyGoal && weeklyGoal.target) {
    const pct = Math.min(100, Math.round((weekCount / weeklyGoal.target) * 100));
    weekCardHtml = '<div class="gc-streak-card" id="gc-week-card">' +
      '<div class="gc-eyebrow" style="color:var(--gold)">Esta semana</div>' +
      '<div class="gc-streak-row">' +
        '<div class="gc-streak-main">' + weekCount + ' de ' + weeklyGoal.target + ' sesiones</div>' +
        (report.streakWeeks > 0 ? '<div class="gc-streak-sub">' + report.streakWeeks + ' semana' + (report.streakWeeks === 1 ? '' : 's') + ' seguida' + (report.streakWeeks === 1 ? '' : 's') + '</div>' : '') +
      '</div>' +
      '<div class="gc-bar-track"><div class="gc-bar-fill" style="width:' + pct + '%;"></div></div>' +
    '</div>';
  } else {
    weekCardHtml = '<div class="gc-goal-cta" id="gc-week-card">Elegi una meta semanal de sesiones para ver tu progreso aca.' +
      '<div><button class="gc-btn gc-btn-ghost gc-btn-sm" style="width:auto;display:inline-block;padding-left:20px;padding-right:20px;">Configurar meta</button></div></div>';
  }

  let focusHtml = '';
  if (focus) {
    focusHtml = '<div class="gc-focus-banner">Foco sugerido para la proxima sesion: <b>' + focus.name + '</b><br>' +
      'es el bloque con menor resultado promedio en tus ultimas practicas (' + focus.avg.toFixed(1) + '/' + RESULT_MAX + ').</div>';
  }

  let lastHtml = '';
  if (lastStats) {
    const resultDiff = prevStats ? lastStats.avgResultado - prevStats.avgResultado : null;
    const thinkDiff = prevStats ? Math.round(lastStats.pctThink * 100) - Math.round(prevStats.pctThink * 100) : null;
    const deltaHtml = (diff, suffix) => {
      if (diff == null || Math.abs(diff) < 0.05) return '';
      const sign = diff > 0 ? '+' : '';
      return '<div class="gc-delta ' + (diff > 0 ? 'up' : 'down') + '">' + sign + diff.toFixed(1).replace(/\.0$/, '') + suffix + ' vs. sesion anterior</div>';
    };
    lastHtml = '<div class="gc-card">' +
      '<div class="gc-eyebrow" style="color:var(--green)">Ultima sesion — ' + VARIANT_DEFS[sel].label.split('—')[1].trim() + '</div>' +
      '<div class="gc-stat-grid">' +
      '<div class="gc-stat"><div class="gc-stat-num">' + lastStats.avgResultado.toFixed(1) + '</div><div class="gc-stat-label">Resultado promedio</div>' + deltaHtml(resultDiff, '') + '</div>' +
      '<div class="gc-stat"><div class="gc-stat-num">' + Math.round(lastStats.pctThink * 100) + '%</div><div class="gc-stat-label">Think Box</div>' + deltaHtml(thinkDiff, '%') + '</div>' +
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
        '<div><div class="gc-variant-name">🎧 Tempo Trainer</div><div class="gc-variant-desc">Swing 3:1 o Putt 2:1, con audio</div></div>' +
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
      weekCardHtml + preRoundHtml + focusHtml + lastHtml +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Elegir variante</div>' +
        pillsHtml +
      '</div>' +
      (sessions.length ? '<button class="gc-btn gc-btn-ghost" id="gc-hist-btn">Ver historial (' + sessions.length + ')</button>' : '') +
    '</div>';

  document.getElementById('gc-menu-btn').onclick = () => { state.screen = 'menu'; render(); };
  document.getElementById('gc-warmup-entry').onclick = () => { state.screen = 'warmup-select'; render(); };
  document.getElementById('gc-tempo-entry').onclick = () => { state.returnScreen = 'home'; state.screen = 'tempo'; render(); };
  // La card de "Esta semana" es clickeable entera cuando ya hay meta (para
  // editarla), o solo el boton "Configurar meta" cuando todavia no se eligio
  // ninguna - en ambos casos abre la misma pantalla.
  const weekCard = document.getElementById('gc-week-card');
  if (weekCard) weekCard.onclick = () => { state.returnScreen = 'home'; state.screen = 'weekly-goal'; render(); };

  // [data-variant]: distingue las 5 pills de variante de las de "Antes de
  // jugar" de arriba, que comparten la misma clase gc-variant-pill por estilo
  // pero no tienen data-variant.
  document.querySelectorAll('.gc-variant-pill[data-variant]').forEach((el) => {
    el.onclick = async () => {
      const key = el.dataset.variant;
      state.selectedVariant = key;
      const unfinished = await db.getUnfinishedSessionForVariant(key);
      if (unfinished) {
        // Ya esta en curso: retoma directo, sin pasar por "explorar".
        state.session = unfinished;
        state.currentFlatIndex = unfinished.type === 'blocks' ? 0 : firstIncompleteFlatIndex(unfinished);
      } else {
        // Nueva: se arma en memoria sin id/fecha (sin guardar todavia) -
        // recien se persiste cuando se toca "Iniciar" en la pantalla de
        // sesion. Hasta entonces es solo explorar con Anterior/Siguiente.
        state.session = VARIANT_DEFS[key].factory();
        state.currentFlatIndex = 0;
      }
      state.confirmingCancel = false;
      state.screen = 'session';
      render();
    };
  });
  const histBtn = document.getElementById('gc-hist-btn');
  if (histBtn) histBtn.onclick = () => { state.screen = 'history'; render(); };
}
