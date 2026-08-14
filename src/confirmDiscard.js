// Boton "Cancelar sesion" compartido por las 3 pantallas de sesion
// (tiro-a-tiro, bloques, warm-up): descarta sin guardar nada, a diferencia
// de "Guardar y salir"/"Salir" que persisten como finished:false.
//
// Confirmacion en dos pasos, sin usar el confirm() nativo del navegador
// (se ve fuera de lugar en una PWA instalada). El estado de "confirmando"
// vive en state.confirmingCancel porque estas pantallas hacen re-render
// completo del innerHTML en cada interaccion.

export function cancelRowHtml(state) {
  if (state.confirmingCancel) {
    return '<div class="gc-row" style="margin-top:8px;">' +
      '<button class="gc-btn gc-btn-ghost gc-btn-sm" id="gc-cancel-no">No</button>' +
      '<button class="gc-btn gc-btn-danger gc-btn-sm" id="gc-cancel-yes">Si, descartar</button>' +
      '</div>';
  }
  return '<button class="gc-btn gc-btn-danger-ghost gc-btn-sm" id="gc-cancel-btn" style="margin-top:8px;">Cancelar sesion</button>';
}

export function wireCancelRow(state, render, onDiscard) {
  if (state.confirmingCancel) {
    document.getElementById('gc-cancel-no').onclick = () => { state.confirmingCancel = false; render(); };
    document.getElementById('gc-cancel-yes').onclick = () => { state.confirmingCancel = false; onDiscard(); };
  } else {
    document.getElementById('gc-cancel-btn').onclick = () => { state.confirmingCancel = true; render(); };
  }
}
