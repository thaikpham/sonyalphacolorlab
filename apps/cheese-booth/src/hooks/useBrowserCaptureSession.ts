import { useEffect, useRef, useState } from 'react'

import {
  DEFAULT_BROWSER_CAPTURE_SESSION_STATE,
  type CaptureMode,
  type BrowserCaptureSessionState,
  type BrowserSessionItem,
} from '../types'
import { getSessionMaxItems } from '../lib/captureModes'

function revokeSessionItemUrls(items: BrowserSessionItem[]): void {
  items.forEach((item) => {
    if (item.previewUrl.startsWith('blob:')) {
      window.URL.revokeObjectURL(item.previewUrl)
    }

    if (item.posterUrl !== item.previewUrl && item.posterUrl.startsWith('blob:')) {
      window.URL.revokeObjectURL(item.posterUrl)
    }
  })
}

function resequenceSessionItems(items: BrowserSessionItem[]): BrowserSessionItem[] {
  return items.map((item, index) => ({
    ...item,
    sequence: index + 1,
  }))
}

export function useBrowserCaptureSession() {
  const [browserSession, setBrowserSession] = useState<BrowserCaptureSessionState>(
    DEFAULT_BROWSER_CAPTURE_SESSION_STATE,
  )
  const itemsRef = useRef(browserSession.items)

  useEffect(() => {
    itemsRef.current = browserSession.items
  }, [browserSession.items])

  function resetBrowserSession(): void {
    setBrowserSession((current) => {
      revokeSessionItemUrls(current.items)
      return {
        ...DEFAULT_BROWSER_CAPTURE_SESSION_STATE,
      }
    })
  }

  function startBrowserSession(captureMode: CaptureMode): void {
    setBrowserSession((current) => {
      if (current.status === 'ready' || current.status === 'error' || current.items.length > 0) {
        revokeSessionItemUrls(current.items)
      }

      return {
        ...DEFAULT_BROWSER_CAPTURE_SESSION_STATE,
        status: 'active',
        startedAt: Date.now(),
        captureMode,
        maxItems: getSessionMaxItems(captureMode),
      }
    })
  }

  function enterReviewingShot(): void {
    setBrowserSession((current) => ({
      ...current,
      status: 'reviewing-shot',
      share: {
        status: 'idle',
      },
    }))
  }

  function rejectReviewedShot(): void {
    setBrowserSession((current) => ({
      ...current,
      status: current.startedAt ? 'active' : 'idle',
    }))
  }

  function addSessionItem(item: BrowserSessionItem): void {
    setBrowserSession((current) => ({
      ...current,
      status: 'active',
      captureMode: current.captureMode ?? item.kind,
      items: [...current.items, item].slice(0, current.maxItems),
    }))
  }

  function removeSessionItem(itemId: string): void {
    setBrowserSession((current) => {
      const removedItem = current.items.find((item) => item.id === itemId)

      if (!removedItem) {
        return current
      }

      revokeSessionItemUrls([removedItem])

      return {
        ...current,
        items: resequenceSessionItems(
          current.items.filter((item) => item.id !== itemId),
        ),
      }
    })
  }

  function startFinalizing(): void {
    setBrowserSession((current) => ({
      ...current,
      status: 'finalizing',
      share: {
        status: 'finalizing',
      },
    }))
  }

  function completeSessionShare(payload: {
    sessionId: string
    downloadToken: string
    galleryUrl: string
    expiresAt: string
  }): void {
    setBrowserSession((current) => ({
      ...current,
      status: 'ready',
      share: {
        status: 'ready',
        sessionId: payload.sessionId,
        downloadToken: payload.downloadToken,
        galleryUrl: payload.galleryUrl,
        expiresAt: payload.expiresAt,
      },
    }))
  }

  function failSessionShare(errorMessage: string): void {
    setBrowserSession((current) => ({
      ...current,
      status: 'error',
      share: {
        status: 'error',
        errorMessage,
      },
    }))
  }

  useEffect(() => {
    return () => {
      revokeSessionItemUrls(itemsRef.current)
    }
  }, [])

  return {
    browserSession,
    startBrowserSession,
    resetBrowserSession,
    cancelBrowserSession: resetBrowserSession,
    enterReviewingShot,
    rejectReviewedShot,
    addSessionItem,
    removeSessionItem,
    startFinalizing,
    completeSessionShare,
    failSessionShare,
  }
}
