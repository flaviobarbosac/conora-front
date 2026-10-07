import { App } from '@capacitor/app'
import { fileToPendingShare, setPendingShare, type PendingShare } from './pendingShare'

const SHARE_CACHE = 'conora-share'

async function fromShareCache(): Promise<PendingShare | null> {
  if (!('caches' in window)) {
    return null
  }
  const cache = await caches.open(SHARE_CACHE)
  const response = await cache.match('pending')
  if (!response) {
    return null
  }
  const blob = await response.blob()
  const fileName = decodeURIComponent(response.headers.get('X-File-Name') ?? 'recibo.jpg')
  await cache.delete('pending')
  return fileToPendingShare(new File([blob], fileName, { type: blob.type || 'image/jpeg' }))
}

async function fromSendIntent(): Promise<PendingShare | null> {
  try {
    const module = (await import('send-intent')) as {
      SendIntent?: {
        checkSendIntentReceived: () => Promise<{ url?: string; title?: string; type?: string }>
      }
    }
    const result = await module.SendIntent?.checkSendIntentReceived()
    if (!result?.url) {
      return null
    }
    const response = await fetch(result.url)
    const blob = await response.blob()
    const name = result.title || 'recibo.jpg'
    return fileToPendingShare(new File([blob], name, { type: result.type || blob.type || 'image/jpeg' }))
  } catch {
    return null
  }
}

export async function consumeIncomingShare(): Promise<PendingShare | null> {
  const fromCache = await fromShareCache()
  if (fromCache) {
    setPendingShare(fromCache)
    return fromCache
  }
  const fromIntent = await fromSendIntent()
  if (fromIntent) {
    setPendingShare(fromIntent)
    return fromIntent
  }
  return null
}

export function listenNativeShare(onShare: (share: PendingShare) => void): () => void {
  let cancelled = false
  const handle = App.addListener('appUrlOpen', (event) => {
    if (cancelled || !event.url.includes('compartilhar')) {
      return
    }
    void consumeIncomingShare().then((share) => {
      if (share) {
        onShare(share)
      }
    })
  })
  void consumeIncomingShare().then((share) => {
    if (!cancelled && share) {
      onShare(share)
    }
  })
  return () => {
    cancelled = true
    void handle.then((listener) => listener.remove())
  }
}
