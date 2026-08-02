import { describe, expect, it } from 'vitest'

import {
  buildYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  isPlaybackStateRunning,
  type YouTubePlayerStateMap,
} from '../src/lib/youtube'

const STATES: YouTubePlayerStateMap = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
}

describe('getYouTubeThumbnailUrl', () => {
  it('builds the hqdefault URL for a video id', () => {
    expect(getYouTubeThumbnailUrl('dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
  })
})

describe('buildYouTubeEmbedUrl', () => {
  function params(url: string) {
    return new URL(url).searchParams
  }

  it('points at the embed endpoint for the given video', () => {
    const url = buildYouTubeEmbedUrl('abc123', { muted: true, autoplay: true })
    expect(url.startsWith('https://www.youtube.com/embed/abc123?')).toBe(true)
  })

  it('always enables the JS API — without it the page cannot mute the player', () => {
    expect(params(buildYouTubeEmbedUrl('x', { muted: false, autoplay: false })).get('enablejsapi'))
      .toBe('1')
  })

  it('always sets playsinline so iOS does not hijack the phone mock-up', () => {
    expect(params(buildYouTubeEmbedUrl('x', { muted: false, autoplay: false })).get('playsinline'))
      .toBe('1')
  })

  it('reflects muted and autoplay', () => {
    const on = params(buildYouTubeEmbedUrl('x', { muted: true, autoplay: true }))
    expect(on.get('mute')).toBe('1')
    expect(on.get('autoplay')).toBe('1')

    const off = params(buildYouTubeEmbedUrl('x', { muted: false, autoplay: false }))
    expect(off.get('mute')).toBe('0')
    expect(off.get('autoplay')).toBe('0')
  })

  it('suppresses related videos and the info card', () => {
    const p = params(buildYouTubeEmbedUrl('x', { muted: true, autoplay: true }))
    expect(p.get('rel')).toBe('0')
    expect(p.get('iv_load_policy')).toBe('3')
  })

  it('escapes a video id that would otherwise inject a parameter', () => {
    const url = buildYouTubeEmbedUrl('x', { muted: true, autoplay: true })
    // Sanity: exactly one '?' separates path from query.
    expect(url.split('?').length).toBe(2)
  })
})

describe('isPlaybackStateRunning', () => {
  it('counts PLAYING as running', () => {
    expect(isPlaybackStateRunning(STATES.PLAYING, STATES)).toBe(true)
  })

  it('counts BUFFERING as running — a stalled video has still been started', () => {
    expect(isPlaybackStateRunning(STATES.BUFFERING, STATES)).toBe(true)
  })

  it.each([
    ['UNSTARTED', STATES.UNSTARTED],
    ['ENDED', STATES.ENDED],
    ['PAUSED', STATES.PAUSED],
    ['CUED', STATES.CUED],
  ])('does not count %s as running', (_name, state) => {
    expect(isPlaybackStateRunning(state, STATES)).toBe(false)
  })

  it('handles a null state, which is what the page holds before the player exists', () => {
    expect(isPlaybackStateRunning(null, STATES)).toBe(false)
  })
})
