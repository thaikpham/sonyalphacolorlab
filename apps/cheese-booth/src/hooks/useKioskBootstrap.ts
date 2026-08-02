import { useEffect, useRef } from 'react'

export function useKioskBootstrap(
  settingsReady: boolean,
  openCapture: () => Promise<void>,
): void {
  const didInitializeCaptureRef = useRef(false)

  useEffect(() => {
    if (!settingsReady || didInitializeCaptureRef.current) return

    didInitializeCaptureRef.current = true
    void openCapture()
  }, [openCapture, settingsReady])
}
