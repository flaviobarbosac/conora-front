type SaveToastHandler = (message: string) => void

let handler: SaveToastHandler | null = null

/** Registers the UI host that renders the success toast. */
export function registerSaveToastHandler(next: SaveToastHandler | null) {
  handler = next
}

/** Shows the standard success toast. It closes itself after 2 seconds. */
export function showSaveToast(message = 'Registro salvo com sucesso.') {
  handler?.(message)
}
