import { useEffect } from 'react'

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

async function requestBrowserFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') {
    return false
  }

  if (document.fullscreenElement) {
    return true
  }

  const root = document.documentElement as FullscreenCapableElement

  try {
    if (root.requestFullscreen) {
      await root.requestFullscreen()
      return true
    }

    if (root.webkitRequestFullscreen) {
      await root.webkitRequestFullscreen()
      return true
    }
  } catch {
    return false
  }

  return false
}

export function useKioskFullscreen(): void {
  useEffect(() => {
    let disposed = false

    const requestOnce = () => {
      void requestBrowserFullscreen()
      window.removeEventListener('pointerdown', requestOnce)
      window.removeEventListener('keydown', requestOnce)
    }

    const queueRetry = () => {
      window.addEventListener('pointerdown', requestOnce, { once: true })
      window.addEventListener('keydown', requestOnce, { once: true })
    }

    const handleFocus = () => {
      if (disposed || document.fullscreenElement) {
        return
      }

      void requestBrowserFullscreen()
    }

    const handleVisibilityChange = () => {
      if (disposed || document.visibilityState !== 'visible') {
        return
      }

      handleFocus()
    }

    const handleFullscreenChange = () => {
      if (disposed || document.fullscreenElement) {
        return
      }

      void requestBrowserFullscreen()
    }

    void requestBrowserFullscreen().then((entered) => {
      if (!entered && !disposed) {
        queueRetry()
      }
    })

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      disposed = true
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      window.removeEventListener('pointerdown', requestOnce)
      window.removeEventListener('keydown', requestOnce)
    }
  }, [])
}
