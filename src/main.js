// GolfSaber — punto de entrada.
// Orquesta estado + dispatcher de pantallas. Mismo patron que el prototipo
// original (un solo <div id="gc-app"> re-renderizado por innerHTML en cada
// cambio), pero repartido en modulos.

// Fuentes self-hosted (en vez del @import a Google Fonts del prototipo) para
// que el service worker las precachee y la app se vea bien sin conexion.
// Solo el subset "latin" (Latin-1 Supplement: á é í ó ú ñ ü ¿ ¡ incluidos)
// en vez de todos los idiomas que trae fontsource por defecto - importar el
// 400.css "completo" multiplicaria varias veces el peso del precache offline.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/fraunces/latin-400.css';
import '@fontsource/fraunces/latin-600.css';
import '@fontsource/fraunces/latin-700.css';
import './styles.css';

import { registerSW } from 'virtual:pwa-register';

import { VARIANT_DEFS, VARIANT_ORDER, flatten } from './variants.js';
import * as db from './db.js';
import { computeStats, suggestFocus, computeGlobalReport, computeWeekCount } from './stats.js';
import { exportCSV } from './csv.js';
import { renderHome } from './screens/home.js';
import { renderShotSession } from './screens/sessionShots.js';
import { renderBlockSession } from './screens/sessionBlocks.js';
import { renderSummary } from './screens/summary.js';
import { renderHistory } from './screens/history.js';
import { renderWarmupSelect } from './screens/warmupSelect.js';
import { renderWarmupSession, renderWarmupDone, cleanupWarmupTicking } from './screens/warmupSession.js';
import { renderTempo, cleanupTempoScreen } from './screens/tempo.js';
import { renderAbout } from './screens/about.js';
import { renderMenu } from './screens/menu.js';
import { renderReports } from './screens/reports.js';
import { renderWeeklyGoal } from './screens/weeklyGoal.js';
import { releaseSessionWakeLock } from './sessionWakeLock.js';
import { initPlayer } from './tempo/player.js';

const APP = document.getElementById('gc-app');

const state = {
  screen: 'home', session: null, selectedVariant: 'C', currentFlatIndex: 0, loading: true,
  warmupSelected: '20', warmupSession: null, returnScreen: null, confirmingCancel: false,
  sessionEndToast: null,
};

async function persistCurrentSession(finished) {
  if (!state.session) return;
  state.session.finished = finished;
  await db.saveSession(state.session);
}

// Recien aca la sesion pasa de "explorando" (armada en memoria por
// home.js, sin id/fecha, nunca guardada) a real: le pone id/fecha/numero
// y la persiste por primera vez. Antes de esto, `!state.session.id` es la
// señal que usan las pantallas de sesion para saber si mostrar
// Volver atras/Iniciar o Pausar y salir/Cancelar sesion.
async function startCurrentSession() {
  if (!state.session || state.session.id) return;
  state.session.id = Date.now();
  state.session.date = new Date().toISOString();
  state.session.finished = false;
  state.session.sessionNumber = (await db.countForVariant(state.session.key)) + 1;
  await db.saveSession(state.session);
}

// Toast de "Meta cumplida"/"Nueva racha" para la pantalla de Summary -
// calculado ANTES/DESPUES de esta sesion (no solo mirando el estado final)
// para saber si algo recien se cruzo con esta sesion puntual, y no repetirlo
// en cada sesion siguiente de la misma semana/racha. null si no hay nada que
// festejar (no todo cierre de sesion necesita un toast).
async function computeSessionEndToast(beforeSessions, session) {
  const goalSetting = await db.getSetting('weeklyGoal');
  const target = goalSetting && goalSetting.target;
  const afterSessions = beforeSessions.concat([session]);
  const weekCountBefore = computeWeekCount(beforeSessions);
  const weekCountAfter = computeWeekCount(afterSessions);

  if (target && weekCountAfter === target) {
    return { type: 'goal', title: 'Meta cumplida 🎯', text: weekCountAfter + ' de ' + target + ' sesiones esta semana.' };
  }
  // Primera sesion de la semana actual Y la racha (que incluye esta semana)
  // ya venia de antes - festeja extender una racha, no arrancar una nueva.
  if (weekCountBefore === 0) {
    const streakAfter = computeGlobalReport(afterSessions).streakWeeks;
    if (streakAfter >= 2) {
      return { type: 'streak', title: 'Nueva racha 🔥', text: streakAfter + ' semanas seguidas con al menos una sesion.' };
    }
  }
  return null;
}

async function finishSession() {
  // Defensivo: si por algun camino se llega a Finalizar sin haber tocado
  // Iniciar antes (no deberia pasar, la UI no deja), esto evita guardar
  // una sesion "finalizada" sin id/fecha.
  if (state.session && !state.session.id) await startCurrentSession();
  const beforeAll = (await db.getAllSessions()).filter((s) => s.finished && s.id !== state.session.id);
  await persistCurrentSession(true);
  state.sessionEndToast = await computeSessionEndToast(beforeAll, state.session);
  state.screen = 'summary';
  render();
}

const ctx = {
  APP, state, render, db, computeStats, suggestFocus, computeGlobalReport, computeWeekCount, exportCSV,
  VARIANT_DEFS, VARIANT_ORDER, flatten, persistCurrentSession, startCurrentSession, finishSession,
};

// Algunas pantallas (el timer del warm-up, la sesion de practica) dejan
// cosas corriendo en segundo plano (setInterval, wake lock) que no se
// limpian solas cuando se navega afuera con innerHTML - el resto de las
// pantallas no necesita esto porque no tienen nada vivo entre renders.
// Antes de despachar a la pantalla nueva, si la pantalla anterior tenia un
// cleanup registrado y estamos dejandola, se ejecuta.
//
// El Tempo Trainer es la excepcion a proposito: cleanupTempoScreen() solo
// para la animacion de la barra (rafId, local a esa pantalla) - el audio en
// si (src/tempo/player.js) sigue sonando al navegar, con su propio
// mini-reproductor (#gc-mini-player) para pararlo desde cualquier lado.
const SCREEN_CLEANUP = {
  tempo: cleanupTempoScreen,
  'warmup-session': cleanupWarmupTicking,
  session: releaseSessionWakeLock,
};
let previousScreen = null;

function render() {
  if (previousScreen && previousScreen !== state.screen) {
    const cleanup = SCREEN_CLEANUP[previousScreen];
    if (cleanup) cleanup();
  }
  previousScreen = state.screen;
  // El mini-reproductor se oculta via CSS mientras la pantalla completa del
  // Tempo Trainer ya esta mostrando esos mismos controles.
  document.body.classList.toggle('gc-on-tempo-screen', state.screen === 'tempo');

  if (state.loading) { APP.innerHTML = '<div class="gc-empty">Cargando...</div>'; return; }
  if (state.screen === 'home') return renderHome(ctx);
  if (state.screen === 'session') {
    return state.session.type === 'blocks' ? renderBlockSession(ctx) : renderShotSession(ctx);
  }
  if (state.screen === 'summary') return renderSummary(ctx);
  if (state.screen === 'history') return renderHistory(ctx);
  if (state.screen === 'warmup-select') return renderWarmupSelect(ctx);
  if (state.screen === 'warmup-session') return renderWarmupSession(ctx);
  if (state.screen === 'warmup-done') return renderWarmupDone(ctx);
  if (state.screen === 'tempo') return renderTempo(ctx);
  if (state.screen === 'about') return renderAbout(ctx);
  if (state.screen === 'menu') return renderMenu(ctx);
  if (state.screen === 'reports') return renderReports(ctx);
  if (state.screen === 'weekly-goal') return renderWeeklyGoal(ctx);
}

// ---------- Init ----------
state.loading = false;
render();

// El mini-reproductor vive fuera de #gc-app (ver index.html) para
// sobrevivir a los re-render que reemplazan innerHTML en cada cambio de
// pantalla. initPlayer() carga las preferencias guardadas y registra como
// volver a la pantalla completa cuando se toca el mini-reproductor.
initPlayer(db, {
  onOpenFull: () => {
    state.returnScreen = state.screen;
    state.screen = 'tempo';
    render();
  },
});

// ---------- Service worker (offline) ----------
// autoUpdate: revisa updates en segundo plano y activa la version nueva sola
// en la siguiente carga, sin interrumpir una sesion de practica en curso.
registerSW({ immediate: true });
