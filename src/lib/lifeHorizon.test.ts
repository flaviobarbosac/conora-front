import { describe, expect, it } from 'vitest'
import {
  horizonBadgeClass,
  horizonFillClass,
  isProjectExtrapolated,
  projectFillClass,
} from './lifeHorizon'

const styles = {
  progressFill_ok: 'green',
  progressFill_warning: 'yellow',
  progressFill_horizonLong: 'horizon-red',
  progressFill_danger: 'alert-red',
  badge_ok: 'badge-green',
  badge_warning: 'badge-yellow',
  badge_horizonLong: 'badge-horizon-red',
}

describe('life project horizon colors', () => {
  it('maps short to green, mid to yellow, long to horizon red', () => {
    expect(horizonFillClass(styles, 'short')).toBe('green')
    expect(horizonFillClass(styles, 'mid')).toBe('yellow')
    expect(horizonFillClass(styles, 'long')).toBe('horizon-red')
    expect(horizonFillClass(styles, 'long')).not.toBe('alert-red')
  })

  it('uses the same palette on the badge', () => {
    expect(horizonBadgeClass(styles, 'short')).toBe('badge-green')
    expect(horizonBadgeClass(styles, 'mid')).toBe('badge-yellow')
    expect(horizonBadgeClass(styles, 'long')).toBe('badge-horizon-red')
  })

  it('paints a project bar by horizon', () => {
    expect(projectFillClass(styles, { horizon: 'short', accumulatedAmount: 10, goalAmount: 100 })).toBe('green')
    expect(projectFillClass(styles, { horizon: 'mid', accumulatedAmount: 10, goalAmount: 100 })).toBe('yellow')
    expect(projectFillClass(styles, { horizon: 'long', accumulatedAmount: 10, goalAmount: 100 })).toBe('horizon-red')
  })

  it('uses horizon red when accumulated passes the goal, even on a short project', () => {
    expect(isProjectExtrapolated({ accumulatedAmount: 150, goalAmount: 100 })).toBe(true)
    expect(isProjectExtrapolated({ accumulatedAmount: 100, goalAmount: 100 })).toBe(false)
    expect(isProjectExtrapolated({ accumulatedAmount: 10, goalAmount: 0 })).toBe(false)
    expect(projectFillClass(styles, { horizon: 'short', accumulatedAmount: 150, goalAmount: 100 })).toBe('horizon-red')
  })
})
