// Planes de warm-up pre-ronda. A diferencia de variants.js, estos 3 planes
// estan escritos a mano en vez de generados por builders: el contenido
// difiere en texto y estructura entre franjas (no solo en cantidad de
// tiros), asi que un generador parametrico seria mas complicado que util.
//
// La regla "si el tiempo es corto, se recorta primero el bloque medio
// (driver/largos), nunca movilidad ni putting" queda satisfecha por
// construccion: el plan de 10 min directamente no tiene bloque de
// driver/largos, y movilidad + putting estan presentes en los 3 planes.

export const WARMUP_PLANS = {
  10: {
    key: '10',
    label: '10 min',
    desc: 'Activacion rapida antes de salir corriendo',
    blocks: [
      { name: 'Movilidad', minutes: 2, detail: 'Rotaciones de hombro y cadera, sin club' },
      { name: 'Wedges', minutes: 3, detail: 'Medio swing, sensacion de contacto' },
      { name: 'Putts cortos', minutes: 3, detail: '3-6 pies, activar la mano' },
      { name: 'Palo del hoyo 1', minutes: 2, detail: '2-3 swings pensando en tempo, no en resultado' },
    ],
  },
  20: {
    key: '20',
    label: '20-30 min',
    desc: 'El estandar antes de una vuelta',
    blocks: [
      { name: 'Movilidad', minutes: 5, detail: 'Rotaciones de hombro/cadera, estiramientos dinamicos' },
      { name: 'Wedges progresivo', minutes: 5, detail: '50% -> 75% -> full swing' },
      { name: 'Hierros medios', minutes: 5, detail: 'Contacto solido, tempo controlado' },
      { name: 'Driver', minutes: 5, detail: '4-5 golpes buscando tempo, no distancia' },
      { name: 'Putting', minutes: 8, detail: 'Lag putts largos primero (calibrar velocidad del green de hoy), despues putts cortos de confianza' },
    ],
  },
  45: {
    key: '45',
    label: '45 min',
    desc: 'Preparacion completa, con tiempo de sobra',
    blocks: [
      { name: 'Movilidad + cardio liviano', minutes: 9, detail: 'Movilidad completa de hombros/cadera/muñecas + activacion cardiovascular liviana' },
      { name: 'Progresion completa', minutes: 11, detail: 'Wedges -> medios -> largos -> driver, ~20 golpes en total' },
      { name: 'Forma suave', minutes: 5, detail: 'Draw/fade suaves solo para confirmar contacto, no para corregir nada' },
      { name: 'Putting', minutes: 13, detail: 'Lag largos primero, despues cortos, despues con quiebre si el green de practica lo tiene' },
      { name: 'Chipping', minutes: 5, detail: 'Si hay tiempo' },
      { name: 'Cierre de confianza', minutes: 2, detail: 'Un tiro de approach corto de alta confianza antes de ir al tee' },
    ],
  },
};

export const WARMUP_ORDER = ['10', '20', '45'];

export function warmupTotalMinutes(plan) {
  return plan.blocks.reduce((sum, b) => sum + b.minutes, 0);
}
