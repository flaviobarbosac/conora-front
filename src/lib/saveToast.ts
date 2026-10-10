type SaveToastHandler = (message: string, durationMs: number) => void

let handler: SaveToastHandler | null = null

/** Registers the UI host that renders the success toast. */
export function registerSaveToastHandler(next: SaveToastHandler | null) {
  handler = next
}

/** Shows the standard success toast. Default duration: 2 seconds. */
export function showSaveToast(message = 'Registro salvo com sucesso.', durationMs = 2000) {
  handler?.(message, durationMs)
}
