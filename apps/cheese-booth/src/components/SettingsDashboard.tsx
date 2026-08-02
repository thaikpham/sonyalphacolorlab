import { ArrowLeft } from 'lucide-react'
import { useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'

import cheeseLogo from '../../cheese_icon_transparent.svg'
import { getCaptureModeLabel } from '../lib/captureModes'
import {
  getCaptureRoute,
  getKioskPreviewAspect,
  getKioskProfileAspectLabel,
  getKioskProfileLabel,
} from '../lib/kioskProfiles'
import type {
  AudioSourceDescriptor,
  CaptureMode,
  CountdownSec,
  KioskProfile,
  OperatorSettings,
  PerformanceAudioState,
  PermissionState,
  SourceDescriptor,
  StreamState,
} from '../types'
import { APP_NAME, APP_SUBTITLE } from '../lib/branding'
import { getRuntimeEnvironment } from '../lib/runtime'
import { SettingsDashboardNav } from './settings-dashboard/SettingsDashboardNav'
import { settingsDashboardPanelRegistry } from './settings-dashboard/settingsDashboardPanelRegistry'
import { SettingsDashboardPreview } from './settings-dashboard/SettingsDashboardPreview'
import {
  getPermissionSummary,
  getStreamSummary,
  type SectionId,
} from './settings-dashboard/settingsDashboardUtils'
import '../styles/settings-dashboard.css'

interface SettingsDashboardProps {
  profile: KioskProfile
  settings: OperatorSettings
  sources: SourceDescriptor[]
  audioSources: AudioSourceDescriptor[]
  performanceAudio: PerformanceAudioState
  permissionState: PermissionState
  streamState: StreamState
  lastError: string | null
  isBusy: boolean
  browserSessionStatus: 'idle' | 'active' | 'reviewing-shot' | 'finalizing' | 'ready' | 'error'
  previewFrameRef: RefObject<HTMLDivElement | null>
  previewCanvasRef: RefObject<HTMLCanvasElement | null>
  onModeChange: (mode: CaptureMode) => void
  onDeviceChange: (deviceId: string) => void
  onAudioDeviceChange: (deviceId: string) => void
  onCountdownChange: (countdown: CountdownSec) => void
  onRotate: () => void
  onFlipHorizontal: () => void
  onFlipVertical: () => void
  onRetryPermission: () => void
  onRefreshSources: () => void
}

export function SettingsDashboard({
  profile,
  settings,
  sources,
  audioSources,
  performanceAudio,
  permissionState,
  streamState,
  lastError,
  isBusy,
  browserSessionStatus,
  previewFrameRef,
  previewCanvasRef,
  onModeChange,
  onDeviceChange,
  onAudioDeviceChange,
  onCountdownChange,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
  onRetryPermission,
  onRefreshSources,
}: SettingsDashboardProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('overview')

  const isPortrait = profile === 'portrait'
  const previewAspect = getKioskPreviewAspect(profile)
  const profileAspectLabel = getKioskProfileAspectLabel(profile)
  const captureModeLabel = getCaptureModeLabel(settings.captureMode)
  const currentSourceLabel =
    sources.find((source) => source.deviceId === settings.deviceId)?.label ?? 'Chưa chọn'
  const currentAudioSourceLabel =
    audioSources.find((source) => source.deviceId === settings.audioDeviceId)?.label ??
    'Auto / silent fallback'
  const permissionSummary = getPermissionSummary(permissionState)
  const streamSummary = getStreamSummary(streamState)
  const orientationLabel = getKioskProfileLabel(profile)
  const runtime = getRuntimeEnvironment()
  const renderPanel = settingsDashboardPanelRegistry[activeSection]
  const modeLocked = browserSessionStatus !== 'idle'
  const activePanel = renderPanel({
    profile,
    settings,
    sources,
    audioSources,
    performanceAudio,
    permissionState,
    streamState,
    lastError,
    isBusy,
    modeLocked,
    captureModeLabel,
    currentSourceLabel,
    currentAudioSourceLabel,
    permissionSummary,
    streamSummary,
    orientationLabel,
    profileAspectLabel,
    runtime,
    onModeChange,
    onDeviceChange,
    onAudioDeviceChange,
    onCountdownChange,
    onRotate,
    onFlipHorizontal,
    onFlipVertical,
    onRetryPermission,
    onRefreshSources,
  })

  return (
    <section className={`settings-dashboard settings-dashboard--${profile}`}>
      <aside className="sd-rail">
        <div className="sd-rail-brand">
          <img
            className="sd-rail-logo"
            src={cheeseLogo}
            alt={APP_NAME}
            title={`${APP_NAME} — ${APP_SUBTITLE}`}
            width={52}
            height={39}
          />
        </div>

        <SettingsDashboardNav
          activeSection={activeSection}
          onSelectSection={setActiveSection}
        />
      </aside>

      {isPortrait ? (
        <div className="sd-portrait-stack">
          <SettingsDashboardPreview
            settings={settings}
            sources={sources}
            permissionState={permissionState}
            streamState={streamState}
            lastError={lastError}
            previewFrameRef={previewFrameRef}
            previewCanvasRef={previewCanvasRef}
            previewAspect={previewAspect}
            profile={profile}
            isPortrait={isPortrait}
            currentSourceLabel={currentSourceLabel}
            streamSummary={streamSummary}
            captureModeLabel={captureModeLabel}
            onRetryPermission={onRetryPermission}
            onRefreshSources={onRefreshSources}
          />

          <main className="sd-controls sd-controls--portrait">
            {activePanel}
          </main>
        </div>
      ) : (
        <>
          <main className="sd-controls">
            {activePanel}
          </main>

          <SettingsDashboardPreview
            settings={settings}
            sources={sources}
            permissionState={permissionState}
            streamState={streamState}
            lastError={lastError}
            previewFrameRef={previewFrameRef}
            previewCanvasRef={previewCanvasRef}
            previewAspect={previewAspect}
            profile={profile}
            isPortrait={isPortrait}
            currentSourceLabel={currentSourceLabel}
            streamSummary={streamSummary}
            captureModeLabel={captureModeLabel}
            onRetryPermission={onRetryPermission}
            onRefreshSources={onRefreshSources}
          />
        </>
      )}

      <Link
        className="sd-floating-back"
        to={getCaptureRoute(profile)}
        title="Quay lại chụp"
      >
        <ArrowLeft size={24} />
      </Link>
    </section>
  )
}
