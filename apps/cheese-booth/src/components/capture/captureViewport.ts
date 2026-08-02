import { useEffect, useState } from 'react'

import { resolveBrowserDeviceKind } from '../../lib/browserDevice'
import type { KioskProfile } from '../../types'

export type UiDensity = 'roomy' | 'compact' | 'dense'
export type BrowserDeviceKind = 'desktop' | 'mobile'

export function useCaptureViewport(layout: KioskProfile): {
  uiDensity: UiDensity
  deviceKind: BrowserDeviceKind
} {
  const [uiDensity, setUiDensity] = useState<UiDensity>('roomy')
  const [deviceKind, setDeviceKind] = useState<BrowserDeviceKind>('desktop')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateViewportContext = () => {
      setUiDensity(resolveUiDensity(layout, window.innerWidth, window.innerHeight))
      setDeviceKind(resolveBrowserDeviceKind(window, navigator))
    }

    updateViewportContext()
    window.addEventListener('resize', updateViewportContext)

    return () => {
      window.removeEventListener('resize', updateViewportContext)
    }
  }, [layout])

  return {
    uiDensity,
    deviceKind,
  }
}

function resolveUiDensity(
  layout: KioskProfile,
  viewportWidth: number,
  viewportHeight: number,
): UiDensity {
  if (layout === 'portrait') {
    if (viewportHeight < 760 || viewportWidth < 420) {
      return 'dense'
    }

    if (
      viewportHeight < 980 ||
      viewportWidth < 560 ||
      viewportHeight / viewportWidth > 2.18
    ) {
      return 'compact'
    }

    return 'roomy'
  }

  if (viewportHeight < 560 || viewportWidth < 900) {
    return 'dense'
  }

  if (viewportHeight < 760 || viewportWidth < 1180) {
    return 'compact'
  }

  return 'roomy'
}
