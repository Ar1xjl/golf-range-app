// Export a CSV, portado desde el prototipo. Ahora lee directo de IndexedDB
// (getAllSessions) en vez de recorrer un indice + fetch por sesion.
//
// Columna "Resultado": 1-3 (Malo/Bueno/Excelente, ver resultScale.js). Las
// sesiones guardadas antes de ese cambio se migraron de su escala 1-5
// original a este 1-3 al abrir la app (db.js, v2 -> v3).

import { getAllSessions } from './db.js';

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
