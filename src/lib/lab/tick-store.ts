'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { parseTicks, toggleTick, type TickSet } from './storage'

/**
 * `localStorage` as a React external store.
 *
 * The obvious shape — `useState({})` plus a `useEffect` that reads storage —
 * is the one this project's lint rules reject, and correctly: it renders the
 * empty state, commits, then immediately re-renders with the stored one, so
 * every ticked box visibly flashes off and back on. `useSyncExternalStore` is
 * the API built for exactly this: React renders the server snapshot during
 * hydration and swaps to the live one in the same commit, with no cascading
 * render and no markup mismatch.
 *
 * Two things fall out of it for free. A write from one checklist re-renders
 * every other checklist on the page, so two lists in one article can no longer
 * hold contradictory copies of the same map. And subscribing to `storage`
 * events means a second tab ticking a box updates this one — which for a tool
 * somebody keeps open next to their camera is the difference between progress
 * and a stale number.
 */

type Listener = () => void

const listeners = new Map<string, Set<Listener>>()

/**
 * Snapshot cache, keyed by storage key.
 *
 * `useSyncExternalStore` calls `getSnapshot` on every render and bails out
 * only when the result is reference-equal to the last one. Parsing the JSON
 * fresh each time returns a new object every render, which React treats as a
 * change — an infinite render loop, not a slow one. So the raw string is
 * cached alongside its parsed value and re-parsed only when the string itself
 * has changed.
 */
const cache = new Map<string, { raw: string | null; value: TickSet }>()

/** One frozen empty map, shared. A fresh `{}` here would loop for the same
    reason as above — and the server must return a stable value too. */
const EMPTY: TickSet = Object.freeze({})

/**
 * The in-memory mirror, for browsers that deny storage outright.
 *
 * Safari's private mode and a cross-origin iframe both throw on `setItem`, and
 * without this a toggle in those browsers does nothing visible at all: the
 * write is swallowed, the next read returns the old value, and the control
 * springs back under the reader's finger. Mirroring every write means the
 * choice holds for the visit and is merely forgotten on reload, which is the
 * degradation the reader can actually make sense of.
 */
const memory = new Map<string, string>()

function rawValue(key: string): string | null {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored !== null) return stored
  } catch {
    /* Storage denied. Fall through to the mirror. */
  }
  return memory.get(key) ?? null
}

function rawWrite(key: string, value: string): void {
  memory.set(key, value)
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* Quota exceeded, or storage denied. The mirror above already has it. */
  }
}

function snapshot(key: string): TickSet {
  const raw = rawValue(key)
  const hit = cache.get(key)
  if (hit && hit.raw === raw) return hit.value

  const value = raw === null ? EMPTY : parseTicks(raw)
  cache.set(key, { raw, value })
  return value
}

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener()
}

function subscribe(key: string, listener: Listener): () => void {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(listener)

  /* Fires only for writes from OTHER tabs — this tab's own writes go through
     `notify` — so the two paths never double up. */
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === key) listener()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    set?.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** The live set for one storage key. Empty on the server and during hydration. */
export function useTicks(key: string): TickSet {
  const sub = useCallback((l: Listener) => subscribe(key, l), [key])
  return useSyncExternalStore(
    sub,
    () => snapshot(key),
    () => EMPTY,
  )
}

/**
 * Toggle one entry and tell every subscriber.
 *
 * It merges into whatever is stored right now rather than into this
 * component's copy. An article can hold more than one checklist, and each of
 * them subscribes to the same key — persisting a component-local copy is how
 * the second list's first tick erases the first list's ticks.
 */
export function toggleStoredTick(key: string, tickKey: string): void {
  rawWrite(key, JSON.stringify(toggleTick(parseTicks(rawValue(key)), tickKey)))
  cache.delete(key)
  notify(key)
}

/**
 * A single stored string — the menu-version preference.
 *
 * Same store, same reasons, but the value is a scalar so it needs no snapshot
 * cache: a string compares by value, and React's bail-out is happy with that.
 */
export function usePreference<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  const sub = useCallback((l: Listener) => subscribe(key, l), [key])
  const get = useCallback(() => {
    const raw = rawValue(key)
    return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
    // `allowed` is a module-level literal at every call site; listing it would
    // rebuild this callback every render for a value that never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fallback])

  return useSyncExternalStore(sub, get, () => fallback)
}

export function setPreference(key: string, value: string): void {
  rawWrite(key, value)
  notify(key)
}
