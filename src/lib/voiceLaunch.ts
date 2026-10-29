/**
 * Product gate for Ian mic / voice launch on the home dashboard.
 * When false: no mic on home, no voice section in Settings (feature absent).
 * When true: Settings "confirmar lançamento por voz" and the home mic are one control
 * (`voiceEntryConfirm` on the profile).
 */
export const VOICE_LAUNCH_ENABLED = false

/** Mic visible and voice listen allowed only when the product gate and the preference agree. */
export function isVoiceMicActive(voiceEntryConfirm: boolean | undefined | null): boolean {
  return VOICE_LAUNCH_ENABLED && voiceEntryConfirm !== false
}
