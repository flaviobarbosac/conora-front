import { fileFromPending } from '../camera/scanReceipt'
import { receiptsApi, type ReceiptChannel, type ReceiptIntake, type ReceiptPurpose } from '../api/finance'
import type { PendingShare } from '../share/pendingShare'

const PENDING_INTAKE_KEY = 'conora.pendingReceiptIntakeId'

export function setPendingIntakeId(id: string): void {
  sessionStorage.setItem(PENDING_INTAKE_KEY, id)
}

export function peekPendingIntakeId(): string | null {
  return sessionStorage.getItem(PENDING_INTAKE_KEY)
}

export function takePendingIntakeId(): string | null {
  const id = peekPendingIntakeId()
  sessionStorage.removeItem(PENDING_INTAKE_KEY)
  return id
}

export async function dataUrlToBlob(dataUrl: string, mimeType: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  if (blob.type) {
    return blob
  }
  return new Blob([blob], { type: mimeType || 'image/jpeg' })
}

export async function uploadPendingShare(
  share: PendingShare,
  channel: ReceiptChannel = 'App',
  purpose: ReceiptPurpose = 'Expense',
): Promise<ReceiptIntake> {
  const file = await fileFromPending(share)
  const intake = await receiptsApi.upload(file, share.fileName || 'recibo.jpg', channel, purpose)
  setPendingIntakeId(intake.id)
  return intake
}

/** File picker for JPEG/PNG/WebP/PDF (cupom or boleto). */
export function pickReceiptMedia(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp,application/pdf,.pdf'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new Error('Nenhum arquivo selecionado.'))
        return
      }
      resolve(file)
    }
    input.click()
  })
}

export async function pollReceipt(
  id: string,
  options?: { maxAttempts?: number; intervalMs?: number },
): Promise<ReceiptIntake> {
  const maxAttempts = options?.maxAttempts ?? 40
  const intervalMs = options?.intervalMs ?? 500
  let latest = await receiptsApi.get(id)
  for (let i = 0; i < maxAttempts && latest.status === 'Processing'; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    latest = await receiptsApi.get(id)
  }
  return latest
}
