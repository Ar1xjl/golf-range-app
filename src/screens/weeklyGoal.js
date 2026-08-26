// Meta semanal: un numero de sesiones por semana, sin calendario ni
// progresion tipo Garmin Coach - el usuario lo define una vez (editable
// cuando quiera) y el home solo se lo refleja de vuelta (ver la card
// "Esta semana" en home.js). Vive en el store `settings` ya existente
// (mismo store que las preferencias del Tempo Trainer), como una fila mas
// - no hizo falta tocar el esquema de db.js.

const MIN_GOAL = 1;
const MAX_GOAL = 7;

export async function renderWeeklyGoal(ctx) {
  const { APP, state, render, db } = ctx;
  const existing = await db.getSetting('weeklyGoal');
  let target = (existing && existing.target) || 3;

  const back = () => { state.screen = state.returnScreen || 'home'; state.returnScreen = null; render(); };

  const draw = () => {
    APP.innerHTML =
      '<div class="gc-header">' +
        '<button class="gc-nav-back" id="gc-back-btn">◂ VOLVER</button>' +
        '<div class="gc-eyebrow">Menu</div>' +
        '<h1 class="gc-title">Meta semanal</h1>' +
        '<div class="gc-sub">Se evalua de lunes a domingo. La podes cambiar cuando quieras.</div>' +
      '</div>' +
      '<div class="gc-body">' +
        '<div class="gc-card" style="text-align:center;">' +
          '<div class="gc-eyebrow" style="color:var(--green);text-align:left;">Sesiones por semana</div>' +
          '<div class="gc-stepper">' +
            '<button class="gc-stepper-btn" id="gc-goal-minus" ' + (target <= MIN_GOAL ? 'disabled' : '') + '>−</button>' +
            '<div class="gc-stepper-num">' + target + '</div>' +
            '<button class="gc-stepper-btn" id="gc-goal-plus" ' + (target >= MAX_GOAL ? 'disabled' : '') + '>+</button>' +
          '</div>' +
        '</div>' +
        '<button class="gc-btn gc-btn-primary" id="gc-goal-save">Guardar meta</button>' +
      '</div>';

    document.getElementById('gc-back-btn').onclick = back;
    document.getElementById('gc-goal-minus').onclick = () => { if (target > MIN_GOAL) { target--; draw(); } };
    document.getElementById('gc-goal-plus').onclick = () => { if (target < MAX_GOAL) { target++; draw(); } };
    document.getElementById('gc-goal-save').onclick = async () => {
      await db.saveSetting('weeklyGoal', { target });
      back();
    };
  };

  draw();
}
