import { describe, expect, it } from 'vitest'
import { FEEDBACK_RATING_LABELS, feedbackRatingColor } from './feedbackRatingColors'

describe('feedbackRatingColors', () => {
  it('returns distinct colors for 1–5', () => {
    const colors = [1, 2, 3, 4, 5].map(feedbackRatingColor)
    expect(new Set(colors).size).toBe(5)
    expect(feedbackRatingColor(0)).toBe(feedbackRatingColor(1))
    expect(feedbackRatingColor(9)).toBe('#2f9e44')
  })

  it('has labels for each star', () => {
    expect(FEEDBACK_RATING_LABELS[1]).toBe('Muito ruim')
    expect(FEEDBACK_RATING_LABELS[5]).toBe('Excelente')
  })
})
