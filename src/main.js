// Registro de Rango — punto de entrada.
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
import { computeStats, suggestFocus } from './stats.js';
import { exportCSV } from './csv.js';
import { renderHome } from './screens/home.js';
import { renderShotSession } from './screens/sessionShots.js';
import { renderBlockSession } from './screens/sessionBlocks.js';
import { renderSummary } from './screens/summary.js';
import { renderHistory } from './screens/history.js';

const APP = document.getElementById('gc-app');

const state = { screen: 'home', session: null, selectedVariant: 'C', currentFlatIndex: 0, loading: true };

async function persistCurrentSession(finished) {
  if (!state.session) return;
  state.session.finished = finished;
  await db.saveSession(state.session);
}

async function finishSession() {
  await persistCurrentSession(true);
  state.screen = 'summary';
  render();
}

const ctx = {
  APP, state, render, db, computeStats, suggestFocus, exportCSV,
  VARIANT_DEFS, VARIANT_ORDER, flatten, persistCurrentSession, finishSession,
};

function render() {
  if (state.loading) { APP.innerHTML = '<div class="gc-empty">Cargando...</div>'; return; }
  if (state.screen === 'home') return renderHome(ctx);
  if (state.screen === 'session') {
    return state.session.type === 'blocks' ? renderBlockSession(ctx) : renderShotSession(ctx);
  }
  if (state.screen === 'summary') return renderSummary(ctx);
  if (state.screen === 'history') return renderHistory(ctx);
}

// ---------- Init ----------
state.loading = false;
render();

// ---------- Service worker (offline) ----------
// autoUpdate: revisa updates en segundo plano y activa la version nueva sola
// en la siguiente carga, sin interrumpir una sesion de practica en curso.
registerSW({ immediate: true });
