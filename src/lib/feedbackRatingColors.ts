/** Star fill colors for feedback ratings 1–5. */
export function feedbackRatingColor(nota: number): string {
  if (nota <= 1) return '#e03131'
  if (nota === 2) return '#f76707'
  if (nota === 3) return '#f59f00'
  if (nota === 4) return '#74b816'
  return '#2f9e44'
}

export const FEEDBACK_RATING_LABELS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Excelente',
}
