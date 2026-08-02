import { describe, expect, it, vi } from 'vitest'

import {
  getSessionFlowResetKey,
  resolveSessionButtonModel,
} from '../../src/components/capture/sessionButtonState'
import {
  DEFAULT_BROWSER_CAPTURE_SESSION_STATE,
  type BrowserCaptureSessionState,
} from '../../src/types'

function createSession(
  overrides: Partial<BrowserCaptureSessionState> = {},
): BrowserCaptureSessionState {
  return {
    ...DEFAULT_BROWSER_CAPTURE_SESSION_STATE,
    ...overrides,
  }
}

describe('sessionButtonState', () => {
  it('derives a reset key from status and committed item count', () => {
    expect(getSessionFlowResetKey(createSession())).toBe('idle:0')
    expect(
      getSessionFlowResetKey(
        createSession({
          status: 'active',
          items: [
            {
              id: 'item-1',
              kind: 'photo',
              sequence: 1,
              createdAt: 1,
              previewUrl: 'blob:preview',
              posterUrl: 'blob:preview',
              mimeType: 'image/jpeg',
              extension: 'jpg',
              width: 1200,
              height: 900,
              blob: new Blob(['photo']),
            },
          ],
        }),
      ),
    ).toBe('active:1')
  })

  it('returns a finalize model for active sessions that already contain media', () => {
    const onFinalizeBrowserSession = vi.fn()
    const onCancelBrowserSession = vi.fn()
    const session = createSession({
      status: 'active',
      items: [
        {
          id: 'item-1',
          kind: 'photo',
          sequence: 1,
          createdAt: 1,
          previewUrl: 'blob:preview',
          posterUrl: 'blob:preview',
          mimeType: 'image/jpeg',
          extension: 'jpg',
          width: 1200,
          height: 900,
          blob: new Blob(['photo']),
        },
      ],
    })

    const model = resolveSessionButtonModel({
      session,
      confirmState: null,
      onFinalizeBrowserSession,
      onCancelBrowserSession,
    })

    expect(model.uiState).toBe('finalize')
    expect(model.nextConfirmState).toBe('cancel-confirm')
    expect(model.onPress).toBe(onFinalizeBrowserSession)
    expect(model.disabled).toBe(false)
  })

  it('switches to reset confirmation when the error flow is long-pressed', () => {
    const onResetBrowserSession = vi.fn()
    const model = resolveSessionButtonModel({
      session: createSession({ status: 'error' }),
      confirmState: 'reset-confirm',
      onResetBrowserSession,
    })

    expect(model.uiState).toBe('reset-confirm')
    expect(model.onPress).toBe(onResetBrowserSession)
    expect(model.disabled).toBe(false)
  })
})
