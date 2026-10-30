export type ConfirmRequest = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** Single-button informational dialog (no cancel). */
  info?: boolean
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
  options?: Omit<ConfirmRequest, 'message' | 'info'>,
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

/** Shows a blocking informational popup (one Entendi button). */
export function confirmInfo(
  message: string,
  options?: { title?: string; confirmLabel?: string },
): Promise<boolean> {
  const request: ConfirmRequest = {
    title: options?.title ?? 'Atenção',
    message,
    confirmLabel: options?.confirmLabel ?? 'Entendi',
    info: true,
  }

  if (!handler) {
    window.alert(message)
    return Promise.resolve(true)
  }

  return handler(request)
}

/** Asks before discarding unsaved edits (navigation, close form, dismiss overlay). */
export function confirmLeaveUnsaved(message?: string): Promise<boolean> {
  return confirmDestructive(
    message ?? 'Há alterações não salvas. Se sair agora, essas informações serão perdidas.',
    {
      title: 'Confirmar saída',
      confirmLabel: 'Sair',
      cancelLabel: 'Continuar editando',
      danger: true,
    },
  )
}
