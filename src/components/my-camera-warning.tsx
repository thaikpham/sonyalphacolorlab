'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import type { InstallReason } from '@/lib/cameras/capabilities/installable';
import type { CameraWarning } from '@/lib/cameras/my-camera';
import { MY_CAMERA_COOKIE, readCookie } from '@/lib/cameras/my-camera-cookie';

/* The cookie is not watched: it changes on the browse page, and a recipe page
   is a fresh mount that reads it again. */
const subscribe = () => () => {};
const readChoice = () => readCookie(document.cookie, MY_CAMERA_COOKIE);
const noChoice = () => null;

/**
 * The recipe page's accuracy line for the reader's camera (ADR 0006):
 * "a7 III has no Creative Look", "An older camera may have no S-Cinetone".
 *
 * The page is prerendered, so it cannot read the cookie; it computes, at
 * build, every choice that has something to say about this recipe
 * (`cameraWarnings`) and this island looks the browser's cookie up in that
 * map. The server render and the first client render are empty — nothing to
 * mismatch — and a value the map does not hold, malformed or not, is no line.
 */
export function MyCameraWarning({ warnings }: { warnings: Readonly<Record<string, CameraWarning>> }) {
  const choice = useSyncExternalStore(subscribe, readChoice, noChoice);
  /* `Object.hasOwn`: a cookie reading `constructor` must not find the prototype's. */
  const warning = choice && Object.hasOwn(warnings, choice) ? warnings[choice] : null;
  return warning ? <CameraWarningLines camera={warning.camera} reasons={warning.reasons} /> : null;
}

/**
 * One line per reason. A confirmed reason is why browse hides the recipe for
 * this camera; an unconfirmed one (the generic older camera and S-Cinetone)
 * only warns. `label` is Sony's own name and is never translated; neither is
 * the camera's.
 */
export function CameraWarningLines({ camera, reasons }: { camera: string | null; reasons: readonly InstallReason[] }) {
  const t = useTranslations('myCamera');
  const subject = camera ?? t('olderSubject');
  return (
    <ul className="flex flex-col gap-1">
      {reasons.map((r) => (
        <li
          key={r.label}
          className={r.confirmed ? 'text-body-sm font-semibold text-danger' : 'text-body-sm font-semibold text-ink-muted'}
        >
          {t(r.confirmed ? 'lacks' : 'mayLack', { camera: subject, label: r.label })}
        </li>
      ))}
    </ul>
  );
}
