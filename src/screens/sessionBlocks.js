// Pantalla de sesion por bloque (variante D: putting semanal). Portado desde el prototipo.

function seaBanner(session) {
  return '<div class="gc-sea-banner">Sesion #' + (session.sessionNumber || 1) + ' — Variante ' + session.key + ': ' + session.name + '</div>';
}

export function renderBlockSession(ctx) {
  const { APP, state, render, persistCurrentSession, finishSession } = ctx;
  const session = state.session;
  const cardsHtml = session.blocks.map((b, bi) => {
    const segRow = (field, current) => '<div class="gc-seg-row" data-field="' + field + '" data-block="' + bi + '">' +
      ['Si', 'Parcial', 'No'].map((opt) => '<div class="gc-seg-btn ' + (current === opt ? 'sel' : '') + '" data-val="' + opt + '">' + opt + '</div>').join('') + '</div>';
    const resultRow = '<div class="gc-result-row" data-field="resultado" data-block="' + bi + '">' +
      [1, 2, 3, 4, 5].map((n) => '<div class="gc-result-peg ' + (b.resultado === n ? 'sel' : '') + '" data-n="' + n + '">' + n + '</div>').join('') + '</div>';

    return '<div class="gc-card">' +
      '<div class="gc-eyebrow" style="color:var(--green)">' + b.name + '</div>' +
      '<div class="gc-shotnum" style="margin-bottom:10px;">' + b.objetivo + '</div>' +
      '<div class="gc-toggle-label">Cantidad de putts</div>' +
      '<input type="number" class="gc-d-input" data-field="cantidadReal" data-block="' + bi + '" value="' + (b.cantidadReal != null ? b.cantidadReal : b.cantidadSugerida) + '" />' +
      '<div class="gc-toggle-label" style="margin-top:12px;">Think Box</div>' + segRow('thinkBox', b.thinkBox) +
      '<div class="gc-toggle-label" style="margin-top:10px;">Play Box</div>' + segRow('playBox', b.playBox) +
      '<div class="gc-toggle-label" style="margin-top:10px;">Resultado promedio (1-5)</div>' + resultRow +
      '<div class="gc-toggle-label" style="margin-top:10px;">% en circulo de 3 pies</div>' +
      '<input type="number" min="0" max="100" class="gc-d-input" data-field="pctCirculo" data-block="' + bi + '" placeholder="0-100" value="' + (b.pctCirculo != null ? b.pctCirculo : '') + '" />' +
      '<div class="gc-toggle-label" style="margin-top:10px;">Notas</div>' +
      '<textarea class="gc-d-textarea" data-field="notas" data-block="' + bi + '" rows="2" placeholder="Opcional">' + (b.notas || '') + '</textarea>' +
      '</div>';
  }).join('');

  APP.innerHTML =
    seaBanner(session) +
    '<div class="gc-body" style="padding-top:16px;">' +
      cardsHtml +
      '<button class="gc-btn gc-btn-primary" id="gc-finish-d-btn">Finalizar sesion</button>' +
      '<button class="gc-btn gc-btn-ghost" id="gc-exit-d-btn" style="margin-top:8px;">Guardar y salir</button>' +
    '</div>';

  document.querySelectorAll('.gc-d-input, .gc-d-textarea').forEach((el) => {
    el.onchange = (e) => {
      const bi = parseInt(el.dataset.block, 10);
      const field = el.dataset.field;
      let val = e.target.value;
      if (field === 'cantidadReal' || field === 'pctCirculo') val = val === '' ? null : parseFloat(val);
      session.blocks[bi][field] = val;
    };
  });
  document.querySelectorAll('.gc-seg-row').forEach((row) => {
    row.querySelectorAll('.gc-seg-btn').forEach((btn) => {
      btn.onclick = () => {
        const bi = parseInt(row.dataset.block, 10);
        session.blocks[bi][row.dataset.field] = btn.dataset.val;
        render();
      };
    });
  });
  document.querySelectorAll('.gc-result-row').forEach((row) => {
    row.querySelectorAll('.gc-result-peg').forEach((peg) => {
      peg.onclick = () => {
        const bi = parseInt(row.dataset.block, 10);
        session.blocks[bi].resultado = parseInt(peg.dataset.n, 10);
        render();
      };
    });
  });
  document.getElementById('gc-finish-d-btn').onclick = async () => { await finishSession(); };
  document.getElementById('gc-exit-d-btn').onclick = async () => {
    await persistCurrentSession(false);
    state.screen = 'home'; state.session = null; render();
  };
}
