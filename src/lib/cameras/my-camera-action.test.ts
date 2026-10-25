import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `chooseMyCamera`, the one writer of the camera cookie. `next/headers` is
 * replaced by a recording store; the catalogue is the real offline seed.
 */

const store = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => store }));

const { chooseMyCamera } = await import('./my-camera-action');
const { MY_CAMERA_COOKIE, MY_CAMERA_MAX_AGE } = await import('./my-camera-cookie');

const choose = (value: string | null) => {
  const fd = new FormData();
  if (value !== null) fd.set('camera', value);
  return chooseMyCamera(fd);
};

beforeEach(() => {
  store.set.mockClear();
  store.delete.mockClear();
});

describe('chooseMyCamera', () => {
  it('stores a catalogue camera, site-wide, for a year, readable by the recipe page’s island', async () => {
    await choose('ILCE-7M3');
    expect(store.delete).not.toHaveBeenCalled();
    expect(store.set).toHaveBeenCalledWith(MY_CAMERA_COOKIE, 'ILCE-7M3', {
      path: '/',
      maxAge: MY_CAMERA_MAX_AGE,
      sameSite: 'lax',
      secure: false,
      httpOnly: false,
    });
  });

  it('stores the generic older camera', async () => {
    await choose('older-creative-style');
    expect(store.set).toHaveBeenCalledWith(MY_CAMERA_COOKIE, 'older-creative-style', expect.any(Object));
  });

  it('forgets the camera for "unknown", and for anything it does not recognise', async () => {
    for (const value of ['unknown', '', null, 'ILCE-7M9', 'ILCE-7M3; Path=/', 'constructor']) {
      store.set.mockClear();
      store.delete.mockClear();
      await choose(value);
      expect(store.set, String(value)).not.toHaveBeenCalled();
      expect(store.delete, String(value)).toHaveBeenCalledWith(MY_CAMERA_COOKIE);
    }
  });
});
