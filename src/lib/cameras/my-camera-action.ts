'use server';

import { cookies } from 'next/headers';
import { getSonyCameras } from './data';
import { cameraOptions, isStorableChoice } from './my-camera';
import { MY_CAMERA_COOKIE, MY_CAMERA_MAX_AGE } from './my-camera-cookie';

/**
 * Stores the reader's camera, or forgets it.
 *
 * A Server Function, so the cookie is written on the response and Next
 * re-renders the current page with it in the same round trip — the browse
 * grid and its counts change without a navigation, and the URL does not
 * change at all (ADR 0006: a shared link must not carry the sender's camera).
 *
 * Reachable by a direct POST like any Server Function, and it needs no
 * identity: it can only set a preference cookie on the caller's own browser.
 * What it stores is still checked — the generic older-camera choice or a
 * model code the catalogue lists. Anything else, `unknown` included, deletes
 * the cookie, which is what "no camera" is.
 */
export async function chooseMyCamera(formData: FormData): Promise<void> {
  const value = formData.get('camera');
  const store = await cookies();
  const options = cameraOptions(await getSonyCameras());

  if (!isStorableChoice(value, options)) {
    store.delete(MY_CAMERA_COOKIE);
    return;
  }

  store.set(MY_CAMERA_COOKIE, value, {
    path: '/',
    maxAge: MY_CAMERA_MAX_AGE,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    /* Read in the browser by the recipe page's warning line; see
       `my-camera-cookie.ts` for why that page does not read it on the server. */
    httpOnly: false,
  });
}
