import type { H264MP4Encoder } from 'h264-mp4-encoder'
import h264Mp4EncoderScriptUrl from 'h264-mp4-encoder/embuild/dist/h264-mp4-encoder.web.js?url'

interface H264Mp4EncoderModule {
  createH264MP4Encoder: () => Promise<H264MP4Encoder>
}

declare global {
  interface Window {
    HME?: H264Mp4EncoderModule
  }
}

let encoderModulePromise: Promise<H264Mp4EncoderModule> | null = null

async function loadEncoderModule(): Promise<H264Mp4EncoderModule> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Runtime hiện tại không hỗ trợ encoder MP4/H.264.')
  }

  if (window.HME) {
    return window.HME
  }

  if (!encoderModulePromise) {
    encoderModulePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')

      script.async = true
      script.src = h264Mp4EncoderScriptUrl
      script.onload = () => {
        if (window.HME) {
          resolve(window.HME)
          return
        }

        encoderModulePromise = null
        reject(new Error('Không thể khởi tạo module encoder MP4/H.264.'))
      }
      script.onerror = () => {
        encoderModulePromise = null
        reject(new Error('Không tải được script encoder MP4/H.264.'))
      }

      document.head.append(script)
    })
  }

  return encoderModulePromise
}

export async function createH264Mp4Encoder(): Promise<H264MP4Encoder> {
  const encoderModule = await loadEncoderModule()

  return encoderModule.createH264MP4Encoder()
}
