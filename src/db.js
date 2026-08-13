// Capa de persistencia con IndexedDB (reemplaza el window.storage de artifacts
// + fallback a localStorage del prototipo). Pensada para uso offline: todo
// queda en el dispositivo, no depende de red.
//
// Un solo object store 'sessions' (keyPath 'id') con un indice por 'key'
// (la variante A-E). El campo `finished` vive directamente en la sesion,
// asi no hace falta mantener un indice separado a mano como en el prototipo.

import { openDB } from 'idb';

const DB_NAME = 'golf-range-db';
const DB_VERSION = 1;
const STORE = 'sessions';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    const store = db.createObjectStore(STORE, { keyPath: 'id' });
    store.createIndex('variant', 'key');
  },
});

export async function saveSession(session) {
  const db = await dbPromise;
  await db.put(STORE, session);
}

export async function loadSession(id) {
  const db = await dbPromise;
  return (await db.get(STORE, id)) || null;
}

export async function getAllSessions() {
  const db = await dbPromise;
  return db.getAll(STORE);
}

export async function loadAllForVariant(variantKey) {
  const db = await dbPromise;
  const all = await db.getAllFromIndex(STORE, 'variant', variantKey);
  return all.filter((s) => s.finished).sort((a, b) => a.id - b.id);
}

export async function countForVariant(variantKey) {
  const db = await dbPromise;
  const all = await db.getAllFromIndex(STORE, 'variant', variantKey);
  return all.length;
}
