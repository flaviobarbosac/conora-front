import { describe, expect, it } from 'vitest'
import { VOICE_LAUNCH_ENABLED, isVoiceMicActive } from './voiceLaunch'

describe('voiceLaunch', () => {
  it('keeps product gate off and mic inactive', () => {
    expect(VOICE_LAUNCH_ENABLED).toBe(false)
    expect(isVoiceMicActive(true)).toBe(false)
    expect(isVoiceMicActive(false)).toBe(false)
    expect(isVoiceMicActive(null)).toBe(false)
  })
})
