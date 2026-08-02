import { GalleryVerticalEnd, X } from 'lucide-react'

import type { BrowserCaptureSessionState } from '../../types'

interface BrowserSessionFilmStripRailProps {
  session: BrowserCaptureSessionState
  layout: 'portrait' | 'landscape'
  uiDensity: 'roomy' | 'compact' | 'dense'
  canRemoveItems?: boolean
  onRemoveItem?: (itemId: string) => void
}

export function BrowserSessionFilmStripRail({
  session,
  layout,
  uiDensity,
  canRemoveItems = false,
  onRemoveItem,
}: BrowserSessionFilmStripRailProps) {
  const slots = Array.from({ length: session.maxItems }, (_, index) => {
    const sequence = index + 1
    const item = session.items.find((currentItem) => currentItem.sequence === sequence)

    return {
      sequence,
      item,
      isNewest: item ? item.sequence === session.items.length : false,
    }
  })

  return (
    <section
      className={[
        'capture-session-tray',
        `capture-session-tray--${layout}`,
        `capture-session-tray--${uiDensity}`,
      ].join(' ')}
      data-orientation={layout}
      data-density={uiDensity}
      aria-label="Session tray"
    >
      <div className="capture-session-tray-header">
        <div className="capture-session-tray-heading">
          <GalleryVerticalEnd size={18} />
          <p className="capture-session-tray-title">Session Tray</p>
        </div>
        <span className="capture-session-tray-count">
          {session.items.length}/{session.maxItems}
        </span>
      </div>

      <div className="capture-session-tray-list">
        {slots.map((slot) => {
          const item = slot.item

          return (
            <article
              key={slot.sequence}
              className="capture-session-card"
              data-filled={item ? 'true' : 'false'}
              data-newest={slot.isNewest ? 'true' : 'false'}
            >
              <div className="capture-session-card-media">
                {item ? (
                  <>
                    <img
                      src={item.posterUrl}
                      alt={`Session item ${slot.sequence}`}
                      className="capture-session-card-image"
                    />
                    {canRemoveItems && onRemoveItem ? (
                      <button
                        type="button"
                        className="capture-session-card-remove"
                        onClick={() => onRemoveItem(item.id)}
                        aria-label={`Xóa item ${slot.sequence} khỏi session`}
                        title="Xóa item này khỏi session"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="capture-session-card-placeholder">
                    <span>Slot {String(slot.sequence).padStart(2, '0')}</span>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
