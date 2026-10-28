import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SECURITY_HEADERS } from './security-headers'

describe('security headers', () => {
  it('are exactly the agreed five, no CSP', () => {
    expect(Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]))).toEqual({
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'X-Frame-Options': 'DENY',
    })
  })

  it('are served on every path by next.config.ts', () => {
    const config = readFileSync('next.config.ts', 'utf8')
    expect(config).toMatch(/async headers\(\)\s*\{[\s\S]*source:\s*'\/:path\*'[\s\S]*headers:\s*\[\.\.\.SECURITY_HEADERS\]/)
  })
})
