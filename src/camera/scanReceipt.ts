import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { resetMobileViewport } from '../lib/resetMobileViewport'
import { setPendingShare, type PendingShare } from '../share/pendingShare'

export async function scanReceipt(): Promise<PendingShare> {
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt,
      promptLabelHeader: 'Escanear recibo',
      promptLabelPhoto: 'Galeria',
      promptLabelPicture: 'Câmera',
    })
    if (!photo.dataUrl) {
      throw new Error('Nenhuma imagem selecionada.')
    }
    const mime = photo.format === 'png' ? 'image/png' : 'image/jpeg'
    const share: PendingShare = {
      fileName: `recibo.${photo.format || 'jpg'}`,
      mimeType: mime,
      dataUrl: photo.dataUrl,
    }
    setPendingShare(share)
    return share
  } finally {
    // Camera/file picker often leaves WKWebView / Chrome scaled above 100%.
    resetMobileViewport()
    requestAnimationFrame(() => resetMobileViewport())
  }
}


export async function fileFromPending(share: PendingShare): Promise<File> {
  const response = await fetch(share.dataUrl)
  const blob = await response.blob()
  return new File([blob], share.fileName, { type: share.mimeType })
}
