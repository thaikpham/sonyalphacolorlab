import { describe, expect, it, vi } from 'vitest'

import { runCaptureCountdown } from '../../src/hooks/captureActions/captureRender'

describe('runCaptureCountdown', () => {
  it('captures immediately when countdown is set to 0s', async () => {
    const setCountdownValue = vi.fn()

    await expect(
      runCaptureCountdown({
        countdownSec: 0,
        setCountdownValue,
      }),
    ).resolves.toBeUndefined()

    expect(setCountdownValue).toHaveBeenCalledWith(null)
    expect(setCountdownValue).toHaveBeenCalledTimes(1)
  })
})
