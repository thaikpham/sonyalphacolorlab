export interface ShowcaseRuntimeFlags {
  kioskMode: boolean;
  debugMode: boolean;
}

export interface StoredCameraPreference {
  deviceId: string | null;
  label: string | null;
  normalizedLabel: string | null;
  lastConnectedAt: string | null;
}

const STORAGE_KEYS = {
  preferredCamera: "sony-showcase:kiosk:preferred-camera",
  videoAudioMutedFallback: "sony-showcase:kiosk:video-audio-muted-fallback",
  videoAudioMutedFallbackAt: "sony-showcase:kiosk:video-audio-muted-fallback-at",
  lastBootAt: "sony-showcase:kiosk:last-boot-at",
  lastCameraConnectedAt: "sony-showcase:kiosk:last-camera-connected-at",
} as const;

const VIDEO_AUDIO_FALLBACK_TTL_MS = 10 * 60 * 1000;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures in kiosk/private profiles.
  }
}

function readString(key: string) {
  if (!canUseStorage()) return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in kiosk/private profiles.
  }
}

export function readShowcaseRuntimeFlags(): ShowcaseRuntimeFlags {
  if (typeof window === "undefined") {
    return { kioskMode: false, debugMode: false };
  }

  const params = new URLSearchParams(window.location.search);
  const kioskMode = params.get("kiosk") === "1";
  const debugMode = params.get("debug") === "1";

  return { kioskMode, debugMode };
}

export function readPreferredCameraPreference(): StoredCameraPreference | null {
  return readJson<StoredCameraPreference>(STORAGE_KEYS.preferredCamera);
}

export function writePreferredCameraPreference(deviceId: string | null, label: string | null) {
  const normalizedLabel = label?.trim().toLowerCase() ?? null;
  const lastConnectedAt = new Date().toISOString();

  writeJson(STORAGE_KEYS.preferredCamera, {
    deviceId,
    label,
    normalizedLabel,
    lastConnectedAt,
  } satisfies StoredCameraPreference);

  writeString(STORAGE_KEYS.lastCameraConnectedAt, lastConnectedAt);
}

export function readLastBootAt() {
  return readString(STORAGE_KEYS.lastBootAt);
}

export function writeLastBootAt(value = new Date().toISOString()) {
  writeString(STORAGE_KEYS.lastBootAt, value);
}

export function readLastCameraConnectedAt() {
  return readString(STORAGE_KEYS.lastCameraConnectedAt);
}

export function readVideoAudioMutedFallback() {
  const enabled = readString(STORAGE_KEYS.videoAudioMutedFallback) === "1";
  if (!enabled) return false;

  const recordedAt = readString(STORAGE_KEYS.videoAudioMutedFallbackAt);
  if (!recordedAt) return false;

  const ageMs = Date.now() - Date.parse(recordedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > VIDEO_AUDIO_FALLBACK_TTL_MS) {
    writeVideoAudioMutedFallback(false);
    return false;
  }

  return true;
}

export function writeVideoAudioMutedFallback(enabled: boolean) {
  writeString(STORAGE_KEYS.videoAudioMutedFallback, enabled ? "1" : "0");
  writeString(STORAGE_KEYS.videoAudioMutedFallbackAt, enabled ? new Date().toISOString() : "");
}
