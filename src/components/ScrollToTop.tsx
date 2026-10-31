import { useEffect, useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Brings every route change back to the top of the page (mobile + desktop). */
function resetDocumentScroll() {
  const main = document.getElementById('conteudo-principal')
  const shellContent = document.getElementById('conora-shell-content')
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
  if (main) {
    main.scrollTop = 0
  }
  if (shellContent) {
    shellContent.scrollTop = 0
  }
}

/**
 * React Router keeps the previous scroll position across navigations.
 * That leaves long screens (Orçamento, Raio-X) opening mid-page or at the bottom.
 * Reset on pathname change only — search/hash deep-links may scroll after this.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useLayoutEffect(() => {
    resetDocumentScroll()
    // Lazy routes paint after the first layout — catch the second frame too.
    const raf = window.requestAnimationFrame(() => {
      resetDocumentScroll()
    })
    const timer = window.setTimeout(resetDocumentScroll, 0)
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [pathname])

  return null
}
