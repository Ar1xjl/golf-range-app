// Planes en cancha: 4 protocolos si-entonces para sostener la rutina mental
// bajo presion (mal drive, distraccion con amigos, cierre de hoyo, llegada
// al tee). Es contenido de lectura/referencia, no un tracker: sin
// checkboxes ni registro, pensado para repasarse en 20-30 segundos parado
// en el tee. El mismo contenido se muestra en dos lugares (renderOncoursePlans,
// pantalla propia siempre accesible desde el menu; y embebido al final del
// warm-up en warmupSession.js) por eso vive separado de ambas pantallas.

const PLANS = [
  {
    title: 'Plan 1 — Despues de un mal drive',
    si: 'pego un mal drive y siento el impulso de "recuperar todo de un golpe"...',
    entonces: 'antes de caminar hacia la pelota, hago un respiro consciente y siento como los hombros bajan y las manos sueltan tension — recien ahi, parado detras de la pelota, decido el palo conservador y el objetivo. Si no lo decidi antes de acercarme, retrocedo y lo decido ahi.',
  },
  {
    title: 'Plan 2 — Distraccion con amigos',
    si: 'estoy charlando y se acerca mi turno...',
    entonces: 'tomo la toalla y limpio el palo (o tomo un trago de agua), prestando atencion consciente a la sensacion fisica — la tela contra el palo, o el agua bajando por la garganta, y noto como la respiracion se acomoda mientras lo hago. Recien cuando termino ese gesto, camino hacia la pelota.',
  },
  {
    title: 'Plan 3A — Cierre del hoyo',
    si: 'emboco el ultimo putt, antes de caminar al proximo tee...',
    entonces: 'un respiro profundo con exhalacion fuerte y audible, o sacudir brazos/manos — soltar fisicamente el hoyo anterior, sea bueno o malo.',
  },
  {
    title: 'Plan 3B — Llegada al tee',
    si: 'llego al tee del proximo hoyo, antes de sacar el palo...',
    entonces: 'estirar la espalda + 2 respiraciones profundas, sintiendo el cuerpo. Recien despues arranca el Think Box normal (elegir palo, target, visualizar).',
  },
];

export function oncoursePlansCardsHtml() {
  return PLANS.map((p) =>
    '<div class="gc-card">' +
      '<div class="gc-eyebrow" style="color:var(--green)">' + p.title + '</div>' +
      '<div class="gc-shotnum" style="line-height:1.6; font-size:13.5px; color:var(--ink);">' +
        '<b style="color:var(--gold);">SI</b> ' + p.si + '<br><br>' +
        '<b style="color:var(--green);">ENTONCES</b> ' + p.entonces +
      '</div>' +
    '</div>'
  ).join('');
}

export function renderOncoursePlans(ctx) {
  const { APP, state, render } = ctx;

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">GolfSaber</div>' +
      '<h1 class="gc-title">Planes en cancha</h1>' +
      '<div class="gc-sub">4 protocolos si-entonces para sostener la rutina bajo presion</div>' +
    '</div>' +
    '<div class="gc-body">' +
      oncoursePlansCardsHtml() +
    '</div>';

  document.getElementById('gc-back-btn').onclick = () => { state.screen = 'menu'; render(); };
}
