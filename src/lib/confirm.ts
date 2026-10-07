export type ConfirmRequest = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmHandler = (request: ConfirmRequest) => Promise<boolean>

let handler: ConfirmHandler | null = null

/** Registers the UI host that renders the styled confirm dialog. */
export function registerConfirmHandler(next: ConfirmHandler | null) {
  handler = next
}

/** Asks the user before a destructive (or important) action. */
export function confirmDestructive(
  message: string,
  options?: Omit<ConfirmRequest, 'message'>,
): Promise<boolean> {
  const request: ConfirmRequest = {
    title: options?.title ?? 'Confirmar exclusão',
    message,
    confirmLabel: options?.confirmLabel ?? 'Excluir',
    cancelLabel: options?.cancelLabel ?? 'Cancelar',
    danger: options?.danger ?? true,
  }

  if (!handler) {
    return Promise.resolve(window.confirm(message))
  }

  return handler(request)
}
