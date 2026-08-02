import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { CaptureScreen } from '../components/CaptureScreen'
import { useKioskBootstrap } from '../hooks/useKioskBootstrap'
import { useKioskController } from '../hooks/useKioskController'
import { useKioskFullscreen } from '../hooks/useKioskFullscreen'
import { getCaptureRoute, getSettingsRoute } from '../lib/kioskProfiles'
import type { KioskProfile } from '../types'
import { KioskLoadingScreen } from './KioskLoadingScreen'

const LazySettingsDashboard = lazy(async () => {
  const module = await import('../components/SettingsDashboard')

  return {
    default: module.SettingsDashboard,
  }
})

export function KioskExperience({
  profile,
  defaultProfile,
}: {
  profile: KioskProfile
  defaultProfile: KioskProfile
}) {
  const {
    settings,
    settingsReady,
    sources,
    audioSources,
    performanceAudio,
    cameraSession,
    isBusy,
    countdownValue,
    recordingProgress,
    captureOutcome,
    browserSession,
    previewFrameRef,
    previewCanvasRef,
    videoRef,
    openCapture,
    refreshSources,
    retryPermission,
    handleShutter,
    startBrowserSession,
    finalizeBrowserSession,
    retryBrowserSessionShare,
    cancelBrowserSession,
    resetBrowserSession,
    removeBrowserSessionItem,
    approveCaptureOutcome,
    rejectCaptureOutcome,
    setMode,
    setCountdown,
    setRotationQuarter,
    rotate,
    toggleFlipHorizontal,
    toggleFlipVertical,
    setDevice,
    setAudioDevice,
  } = useKioskController(profile)

  useKioskBootstrap(settingsReady, openCapture)
  useKioskFullscreen()

  if (!settingsReady) {
    return <KioskLoadingScreen />
  }

  return (
    <>
      <Routes>
        <Route
          path="/capture/:profile"
          element={
            <CaptureScreen
              profile={profile}
              settings={settings}
              sources={sources}
              performanceAudio={performanceAudio}
              permissionState={cameraSession.permissionState}
              streamState={cameraSession.streamState}
              lastError={cameraSession.lastError}
              isBusy={isBusy}
              countdownValue={countdownValue}
              recordingProgress={recordingProgress}
              captureOutcome={captureOutcome}
              browserSession={browserSession}
              previewFrameRef={previewFrameRef}
              previewCanvasRef={previewCanvasRef}
              onRetryPermission={() => {
                void retryPermission()
              }}
              onRefreshSources={() => {
                void refreshSources()
              }}
              onShutter={() => {
                void handleShutter()
              }}
              onStartBrowserSession={startBrowserSession}
              onFinalizeBrowserSession={() => {
                void finalizeBrowserSession()
              }}
              onRetryBrowserSessionShare={() => {
                void retryBrowserSessionShare()
              }}
              onCancelBrowserSession={cancelBrowserSession}
              onResetBrowserSession={resetBrowserSession}
              onRemoveBrowserSessionItem={removeBrowserSessionItem}
              onModeChange={setMode}
              onCountdownChange={setCountdown}
              onSetRotationQuarter={setRotationQuarter}
              onFlipHorizontal={toggleFlipHorizontal}
              onFlipVertical={toggleFlipVertical}
              onApproveCaptureOutcome={approveCaptureOutcome}
              onRejectCaptureOutcome={rejectCaptureOutcome}
            />
          }
        />
        <Route
          path="/settings/:profile"
          element={
            <Suspense fallback={<KioskLoadingScreen message="Đang tải bảng điều khiển…" />}>
              <LazySettingsDashboard
                profile={profile}
                settings={settings}
                sources={sources}
                audioSources={audioSources}
                performanceAudio={performanceAudio}
                permissionState={cameraSession.permissionState}
                streamState={cameraSession.streamState}
                lastError={cameraSession.lastError}
                isBusy={isBusy}
                browserSessionStatus={browserSession.status}
                previewFrameRef={previewFrameRef}
                previewCanvasRef={previewCanvasRef}
                onModeChange={setMode}
                onDeviceChange={setDevice}
                onAudioDeviceChange={setAudioDevice}
                onCountdownChange={setCountdown}
                onRotate={rotate}
                onFlipHorizontal={toggleFlipHorizontal}
                onFlipVertical={toggleFlipVertical}
                onRetryPermission={() => {
                  void retryPermission()
                }}
                onRefreshSources={() => {
                  void refreshSources()
                }}
              />
            </Suspense>
          }
        />
        <Route
          path="/capture"
          element={<Navigate to={getCaptureRoute(defaultProfile)} replace />}
        />
        <Route
          path="/settings"
          element={<Navigate to={getSettingsRoute(defaultProfile)} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={getCaptureRoute(defaultProfile)} replace />}
        />
      </Routes>

      <video ref={videoRef} className="hidden-video" autoPlay muted playsInline />
    </>
  )
}
