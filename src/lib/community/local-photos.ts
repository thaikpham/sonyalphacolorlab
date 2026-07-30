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

export function subscribeLocalPhotos(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith('colorlab_user_photos_')) {
      const slug = e.key.replace('colorlab_user_photos_', '');
      cache.set(slug, parse(e.newValue));
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

/** Helper to get all local credits (author name, social link) by photo URL */
export function getLocalCredits(slug: string): Record<string, PhotoCredit> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CREDITS_KEY(slug));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Helper to set credit for a photo URL */
export function setLocalCredit(slug: string, credit: PhotoCredit): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalCredits(slug);
    existing[credit.url] = credit;
    localStorage.setItem(CREDITS_KEY(slug), JSON.stringify(existing));
  } catch {
    // Quota or private mode
  }
  emit();
}
