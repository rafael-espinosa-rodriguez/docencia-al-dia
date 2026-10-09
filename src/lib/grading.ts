// Escala oficial de calificaciones: 2 (mínimo, desaprobado) – 5 (máximo).
// Aprueba con 3 o más. Toda nota que entre al sistema debe quedar
// normalizada a un entero dentro de este rango.
export const GRADE_MIN = 2;
export const GRADE_MAX = 5;
export const PASS_SCORE = 3;

export const clampGrade = (value: number): number => {
  if (isNaN(value)) return GRADE_MIN;
  return Math.min(GRADE_MAX, Math.max(GRADE_MIN, Math.round(value)));
};

export const isPassingGrade = (score: number | null): boolean =>
  score !== null && score >= PASS_SCORE;

export const formatGrade = (score: number | null): string => {
  if (score === null) return '—';
  return score < 10 ? `0${score}` : `${score}`;
};
