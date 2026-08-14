// Wake lock compartido por las pantallas de sesion de practica
// (sessionShots.js y sessionBlocks.js - nunca estan montadas las dos a la
// vez, asi que un solo handle alcanza). Evita pedirlo de nuevo en cada
// re-render (la pantalla se re-renderiza en cada click) con el flag
// `active`, y se libera desde SCREEN_CLEANUP['session'] en main.js.
import { createWakeLockHandle } from './wakeLock.js';

const handle = createWakeLockHandle();
let active = false;

export function ensureSessionWakeLock() {
  if (active) return;
  active = true;
  handle.request();
}

export function releaseSessionWakeLock() {
  if (!active) return;
  active = false;
  handle.release();
}
