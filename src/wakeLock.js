// Wake Lock API: evita que la pantalla se apague sola mientras hay una
// sesion/timer activo. Factory en vez de un singleton compartido a proposito:
// dos features independientes (una sesion de practica y el Tempo Trainer,
// por ejemplo) pueden querer el wake lock activo al mismo tiempo, y liberar
// el sentinel de una no debe apagar el de la otra. Cada owner llama a
// createWakeLockHandle() una vez y usa SU PROPIO handle.
export function createWakeLockHandle() {
  let sentinel = null;
  return {
    async request() {
      if (!('wakeLock' in navigator)) return;
      try { sentinel = await navigator.wakeLock.request('screen'); } catch (e) { sentinel = null; }
    },
    release() {
      if (sentinel) { sentinel.release().catch(() => {}); sentinel = null; }
    },
  };
}
