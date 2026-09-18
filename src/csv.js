// Export a CSV, portado desde el prototipo. Ahora lee directo de IndexedDB
// (getAllSessions) en vez de recorrer un indice + fetch por sesion.
//
// Columna "Resultado": 1-3 (Malo/Bueno/Excelente, ver resultScale.js). Las
// sesiones guardadas antes de ese cambio se migraron de su escala 1-5
// original a este 1-3 al abrir la app (db.js, v2 -> v3).

import { getAllSessions, saveSession } from './db.js';
import { VARIANT_DEFS } from './variants.js';

const CSV_HEADER = ['Variante', 'SesionNumero', 'Fecha', 'Estado', 'Bloque', 'Tipo', 'Item',
  'PaloOCantidadPutts', 'Objetivo', 'Target', 'ThinkBox', 'PlayBox', 'Resultado', 'DistanciaReal', 'PctCirculo3pies', 'Notas'];

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function sessionToRows(session) {
  const rows = [];
  const estado = session.finished ? 'Finalizada' : 'En progreso';
  const fecha = new Date(session.date).toLocaleDateString('es-AR');
  if (session.type === 'blocks') {
    session.blocks.forEach((b, bi) => {
      rows.push([session.key, session.sessionNumber, fecha, estado, b.name, 'bloque', bi + 1,
        (b.cantidadReal != null ? b.cantidadReal : b.cantidadSugerida), b.objetivo, '',
        b.thinkBox || '', b.playBox || '', b.resultado != null ? b.resultado : '', '',
        b.pctCirculo != null ? b.pctCirculo : '', b.notas || '']);
    });
  } else {
    session.blocks.forEach((b) => {
      b.shots.forEach((s, si) => {
        rows.push([session.key, session.sessionNumber, fecha, estado, b.name, 'tiro', si + 1,
          s.club, s.objetivo, s.target || '', s.thinkBox ? 'X' : '', s.playBox ? 'X' : '',
          s.resultado != null ? s.resultado : '', s.distancia != null ? s.distancia : '', '', '']);
      });
    });
  }
  return rows;
}

function downloadCSV(csvString, filename) {
  const blob = new Blob(['﻿' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportCSV(variantKey) {
  const all = await getAllSessions();
  const sessions = (variantKey ? all.filter((s) => s.key === variantKey) : all).sort((a, b) => a.id - b.id);
  const rows = [CSV_HEADER];
  for (const s of sessions) rows.push(...sessionToRows(s));
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const suffix = variantKey ? '_variante_' + variantKey : '_todo';
  downloadCSV(csv, 'registro_rango_juan' + suffix + '_' + new Date().toISOString().slice(0, 10) + '.csv');
}

// ---------- Import (reconstruye sesiones desde un CSV exportado por exportCSV) ----------
//
// Pensado para el caso "reinstale la app y perdi IndexedDB": el CSV exportado
// es la unica copia que queda, asi que esto reconstruye sesiones completas a
// partir de sus filas. Es un formato "aplanado" (una fila por bloque o por
// tiro), asi que se pierde precision que el CSV nunca guardo (hora exacta de
// la sesion - solo la fecha, trackDistance por tiro) - se recupera lo que
// hace falta para Historial/Reportes, que es lo que importa para no perder
// el trabajo. Los campos de plantilla que el CSV no guarda (shortLabel,
// cantidadSugerida, trackDistance) se completan comparando contra
// VARIANT_DEFS[key].factory(), la misma definicion que arma una sesion nueva.

function parseCSVRows(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

function parseNum(v) { return v == null || v === '' ? null : Number(v); }

// "dd/mm/aaaa" (toLocaleDateString('es-AR')) -> ISO. Sin hora en el CSV, asi
// que usa el mediodia para evitar que un cambio de huso corra la fecha al
// dia anterior/siguiente al mostrarla.
function parseFechaAR(v) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((v || '').trim());
  if (!m) return new Date().toISOString();
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0).toISOString();
}

function buildImportedSession(variantKey, tipo, groupRows, idx) {
  const template = VARIANT_DEFS[variantKey].factory();
  const col = (cols, name) => cols[idx[name]];
  const byItem = (a, b) => parseInt(col(a, 'Item'), 10) - parseInt(col(b, 'Item'), 10);

  if (tipo === 'bloque') {
    const blocks = groupRows.slice().sort(byItem).map((cols, bi) => {
      const tmpl = template.blocks[bi] || {};
      const cantidad = parseNum(col(cols, 'PaloOCantidadPutts'));
      return {
        name: col(cols, 'Bloque') || tmpl.name || ('Bloque ' + (bi + 1)),
        shortLabel: tmpl.shortLabel || col(cols, 'Bloque'),
        objetivo: col(cols, 'Objetivo') || tmpl.objetivo || '',
        cantidadSugerida: tmpl.cantidadSugerida != null ? tmpl.cantidadSugerida : cantidad,
        cantidadReal: cantidad,
        thinkBox: col(cols, 'ThinkBox') || null,
        playBox: col(cols, 'PlayBox') || null,
        resultado: parseNum(col(cols, 'Resultado')),
        pctCirculo: parseNum(col(cols, 'PctCirculo3pies')),
        notas: col(cols, 'Notas') || '',
      };
    });
    return { key: variantKey, type: 'blocks', name: template.name, blocks };
  }

  const blockOrder = [];
  const blockRows = new Map();
  groupRows.forEach((cols) => {
    const bname = col(cols, 'Bloque');
    if (!blockRows.has(bname)) { blockRows.set(bname, []); blockOrder.push(bname); }
    blockRows.get(bname).push(cols);
  });
  const blocks = blockOrder.map((bname, bi) => {
    const tmplBlock = template.blocks.find((b) => b.name === bname) || template.blocks[bi] || {};
    const shots = blockRows.get(bname).slice().sort(byItem).map((cols, si) => {
      const tmplShot = (tmplBlock.shots || [])[si] || {};
      const distancia = parseNum(col(cols, 'DistanciaReal'));
      return {
        objetivo: col(cols, 'Objetivo') || tmplShot.objetivo || '',
        club: col(cols, 'PaloOCantidadPutts') || tmplShot.club || '',
        target: col(cols, 'Target') || tmplShot.target || '',
        trackDistance: tmplShot.trackDistance != null ? tmplShot.trackDistance : distancia != null,
        thinkBox: col(cols, 'ThinkBox') === 'X',
        playBox: col(cols, 'PlayBox') === 'X',
        resultado: parseNum(col(cols, 'Resultado')),
        distancia,
      };
    });
    return { name: bname, shortLabel: tmplBlock.shortLabel || bname, shots };
  });
  return { key: variantKey, type: 'shots', name: template.name, blocks };
}

// Devuelve { imported, skipped }. Idempotente: una sesion cuya Variante+
// SesionNumero ya existe en la base se omite en vez de duplicarla (para
// poder reimportar el mismo CSV sin miedo, ej. si el import se corto a
// mitad de camino).
export async function importCSV(file) {
  const text = await file.text();
  const rows = parseCSVRows(text);
  if (rows.length < 2) return { imported: 0, skipped: 0 };

  const header = rows[0];
  const idx = {};
  CSV_HEADER.forEach((name, i) => { idx[name] = header.indexOf(name) !== -1 ? header.indexOf(name) : i; });

  const groups = new Map();
  const groupOrder = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (cols.length < 2) continue;
    const variantKey = cols[idx['Variante']];
    const sessionNumber = cols[idx['SesionNumero']];
    const gkey = variantKey + '|' + sessionNumber;
    if (!groups.has(gkey)) { groups.set(gkey, []); groupOrder.push(gkey); }
    groups.get(gkey).push(cols);
  }

  const existing = await getAllSessions();
  const existingKeys = new Set(existing.map((s) => s.key + '|' + s.sessionNumber));
  const usedIds = new Set(existing.map((s) => s.id));
  let nextId = Date.now();
  function freshId() {
    while (usedIds.has(nextId)) nextId++;
    usedIds.add(nextId);
    return nextId++;
  }

  let imported = 0, skipped = 0;
  for (const gkey of groupOrder) {
    const groupRows = groups.get(gkey);
    const first = groupRows[0];
    const variantKey = first[idx['Variante']];
    const sessionNumber = parseInt(first[idx['SesionNumero']], 10);
    if (!VARIANT_DEFS[variantKey] || Number.isNaN(sessionNumber) || existingKeys.has(gkey)) { skipped++; continue; }

    const tipo = first[idx['Tipo']];
    const session = buildImportedSession(variantKey, tipo, groupRows, idx);
    session.id = freshId();
    session.sessionNumber = sessionNumber;
    session.date = parseFechaAR(first[idx['Fecha']]);
    session.finished = first[idx['Estado']] === 'Finalizada';

    await saveSession(session);
    existingKeys.add(gkey);
    imported++;
  }

  return { imported, skipped };
}
