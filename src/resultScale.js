// Escala de calificacion del post-shot / bloque: 3 niveles con nombre en
// vez de la escala 1-5 original. La escala de 5 generaba sesgo (rango muy
// amplio, dificil de aplicar consistente parado en el driving range) - ver
// discusion en About. Usamos palabras en los botones (no numeros) a
// proposito, para no anclar en un "puntaje".
export const RESULT_LEVELS = [
  { value: 1, label: 'Malo' },
  { value: 2, label: 'Bueno' },
  { value: 3, label: 'Excelente' },
];

export const RESULT_MAX = RESULT_LEVELS.length;

export function resultLabel(value) {
  const found = RESULT_LEVELS.find((l) => l.value === value);
  return found ? found.label : '';
}
