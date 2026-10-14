import type { SharingScope } from '../api/finance'

const KEY = 'conora.sharingView'

export function readSharingView(): SharingScope {
  const value = sessionStorage.getItem(KEY)
  return value === 'Personal' ? 'Personal' : 'Family'
}

export function writeSharingView(scope: SharingScope): void {
  sessionStorage.setItem(KEY, scope)
  window.dispatchEvent(new Event('conora:sharing-view'))
}
