import { useEffect, useRef, useState } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

import type { BrowserCaptureSessionState } from '../../types'
import {
  resolveSessionButtonModel,
  type SessionConfirmState,
} from './sessionButtonState'

const SESSION_LONG_PRESS_MS = 450
const SESSION_CONFIRM_TIMEOUT_MS = 3000

interface SessionFlowButtonProps {
  browserSession: BrowserCaptureSessionState
  sessionCountLabel: string
  onStartBrowserSession?: () => void
  onFinalizeBrowserSession?: () => void
  onRetryBrowserSessionShare?: () => void
  onCancelBrowserSession?: () => void
  onResetBrowserSession?: () => void
}

export function SessionFlowButton({
  browserSession,
  sessionCountLabel,
  onStartBrowserSession,
  onFinalizeBrowserSession,
  onRetryBrowserSessionShare,
  onCancelBrowserSession,
  onResetBrowserSession,
}: SessionFlowButtonProps) {
  const [confirmState, setConfirmState] = useState<SessionConfirmState>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const longPressTriggeredRef = useRef(false)

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!confirmState) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setConfirmState(null)
    }, SESSION_CONFIRM_TIMEOUT_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [confirmState])

  useEffect(() => {
    return () => {
      clearLongPressTimer()
    }
  }, [])

  const sessionButton = resolveSessionButtonModel({
    session: browserSession,
    confirmState,
    onStartBrowserSession,
    onFinalizeBrowserSession,
    onRetryBrowserSessionShare,
    onCancelBrowserSession,
    onResetBrowserSession,
  })

  const handleSessionPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    if (
      sessionButton.disabled ||
      !sessionButton.canLongPress ||
      sessionButton.nextConfirmState === null ||
      confirmState !== null
    ) {
      return
    }

    longPressTriggeredRef.current = false
    clearLongPressTimer()
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true
      setConfirmState(sessionButton.nextConfirmState)
    }, SESSION_LONG_PRESS_MS)
  }

  const handleSessionPointerEnd = (): void => {
    clearLongPressTimer()
  }

  const handleSessionClick = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      event.preventDefault()
      return
    }

    sessionButton.onPress?.()
  }

  return (
    <button
      className="capture-dock-button capture-dock-button--session-flow"
      data-session-ui={sessionButton.uiState}
      type="button"
      onClick={handleSessionClick}
      onPointerDown={handleSessionPointerDown}
      onPointerUp={handleSessionPointerEnd}
      onPointerLeave={handleSessionPointerEnd}
      onPointerCancel={handleSessionPointerEnd}
      onBlur={() => {
        clearLongPressTimer()
        setConfirmState(null)
      }}
      onContextMenu={(event) => {
        if (sessionButton.canLongPress) {
          event.preventDefault()
        }
      }}
      disabled={sessionButton.disabled}
      aria-label={sessionButton.ariaLabel}
      title={sessionButton.title}
    >
      <span className="capture-dock-status-count">{sessionCountLabel}</span>
      <span className="capture-dock-button-label">
        <sessionButton.Icon size={16} className={sessionButton.iconClassName} />
        {sessionButton.label}
      </span>
    </button>
  )
}
