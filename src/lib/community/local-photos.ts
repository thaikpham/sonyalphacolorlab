/**
 * Locally contributed photo URLs and author credits, as an external store.
 *
 * Read through `useSyncExternalStore` rather than `useState` + `useEffect`.
 * `getSnapshot` MUST return a referentially stable value.
 */

const KEY = (slug: string) => `colorlab_user_photos_${slug}`;
const CREDITS_KEY = (slug: string) => `colorlab_user_credits_${slug}`;

export type PhotoCredit = {
  url: string;
  authorName?: string;
  authorSocial?: string;
};

/** Shared empty array; a new `[]` each call would defeat the snapshot cache. */
const EMPTY: readonly string[] = Object.freeze([]);

const cache = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function parse(raw: string | null): readonly string[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function getLocalPhotos(slug: string): readonly string[] {
  const hit = cache.get(slug);
  if (hit) return hit;
  if (typeof window === 'undefined') return EMPTY;

  let list: readonly string[] = EMPTY;
  try {
    list = parse(localStorage.getItem(KEY(slug)));
  } catch {
    // Private mode, disabled storage
  }
  cache.set(slug, list);
  return list;
}

/** Server render has no storage; always the same empty array. */
export const getServerPhotos = (): readonly string[] => EMPTY;

/** Subscribes to both halves of the store; photos and credits change together. */
export function subscribeLocalPhotos(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith('colorlab_user_photos_')) {
      const slug = e.key.replace('colorlab_user_photos_', '');
      cache.set(slug, parse(e.newValue));
      emit();
    } else if (e.key?.startsWith('colorlab_user_credits_')) {
      const slug = e.key.replace('colorlab_user_credits_', '');
      creditsCache.set(slug, parseCredits(e.newValue));
      emit();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function setLocalPhotos(slug: string, photos: string[]): void {
  cache.set(slug, Object.freeze([...photos]));
  try {
    localStorage.setItem(KEY(slug), JSON.stringify(photos));
  } catch {
    // Quota or private mode
  }
  emit();
}

/** Shared empty map, for the same reason as `EMPTY`. */
const EMPTY_CREDITS: Readonly<Record<string, PhotoCredit>> = Object.freeze({});

const creditsCache = new Map<string, Readonly<Record<string, PhotoCredit>>>();

function parseCredits(raw: string | null): Readonly<Record<string, PhotoCredit>> {
  if (!raw) return EMPTY_CREDITS;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.freeze(parsed as Record<string, PhotoCredit>)
      : EMPTY_CREDITS;
  } catch {
    return EMPTY_CREDITS;
  }
}

/**
 * Author credits, cached the same way the photo list is.
 *
 * This used to read `localStorage` on every call and hand back a fresh object.
 * Two things followed from that, both silent. Called during render it returned
 * `{}` on the server and real data on the client's first pass, which is a
 * hydration mismatch; and because the object was new each time, `setLocalCredit`
 * could `emit()` all it liked — `useSyncExternalStore` compares snapshots by
 * reference, saw the photo list unchanged, and never re-rendered, so a credit
 * just added did not appear until something else moved.
 */
export function getLocalCredits(slug: string): Readonly<Record<string, PhotoCredit>> {
  const hit = creditsCache.get(slug);
  if (hit) return hit;
  if (typeof window === 'undefined') return EMPTY_CREDITS;

  let map: Readonly<Record<string, PhotoCredit>> = EMPTY_CREDITS;
  try {
    map = parseCredits(localStorage.getItem(CREDITS_KEY(slug)));
  } catch {
    // Private mode, disabled storage
  }
  creditsCache.set(slug, map);
  return map;
}

/** Server render has no storage; always the same empty map. */
export const getServerCredits = (): Readonly<Record<string, PhotoCredit>> => EMPTY_CREDITS;

/** Helper to set credit for a photo URL */
export function setLocalCredit(slug: string, credit: PhotoCredit): void {
  if (typeof window === 'undefined') return;
  const next = Object.freeze({ ...getLocalCredits(slug), [credit.url]: credit });
  creditsCache.set(slug, next);
  try {
    localStorage.setItem(CREDITS_KEY(slug), JSON.stringify(next));
  } catch {
    // Quota or private mode
  }
  emit();
}
