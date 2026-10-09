/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/compartilhar')) {
    return
  }

  event.respondWith(handleShareTarget(event.request, url))
})

async function handleShareTarget(request: Request, url: URL): Promise<Response> {
  try {
    const form = await request.formData()
    const media = form.get('media')
    if (media instanceof File && media.size > 0) {
      const cache = await caches.open('conora-share')
      await cache.put(
        'pending',
        new Response(media, {
          headers: {
            'Content-Type': media.type || 'image/jpeg',
            'X-File-Name': encodeURIComponent(media.name || 'recibo.jpg'),
          },
        }),
      )
    }
  } catch {
    // continue to the confirm screen even if the payload is empty
  }

  const dest = new URL('compartilhar', `${url.origin}/app/`)
  return Response.redirect(dest.toString(), 303)
}
