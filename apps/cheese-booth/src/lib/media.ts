import type {
  KioskProfile,
  RecordingProgressIndicator,
  TransformSettings,
} from '../types'
import { createH264Mp4Encoder } from './h264Mp4Encoder'

const PHOTO_LANDSCAPE_RATIO = 4 / 3
const PHOTO_PORTRAIT_RATIO = 3 / 4
export const BOOMERANG_DURATION_MS = 3_000
const BOOMERANG_FPS = 15
const BOOMERANG_MAX_LONG_EDGE = 1920
const BOOMERANG_H264_BITRATE_KBPS = 8000
export const PERFORMANCE_MAX_DURATION_MS = 60_000
const PERFORMANCE_FPS = 30
const PERFORMANCE_VIDEO_BITS_PER_SECOND = 16_000_000
const PERFORMANCE_AUDIO_BITS_PER_SECOND = 192_000
const PERFORMANCE_MIME_TYPE_CANDIDATES = [
  'video/mp4;codecs="avc1.4d002a,mp4a.40.2"',
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4',
] as const

export interface RenderedCapture {
  blob: Blob
  width: number
  height: number
  mimeType: string
  extension: string
  posterBlob?: Blob
}

type SampledFrame = CanvasImageSource & {
  close?: () => void
}

interface RenderBoomerangOptions {
  onProgress?: (progress: RecordingProgressIndicator) => void
}

export interface PerformanceRecordingSupport {
  supported: boolean
  mimeType: string | null
}

export interface PerformanceRecordingController {
  stop: () => void
  result: Promise<RenderedCapture>
}

interface DisposablePhotoSource {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

interface ImageCaptureLike {
  takePhoto?: () => Promise<Blob>
  grabFrame?: () => Promise<ImageBitmap>
}

type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }

        reject(new Error('Không thể tạo blob từ canvas.'))
      },
      type,
      quality,
    )
  })
}

function getAttachedVideoTrack(video: HTMLVideoElement): MediaStreamTrack | null {
  const stream = video.srcObject

  if (!(stream instanceof MediaStream)) {
    return null
  }

  return stream.getVideoTracks()[0] ?? null
}

async function decodeBlobToPhotoSource(blob: Blob): Promise<DisposablePhotoSource> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => {
        bitmap.close?.()
      },
    }
  }

  const image = new Image()
  const objectUrl = window.URL.createObjectURL(blob)

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Không thể decode still photo blob.'))
      image.src = objectUrl
    })
  } catch (error) {
    window.URL.revokeObjectURL(objectUrl)
    throw error
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => {
      window.URL.revokeObjectURL(objectUrl)
    },
  }
}

async function captureHighResolutionPhotoSource(
  video: HTMLVideoElement,
): Promise<DisposablePhotoSource | null> {
  const videoTrack = getAttachedVideoTrack(video)

  if (!videoTrack) {
    return null
  }

  const ImageCaptureClass = (
    globalThis as typeof globalThis & { ImageCapture?: ImageCaptureCtor }
  ).ImageCapture

  if (!ImageCaptureClass) {
    return null
  }

  const imageCapture = new ImageCaptureClass(videoTrack)

  if (typeof imageCapture.takePhoto === 'function') {
    try {
      return await decodeBlobToPhotoSource(await imageCapture.takePhoto())
    } catch {
      // Fall through to grabFrame/video snapshot when still capture is unsupported.
    }
  }

  if (typeof imageCapture.grabFrame === 'function') {
    try {
      const frame = await imageCapture.grabFrame()

      return {
        source: frame,
        width: frame.width,
        height: frame.height,
        release: () => {
          frame.close?.()
        },
      }
    } catch {
      return null
    }
  }

  return null
}

export function normalizeRotationQuarter(rotationQuarter: number): 0 | 1 | 2 | 3 {
  const normalized = ((rotationQuarter % 4) + 4) % 4

  if (normalized === 1 || normalized === 2 || normalized === 3) {
    return normalized
  }

  return 0
}

export function getPerformanceOutputSize(
  profile: KioskProfile,
): { width: number; height: number } {
  return profile === 'portrait'
    ? { width: 1152, height: 2048 }
    : { width: 2048, height: 1152 }
}

export function getSupportedPerformanceRecorderMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null
  }

  const supported = PERFORMANCE_MIME_TYPE_CANDIDATES.find((candidate) =>
    typeof MediaRecorder.isTypeSupported === 'function'
      ? MediaRecorder.isTypeSupported(candidate)
      : candidate === 'video/mp4',
  )

  return supported ?? null
}

export function getPerformanceRecordingSupport(): PerformanceRecordingSupport {
  const mimeType = getSupportedPerformanceRecorderMimeType()

  return {
    supported: !!mimeType,
    mimeType,
  }
}

function isPortraitRotation(rotationQuarter: number): boolean {
  return normalizeRotationQuarter(rotationQuarter) % 2 === 1
}

export function getOutputAspectRatio(rotationQuarter: number): number {
  return isPortraitRotation(rotationQuarter)
    ? PHOTO_PORTRAIT_RATIO
    : PHOTO_LANDSCAPE_RATIO
}

export function getLargestAspectRect(
  sourceWidth: number,
  sourceHeight: number,
  rotationQuarter: number,
  targetAspectRatio = getOutputAspectRatio(rotationQuarter),
): { width: number; height: number } {
  const normalized = normalizeRotationQuarter(rotationQuarter)
  const rotatedWidth = normalized % 2 === 1 ? sourceHeight : sourceWidth
  const rotatedHeight = normalized % 2 === 1 ? sourceWidth : sourceHeight

  if (rotatedWidth / rotatedHeight > targetAspectRatio) {
    return {
      width: Math.max(1, Math.round(rotatedHeight * targetAspectRatio)),
      height: Math.max(1, Math.round(rotatedHeight)),
    }
  }

  return {
    width: Math.max(1, Math.round(rotatedWidth)),
    height: Math.max(1, Math.round(rotatedWidth / targetAspectRatio)),
  }
}

function constrainLongEdge(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(width, height)

  if (longEdge <= maxLongEdge) {
    return { width, height }
  }

  const scale = maxLongEdge / longEdge

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function ensureEvenDimensions(
  width: number,
  height: number,
): { width: number; height: number } {
  return {
    width: makeEvenDimension(width),
    height: makeEvenDimension(height),
  }
}

function makeEvenDimension(value: number): number {
  const rounded = Math.max(2, Math.round(value))

  return rounded % 2 === 0 ? rounded : rounded - 1
}

function getCenteredAspectCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  rotationQuarter: number,
): {
  sourceX: number
  sourceY: number
  sourceCropWidth: number
  sourceCropHeight: number
  rotatedCropWidth: number
  rotatedCropHeight: number
} {
  const normalized = normalizeRotationQuarter(rotationQuarter)
  const rotatedWidth = normalized % 2 === 1 ? sourceHeight : sourceWidth
  const rotatedHeight = normalized % 2 === 1 ? sourceWidth : sourceHeight
  const targetRatio = targetWidth / targetHeight

  let rotatedCropHeight = rotatedHeight
  let rotatedCropWidth = rotatedCropHeight * targetRatio

  // Prefer preserving the full sensor height and crop symmetrically from the sides.
  if (rotatedCropWidth > rotatedWidth) {
    rotatedCropWidth = rotatedWidth
    rotatedCropHeight = rotatedCropWidth / targetRatio
  }

  const sourceCropWidth =
    normalized % 2 === 1 ? rotatedCropHeight : rotatedCropWidth
  const sourceCropHeight =
    normalized % 2 === 1 ? rotatedCropWidth : rotatedCropHeight

  return {
    sourceX: Math.max(0, (sourceWidth - sourceCropWidth) / 2),
    sourceY: Math.max(0, (sourceHeight - sourceCropHeight) / 2),
    sourceCropWidth: Math.max(1, sourceCropWidth),
    sourceCropHeight: Math.max(1, sourceCropHeight),
    rotatedCropWidth: Math.max(1, rotatedCropWidth),
    rotatedCropHeight: Math.max(1, rotatedCropHeight),
  }
}

export function drawTransformedCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  transform: TransformSettings,
): void {
  const rotationQuarter = normalizeRotationQuarter(transform.rotationQuarter)
  const crop = getCenteredAspectCrop(
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    rotationQuarter,
  )
  const scale = Math.min(
    targetWidth / crop.rotatedCropWidth,
    targetHeight / crop.rotatedCropHeight,
  )
  const drawWidth = crop.sourceCropWidth * scale
  const drawHeight = crop.sourceCropHeight * scale

  const flipX = transform.flipHorizontal ? -1 : 1
  const flipY = transform.flipVertical ? -1 : 1

  ctx.clearRect(0, 0, targetWidth, targetHeight)
  ctx.fillStyle = '#0c0f14'
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  ctx.save()
  ctx.translate(targetWidth / 2, targetHeight / 2)
  ctx.rotate((rotationQuarter * Math.PI) / 2)
  ctx.scale(flipX, flipY)

  ctx.drawImage(
    source,
    crop.sourceX,
    crop.sourceY,
    crop.sourceCropWidth,
    crop.sourceCropHeight,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  )
  ctx.restore()
}

export async function renderPhotoFromVideo(
  video: HTMLVideoElement,
  transform: TransformSettings,
  outputAspectRatio: number,
): Promise<RenderedCapture> {
  const highResolutionSource = await captureHighResolutionPhotoSource(video)
  const source = highResolutionSource?.source ?? video
  const sourceWidth = highResolutionSource?.width ?? video.videoWidth
  const sourceHeight = highResolutionSource?.height ?? video.videoHeight
  const output = getLargestAspectRect(
    sourceWidth,
    sourceHeight,
    transform.rotationQuarter,
    outputAspectRatio,
  )
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Không thể khởi tạo canvas chụp ảnh.')
  }

  canvas.width = output.width
  canvas.height = output.height
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  drawTransformedCover(
    ctx,
    source,
    sourceWidth,
    sourceHeight,
    output.width,
    output.height,
    transform,
  )

  try {
    const blob = await toBlob(canvas, 'image/png')

    return {
      blob,
      width: output.width,
      height: output.height,
      mimeType: 'image/png',
      extension: 'png',
      posterBlob: blob,
    }
  } finally {
    highResolutionSource?.release()
  }
}

async function cloneSampleFrame(canvas: HTMLCanvasElement): Promise<SampledFrame> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(canvas)
  }

  const clonedCanvas = document.createElement('canvas')
  const clonedContext = clonedCanvas.getContext('2d')

  if (!clonedContext) {
    throw new Error('Không thể sao chép frame boomerang.')
  }

  clonedCanvas.width = canvas.width
  clonedCanvas.height = canvas.height
  clonedContext.drawImage(canvas, 0, 0)

  return clonedCanvas
}

export async function renderBoomerangFromVideo(
  video: HTMLVideoElement,
  transform: TransformSettings,
  outputAspectRatio: number,
  options: RenderBoomerangOptions = {},
): Promise<RenderedCapture> {
  const { onProgress } = options
  const baseOutput = getLargestAspectRect(
    video.videoWidth,
    video.videoHeight,
    transform.rotationQuarter,
    outputAspectRatio,
  )
  const constrainedOutput = constrainLongEdge(
    baseOutput.width,
    baseOutput.height,
    BOOMERANG_MAX_LONG_EDGE,
  )
  const output = ensureEvenDimensions(
    constrainedOutput.width,
    constrainedOutput.height,
  )
  const sampleCanvas = document.createElement('canvas')
  const sampleContext = sampleCanvas.getContext('2d')

  if (!sampleContext) {
    throw new Error('Không thể khởi tạo canvas boomerang.')
  }

  sampleCanvas.width = output.width
  sampleCanvas.height = output.height

  const sampledFrames: SampledFrame[] = []
  const frameInterval = 1000 / BOOMERANG_FPS
  const totalFrames = Math.max(1, Math.round(BOOMERANG_DURATION_MS / frameInterval))
  const sampleStart = performance.now()

  onProgress?.({
    mode: 'boomerang',
    elapsedMs: 0,
    maxDurationMs: BOOMERANG_DURATION_MS,
    remainingMs: BOOMERANG_DURATION_MS,
    progress: 0,
  })

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const nextDeadline = sampleStart + frameIndex * frameInterval
    const delay = nextDeadline - performance.now()

    if (delay > 0) {
      await wait(delay)
    }

    drawTransformedCover(
      sampleContext,
      video,
      video.videoWidth,
      video.videoHeight,
      output.width,
      output.height,
      transform,
    )

    sampledFrames.push(await cloneSampleFrame(sampleCanvas))

    const elapsedMs = Math.min(
      BOOMERANG_DURATION_MS,
      Math.max(0, performance.now() - sampleStart),
    )

    onProgress?.({
      mode: 'boomerang',
      elapsedMs,
      maxDurationMs: BOOMERANG_DURATION_MS,
      remainingMs: Math.max(0, BOOMERANG_DURATION_MS - elapsedMs),
      progress: Math.min(1, elapsedMs / BOOMERANG_DURATION_MS),
    })
  }

  if (sampledFrames.length === 0) {
    throw new Error('Không lấy được frame nào cho boomerang.')
  }

  const sequence = sampledFrames.concat(sampledFrames.slice(1, -1).reverse())
  const playbackCanvas = document.createElement('canvas')
  const playbackContext = playbackCanvas.getContext('2d', {
    willReadFrequently: true,
  })

  if (!playbackContext) {
    sampledFrames.forEach((frame) => frame.close?.())
    throw new Error('Không thể khởi tạo canvas xuất boomerang.')
  }

  playbackCanvas.width = output.width
  playbackCanvas.height = output.height
  let encoder: Awaited<ReturnType<typeof createH264Mp4Encoder>> | null = null
  const posterBlob = await toBlob(sampleCanvas, 'image/jpeg', 0.92)

  try {
    encoder = await createH264Mp4Encoder()
    encoder.outputFilename = `boomerang-${Date.now()}.mp4`
    encoder.width = output.width
    encoder.height = output.height
    encoder.frameRate = BOOMERANG_FPS
    encoder.groupOfPictures = BOOMERANG_FPS
    encoder.kbps = BOOMERANG_H264_BITRATE_KBPS
    encoder.speed = 6
    encoder.quantizationParameter = 24
    encoder.initialize()

    for (const frame of sequence) {
      playbackContext.clearRect(0, 0, output.width, output.height)
      playbackContext.drawImage(frame, 0, 0, output.width, output.height)

      const frameBytes = playbackContext.getImageData(
        0,
        0,
        output.width,
        output.height,
      ).data

      encoder.addFrameRgba(frameBytes)
    }

    encoder.finalize()

    const mp4Bytes = encoder.FS.readFile(encoder.outputFilename)
    const normalizedMp4Bytes = Uint8Array.from(mp4Bytes)
    const blob = new Blob([normalizedMp4Bytes], {
      type: 'video/mp4',
    })

    try {
      encoder.FS.unlink(encoder.outputFilename)
    } catch {
      // Best-effort cleanup in the encoder virtual FS.
    }

    return {
      blob,
      width: output.width,
      height: output.height,
      mimeType: 'video/mp4',
      extension: 'mp4',
      posterBlob,
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Không thể encode boomerang sang MP4/H.264: ${error.message}`
        : 'Không thể encode boomerang sang MP4/H.264.',
    )
  } finally {
    sampledFrames.forEach((frame) => frame.close?.())
    encoder?.delete()
  }
}

async function requestPerformanceAudioStream(
  audioDeviceId: string | null,
): Promise<MediaStream | null> {
  if (!audioDeviceId || typeof navigator === 'undefined') {
    return null
  }

  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: audioDeviceId },
      channelCount: { ideal: 2 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: false,
  })
}

function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export function startPerformanceRecording({
  profile,
  video,
  transform,
  audioDeviceId,
  onProgress,
  onAudioFallback,
}: {
  profile: KioskProfile
  video: HTMLVideoElement
  transform: TransformSettings
  audioDeviceId: string | null
  onProgress?: (progress: RecordingProgressIndicator) => void
  onAudioFallback?: () => void
}): PerformanceRecordingController {
  const mimeType = getSupportedPerformanceRecorderMimeType()

  if (!mimeType) {
    throw new Error(
      'Runtime hiện tại không hỗ trợ quay MP4 native cho 60s Performance.',
    )
  }

  const output = getPerformanceOutputSize(profile)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Không thể khởi tạo canvas performance recorder.')
  }

  canvas.width = output.width
  canvas.height = output.height

  let stopped = false
  let drawFrameId = 0
  let stopTimer = 0
  let audioStream: MediaStream | null = null
  let canvasStream: MediaStream | null = null
  let recordingStream: MediaStream | null = null

  const stop = () => {
    if (stopped) {
      return
    }

    stopped = true
    window.clearTimeout(stopTimer)
    window.cancelAnimationFrame(drawFrameId)
    recorder?.stop()
  }

  let recorder: MediaRecorder | null = null

  const result = (async () => {
    try {
      try {
        audioStream = await requestPerformanceAudioStream(audioDeviceId)
      } catch {
        audioStream = null
        onAudioFallback?.()
      }

      drawTransformedCover(
        context,
        video,
        video.videoWidth,
        video.videoHeight,
        output.width,
        output.height,
        transform,
      )

      canvasStream = canvas.captureStream(PERFORMANCE_FPS)
      const [videoTrack] = canvasStream.getVideoTracks()

      if (!videoTrack) {
        throw new Error('Không lấy được video track cho performance recorder.')
      }

      recordingStream = new MediaStream([videoTrack])
      const [audioTrack] = audioStream?.getAudioTracks() ?? []

      if (audioTrack) {
        recordingStream.addTrack(audioTrack)
      }

      const startedAt = performance.now()
      const chunks: BlobPart[] = []

      recorder = new MediaRecorder(recordingStream, {
        mimeType,
        videoBitsPerSecond: PERFORMANCE_VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: audioTrack ? PERFORMANCE_AUDIO_BITS_PER_SECOND : undefined,
      })

      const resultBlob = new Promise<Blob>((resolve, reject) => {
        recorder?.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data)
          }
        })
        recorder?.addEventListener('stop', () => {
          if (chunks.length === 0) {
            reject(new Error('Performance recorder không tạo ra dữ liệu MP4.'))
            return
          }

          resolve(new Blob(chunks, { type: 'video/mp4' }))
        })
        recorder?.addEventListener('error', () => {
          reject(
            new Error('Performance recorder gặp lỗi không xác định.'),
          )
        })
      })

      const draw = () => {
        drawTransformedCover(
          context,
          video,
          video.videoWidth,
          video.videoHeight,
          output.width,
          output.height,
          transform,
        )

        const elapsedMs = Math.min(
          PERFORMANCE_MAX_DURATION_MS,
          Math.max(0, performance.now() - startedAt),
        )

        onProgress?.({
          mode: 'performance',
          elapsedMs,
          maxDurationMs: PERFORMANCE_MAX_DURATION_MS,
          remainingMs: Math.max(0, PERFORMANCE_MAX_DURATION_MS - elapsedMs),
          progress: Math.min(1, elapsedMs / PERFORMANCE_MAX_DURATION_MS),
        })

        if (!stopped) {
          drawFrameId = window.requestAnimationFrame(draw)
        }
      }

      onProgress?.({
        mode: 'performance',
        elapsedMs: 0,
        maxDurationMs: PERFORMANCE_MAX_DURATION_MS,
        remainingMs: PERFORMANCE_MAX_DURATION_MS,
        progress: 0,
      })

      recorder.start()
      draw()
      stopTimer = window.setTimeout(stop, PERFORMANCE_MAX_DURATION_MS)

      const blob = await resultBlob
      const posterBlob = await toBlob(canvas, 'image/jpeg', 0.92)

      onProgress?.({
        mode: 'performance',
        elapsedMs: PERFORMANCE_MAX_DURATION_MS,
        maxDurationMs: PERFORMANCE_MAX_DURATION_MS,
        remainingMs: 0,
        progress: 1,
      })

      return {
        blob,
        width: output.width,
        height: output.height,
        mimeType: 'video/mp4',
        extension: 'mp4',
        posterBlob,
      }
    } finally {
      window.clearTimeout(stopTimer)
      window.cancelAnimationFrame(drawFrameId)
      stopMediaStream(recordingStream)
      stopMediaStream(canvasStream)
      stopMediaStream(audioStream)
    }
  })()

  return {
    stop,
    result,
  }
}
