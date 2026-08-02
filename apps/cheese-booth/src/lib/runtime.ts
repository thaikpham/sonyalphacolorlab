export const BROWSER_CLOUD_SHARE_LABEL = 'Cloud QR 24h'

export interface RuntimeEnvironment {
  kind: 'browser'
  label: string
  telemetryLabel: 'BROWSER'
  storageTargetLabel: string
  storageReady: true
  storageSummary: string
  tone: 'good'
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  return {
    kind: 'browser',
    label: 'Browser + Cloud Share',
    telemetryLabel: 'BROWSER',
    storageTargetLabel: BROWSER_CLOUD_SHARE_LABEL,
    storageReady: true,
    storageSummary: 'Upload rieng tu + QR gallery 24h',
    tone: 'good',
  }
}
