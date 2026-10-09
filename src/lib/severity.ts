export type Tone = 'ok' | 'info' | 'warning' | 'danger'

/** Maps API severity/status strings (Ok, Attention, Limit, Exceeded, Info) to a badge tone. */
export function toneFromSeverity(severity: string): Tone {
  switch (severity) {
    case 'Ok':
      return 'ok'
    case 'Attention':
    case 'Limit':
      return 'warning'
    case 'Exceeded':
      return 'danger'
    default:
      return 'info'
  }
}
