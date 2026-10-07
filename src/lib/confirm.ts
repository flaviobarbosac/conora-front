/** Asks the user before a destructive action. Returns true only if they confirm. */
export function confirmDestructive(message: string): boolean {
  return window.confirm(message)
}
