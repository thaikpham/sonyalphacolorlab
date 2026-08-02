import { useEffect, type RefObject } from 'react'

import { drawTransformedCover, getLargestAspectRect } from '../lib/media'
import { getKioskProfileAspectRatio } from '../lib/kioskProfiles'
import type { KioskProfile, OperatorSettings } from '../types'

interface UsePreviewCanvasOptions {
  previewFrameRef: RefObject<HTMLDivElement | null>
  previewCanvasRef: RefObject<HTMLCanvasElement | null>
  videoRef: RefObject<HTMLVideoElement | null>
  profile: KioskProfile
  settings: Pick<
    OperatorSettings,
    'rotationQuarter' | 'flipHorizontal' | 'flipVertical'
  >
}

export function usePreviewCanvas({
  previewFrameRef,
  previewCanvasRef,
  videoRef,
  profile,
  settings,
}: UsePreviewCanvasOptions): void {
  const { flipHorizontal, flipVertical, rotationQuarter } = settings
  const targetAspectRatio = getKioskProfileAspectRatio(profile)

  useEffect(() => {
    const previewFrame = previewFrameRef.current
    const previewCanvas = previewCanvasRef.current
    const video = videoRef.current

    if (!previewFrame || !previewCanvas) return

    const syncCanvasResolution = (frameRect?: DOMRectReadOnly) => {
      const canvas = previewCanvasRef.current
      const currentVideo = videoRef.current

      if (!canvas || !previewFrame) return

      const dpr = window.devicePixelRatio || 1
      const fallbackWidth = Math.max(
        1,
        Math.round((frameRect?.width ?? previewFrame.clientWidth) * dpr),
      )
      const fallbackHeight = Math.max(
        1,
        Math.round((frameRect?.height ?? previewFrame.clientHeight) * dpr),
      )

      let width = fallbackWidth
      let height = fallbackHeight

      if (
        currentVideo &&
        currentVideo.readyState >= 2 &&
        currentVideo.videoWidth > 0 &&
        currentVideo.videoHeight > 0
      ) {
        const output = getLargestAspectRect(
          currentVideo.videoWidth,
          currentVideo.videoHeight,
          rotationQuarter,
          targetAspectRatio,
        )

        width = output.width
        height = output.height
      }

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) return

      syncCanvasResolution(entry.contentRect)
    })
    const handleVideoMetadata = () => {
      syncCanvasResolution()
    }

    resizeObserver.observe(previewFrame)
    video?.addEventListener('loadedmetadata', handleVideoMetadata)
    video?.addEventListener('loadeddata', handleVideoMetadata)
    syncCanvasResolution()

    return () => {
      resizeObserver.disconnect()
      video?.removeEventListener('loadedmetadata', handleVideoMetadata)
      video?.removeEventListener('loadeddata', handleVideoMetadata)
    }
  }, [previewCanvasRef, previewFrameRef, rotationQuarter, targetAspectRatio, videoRef])

  useEffect(() => {
    let frameId = 0

    const drawLoop = () => {
      const canvas = previewCanvasRef.current
      const video = videoRef.current

      if (canvas) {
        const context = canvas.getContext('2d')

        if (context) {
          if (video && video.readyState >= 2) {
            const output = getLargestAspectRect(
              video.videoWidth,
              video.videoHeight,
              rotationQuarter,
              targetAspectRatio,
            )

            if (canvas.width !== output.width || canvas.height !== output.height) {
              canvas.width = output.width
              canvas.height = output.height
            }

            context.imageSmoothingEnabled = true
            context.imageSmoothingQuality = 'high'

            drawTransformedCover(
              context,
              video,
              video.videoWidth,
              video.videoHeight,
              canvas.width,
              canvas.height,
              {
                rotationQuarter,
                flipHorizontal,
                flipVertical,
              },
            )
          } else {
            context.clearRect(0, 0, canvas.width, canvas.height)
            context.fillStyle = '#0c0f14'
            context.fillRect(0, 0, canvas.width, canvas.height)
          }
        }
      }

      frameId = window.requestAnimationFrame(drawLoop)
    }

    frameId = window.requestAnimationFrame(drawLoop)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    previewCanvasRef,
    flipHorizontal,
    flipVertical,
    targetAspectRatio,
    rotationQuarter,
    videoRef,
  ])
}
