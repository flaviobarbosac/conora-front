export const PENDING_SHARE_KEY = 'conora.pendingShare'

export type PendingShare = {
  fileName: string
  mimeType: string
  dataUrl: string
}

export function setPendingShare(share: PendingShare): void {
  sessionStorage.setItem(PENDING_SHARE_KEY, JSON.stringify(share))
}

export function peekPendingShare(): PendingShare | null {
  const raw = sessionStorage.getItem(PENDING_SHARE_KEY)
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as PendingShare
  } catch {
    return null
  }
}

export function takePendingShare(): PendingShare | null {
  const share = peekPendingShare()
  sessionStorage.removeItem(PENDING_SHARE_KEY)
  return share
}

export async function fileToPendingShare(file: File): Promise<PendingShare> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo compartilhado.'))
    reader.readAsDataURL(file)
  })
  return { fileName: file.name || 'recibo.jpg', mimeType: file.type || 'image/jpeg', dataUrl }
}
