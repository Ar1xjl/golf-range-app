// Capa de persistencia con IndexedDB (reemplaza el window.storage de artifacts
// + fallback a localStorage del prototipo). Pensada para uso offline: todo
// queda en el dispositivo, no depende de red.
//
// Stores:
// - 'sessions' (keyPath 'id', indice 'variant' por session.key): las 5
//   variantes de practica A-E. El campo `finished` vive directamente en la
//   sesion, asi no hace falta mantener un indice separado a mano.
// - 'warmups' (keyPath 'id'): historial de warm-ups pre-ronda. Separado de
//   'sessions' porque no tiene bloques/tiros ni resultado 1-5 - mezclarlo
//   ahi obligaria a ramas especiales en computeStats/CSV para un dato que
//   no encaja en ese contrato.
// - 'settings' (keyPath 'id'): una fila por grupo de preferencias (ej. las
//   del Tempo Trainer), para que la app recuerde configuracion entre usos.

import { openDB } from 'idb';

const DB_NAME = 'golf-range-db';
const DB_VERSION = 2;
const STORE_SESSIONS = 'sessions';
const STORE_WARMUPS = 'warmups';
const STORE_SETTINGS = 'settings';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      store.createIndex('variant', 'key');
    }
    if (oldVersion < 2) {
      db.createObjectStore(STORE_WARMUPS, { keyPath: 'id' });
      db.createObjectStore(STORE_SETTINGS, { keyPath: 'id' });
    }
  },
});

// ---------- Sesiones de practica (variantes A-E) ----------

export async function saveSession(session) {
  const db = await dbPromise;
  await db.put(STORE_SESSIONS, session);
}

export async function loadSession(id) {
  const db = await dbPromise;
  return (await db.get(STORE_SESSIONS, id)) || null;
}

export async function getAllSessions() {
  const db = await dbPromise;
  return db.getAll(STORE_SESSIONS);
}

export async function loadAllForVariant(variantKey) {
  const db = await dbPromise;
  const all = await db.getAllFromIndex(STORE_SESSIONS, 'variant', variantKey);
  return all.filter((s) => s.finished).sort((a, b) => a.id - b.id);
}

export async function countForVariant(variantKey) {
  const db = await dbPromise;
  const all = await db.getAllFromIndex(STORE_SESSIONS, 'variant', variantKey);
  return all.length;
}

// ---------- Warm-ups pre-ronda ----------

export async function saveWarmup(warmup) {
  const db = await dbPromise;
  await db.put(STORE_WARMUPS, warmup);
}

export async function getAllWarmups() {
  const db = await dbPromise;
  return db.getAll(STORE_WARMUPS);
}

// Los mas recientes primero (para un "ultimo warm-up: hace 3 dias" en el home).
export async function getRecentWarmups(limit) {
  const all = await getAllWarmups();
  const sorted = all.sort((a, b) => b.id - a.id);
  return limit ? sorted.slice(0, limit) : sorted;
}

// ---------- Preferencias (ej. Tempo Trainer) ----------

export async function getSetting(id) {
  const db = await dbPromise;
  return (await db.get(STORE_SETTINGS, id)) || null;
}

export async function saveSetting(id, value) {
  const db = await dbPromise;
  await db.put(STORE_SETTINGS, { id, ...value });
}
