// Pantalla "Acerca de": que es la app y credito. Acceso desde el menu.

import { RESULT_LEVELS } from '../resultScale.js';

export function renderAbout(ctx) {
  const { APP, state, render } = ctx;

  // Criterio de cada nivel - las etiquetas (Malo/Bueno/Excelente) viven en
  // resultScale.js junto al valor numerico que se guarda; la descripcion
  // larga es especifica de esta pantalla.
  const resultCriteria = {
    3: 'Tiro perfecto y controlado.',
    2: 'Buen tiro, la pelota queda en juego - aunque el contacto no fue del todo limpio, o hubo desvio de linea/distancia que hace fallar el green.',
    1: 'Tiro desviado, filazo, muy pesado, o directamente errado e injugable.',
  };
  const resultCriteriaHtml = RESULT_LEVELS.slice().reverse().map((l) =>
    '<b style="color:var(--ink);">' + l.label + ':</b> ' + resultCriteria[l.value]
  ).join('<br><br>');

  APP.innerHTML =
    '<div class="gc-header">' +
      '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
      '<div class="gc-eyebrow">GolfSaber</div>' +
      '<h1 class="gc-title">Acerca de la app</h1>' +
    '</div>' +
    '<div class="gc-body">' +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Que es</div>' +
        '<div class="gc-shotnum" style="line-height:1.6; font-size:13.5px; color:var(--ink);">' +
          'App de registro de sesiones de practica de golf, pensada para usarse parada en el driving range o en el green, ' +
          'sin depender de wifi. Cada tiro (o bloque, en putting) registra Think Box, Play Box y un resultado post-shot, ' +
          'y la app guarda el historial y calcula un foco sugerido para la proxima practica.' +
        '</div>' +
      '</div>' +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Think Box / Play Box</div>' +
        '<div class="gc-shotnum" style="line-height:1.6; font-size:13.5px; color:var(--ink);">' +
          '<b style="color:var(--ink);">Think Box:</b> marcalo si ANTES del tiro elegiste a conciencia objetivo, palo y trayectoria - un plan claro, no "pegale y listo".<br><br>' +
          '<b style="color:var(--ink);">Play Box:</b> marcalo si DURANTE el swing ejecutaste comprometido con ese plan, sin dudar ni re-analizar a mitad de camino.<br><br>' +
          'No marques Play Box si jugaste distraido, indeciso, o cambiaste de idea a mitad del swing - aunque el resultado haya salido bien. La idea es medir el proceso (la rutina mental), no el resultado: eso ya lo captura el Post-shot.' +
        '</div>' +
      '</div>' +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Post-shot: como calificar el tiro</div>' +
        '<div class="gc-shotnum" style="line-height:1.6; font-size:13.5px; color:var(--ink);">' +
          resultCriteriaHtml +
        '</div>' +
      '</div>' +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Variantes de practica</div>' +
        '<div class="gc-hist-row"><span>A — Approach corto</span><span class="gc-mono">&lt;120 yds</span></div>' +
        '<div class="gc-hist-row"><span>B — Distancia media</span><span class="gc-mono">120-150 yds</span></div>' +
        '<div class="gc-hist-row"><span>C — Precision hierros largos</span><span class="gc-mono">150-185 yds</span></div>' +
        '<div class="gc-hist-row"><span>D — Putting semanal</span><span class="gc-mono">por bloque</span></div>' +
        '<div class="gc-hist-row"><span>E — Drive y recuperacion</span><span class="gc-mono">fairway + plan B</span></div>' +
      '</div>' +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Antes de jugar</div>' +
        '<div class="gc-shotnum" style="line-height:1.6; font-size:13.5px; color:var(--ink);">' +
          '<b style="color:var(--ink);">Warm-up:</b> checklist con timer segun el tiempo que tengas antes de salir a jugar.<br>' +
          '<b style="color:var(--ink);">Tempo Trainer:</b> metronomo de audio con relacion 3:1 backswing:downswing, ' +
          'inspirado en Tour Tempo y en el trabajo de Robert Grober (Sonic Golf).' +
        '</div>' +
      '</div>' +
      '<div class="gc-card">' +
        '<div class="gc-eyebrow" style="color:var(--green)">Datos</div>' +
        '<div class="gc-shotnum" style="line-height:1.6; font-size:13.5px; color:var(--ink);">' +
          'Todo se guarda en el dispositivo (IndexedDB), no hay backend ni sincronizacion. Los datos no salen del telefono ' +
          'salvo que uses "Exportar a CSV" vos mismo.' +
        '</div>' +
      '</div>' +
      '<div class="gc-shotnum" style="text-align:center; margin-top:20px;">' +
        'Creada por Juan Llauro<br>' +
        '<a href="mailto:hodlear@proton.me" style="color:var(--green); font-weight:600;">hodlear@proton.me</a>' +
      '</div>' +
    '</div>';

  document.getElementById('gc-back-btn').onclick = () => { state.screen = 'menu'; render(); };
}
