import { beforeEach, describe, expect, it } from 'vitest';
import { clConstraints, constraintsFor, ppConstraints, wbConstraints } from './constraints';
import { checkDailyBudget, checkRateLimit, resetRateLimits } from './rate-limit';
import { CREATIVE_LOOKS, PP_GAMMA } from '../camera/constants';

/**
 * The prompt text is generated from constants.ts. These tests exist because a
 * prompt that restates a range by hand is a second source of truth, and when it
 * drifts the model is told the wrong rules with total confidence — a failure
 * mode with no stack trace.
 */
describe('AI constraint text', () => {
  it('lists every gamma curve and Creative Look from the constants', () => {
    const pp = ppConstraints();
    for (const g of PP_GAMMA) expect(pp).toContain(g);

    const cl = clConstraints();
    for (const l of CREATIVE_LOOKS) expect(cl).toContain(l.code);
  });

  it('states the two saturation ranges distinctly', () => {
    // The single most dangerous confusion: PP is -32..+32, CL is -9..+9.
    expect(ppConstraints()).toContain('-32 to 32');
    expect(clConstraints()).toContain('-9 to 9');
  });

  it('spells out the unsigned Creative Look parameters', () => {
    const cl = clConstraints();
    expect(cl).toContain('Fade: 0 to 9');
    expect(cl).toContain('Sharpness: 0 to 9');
    expect(cl).toContain('Sharpness Range: 1 to 5');
    expect(cl).toContain('Clarity: 0 to 9');
  });

  it('tells the model to omit Saturation on monochrome Looks', () => {
    expect(clConstraints()).toContain("OMITTED");
    expect(clConstraints()).toContain("BW, SE");
  });

  it('includes the WB shift quarter-step', () => {
    expect(wbConstraints()).toContain('in steps of 0.25');
  });

  it('gives each format only its own rules', () => {
    expect(constraintsFor('pp')).toContain('PICTURE PROFILE');
    expect(constraintsFor('pp')).not.toContain('CREATIVE LOOK —');
    expect(constraintsFor('cl')).toContain('CREATIVE LOOK');
    expect(constraintsFor('cl')).not.toContain('PICTURE PROFILE —');
  });
});

describe('rate limiting', () => {
  beforeEach(resetRateLimits);

  it('allows a burst then blocks', () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('a', t).allowed, `call ${i + 1}`).toBe(true);
    }
    const blocked = checkRateLimit('a', t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps callers in separate buckets', () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit('a', t);
    expect(checkRateLimit('b', t).allowed).toBe(true);
  });

  it('recovers after the window passes', () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit('a', t);
    expect(checkRateLimit('a', t).allowed).toBe(false);
    expect(checkRateLimit('a', t + 60_001).allowed).toBe(true);
  });

  it('reports remaining budget', () => {
    const t = 1_000_000;
    expect(checkRateLimit('a', t).remaining).toBe(4);
    expect(checkRateLimit('a', t).remaining).toBe(3);
  });
});

describe('daily spend cap', () => {
  beforeEach(resetRateLimits);

  it('stops calls once the cap is reached', () => {
    // The per-caller limiter does nothing about many callers at once; this is
    // the backstop that keeps a shared link from becoming a bill.
    const t = Date.parse('2026-07-28T10:00:00Z');
    const cap = checkDailyBudget(t).cap;
    for (let i = 1; i < cap; i++) checkDailyBudget(t);
    expect(checkDailyBudget(t).allowed).toBe(false);
  });

  it('resets on the next UTC day', () => {
    const t = Date.parse('2026-07-28T23:59:00Z');
    const cap = checkDailyBudget(t).cap;
    for (let i = 1; i < cap; i++) checkDailyBudget(t);
    expect(checkDailyBudget(t).allowed).toBe(false);
    expect(checkDailyBudget(Date.parse('2026-07-29T00:01:00Z')).allowed).toBe(true);
  });

  it('reports usage against the cap', () => {
    const t = Date.parse('2026-07-28T10:00:00Z');
    const first = checkDailyBudget(t);
    expect(first.used).toBe(1);
    expect(first.cap).toBeGreaterThan(0);
  });
});
