import { Download, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import cheeseLogo from '../../cheese_icon_transparent.svg'
import {
  fetchCloudCaptureSessionGallery,
  type CloudCaptureSessionGalleryResponse,
} from '../lib/cloudShare'
import {
  getCaptureModeBadgeLabel,
  getCaptureModeLabel,
} from '../lib/captureModes'
import { APP_NAME, APP_SUBTITLE } from '../lib/branding'
import '../styles/session-gallery.css'

export function SessionGalleryPage() {
  const { token = '' } = useParams()
  const [requestState, setRequestState] = useState<{
    token: string
    gallery: CloudCaptureSessionGalleryResponse | null
    status: 'loading' | 'ready' | 'error'
    errorMessage: string | null
  }>({
    token,
    gallery: null,
    status: 'loading',
    errorMessage: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    void fetchCloudCaptureSessionGallery(token, controller.signal)
      .then((response) => {
        setRequestState({
          token,
          gallery: response,
          status: 'ready',
          errorMessage: null,
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return
        }

        setRequestState({
          token,
          gallery: null,
          status: 'error',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Không thể tải gallery của session này.',
        })
      })

    return () => {
      controller.abort()
    }
  }, [token])

  const isLoadingCurrentToken =
    requestState.token !== token || requestState.status === 'loading'
  const gallery =
    requestState.token === token && requestState.status === 'ready'
      ? requestState.gallery
      : null
  const errorMessage =
    requestState.token === token && requestState.status === 'error'
      ? requestState.errorMessage
      : null

  return (
    <main className="session-gallery-page">
      <section className="session-gallery-shell">
        <header className="session-gallery-header">
          <Link to="/" className="session-gallery-brand">
            <img
              src={cheeseLogo}
              alt=""
              className="session-gallery-brand-logo"
              width={40}
              height={30}
            />
            <div className="session-gallery-brand-copy">
              <span>{APP_NAME}</span>
              <small>{APP_SUBTITLE}</small>
            </div>
          </Link>

          {gallery ? (
            <div className="session-gallery-meta">
              <span>{gallery.items.length} media</span>
              <span>Hết hạn {formatDateTime(gallery.expiresAt)}</span>
            </div>
          ) : null}
        </header>

        {isLoadingCurrentToken ? (
          <section className="session-gallery-state-card">
            <LoaderCircle className="session-gallery-spinner" size={28} />
            <h1>Đang tải gallery</h1>
            <p>Chuẩn bị các ảnh và boomerang trong session này…</p>
          </section>
        ) : null}

        {!isLoadingCurrentToken && errorMessage ? (
          <section className="session-gallery-state-card session-gallery-state-card--error">
            <h1>Gallery không còn khả dụng</h1>
            <p>
              {errorMessage ??
                'Session này có thể đã hết hạn hoặc token không còn hợp lệ.'}
            </p>
            <Link to="/" className="button secondary session-gallery-back">
              Quay lại kiosk
            </Link>
          </section>
        ) : null}

        {!isLoadingCurrentToken && gallery ? (
          <section className="session-gallery-content">
            <div className="session-gallery-hero">
              <p className="session-gallery-eyebrow">Session ready</p>
              <h1>Tải media vừa chụp</h1>
              <p className="session-gallery-copy">
                Session này có {gallery.items.length} media. Bạn có thể xem nhanh và
                tải từng file về điện thoại. Với 60s Performance, gallery sẽ trả về
                clip MP4 hoàn chỉnh.
              </p>
            </div>

            <div className="session-gallery-grid">
              {gallery.items.map((item) => {
                const isPhoto = item.kind === 'photo'
                const isPerformance = item.kind === 'performance'

                return (
                  <article key={item.captureId} className="session-gallery-card">
                    <div className="session-gallery-card-media">
                      {isPhoto ? (
                        <img
                          src={item.previewUrl}
                          alt={`Preview item ${item.sequence}`}
                          className="session-gallery-image"
                        />
                      ) : (
                        <video
                          src={item.previewUrl}
                          className="session-gallery-video"
                          controls
                          autoPlay={!isPerformance}
                          muted={!isPerformance}
                          loop={!isPerformance}
                          playsInline
                        />
                      )}
                    </div>

                    <div className="session-gallery-card-copy">
                      <div className="session-gallery-card-head">
                        <span className="session-gallery-sequence">
                          #{String(item.sequence).padStart(2, '0')}
                        </span>
                        <span className="session-gallery-kind">
                          {getCaptureModeBadgeLabel(item.kind)}
                        </span>
                      </div>

                      <p className="session-gallery-card-meta">
                        {item.width} × {item.height} • {item.extension.toUpperCase()}
                      </p>

                      {!isPhoto ? (
                        <p className="session-gallery-card-meta">
                          {isPerformance
                            ? 'Performance MP4 có thể phát trực tiếp hoặc tải về.'
                            : `${getCaptureModeLabel(item.kind)} preview sẵn sàng.`}
                        </p>
                      ) : null}

                      <a
                        className="button primary session-gallery-download"
                        href={item.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download size={18} />
                        {isPerformance ? 'Tải MP4' : 'Tải xuống'}
                      </a>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return '--'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(parsed)
}
