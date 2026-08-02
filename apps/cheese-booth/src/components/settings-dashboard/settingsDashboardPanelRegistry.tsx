import type { JSX } from 'react'

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
} from '../../types'
import type { RuntimeEnvironment } from '../../lib/runtime'
import type {
  DashboardStatusSummary,
  SectionId,
} from './settingsDashboardUtils'
import { SettingsDashboardCameraPanel } from './panels/CameraPanel'
import { SettingsDashboardCapturePanel } from './panels/CapturePanel'
import { SettingsDashboardDownloadPanel } from './panels/DownloadPanel'
import { SettingsDashboardOutputPanel } from './panels/OutputPanel'
import { SettingsDashboardOverviewPanel } from './panels/OverviewPanel'
import { SettingsDashboardTransformPanel } from './panels/TransformPanel'

export interface SettingsDashboardPanelRegistryProps {
  profile: KioskProfile
  settings: OperatorSettings
  sources: SourceDescriptor[]
  audioSources: AudioSourceDescriptor[]
  performanceAudio: PerformanceAudioState
  permissionState: PermissionState
  streamState: StreamState
  lastError: string | null
  isBusy: boolean
  modeLocked: boolean
  captureModeLabel: string
  currentSourceLabel: string
  currentAudioSourceLabel: string
  permissionSummary: DashboardStatusSummary
  streamSummary: DashboardStatusSummary
  orientationLabel: string
  profileAspectLabel: string
  runtime: RuntimeEnvironment
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

export const settingsDashboardPanelRegistry: Record<
  SectionId,
  (props: SettingsDashboardPanelRegistryProps) => JSX.Element
> = {
  overview: (props) => (
    <SettingsDashboardOverviewPanel
      settings={props.settings}
      captureModeLabel={props.captureModeLabel}
      currentSourceLabel={props.currentSourceLabel}
      currentAudioSourceLabel={props.currentAudioSourceLabel}
      performanceAudio={props.performanceAudio}
      runtime={props.runtime}
      permissionSummary={props.permissionSummary}
      streamSummary={props.streamSummary}
      orientationLabel={props.orientationLabel}
      profileAspectLabel={props.profileAspectLabel}
      isBusy={props.isBusy}
      lastError={props.lastError}
    />
  ),
  capture: (props) => (
    <SettingsDashboardCapturePanel
      settings={props.settings}
      captureModeLabel={props.captureModeLabel}
      isBusy={props.isBusy}
      modeLocked={props.modeLocked}
      performanceEnabled={props.performanceAudio.recordingSupported}
      onModeChange={props.onModeChange}
      onCountdownChange={props.onCountdownChange}
    />
  ),
  camera: (props) => (
    <SettingsDashboardCameraPanel
      settings={props.settings}
      sources={props.sources}
      audioSources={props.audioSources}
      performanceAudio={props.performanceAudio}
      permissionState={props.permissionState}
      isBusy={props.isBusy}
      permissionSummary={props.permissionSummary}
      streamSummary={props.streamSummary}
      currentSourceLabel={props.currentSourceLabel}
      currentAudioSourceLabel={props.currentAudioSourceLabel}
      onDeviceChange={props.onDeviceChange}
      onAudioDeviceChange={props.onAudioDeviceChange}
      onRetryPermission={props.onRetryPermission}
      onRefreshSources={props.onRefreshSources}
    />
  ),
  output: (props) => (
    <SettingsDashboardOutputPanel
      orientationLabel={props.orientationLabel}
      captureMode={props.settings.captureMode}
      performanceAudio={props.performanceAudio}
      runtime={props.runtime}
    />
  ),
  transform: (props) => (
    <SettingsDashboardTransformPanel
      profile={props.profile}
      settings={props.settings}
      orientationLabel={props.orientationLabel}
      isBusy={props.isBusy}
      onRotate={props.onRotate}
      onFlipHorizontal={props.onFlipHorizontal}
      onFlipVertical={props.onFlipVertical}
    />
  ),
  download: () => <SettingsDashboardDownloadPanel />,
}
