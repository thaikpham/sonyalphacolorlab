/**
 * YouTube embed helpers, extracted from the showcase page so the URL shape and
 * the playback-state predicate can be pinned by tests.
 *
 * The player parameters below are not decorative: `enablejsapi` is what lets
 * the page mute and unmute the video at all, and `playsinline` is what stops
 * iOS taking the video fullscreen and destroying the phone mock-up around it.
 */

export type YouTubeQualityLevel =
  | 'small'
  | 'medium'
  | 'large'
  | 'hd720'
  | 'hd1080'
  | 'highres'
  | 'default'

export interface YouTubePlayer {
  destroy: () => void
  getPlayerState: () => number
  isMuted: () => boolean
  playVideo: () => void
  mute: () => void
  setVolume: (volume: number) => void
  unMute: () => void
  setPlaybackQuality: (quality: YouTubeQualityLevel) => void
}

export interface YouTubePlayerStateMap {
  BUFFERING: number
  CUED: number
  ENDED: number
  PAUSED: number
  PLAYING: number
  UNSTARTED: number
}

export interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void
        onStateChange?: (event: { data: number }) => void
      }
    },
  ) => YouTubePlayer
  PlayerState: YouTubePlayerStateMap
}

export const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api'

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  { muted, autoplay }: { muted: boolean; autoplay: boolean },
): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    controls: '1',
    // Without this the page cannot drive the player at all.
    enablejsapi: '1',
    fs: '1',
    iv_load_policy: '3',
    modestbranding: '1',
    mute: muted ? '1' : '0',
    // iOS takes the video fullscreen without it, which destroys the mock-up.
    playsinline: '1',
    rel: '0',
  })

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/**
 * BUFFERING counts as running: a video that is loading has been *started*, and
 * treating it as stopped makes the UI flicker its play button on every stall.
 */
export function isPlaybackStateRunning(
  playerState: number | null,
  playerStateMap: YouTubePlayerStateMap,
): boolean {
  return playerState === playerStateMap.PLAYING || playerState === playerStateMap.BUFFERING
}
