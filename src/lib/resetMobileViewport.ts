const LOCKED_VIEWPORT =
  'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover'

/** Forces the page back to 100% scale after camera, keyboard or accidental pinch zoom. */
export function resetMobileViewport(): void {
  const meta = document.querySelector('meta[name="viewport"]')
  if (meta instanceof HTMLMetaElement) {
    meta.setAttribute('content', LOCKED_VIEWPORT)
  }

  const root = document.documentElement
  const previousZoom = root.style.getPropertyValue('zoom')
  root.style.setProperty('zoom', '1')
  if (previousZoom && previousZoom !== '1') {
    requestAnimationFrame(() => {
      root.style.setProperty('zoom', '1')
    })
  }

  const vv = window.visualViewport
  if (vv && Math.abs(vv.scale - 1) > 0.01) {
    window.scrollTo({ top: window.scrollY, left: 0 })
  }
}

/** Native: re-lock scale whenever the app returns to foreground (camera/share/keyboard). */
export function installMobileViewportGuard(): () => void {
  resetMobileViewport()

  const onFocus = () => resetMobileViewport()
  const onVisibility = () => {
    if (document.visibilityState === 'visible') resetMobileViewport()
  }
  const onViewport = () => {
    const vv = window.visualViewport
    if (vv && Math.abs(vv.scale - 1) > 0.01) resetMobileViewport()
  }

  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisibility)
  window.visualViewport?.addEventListener('resize', onViewport)
  window.visualViewport?.addEventListener('scroll', onViewport)

  let removeAppListener: (() => void) | undefined
  void import('@capacitor/core').then(({ Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return
    void import('@capacitor/app').then(({ App }) => {
      const handle = App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) resetMobileViewport()
      })
      removeAppListener = () => {
        void handle.then((listener) => listener.remove())
      }
    })
  })

  return () => {
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibility)
    window.visualViewport?.removeEventListener('resize', onViewport)
    window.visualViewport?.removeEventListener('scroll', onViewport)
    removeAppListener?.()
  }
}
