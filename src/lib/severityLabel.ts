/** Portuguese labels for API alert severity codes (API keeps English codes). */
export function severityLabelPt(severity: string): string {
  switch (severity) {
    case 'Exceeded':
      return 'Excedido'
    case 'Attention':
      return 'Atenção'
    case 'Limit':
      return 'Limite'
    case 'Ok':
      return 'Ok'
    case 'Info':
      return 'Info'
    default:
      return severity
  }
}
