import 'server-only';

/**
 * Fixed-window rate limiter for the AI endpoint.
 *
 * In-process and therefore per-instance: on serverless it limits each warm
 * instance, not the fleet. That is deliberate for now — it stops a single
 * client hammering the endpoint, which is the realistic abuse here, without
 * adding a Redis dependency before there is traffic to justify one.
 *
 * ⚠ Before opening the AI endpoint to real traffic, move this to a shared
 * store (Upstash / Vercel KV). A per-instance limit is not a spend cap.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  // Opportunistic sweep; the map would otherwise grow with every unique key.
  if (windows.size > 10_000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_PER_WINDOW - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= MAX_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: MAX_PER_WINDOW - existing.count,
    retryAfterSeconds: 0,
  };
}

// ---------------------------------------------------------------------------
// Daily spend cap
// ---------------------------------------------------------------------------

/**
 * A hard ceiling on AI calls per UTC day, across all callers.
 *
 * The per-caller rate limit above stops one client hammering the endpoint; it
 * does nothing about *many* clients, or about a link going around a Facebook
 * group. This is the backstop that keeps a bad day from becoming a bill.
 *
 * Also in-process, so on serverless the effective cap is roughly
 * `AI_DAILY_CALL_CAP x live instances`. Set it well under the real budget, and
 * move both counters to a shared store before this sees serious traffic.
 */
const DEFAULT_DAILY_CAP = 500;

const dailyCap = () => {
  const raw = Number(process.env.AI_DAILY_CALL_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_CAP;
};

let day = '';
let dayCount = 0;

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

export type BudgetResult = { allowed: boolean; used: number; cap: number };

/** Counts one call against today's budget. */
export function checkDailyBudget(now = Date.now()): BudgetResult {
  const today = utcDay(now);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }

  const cap = dailyCap();
  if (dayCount >= cap) return { allowed: false, used: dayCount, cap };

  dayCount += 1;
  return { allowed: true, used: dayCount, cap };
}

/** Test-only. */
export function resetRateLimits() {
  windows.clear();
  day = '';
  dayCount = 0;
}
