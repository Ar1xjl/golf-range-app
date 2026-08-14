// Menu (icono hamburguesa arriba a la derecha del home): reportes,
// exportar y acerca de. Centraliza acciones que antes estaban sueltas en
// el home.

export function renderMenu(ctx) {
  const { APP, state, render, exportCSV } = ctx;

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">GolfSaber</div>' +
      '<h1 class="gc-title">Menu</h1>' +
    '</div>' +
    '<div class="gc-body">' +
      '<button class="gc-btn gc-btn-ghost" id="gc-menu-reports" style="margin-bottom:10px;">📊 Reportes y estadisticas</button>' +
      '<button class="gc-btn gc-btn-ghost" id="gc-menu-export" style="margin-bottom:10px;">Exportar todo a CSV</button>' +
      '<button class="gc-btn gc-btn-ghost" id="gc-menu-about">Acerca de esta app</button>' +
    '</div>';

  document.getElementById('gc-back-btn').onclick = () => { state.screen = 'home'; render(); };
  document.getElementById('gc-menu-reports').onclick = () => { state.screen = 'reports'; render(); };
  document.getElementById('gc-menu-export').onclick = () => exportCSV(null);
  document.getElementById('gc-menu-about').onclick = () => { state.screen = 'about'; render(); };
}
