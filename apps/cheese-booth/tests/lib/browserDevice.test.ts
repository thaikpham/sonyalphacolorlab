import { describe, expect, it } from 'vitest'

import {
  resolveBrowserDeviceKind,
  resolveDefaultKioskProfile,
} from '../../src/lib/browserDevice'
import { DEFAULT_KIOSK_PROFILE } from '../../src/lib/kioskProfiles'

function createWindow(innerWidth: number, coarsePointer = false) {
  return {
    innerWidth,
    matchMedia: (query: string) => ({
      matches: query === '(pointer: coarse)' ? coarsePointer : false,
    }),
  }
}

function createNavigator(overrides?: Partial<Navigator> & { userAgentData?: { mobile?: boolean } }) {
  return {
    maxTouchPoints: 0,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36',
    ...overrides,
  }
}

describe('browserDevice profile defaults', () => {
  it('defaults desktop browsers to landscape', () => {
    expect(
      resolveDefaultKioskProfile(createWindow(1440), createNavigator()),
    ).toBe('landscape')
  })

  it('defaults mobile user agents to portrait', () => {
    expect(
      resolveDefaultKioskProfile(
        createWindow(393, true),
        createNavigator({
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        }),
      ),
    ).toBe('portrait')
  })

  it('treats coarse touch devices as mobile even without a mobile UA', () => {
    expect(
      resolveBrowserDeviceKind(
        createWindow(820, true),
        createNavigator({ maxTouchPoints: 5 }),
      ),
    ).toBe('mobile')
  })

  it('falls back to the static default when browser globals are unavailable', () => {
    expect(resolveDefaultKioskProfile()).toBe(DEFAULT_KIOSK_PROFILE)
  })
})
