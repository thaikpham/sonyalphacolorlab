import {
  Camera,
  Clock3,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  type LucideIcon,
} from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'

import {
  getKioskProfileAspectLabel,
  getKioskRotationOptions,
} from '../../lib/kioskProfiles'
import {
  getCaptureModeEmoji,
  getCaptureModeLabel,
} from '../../lib/captureModes'
import type { KioskProfile } from '../../types'
import type { CaptureMode, CountdownSec, OperatorSettings } from '../../types'

type InteractiveTokenId =
  | 'mode'
  | 'countdown'
  | 'rotation'
  | 'flip-horizontal'
  | 'flip-vertical'

interface TelemetryOption {
  label: string
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}

interface InteractiveTelemetryToken {
  id: InteractiveTokenId
  emoji: string
  icon: LucideIcon
  label: string
  interactive: true
  accent: boolean
  menuLabel: string
  options: TelemetryOption[]
}

interface PassiveTelemetryToken {
  id: 'aspect' | 'rotation'
  emoji: string
  icon: LucideIcon
  label: string
  interactive: false
  accent: boolean
}

type TelemetryToken = InteractiveTelemetryToken | PassiveTelemetryToken

interface CapturePreviewTelemetryProps {
  profile: KioskProfile
  settings: Pick<
    OperatorSettings,
    'captureMode' | 'countdownSec' | 'rotationQuarter' | 'flipHorizontal' | 'flipVertical'
  >
  disabled?: boolean
  modeLocked?: boolean
  performanceEnabled?: boolean
  onModeChange: (mode: CaptureMode) => void
  onCountdownChange: (countdownSec: CountdownSec) => void
  onSetRotationQuarter: (
    rotationQuarter: OperatorSettings['rotationQuarter'],
  ) => void
  onFlipHorizontal: () => void
  onFlipVertical: () => void
}

const COUNTDOWN_OPTIONS: CountdownSec[] = [0, 3, 5, 10]
export function CapturePreviewTelemetry({
  profile,
  settings,
  disabled = false,
  modeLocked = false,
  performanceEnabled = true,
  onModeChange,
  onCountdownChange,
  onSetRotationQuarter,
  onFlipHorizontal,
  onFlipVertical,
}: CapturePreviewTelemetryProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [openTokenId, setOpenTokenId] = useState<InteractiveTokenId | null>(null)
  const rotationOptions = getKioskRotationOptions(profile, settings.captureMode)
  const rotationLocked = rotationOptions.length === 1

  useEffect(() => {
    if (!openTokenId) return

    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenTokenId(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpenTokenId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openTokenId])

  useEffect(() => {
    if (!disabled) return

    const frame = window.requestAnimationFrame(() => {
      setOpenTokenId(null)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [disabled])

  const tokens: TelemetryToken[] = [
    {
      id: 'mode',
      emoji: getCaptureModeEmoji(settings.captureMode),
      icon: Camera,
      label: getCaptureModeLabel(settings.captureMode),
      interactive: true,
      accent: true,
      menuLabel: 'Chọn chế độ camera',
      options: [
        {
          label: 'Photo',
          selected: settings.captureMode === 'photo',
          disabled: modeLocked,
          onSelect: () => {
            if (settings.captureMode !== 'photo') {
              onModeChange('photo')
            }
          },
        },
        {
          label: 'Boomerang',
          selected: settings.captureMode === 'boomerang',
          disabled: modeLocked,
          onSelect: () => {
            if (settings.captureMode !== 'boomerang') {
              onModeChange('boomerang')
            }
          },
        },
        {
          label: '60s Performance',
          selected: settings.captureMode === 'performance',
          disabled: modeLocked || !performanceEnabled,
          onSelect: () => {
            if (settings.captureMode !== 'performance') {
              onModeChange('performance')
            }
          },
        },
      ],
    },
    {
      id: 'countdown',
      emoji: '⏱',
      icon: Clock3,
      label: `${settings.countdownSec}s`,
      interactive: true,
      accent: true,
      menuLabel: 'Chọn thời gian đếm ngược',
      options: COUNTDOWN_OPTIONS.map((value) => ({
        label: value === 0 ? '0s · Chụp ngay' : `${value}s`,
        selected: settings.countdownSec === value,
        onSelect: () => {
          if (settings.countdownSec !== value) {
            onCountdownChange(value)
          }
        },
      })),
    },
    {
      id: 'aspect',
      emoji: '🖼',
      icon: Crop,
      label: getKioskProfileAspectLabel(profile),
      interactive: false,
      accent: false,
    },
    {
      id: 'rotation',
      emoji: '↻',
      icon: RotateCw,
      label: `R${settings.rotationQuarter * 90}`,
      ...(rotationLocked
        ? {
            interactive: false,
            accent: false,
          }
        : {
            interactive: true,
            accent: true,
            menuLabel: 'Chọn góc xoay camera',
            options: rotationOptions.map((value) => ({
              label: `R${value * 90}`,
              selected: settings.rotationQuarter === value,
              onSelect: () => {
                if (settings.rotationQuarter !== value) {
                  onSetRotationQuarter(value)
                }
              },
            })),
          }),
    },
    {
      id: 'flip-horizontal',
      emoji: '↔',
      icon: FlipHorizontal2,
      label: `H${settings.flipHorizontal ? '1' : '0'}`,
      interactive: true,
      accent: true,
      menuLabel: 'Lật ngang camera',
      options: [
        {
          label: 'H0',
          selected: !settings.flipHorizontal,
          onSelect: () => {
            if (settings.flipHorizontal) {
              onFlipHorizontal()
            }
          },
        },
        {
          label: 'H1',
          selected: settings.flipHorizontal,
          onSelect: () => {
            if (!settings.flipHorizontal) {
              onFlipHorizontal()
            }
          },
        },
      ],
    },
    {
      id: 'flip-vertical',
      emoji: '↕',
      icon: FlipVertical2,
      label: `V${settings.flipVertical ? '1' : '0'}`,
      interactive: true,
      accent: true,
      menuLabel: 'Lật dọc camera',
      options: [
        {
          label: 'V0',
          selected: !settings.flipVertical,
          onSelect: () => {
            if (settings.flipVertical) {
              onFlipVertical()
            }
          },
        },
        {
          label: 'V1',
          selected: settings.flipVertical,
          onSelect: () => {
            if (!settings.flipVertical) {
              onFlipVertical()
            }
          },
        },
      ],
    },
  ]

  function toggleToken(tokenId: InteractiveTokenId): void {
    if (disabled) return

    setOpenTokenId((current) => (current === tokenId ? null : tokenId))
  }

  function handleSelectOption(option: TelemetryOption): void {
    if (option.disabled) {
      return
    }

    option.onSelect()
    setOpenTokenId(null)
  }

  return (
    <div
      ref={rootRef}
      className="capture-telemetry-bar"
      role="group"
      aria-label="Camera quick settings"
    >
      {tokens.map((token, index) => {
        const isOpen = token.interactive && openTokenId === token.id
        const Icon = token.icon

        return (
          <Fragment key={token.id}>
            <span className="capture-telemetry-chip-wrap">
              {token.interactive ? (
                <button
                  type="button"
                  className={[
                    'capture-telemetry-chip',
                    'capture-telemetry-chip--interactive',
                    token.accent ? 'capture-telemetry-chip--accent' : '',
                    isOpen ? 'capture-telemetry-chip--open' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => toggleToken(token.id)}
                  disabled={disabled}
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                >
                  <span className="capture-telemetry-chip-main">
                    <Icon size={15} />
                    <span aria-hidden="true">{token.emoji}</span>
                    <span>{token.label}</span>
                  </span>
                  <span className="capture-telemetry-chip-caret" aria-hidden="true">
                    ▾
                  </span>
                </button>
              ) : (
                <span className="capture-telemetry-chip capture-telemetry-chip--passive">
                  <span className="capture-telemetry-chip-main">
                    <Icon size={15} />
                    <span aria-hidden="true">{token.emoji}</span>
                    <span>{token.label}</span>
                  </span>
                </span>
              )}

              {token.interactive && isOpen && token.options.length ? (
                <div
                  className="capture-telemetry-menu"
                  role="menu"
                  aria-label={token.menuLabel}
                >
                  {token.options.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      className={[
                        'capture-telemetry-option',
                        option.selected ? 'is-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleSelectOption(option)}
                      disabled={option.disabled}
                      role="menuitemradio"
                      aria-checked={option.selected}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </span>

            {index < tokens.length - 1 ? (
              <span className="capture-telemetry-separator" aria-hidden="true">
                •
              </span>
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}
