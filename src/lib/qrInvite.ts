import jsQR from 'jsqr'
import QRCode from 'qrcode'

export async function renderQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 280,
    color: { dark: '#111111', light: '#ffffff' },
  })
}

export function tokenFromQrPayload(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/grupo\/convite\/([^/]+)/i)
    if (match?.[1]) {
      return decodeURIComponent(match[1])
    }
  } catch {
    // plain token
  }
  if (/^[0-9A-Fa-f]{48,128}$/.test(trimmed)) {
    return trimmed
  }
  return null
}

export function cameraAvailable(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

export type QrScanSession = {
  stop: () => void
}

export async function startQrScan(
  video: HTMLVideoElement,
  onToken: (token: string) => void,
  onError: (message: string) => void,
): Promise<QrScanSession> {
  if (!cameraAvailable()) {
    throw new Error(
      'Este navegador não liberou a câmera. Use o Chrome, o Safari, o Edge, o Firefox ou o aplicativo Conora.',
    )
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    })
  } catch {
    throw new Error(
      'Este navegador não liberou a câmera. Use o Chrome, o Safari, o Edge, o Firefox ou o aplicativo Conora.',
    )
  }

  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  await video.play()

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  let active = true
  let handled = false
  let frame = 0

  function tick() {
    if (!active || handled) {
      return
    }
    frame += 1
    if (frame % 2 === 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && context) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      if (canvas.width > 0 && canvas.height > 0) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
        if (code?.data) {
          const token = tokenFromQrPayload(code.data)
          if (token) {
            handled = true
            onToken(token)
            stop()
            return
          }
          onError('QR lido, mas o código do convite não é válido.')
        }
      }
    }
    requestAnimationFrame(tick)
  }

  function stop() {
    active = false
    for (const track of stream.getTracks()) {
      track.stop()
    }
    video.srcObject = null
  }

  requestAnimationFrame(tick)
  return { stop }
}
