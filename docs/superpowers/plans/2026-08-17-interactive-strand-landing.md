# Interactive Strand Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's whole-image parallax with an independently deforming black/silver/blue/purple 3D strand field that prioritizes 60fps on desktop and mobile while retaining the dark WebP fallback and liquid-glass launcher tiles.

**Architecture:** Keep `src/app/[locale]/page.tsx` server-rendered and isolate all browser work in a small `LauncherBackdrop` client shell. The shell renders the fallback and two React-owned canvases, then conditionally imports one imperative runtime; that runtime selects a WebGPU compute backend or a WebGL2 analytical backend and shares only DOM-free policy modules with the initial bundle. Pure reducers and schedulers receive Node/Vitest coverage, renderer coordination is tested through injected doubles, and real shader/canvas behavior is verified in Chrome through Playwright and the in-app browser.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, TypeScript 6, Three.js/TSL `0.185.1`, Vitest 4, Playwright 1.62.1, Tailwind v4/CSS, WebGPU, WebGL2.

**Spec:** `docs/superpowers/specs/2026-08-17-interactive-strand-landing-design.md`

## Global Constraints

- Pin both `three` and `@types/three` to exactly `0.185.1`; pin `@playwright/test` to exactly `1.62.1`.
- Keep the localized landing page a Server Component. `src/components/launcher-backdrop.tsx` is the only **new landing-specific** Client Component boundary; existing shared Client Components such as `LauncherGrid` stay unchanged.
- The client shell may use `import type` from `types.ts`, but it must not statically import `three`, `three/webgpu`, `three/tsl`, `runtime.ts`, or a module that imports them.
- Preserve two separate canvases. A canvas that acquired WebGPU is never reused for WebGL2.
- Deployed production backend preference is always `auto`. Query/test globals are compiled only when `NEXT_PUBLIC_LAUNCHER_TEST_HARNESS=1`; normal Vercel builds omit that variable and ignore `launcherBackend`, `launcherTest`, and `launcherPerf`.
- Every interactive tier targets 60fps. The exact ladders, two-second windows, thresholds, cooldowns, and terminal fallback rules are copied from the spec and may not be relaxed.
- Use capability checks, viewport measurements, and pointer media queries; never branch on user agent.
- Keep canvas input passive and coalesced. The canvases remain `pointer-events: none`, unfocusable, and decorative.
- Do not add post-processing, depth of field, shadows, MSAA, per-frame allocation, a Route Handler, server compute, or a remote asset/runtime dependency.
- Keep `src/assets/launcher-oasis.webp` as a fingerprinted, `unoptimized` static fallback, no larger than 350 KiB.
- Keep landing-only liquid glass scoped under `.launcher-stage`; do not change shared `LauncherGrid` behavior or header-launcher faces.
- Do not touch dirty user files `src/components/camera-wiki-view.tsx`, `src/components/site-header.tsx`, `.agents/`, `Claude Design Plan/`, or `Font unification across design system/`.
- All production behavior follows red-green-refactor. Browser-only behavior gets a failing Playwright assertion before its implementation.
- Physical D1/M1/M1-WGL/M2 performance results are never invented. Record `not-run` when a named device is unavailable and do not claim physical 60fps acceptance for that profile.
- Execute this plan only in the isolated worktree created for it. The approved binary fallback and its asset contract test are tracked in the plan's base commit, so no task depends on dirty files outside that worktree.

---

### Task 1: Exact Dependencies, Public Contracts, and Deterministic Blade Distribution

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/launcher-strands/types.ts`
- Create: `src/lib/launcher-strands/distribution.ts`
- Test: `src/lib/launcher-strands/distribution.test.ts`

**Interfaces:**
- Produces: `LauncherStrandRuntimeOptions`, `LauncherStrandController`, `LauncherStrandDiagnostics`, `LauncherStrandBackend`, `LauncherStrandState`, `LauncherStrandFallbackReason`, `BladeSeed`, and `createBladeSeed()`.
- Consumes: no feature code; this is the dependency and type root.

- [ ] **Step 1: Install exact dependencies**

Run:

```bash
npm install --save-exact three@0.185.1
npm install --save-dev --save-exact @types/three@0.185.1 @playwright/test@1.62.1
```

Expected: `package.json` and `package-lock.json` resolve all three packages to the exact versions above; `npm ls three @types/three @playwright/test` exits 0.

- [ ] **Step 2: Define the Three-free public contract**

Write `types.ts` with these exact public shapes and no imports from Three:

```ts
export type LauncherStrandBackend = 'webgpu' | 'webgl2';

export type LauncherStrandState =
  | 'static'
  | 'scheduled'
  | 'loading'
  | 'initializing-webgpu'
  | 'initializing-webgl2'
  | 'running'
  | 'paused'
  | 'static-failed'
  | 'disposed';

export type LauncherStrandFallbackReason =
  | 'reduced-motion'
  | 'save-data'
  | 'import-failed'
  | 'webgpu-unavailable'
  | 'webgpu-initialization-failed'
  | 'webgl2-initialization-failed'
  | 'context-lost'
  | 'device-lost'
  | 'minimum-quality-unstable'
  | 'aborted';

export interface LauncherStrandPointerFrame {
  ndcX: number;
  ndcY: number;
  active: boolean;
  released: boolean;
}

export interface LauncherStrandRuntimeOptions {
  canvases: { webgpu: HTMLCanvasElement; webgl2: HTMLCanvasElement };
  stage: HTMLElement;
  signal: AbortSignal;
  backendPreference: 'auto' | 'webgl2';
  onReady: (backend: LauncherStrandBackend) => void;
  onFallback: (reason: LauncherStrandFallbackReason) => void;
  onStateChange?: (state: LauncherStrandState) => void;
}

export interface LauncherStrandDiagnostics {
  state: LauncherStrandState;
  backend: LauncherStrandBackend | null;
  qualityIndex: number;
  activeBlades: number;
  effectiveDpr: number;
  renderScale: number;
  submissionFps: number;
  missRatio: number;
  submitP95Ms: number;
  gpuMetric: 'queue-latency' | 'timer-query' | 'unavailable';
  gpuP95Ms: number | null;
  gpuProbePending: boolean;
  fallbackReason: LauncherStrandFallbackReason | null;
}

export interface LauncherStrandController {
  dispose(): void;
  getDiagnostics(): LauncherStrandDiagnostics;
}
```

- [ ] **Step 3: Write the failing distribution tests**

Use literal expectations independent from the implementation:

```ts
import { describe, expect, it } from 'vitest';
import { createBladeSeed } from './distribution';

function independentCoverage(seeds: readonly ReturnType<typeof createBladeSeed>[]) {
  const counts = Array.from({ length: 16 }, () => 0);
  for (const seed of seeds) {
    const radialBin = Math.min(3, Math.floor(seed.radius * seed.radius * 4));
    const angle = (Math.atan2(seed.z, seed.x) + Math.PI * 2) % (Math.PI * 2);
    const angleBin = Math.min(3, Math.floor((angle / (Math.PI * 2)) * 4));
    counts[radialBin * 4 + angleBin] += 1;
  }
  const nonzero = counts.filter((count) => count > 0);
  return {
    occupiedBins: nonzero.length,
    maxToMinRatio: Math.max(...nonzero) / Math.min(...nonzero),
  };
}

describe('launcher strand distribution', () => {
  it('is deterministic for a fixed index and seed', () => {
    expect(createBladeSeed(17, 0x51a7)).toEqual(createBladeSeed(17, 0x51a7));
    expect(createBladeSeed(17, 0x51a7)).not.toEqual(createBladeSeed(18, 0x51a7));
  });

  it.each([6_000, 8_000, 16_000, 24_000, 72_000])(
    'keeps the active prefix spread over a 4x4 field at %i blades',
    (count) => {
      const seeds = Array.from({ length: count }, (_, index) =>
        createBladeSeed(index, 0x51a7),
      );
      const coverage = independentCoverage(seeds);
      expect(coverage.occupiedBins).toBe(16);
      expect(coverage.maxToMinRatio).toBeLessThan(1.35);
    },
  );

  it('keeps every generated attribute finite and within its declared range', () => {
    const seed = createBladeSeed(4_096, 0x51a7);
    expect(seed.radius).toBeGreaterThanOrEqual(0);
    expect(seed.radius).toBeLessThanOrEqual(1);
    expect(seed.rotation).toBeGreaterThanOrEqual(0);
    expect(seed.rotation).toBeLessThan(Math.PI * 2);
    expect(seed.height).toBeGreaterThanOrEqual(0.62);
    expect(seed.height).toBeLessThanOrEqual(1.28);
    expect(seed.width).toBeGreaterThanOrEqual(0.018);
    expect(seed.width).toBeLessThanOrEqual(0.052);
    expect(seed.palette).toBeGreaterThanOrEqual(0);
    expect(seed.palette).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 4: Run the new test and verify RED**

Run: `npm test -- src/lib/launcher-strands/distribution.test.ts`

Expected: FAIL because `./distribution` does not exist.

- [ ] **Step 5: Implement the deterministic R2 disk distribution**

Implement `BladeSeed` with `x`, `z`, `radius`, `rotation`, `height`, `width`, `phase`, `cluster`, and `palette`. Use the R2 sequence constants `1 / 1.324717957244746` and its square, concentric square-to-disk mapping, and a seeded integer hash for attribute jitter. Clamp all declared ranges exactly as asserted above; do not call `Math.random()`.

The coverage calculation deliberately stays in the test and uses independent equal-area radial/angular bins, so production code cannot make a broken generator and its own validator agree.

- [ ] **Step 6: Verify GREEN and type health**

Run:

```bash
npm test -- src/lib/launcher-strands/distribution.test.ts
npm run typecheck
```

Expected: distribution tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit Task 1**

```bash
git add package.json package-lock.json src/lib/launcher-strands/types.ts src/lib/launcher-strands/distribution.ts src/lib/launcher-strands/distribution.test.ts
git commit -m "feat: add strand runtime foundations"
```

---

### Task 2: 60Hz Scheduler and Adaptive Quality Policy

**Files:**
- Create: `src/lib/launcher-strands/scheduler.ts`
- Test: `src/lib/launcher-strands/scheduler.test.ts`
- Create: `src/lib/launcher-strands/metrics.ts`
- Test: `src/lib/launcher-strands/metrics.test.ts`
- Create: `src/lib/launcher-strands/quality.ts`
- Test: `src/lib/launcher-strands/quality.test.ts`

**Interfaces:**
- Produces: `createFrameClock()`, `advanceFrameClock()`, `createMetricWindow()`, `setMetricEligibility()`, `resetMetricWindow()`, `recordMetricFrame()`, `finishMetricWindow()`, `selectInitialProfile()`, `effectiveDpr()`, `createQualityState()`, and `evaluateQualityWindow()`.
- Consumes: backend names from `types.ts`.

- [ ] **Step 1: Write failing scheduler tests**

```ts
it.each([
  { hz: 60, expectedRenders: 60 },
  { hz: 90, expectedRenders: 60 },
  { hz: 120, expectedRenders: 60 },
])('submits at most 60 frames during one second at $hz Hz', ({ hz, expectedRenders }) => {
  let state = createFrameClock(0);
  let renders = 0;
  for (let frame = 1; frame <= hz; frame += 1) {
    const tick = advanceFrameClock(state, (frame * 1_000) / hz);
    state = tick.state;
    if (tick.shouldRender) renders += 1;
  }
  expect(renders).toBe(expectedRenders);
});

it('renders once and counts extra logical deadlines as misses after a stall', () => {
  const tick = advanceFrameClock(createFrameClock(0), 68);
  expect(tick.shouldRender).toBe(true);
  expect(tick.elapsedDeadlines).toBe(4);
  expect(tick.missedDeadlines).toBe(3);
});
```

- [ ] **Step 2: Verify scheduler RED**

Run: `npm test -- src/lib/launcher-strands/scheduler.test.ts`

Expected: FAIL because the scheduler module is missing.

- [ ] **Step 3: Implement a deadline accumulator with no catch-up render**

Use `LOGICAL_FRAME_MS = 1000 / 60`. Each tick calculates elapsed logical deadlines, returns at most one `shouldRender`, advances the accumulator by all elapsed deadlines, and exposes the remaining missed count. Reset creates a new epoch and excludes the first 500ms from metric windows.

- [ ] **Step 4: Verify scheduler GREEN**

Run: `npm test -- src/lib/launcher-strands/scheduler.test.ts`

Expected: all 60/90/120Hz and stall cases pass.

- [ ] **Step 5: Write failing two-second metric-window tests**

Use literal frame/deadline/submission-duration fixtures. Assert no completed sample before exactly `2_000ms` of visible eligible time; paused time contributes nothing; the first `500ms` after backend start, resize, or resume is excluded; submission FPS is `submitted / eligibleSeconds`; miss ratio is `missedDeadlines / elapsedDeadlines`; and nearest-rank p95 for `[1, 2, 3, 4, 20]` is `20`. A reset clears old durations, misses, and submissions so no previous epoch can affect the next window.

The API is:

```ts
export interface MetricWindowResult {
  submissionFps: number;
  missRatio: number;
  submitP95Ms: number;
  eligibleMs: number;
}

export function createMetricWindow(startMs: number, excludedUntilMs: number): MetricWindowState;
export function setMetricEligibility(
  state: MetricWindowState,
  nowMs: number,
  eligible: boolean,
  excludedUntilMs?: number,
): MetricWindowState;
export function resetMetricWindow(startMs: number, excludedUntilMs: number): MetricWindowState;
export function recordMetricFrame(
  state: MetricWindowState,
  sample: { nowMs: number; submitted: boolean; elapsedDeadlines: number; missedDeadlines: number; submitMs?: number },
): MetricWindowState;
export function finishMetricWindow(state: MetricWindowState, nowMs: number):
  | { state: MetricWindowState; result: null }
  | { state: MetricWindowState; result: MetricWindowResult };
```

- [ ] **Step 6: Verify metrics RED, implement, and verify GREEN**

Run RED: `npm test -- src/lib/launcher-strands/metrics.test.ts`

Implement fixed-size in-place duration storage sized for a two-second 60Hz window plus margin; do not allocate or sort per rendered frame. Sorting a copied slice once when closing the two-second window is allowed.

`setMetricEligibility(state, nowMs, false)` closes the current eligible segment without completing a sample. `setMetricEligibility(state, nowMs, true, nowMs + 500)` starts a new segment and excludes its first 500ms; wall time between those transitions contributes neither duration nor deadlines. Backend start, resize, backend change, and quality reset replace state through `resetMetricWindow(nowMs, nowMs + 500)`. Tests call these transitions directly so pause semantics cannot be hidden inside the coordinator.

Run GREEN: `npm test -- src/lib/launcher-strands/metrics.test.ts`

- [ ] **Step 7: Write failing quality-policy tests**

The tests must cover these exact ladders and hand-derived results:

```ts
const EXPECTED_LADDERS = {
  'webgpu-fine': [[72_000, 1], [72_000, .85], [72_000, .7], [54_000, .7], [36_000, .7], [24_000, .65], [16_000, .65]],
  'webgpu-coarse': [[24_000, 1], [24_000, .85], [24_000, .7], [18_000, .7], [12_000, .7], [8_000, .65]],
  'webgl2-fine': [[36_000, 1], [36_000, .85], [36_000, .7], [28_000, .7], [20_000, .7], [12_000, .65]],
  'webgl2-coarse': [[16_000, 1], [16_000, .85], [16_000, .7], [12_000, .7], [8_000, .7], [6_000, .65]],
} as const;
```

Assert: one urgent window downgrades one step; one normal bad window does not; the second consecutive normal bad window does; five excellent windows upgrade one step; the eight-second cooldown blocks the next upgrade; and three critical windows at the minimum return `{ action: 'fallback' }`.

Also assert `effectiveDpr({ deviceDpr: 3, cssWidth: 1_200, cssHeight: 900, dprCap: 1, pixelBudget: 1_200_000 })` is close to `1.0`, while a 2,400×1,800 viewport produces `sqrt(1_200_000 / 4_320_000)`.

- [ ] **Step 8: Verify quality RED**

Run: `npm test -- src/lib/launcher-strands/quality.test.ts`

Expected: FAIL because `quality.ts` is missing.

- [ ] **Step 9: Implement the exact policy**

Define four profiles with the spec's blade counts, DPR caps, pixel budgets, and ladders. `selectInitialProfile()` keys on backend plus `(any-pointer: coarse)` result supplied by its caller. `evaluateQualityWindow()` accepts `{ submissionFps, missRatio, submitP95Ms, gpuP95Ms, gpuProbePending, nowMs }` and never applies more than one step per two-second window.

Urgent means `missRatio > 0.10`, `submitP95Ms > 16`, WebGPU queue p95 above `33ms`, or WebGL timer p95 above `20ms`, and downgrades after one window. Normal pressure means `missRatio > 0.05` or `submissionFps < 57`, `submitP95Ms > 12`, WebGPU queue p95 above `18ms`/still pending at the next probe point, or WebGL timer p95 above `14ms`, and downgrades after two consecutive windows. Upgrade requires five windows with `missRatio <= 0.017`, `submissionFps >= 59`, `submitP95Ms <= 8`, and no normal GPU pressure, followed by an eight-second cooldown. At the minimum tier, three windows with `missRatio > 0.167`, `submissionFps < 50`, `submitP95Ms > 20`, urgent GPU pressure, or repeated pending WebGPU probes return terminal fallback.

- [ ] **Step 10: Verify and commit Task 2**

```bash
npm test -- src/lib/launcher-strands/scheduler.test.ts src/lib/launcher-strands/metrics.test.ts src/lib/launcher-strands/quality.test.ts
git add src/lib/launcher-strands/scheduler.ts src/lib/launcher-strands/scheduler.test.ts src/lib/launcher-strands/metrics.ts src/lib/launcher-strands/metrics.test.ts src/lib/launcher-strands/quality.ts src/lib/launcher-strands/quality.test.ts
git commit -m "feat: add adaptive 60hz strand policy"
```

---

### Task 3: Coordinate Mapping, Touch Ownership, Pointer Trail, and Lifecycle Epochs

**Files:**
- Create: `src/lib/launcher-strands/coordinates.ts`
- Test: `src/lib/launcher-strands/coordinates.test.ts`
- Create: `src/lib/launcher-strands/input.ts`
- Test: `src/lib/launcher-strands/input.test.ts`
- Create: `src/lib/launcher-strands/lifecycle.ts`
- Test: `src/lib/launcher-strands/lifecycle.test.ts`

**Interfaces:**
- Produces: `clientPointToNdc()`, `reduceTouchOwner()`, `consumeLatestPointer()`, `updatePointerRing()`, `deriveRunEligibility()`, and `ProbeEpoch`.
- Consumes: no renderer objects; all inputs are serializable values.

- [ ] **Step 1: Write failing coordinate tests**

Use `{ left: 100, top: 50, width: 400, height: 200 }` and assert: top-left maps to `{-1, 1}`, center to `{0, 0}`, bottom-right to `{1, -1}`, an outside point returns `null`, and a refreshed rectangle with nonzero page scroll still uses client coordinates without adding scroll offsets.

- [ ] **Step 2: Verify coordinate RED, implement, and verify GREEN**

Run RED: `npm test -- src/lib/launcher-strands/coordinates.test.ts`

Implement:

```ts
export interface StageRect { left: number; top: number; width: number; height: number }
export function clientPointToNdc(
  point: { clientX: number; clientY: number },
  rect: StageRect,
): { x: number; y: number } | null;
```

Run GREEN: `npm test -- src/lib/launcher-strands/coordinates.test.ts`

- [ ] **Step 3: Write failing input-reducer tests**

Test one exact owner identifier, ignored secondary touches, ignored touch-typed Pointer Events, release on matching `touchend`, `touchcancel`, lost identifier, blur, and page hiding. Test that event reducers overwrite one latest coordinate without allocating a queue.

For the six-slot ring assert: movement below `0.12` field units or before `33ms` updates the newest slot; a qualifying move advances once; a held contact refreshes the newest timestamp; released samples use `2 ** (-age / 320)`; and every slot is zero at `900ms`.

- [ ] **Step 4: Verify input RED, implement, and verify GREEN**

Expose these reducer actions:

```ts
type TouchOwnerAction =
  | { type: 'start'; identifier: number; clientX: number; clientY: number }
  | { type: 'move'; touches: readonly { identifier: number; clientX: number; clientY: number }[] }
  | { type: 'end' | 'cancel'; identifiers: readonly number[] }
  | { type: 'reset' };
```

Run: `npm test -- src/lib/launcher-strands/input.test.ts`

- [ ] **Step 5: Write failing lifecycle and stale-probe tests**

Assert visible+intersecting+not-pagehidden is runnable; any false gate pauses; `pageshow` clears only the pagehide gate; and callbacks carrying an earlier probe epoch cannot mutate latency or pending state after pause, resume, resize, backend change, quality change, fallback, or disposal.

- [ ] **Step 6: Implement lifecycle state and verify Task 3**

`ProbeEpoch` owns a monotonically increasing integer, `invalidate()` clears pending state and returns the new integer, and `accept(capturedEpoch)` is true only for the current epoch before disposal.

Run:

```bash
npm test -- src/lib/launcher-strands/coordinates.test.ts src/lib/launcher-strands/input.test.ts src/lib/launcher-strands/lifecycle.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit Task 3**

```bash
git add src/lib/launcher-strands/coordinates.ts src/lib/launcher-strands/coordinates.test.ts src/lib/launcher-strands/input.ts src/lib/launcher-strands/input.test.ts src/lib/launcher-strands/lifecycle.ts src/lib/launcher-strands/lifecycle.test.ts
git commit -m "feat: model strand input and lifecycle"
```

---

### Task 4: Runtime Coordinator and Abort-Safe Backend Chain

**Files:**
- Create: `src/lib/launcher-strands/coordinator.ts`
- Test: `src/lib/launcher-strands/coordinator.test.ts`
- Create: `src/lib/launcher-strands/runtime.ts`
- Create: `src/lib/launcher-strands/webgpu.ts`
- Create: `src/lib/launcher-strands/webgl2.ts`

**Interfaces:**
- Produces: `BackendFactory`, `BackendSession`, `createRuntimeCoordinator()`, and the public `mountLauncherStrands()` dynamic entry.
- Consumes: Tasks 1–3 contracts and policy modules.
- Later tasks replace the two explicit unavailable backend factories with concrete sessions without changing the coordinator API.

- [ ] **Step 1: Write failing backend-chain tests with real coordinator behavior and renderer doubles**

Use this seam:

```ts
export interface BackendSession {
  readonly backend: LauncherStrandBackend;
  initialize(signal: AbortSignal): Promise<void>;
  setFrameCallback(callback: ((nowMs: number) => void) | null): void;
  render(nowMs: number, pointer: LauncherStrandPointerFrame | null): void;
  resize(width: number, height: number, dpr: number): void;
  pause(): void;
  resume(): void;
  applyQuality(previousIndex: number, nextIndex: number): Promise<void> | void;
  getGpuSample(): { metric: 'queue-latency' | 'timer-query' | 'unavailable'; p95Ms: number | null; pending: boolean };
  dispose(): void;
}

export interface BackendInitialConfig {
  qualityIndex: number;
  activeBlades: number;
  effectiveDpr: number;
  renderScale: number;
  viewport: { width: number; height: number };
}

export interface BackendFactory {
  create(
    canvas: HTMLCanvasElement,
    signal: AbortSignal,
    initialConfig: BackendInitialConfig,
    hooks: { onFatal: (reason: LauncherStrandFallbackReason) => void },
  ): BackendSession;
}
```

`LauncherStrandPointerFrame` is a Three-free value type from `types.ts`:

```ts
export interface LauncherStrandPointerFrame {
  ndcX: number;
  ndcY: number;
  active: boolean;
  released: boolean;
}
```

Tests must assert:

- automatic mode attempts WebGPU on `canvases.webgpu`, then WebGL2 on `canvases.webgl2` exactly once;
- forced WebGL2 never calls the WebGPU factory;
- the coordinator derives `BackendInitialConfig` from the selected backend, pointer capability, current stage size, device DPR, and quality tier, then passes it to `create()` before `initialize()`; the session observes that exact configuration during prewarm and no `-1 -> 0` quality mutation is used as implicit initialization;
- `onReady` occurs only after `initialize()` resolves;
- both failures publish one terminal fallback;
- a running backend's `onFatal('device-lost' | 'context-lost')` stops the loop, disposes the session, restores terminal fallback once, and prevents a late ready/state callback;
- abort before a dynamic import/factory call creates no backend;
- abort during initialization publishes nothing and waits for settlement; a fulfilled session is disposed exactly once, while a rejected session reports that its adapter performed partial cleanup and is never sent through renderer-level disposal;
- repeated controller disposal is idempotent;
- an upgrade from a smaller WebGPU active range awaits `applyQuality()` before diagnostics expose the larger draw count.
- after initialization the session installs exactly one stable Three `setAnimationLoop()` adapter; the coordinator supplies its scheduler through `setFrameCallback()` and never starts a second render rAF chain. Pause clears the adapter callback (no compute/draw), resume restores it, and final disposal is the only event claimed to stop Three's internal animation driver;
- passive pointer/pen and touch listeners subscribe once on `window`, touch-typed Pointer Events are ignored, and teardown removes the exact listeners;
- `ResizeObserver`, `IntersectionObserver`, `visibilitychange`, `pagehide`, `pageshow`, and `blur` update the pure lifecycle state, batch rectangle/size work into one rAF, and publish no callback after disposal.
- ten create/dispose cycles with injected listener and animation-loop counters end with zero live subscriptions, zero loops, and no callback from the first nine generations.

- [ ] **Step 2: Verify coordinator RED**

Run: `npm test -- src/lib/launcher-strands/coordinator.test.ts`

Expected: FAIL because `coordinator.ts` is missing.

- [ ] **Step 3: Implement the coordinator state machine**

Implement the exact state transitions from the spec. The coordinator owns backend selection, the logical 60Hz scheduler callback, metrics, quality decisions, observer/listener teardown hooks, and diagnostics. It passes that callback through `BackendSession.setFrameCallback()` and never owns a second render `requestAnimationFrame` chain; rAF is used only to batch rectangle/resize DOM work. Browser bindings attach passive listeners to `window`, cache the stage rectangle, coalesce every input stream to one `LauncherStrandPointerFrame`, and pass at most that one value to each rendered frame. Resize and scroll refresh the cached rectangle in one rAF; visibility/intersection/pagehide clear the application callback and pageshow restores it only when every gate is eligible. The backend `onFatal` hook is the only post-ready path into terminal device/context fallback. The coordinator accepts factories and browser bindings as dependencies in tests and defaults to the exported factories from `webgpu.ts` and `webgl2.ts` in `runtime.ts`.

Before constructing each candidate backend, derive its initial profile and viewport and pass the complete `BackendInitialConfig` into `factory.create()`. Initialization and health prewarm consume that immutable configuration. Do not call `applyQuality()` for the initial tier. On pause/resume call `setMetricEligibility()`; on resize/backend/quality epoch call `resetMetricWindow()` so paused or stale time cannot enter a later sample.

For this task, each concrete backend module exports a factory whose `create()` returns a session that rejects initialization with its backend-specific initialization failure. That is a valid static-fallback increment and lets the coordinator and shell land before GPU code.

- [ ] **Step 4: Verify coordinator GREEN and all pure tests**

```bash
npm test -- src/lib/launcher-strands
npm run typecheck
```

Expected: all strand unit tests pass; no Three module enters `types.ts`, coordinator tests, or policy modules.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/lib/launcher-strands/coordinator.ts src/lib/launcher-strands/coordinator.test.ts src/lib/launcher-strands/runtime.ts src/lib/launcher-strands/webgpu.ts src/lib/launcher-strands/webgl2.ts
git commit -m "feat: coordinate strand renderer lifecycle"
```

---

### Task 5: Progressive Client Shell, Static Fallback, and Browser Harness

**Files:**
- Create: `src/lib/launcher-strands/enhancement.ts`
- Test: `src/lib/launcher-strands/enhancement.test.ts`
- Modify: `DESIGN.md`
- Modify: `CLAUDE.md`
- Create: `src/components/launcher-backdrop.tsx`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/globals.css`
- Test: `src/app/launcher-background.test.ts`
- Create: `playwright.config.ts`
- Create: `e2e/launcher-strands.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: the server-rendered fallback, two canvases, runtime scheduling gate, DOM state attributes, and a browser test command.
- Consumes: `mountLauncherStrands()` only through a literal dynamic import and imports runtime contracts with `import type`.

- [ ] **Step 1: Verify the tracked fallback artifact**

Run `npm test -- src/app/launcher-background.test.ts` and `sha256sum src/assets/launcher-oasis.webp`. Verify the WebP contract test passes, the file is exactly 235,524 bytes/no larger than 350 KiB, and SHA-256 is `6e5eaa8f68812654c29a65e112bca07c64448705487d22b6e670fbcef7048ca7`. The asset/test pair completed its RED-GREEN cycle before this implementation plan; do not regenerate or copy it. The primary checkout's untracked parallax module and test are not part of the isolated base.

- [ ] **Step 2: Write failing enhancement-gate tests**

Define injected scheduling dependencies and assert:

- reduced motion or Save-Data returns `static` without invoking the importer;
- eligible startup waits one animation frame and then idle callback `{ timeout: 1000 }`;
- absence of `requestIdleCallback` uses one `150ms` timer;
- cleanup cancels rAF, idle callback/timer, aborts an active mount, and ignores a dynamic import that resolves late;
- changing reduced motion to true disposes immediately; changing it back schedules one fresh attempt.

- [ ] **Step 3: Verify RED, implement `enhancement.ts`, and verify GREEN**

Run: `npm test -- src/lib/launcher-strands/enhancement.test.ts`

The module accepts an environment object rather than reading `window`, which keeps Node tests real and deterministic. The React component supplies browser dependencies.

- [ ] **Step 4: Add the browser harness and verify RED before writing the shell**

Add `test:e2e:launcher`. Preflight with `google-chrome --version`; the local and CI contract is a system Chrome channel, and a missing binary is a setup failure resolved with `npx playwright install chrome`, not a silently skipped GPU test. Configure Playwright on `127.0.0.1:3107`, `channel: 'chrome'`, `reuseExistingServer: false`, and two projects named `auto` and `forced-webgl2`. The forced project navigates with `?launcherBackend=webgl2`; the auto project uses the bare URL. The shared server is:

```ts
webServer: {
  command: 'NEXT_PUBLIC_LAUNCHER_TEST_HARNESS=1 npm run dev -- --hostname 127.0.0.1 --port 3107',
  url: 'http://127.0.0.1:3107/vi',
  timeout: 120_000,
  reuseExistingServer: false,
}
```

The forced project launches Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader` so WebGL2 exists without claiming physical GPU performance. The browser test expects the server-rendered fallback, exactly two canvases, usable launcher links, and reduced-motion/Save-Data never changing `data-runtime-requested` to true. Model reduced motion through Playwright's context option. Model Save-Data with `context.addInitScript()` that defines an own, configurable `navigator.connection` value `{ saveData: true }` before application code. The eligible forced-WebGL2 case expects `static-failed` until Task 6 supplies the concrete backend.

Run: `npm run test:e2e:launcher`

Expected: FAIL because the landing page has no backdrop or canvases yet.

- [ ] **Step 5: Record the narrow design exception before animated code lands**

Add one rule to both design documents: only the localized ecosystem landing may run this decorative client-only strand canvas; it remains below the launcher, obeys reduced motion/Save-Data, uses only black/graphite/silver/blue/purple, and does not authorize the deleted generic effects vocabulary elsewhere.

- [ ] **Step 6: Write the shell and landing integration**

`LauncherBackdrop` renders this stable DOM shape:

```tsx
<div
  ref={stageRef}
  aria-hidden="true"
  className="launcher-backdrop"
  data-runtime-state={runtimeState}
  data-runtime-requested={runtimeRequested ? 'true' : 'false'}
  data-backend={readyBackend ?? undefined}
>
  <Image className="launcher-backdrop-fallback" src={launcherOasis} alt="" fill sizes="100vw" placeholder="blur" preload unoptimized draggable={false} />
  <canvas ref={webgpuCanvasRef} className="launcher-strand-canvas" data-canvas-backend="webgpu" />
  <canvas ref={webgl2CanvasRef} className="launcher-strand-canvas" data-canvas-backend="webgl2" />
  <span className="launcher-backdrop-shade" />
</div>
```

After one rAF and idle delay, call the literal import:

```ts
const { mountLauncherStrands } = await import('@/lib/launcher-strands/runtime');
```

Use refs for transient handles and only update React state on lifecycle/backend transitions. Unless `NEXT_PUBLIC_LAUNCHER_TEST_HARNESS === '1'`, always pass `auto` and ignore test queries. An instrumented local build parses `new URLSearchParams(window.location.search)` once and passes `webgl2` when `params.get('launcherBackend') === 'webgl2'`, allowing the independent `launcherTest=1` or `launcherPerf=1` flags to coexist.

Keep `<main>` untransformed, preserve `100dvh`, safe insets and overflow, and place `.launcher-stage-content` above the backdrop. Replace the old parallax CSS with fallback/canvas absolute layers and a 180ms opacity crossfade. Retain the landing-scoped liquid-glass `.launcher-face` override.

- [ ] **Step 7: Run shell verification and commit Task 5**

```bash
npm test -- src/app/launcher-background.test.ts src/lib/launcher-strands/enhancement.test.ts
npm run typecheck
npm run test:e2e:launcher
git add DESIGN.md CLAUDE.md src/components/launcher-backdrop.tsx src/app/[locale]/page.tsx src/app/globals.css src/assets/launcher-oasis.webp src/app/launcher-background.test.ts src/lib/launcher-strands/enhancement.ts src/lib/launcher-strands/enhancement.test.ts playwright.config.ts e2e/launcher-strands.spec.ts package.json package-lock.json
git commit -m "feat: add progressive strand launcher shell"
```

---

### Task 6: Shared Field and WebGL2 Analytical Backend

**Files:**
- Create: `src/lib/launcher-strands/r185-adapter.ts`
- Create: `src/lib/launcher-strands/palette.ts`
- Test: `src/lib/launcher-strands/palette.test.ts`
- Create: `src/lib/launcher-strands/health.ts`
- Test: `src/lib/launcher-strands/health.test.ts`
- Create: `src/lib/launcher-strands/field.ts`
- Create: `src/lib/launcher-strands/browser-test-driver.ts`
- Modify: `src/lib/launcher-strands/webgl2.ts`
- Test: `src/lib/launcher-strands/webgl2.test.ts`
- Modify: `e2e/launcher-strands.spec.ts`

**Interfaces:**
- Produces: `createFieldScene()`, `validateHealthPixels()`, `createWebGl2BackendFactory()`, and all r185 runtime narrowings.
- Consumes: distribution, input ring, quality profiles, and `BackendSession`.

- [ ] **Step 1: Write failing palette and health tests**

The palette is numeric normalized RGB, not raw hex or Tailwind colors. Assert graphite is the darkest stop, silver has low channel spread, blue has `b > r`, purple has `b > g`, and every channel is in `[0, 1]`.

For a 32×32 RGBA buffer, assert `validateHealthPixels()` fails all-zero alpha, fewer than eight alpha-above-16 pixels, a central collapsed cluster, a bounding box narrower than 8×6, or occupancy in fewer than two of four bins on either axis. A hand-built buffer with occupied pixels across three x bins and two y bins passes.

- [ ] **Step 2: Verify RED, implement palette/health, and verify GREEN**

```bash
npm test -- src/lib/launcher-strands/palette.test.ts src/lib/launcher-strands/health.test.ts
```

`validateHealthPixels(pixels, 32, 32)` returns a discriminated result with pixel count, occupied bounds, x/y bin counts, and a stable failure code for diagnostics.

- [ ] **Step 3: Write failing WebGL unit and browser tests**

Assert exact constructor options, `forceWebGL: true`, compile-before-first-render, `debug.onShaderError` turning any invocation into initialization rejection, lost-context rejection after render, one health readback, and idempotent resource disposal. The facade mirrors every used r185 field rather than accepting arbitrary calls.

With a strict fake `EXT_disjoint_timer_query_webgl2`, assert one asynchronous query starts every tenth submitted render when none is pending, absence of the extension reports `unavailable`, an available result records GPU duration, `GPU_DISJOINT_EXT` discards the sample, and pause/resize/backend/quality/fallback/disposal deletes the pending query and prevents its stale epoch from writing state.

Replace the Task 5 eligible-case `static-failed` expectation with:

```ts
await expect(backdrop).toHaveAttribute('data-runtime-state', 'running');
await expect(backdrop).toHaveAttribute('data-backend', 'webgl2');
await expect(page.locator('canvas[data-canvas-backend="webgl2"]')).toBeVisible();
```

Also specify a figure-eight pointer path, scrolling in a mobile coarse-pointer context, Wiki activation/fixed-back click, and `WEBGL_lose_context` returning to terminal `static-failed` with the fallback visible.

For deterministic deformation coverage, navigate in non-production with both `launcherBackend=webgl2` and `launcherTest=1`. That exact test mode freezes wind/time, disables the automatic loop, and exposes `window.__COLORLAB_STRANDS_TEST__` with `setPointer(ndcX, ndcY, active)`, `step(frameCount, deltaMs)`, and `captureInteractionMap(): Promise<number[]>`. A capture is an 8×8 luma/alpha aggregate produced from a test-only 32×32 readback; the global and extra readbacks do not exist when the query is absent or in production.

The browser assertion captures baseline, applies a centered pointer for two 16.667ms steps, and captures deformation. The sum of absolute differences in the central 2×2 bins must exceed `20`; the four corner-bin sum must be at most `4`. After release and 30 more fixed steps, central difference from baseline must be less than half the deformed difference. This fails if the shader renders but ignores pointer input.

Run:

```bash
npm test -- src/lib/launcher-strands/webgl2.test.ts
npm run test:e2e:launcher
```

The deformation URLs above are valid only in a local harness build (`NEXT_PUBLIC_LAUNCHER_TEST_HARNESS=1`). The global and extra readbacks do not exist without both that build flag and `launcherTest=1`, including normal production deployments.

Expected: both commands FAIL because the concrete WebGL2 backend is still unavailable.

- [ ] **Step 4: Implement the r185 adapter and shared field**

Keep all missing declaration casts in `r185-adapter.ts`: backend flags/device/context, object-shaped `onError`, `EXT_disjoint_timer_query_webgl2`, and `navigator.connection.saveData`. Do not use runtime-missing `ComputeNode.setCount()` or `waitForGPU()`.

Build one five-segment two-sided blade geometry rooted at y=0, deterministic instance attributes from Task 1, perspective camera, fog, and a TSL material with tip-weighted bend. The WebGL material analytically combines wind with the fixed six-slot ring. A shared pointer projector consumes the latest NDC value and performs exactly one camera-ray/y=0-plane intersection per rendered frame, never one raycast per strand. `browser-test-driver.ts` is compiled into the deferred runtime chunk only and installs its global exclusively under the non-production test query. Use no post-processing, shadow, MSAA, or per-frame object creation.

- [ ] **Step 5: Implement the concrete WebGL2 session**

Harness compilation is controlled by `NEXT_PUBLIC_LAUNCHER_TEST_HARNESS=1`, not by `NODE_ENV`. `browser-test-driver.ts` installs its global only when the public flag is present and `launcherTest=1`; normal Vercel builds omit the flag and compiler-prune the branch.

Construct `WebGPURenderer` with the exact spec options, install the shader-error latch before compile, initialize/compile, render the field once, check context loss, and publish success only after health validation. Resize reuses renderer/canvas; quality changes update `mesh.count` and effective DPR without rebuilding geometry. Sparse `EXT_disjoint_timer_query_webgl2` probes carry `probeEpoch` and delete stale queries.

- [ ] **Step 6: Verify the real WebGL2 unit and browser behavior is GREEN**

Run the unit test and browser scenario written in Step 3. Confirm the eligible case now reaches `running/webgl2`, pointer/touch interactions leave navigation usable, and forced context loss restores the fallback.

- [ ] **Step 7: Run and commit Task 6**

```bash
npm test -- src/lib/launcher-strands/palette.test.ts src/lib/launcher-strands/health.test.ts src/lib/launcher-strands/webgl2.test.ts
npm run typecheck
npm run test:e2e:launcher
git add src/lib/launcher-strands/r185-adapter.ts src/lib/launcher-strands/palette.ts src/lib/launcher-strands/palette.test.ts src/lib/launcher-strands/health.ts src/lib/launcher-strands/health.test.ts src/lib/launcher-strands/field.ts src/lib/launcher-strands/browser-test-driver.ts src/lib/launcher-strands/webgl2.ts src/lib/launcher-strands/webgl2.test.ts e2e/launcher-strands.spec.ts
git commit -m "feat: render interactive strands with webgl2"
```

---

### Task 7: WebGPU Compute Backend, Fences, and GPU Pressure Probes

**Files:**
- Create: `src/lib/launcher-strands/gpu-fence.ts`
- Test: `src/lib/launcher-strands/gpu-fence.test.ts`
- Create: `src/lib/launcher-strands/gpu-probes.ts`
- Test: `src/lib/launcher-strands/gpu-probes.test.ts`
- Create: `src/lib/launcher-strands/performance-harness.ts`
- Modify: `src/lib/launcher-strands/field.ts`
- Modify: `src/lib/launcher-strands/webgpu.ts`
- Test: `src/lib/launcher-strands/webgpu.test.ts`
- Modify: `src/lib/launcher-strands/runtime.ts`
- Modify: `e2e/launcher-strands.spec.ts`
- Create: `e2e/launcher-strands.perf.spec.ts`
- Create: `playwright.performance.config.ts`
- Create: `scripts/run-launcher-performance.mjs`
- Create: `scripts/run-launcher-android-performance.mjs`
- Create: `scripts/analyze-launcher-perfetto.mjs`
- Create: `scripts/analyze-launcher-safari.mjs`
- Create: `scripts/launcher-perfetto-config.pbtxt`
- Create: `scripts/launcher-perfetto.sql`

**Interfaces:**
- Produces: `runGpuFence()`, `createQueueProbe()`, and `createWebGpuBackendFactory()`.
- Consumes: shared field, health validator, quality controller, probe epoch, coordinator backend interface.

- [ ] **Step 1: Write failing error-scope and queue-probe tests**

With a strict fake `GPUDevice`, require this sequence for each batch:

```text
push validation -> push out-of-memory -> submit -> onSubmittedWorkDone
-> pop out-of-memory -> pop validation
```

Assert both scopes are balanced once on success, submission throw, queue rejection, abort, and device loss. Assert the second batch creates a fresh pair. Queue probes sample every tenth submitted frame, report pending backlog at the next probe point, and make no state write after epoch invalidation/disposal.

- [ ] **Step 2: Verify fence/probe RED, implement, and verify GREEN**

```bash
npm test -- src/lib/launcher-strands/gpu-fence.test.ts src/lib/launcher-strands/gpu-probes.test.ts
```

- [ ] **Step 3: Write failing WebGPU prewarm tests**

The renderer/device facade must prove:

- `init()` completes and `backend.isWebGPUBackend === true` before compute;
- `renderer.onError` and `renderer.onDeviceLost` are installed before the first `init()` call;
- the callback-error latch is monotonic from before `init()` through readiness: a separately injected error during `init()` or during `compileAsync()` fails prewarm and is never cleared;
- automatic Three fallback is rejected;
- `compileAsync()` precedes the first fenced init/update/hidden render;
- init dispatches the full `BLADE_CAPACITY` even from a smaller initial tier, while update dispatches only `activeCount`; stable attributes, bend state, and readiness use separate maximum-capacity storage nodes; init readiness starts at zero and update compute sets it to one;
- counts not divisible by the workgroup size (including 18,000 and 54,000) cannot write past the intended prefix: the compute node's own count/guard and the renderer dispatch override agree, and range reset guards `localIndex < newCount - oldCount` before adding `oldCount`;
- the 32×32 actual field readback uses the five-argument r185 signature and passes `validateHealthPixels()`;
- health target disposal precedes a second update/real-canvas render in a fresh fence;
- `onReady` cannot fire after a callback error, scoped error, device loss, failed spatial health, or abort;
- a quality upgrade resets only `[oldCount, newCount)`, warms through `newCount`, then raises draw count;
- abort during pending `init()` consumes settlement without calling early `renderer.dispose()`; fulfilled init uses one normal disposal, while rejected init invokes the adapter's direct partial-backend cleanup, removes acquired listeners/resources, and never re-enters `init()` or leaks an unhandled rejection.

- [ ] **Step 4: Implement the concrete compute backend**

Allocate separate maximum-capacity storage nodes for stable attributes, persistent bend state, and readiness. Initialization compute dispatches `BLADE_CAPACITY` and writes deterministic position/attributes plus readiness zero for every possible tier. Update compute applies wind, two-radius pointer force, fast attack/slow recovery, and readiness one only through `activeCount`. In pinned r185 the `renderer.compute(node, count)` override changes dispatch size but the shader's implicit guard reads `ComputeNode.count`; synchronize both counts or provide an explicit uniform/index guard. Range reset must guard the local range index before adding its base offset. Never call nonexistent `setCount()`.

Prewarm follows the exact seven-step sequence in the spec. Use `RenderTarget(32, 32, { type: UnsignedByteType, samples: 0, stencilBuffer: false })` and:

```ts
const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 32, 32);
```

Dispose storage node values, compute nodes, material, geometry, target, renderer, and device-owned resources exactly once.

- [ ] **Step 5: Integrate automatic selection and a conditional WebGPU browser smoke**

The `auto` Playwright project first uses the bare URL for backend-selection smoke. When Chrome reports a real WebGPU backend, the test requires `running/webgpu`; when it does not, it requires `running/webgl2`. The test never treats `navigator.gpu` alone as proof of the selected backend. Forced-WebGL2 coverage from Task 6 remains unconditional. A second auto navigation uses `?launcherTest=1`; if auto selected WebGPU there, repeat Task 6's frozen pointer/readback deformation sequence through the installed driver. If auto selected WebGL2, record the conditional WebGPU deformation check as unavailable rather than pretending it ran.

Extend the browser suite to switch reduced motion on and off after mount, hide/resume the page through injected visibility bindings, resize the viewport, and navigate launcher-away-launcher ten times. After every return there are exactly two React-owned canvases, no stale generation changes the current root state, no console error appears, and the resumed timing window starts fresh. Task 4's injected counters remain the authoritative listener/loop leak assertion.

- [ ] **Step 6: Add the reproducible 30-second performance driver**

`performance-harness.ts` is compiled and installs `window.__COLORLAB_STRANDS_PERF__.run()` only when `NEXT_PUBLIC_LAUNCHER_TEST_HARNESS=1` and `?launcherPerf=1` are both present. `run()` waits five excluded warmup seconds, calls `performance.mark('launcher-strands-start')`, drives a deterministic figure-eight across the central 60% for exactly 20 seconds through the same latest-pointer path as input, releases for exactly 10 seconds, marks the end, and creates exactly one `performance.measure('launcher-strands-measure', 'launcher-strands-start', 'launcher-strands-end')`. It returns the final diagnostics plus actual `visualViewport`, DPR, backend, and run timestamps.

`playwright.performance.config.ts` is separate from the dev E2E config. It serves the already-built instrumented production app on port 3108 with `npm run start -- --hostname 127.0.0.1 --port 3108`, and defines `auto` and `forced-webgl2` Chrome projects with the same backend semantics as functional E2E. The Playwright perf spec is skipped unless `LAUNCHER_PHYSICAL_PROFILE` equals `D1`, `M1`, `M1-WGL`, or `M2` and `LAUNCHER_PERF_RUN` equals `1`, `2`, or `3`. When enabled it navigates with `launcherPerf=1`, calls `run()`, asserts the measure duration is between `29_900` and `30_100ms`, asserts runtime submission fps >=57, miss ratio <=0.05, submit p95 <=12ms, and no terminal fallback, then writes a uniquely named diagnostics JSON artifact containing profile and run number.

`scripts/run-launcher-performance.mjs D1` is intentionally desktop-only. It executes the local `auto` perf spec serially for `LAUNCHER_PERF_RUN=1,2,3`, exits nonzero if any run fails, and writes a manifest with the three artifact paths and median runtime metrics while preserving each run so a failed run can never be hidden by the median. Its D1 workflow is:

```bash
NEXT_PUBLIC_LAUNCHER_TEST_HARNESS=1 npm run build
node scripts/run-launcher-performance.mjs D1
```

The runner prints the exact external-profiler capture command before every run and requires the corresponding raw artifact path in its manifest. `scripts/launcher-perfetto-config.pbtxt` enables Chrome FrameReporter2, Graphics.Pipeline, `blink.user_timing`, and `filter_dynamic_event_names: false`. `scripts/launcher-perfetto.sql` is the exact query from the spec plus a preflight that requires exactly one 29.9-30.1s process slice and reports renderer `upid` and duration. `scripts/analyze-launcher-perfetto.mjs <trace1> <trace2> <trace3>` invokes `trace_processor_shell`, saves each query output, rejects missing/ambiguous measures or any profiler fps below 57, and emits a three-run summary. `scripts/analyze-launcher-safari.mjs <csv1> <csv2> <csv3>` requires ordered `RenderingFrameTimelineRecord` start times plus measure bounds, recomputes `N / seconds`, rejects any run below 57, and emits the same summary shape. Both analyzers require exactly three raw inputs and fail on one failed run.

M1/M1-WGL use `scripts/run-launcher-android-performance.mjs M1|M1-WGL`, not the desktop Playwright runner. The script verifies exactly one `adb` device whose model is Pixel 7, runs `adb reverse tcp:3108 tcp:3108`, launches instrumented Chrome at `http://127.0.0.1:3108/vi?launcherPerf=1` (adding `launcherBackend=webgl2` for M1-WGL), connects to that tab through Chrome DevTools Protocol, and for each of three serial runs starts/stops the supplied Perfetto config on-device, invokes the page's `run()`, saves its returned diagnostics, pulls the `.pftrace`, and finally invokes the three-trace analyzer. The app must be built with the public harness flag and served separately with `npm run start -- --hostname 0.0.0.0 --port 3108`; the script refuses an emulated/non-Pixel model and refuses missing raw traces.

M2 is a physical/manual Safari workflow because Linux cannot drive iOS Web Inspector: serve the same instrumented production build on `0.0.0.0:3108`, open the LAN URL `http://<host-ip>:3108/vi?launcherPerf=1` on the iPhone 13, connect macOS Safari Web Inspector, start a Rendering Frames recording, invoke the harness `run()` from the inspected page, stop/export immediately after resolution, and repeat from a fresh recording until exactly three timeline exports and three diagnostics JSON results exist. Convert each export to the ordered CSV schema required by `scripts/analyze-launcher-safari.mjs`, then run that analyzer on exactly three inputs. Record the host IP, browser/device versions, exported timelines, JSON, and analyzer output. If the named device, macOS Web Inspector host, or profiler CLI is absent, do not substitute emulation: record `not-run — named physical device unavailable`.

- [ ] **Step 7: Run and commit Task 7**

```bash
npm test -- src/lib/launcher-strands/gpu-fence.test.ts src/lib/launcher-strands/gpu-probes.test.ts src/lib/launcher-strands/webgpu.test.ts src/lib/launcher-strands/coordinator.test.ts
npm run typecheck
npm run test:e2e:launcher
git add src/lib/launcher-strands/gpu-fence.ts src/lib/launcher-strands/gpu-fence.test.ts src/lib/launcher-strands/gpu-probes.ts src/lib/launcher-strands/gpu-probes.test.ts src/lib/launcher-strands/performance-harness.ts src/lib/launcher-strands/field.ts src/lib/launcher-strands/webgpu.ts src/lib/launcher-strands/webgpu.test.ts src/lib/launcher-strands/runtime.ts e2e/launcher-strands.spec.ts e2e/launcher-strands.perf.spec.ts playwright.performance.config.ts scripts/run-launcher-performance.mjs scripts/run-launcher-android-performance.mjs scripts/analyze-launcher-perfetto.mjs scripts/analyze-launcher-safari.mjs scripts/launcher-perfetto-config.pbtxt scripts/launcher-perfetto.sql
git commit -m "feat: add webgpu strand simulation"
```

---

### Task 8: Design Exception, Bundle Evidence, Full Verification, and Preview

**Files:**
- Create: `docs/superpowers/verification/2026-08-17-interactive-strands.md`

**Interfaces:**
- Produces: durable design-system scope, reproducible evidence, production build, and localhost preview.
- Consumes: all prior tasks.

- [ ] **Step 1: Create the evidence document without unsupported claims**

Record dependency versions, Three's retained MIT license, build hash, route, Chrome version, GPU/backend, viewport, DPR, active blades, render scale, runtime metrics, browser test results, context-loss fallback, reduced-motion/Save-Data result, and bundle analysis. Include D1, M1, M1-WGL, and M2 tables; use `not-run — named physical device unavailable` for any uncaptured profile. For every captured Chrome profile retain the exact trace config, raw `.pftrace`, Perfetto SQL, selected renderer `upid`, query output, and measure duration; for Safari retain the exported Rendering Frames timeline and ordered frame CSV.

- [ ] **Step 2: Run the design audit and fix only feature-introduced hits**

Run all eight `DESIGN.md` audit commands. Compare hits to the merge base and change only lines introduced by this branch. Do not edit unrelated user files to make an existing hit disappear. If a feature-introduced hit requires a source correction, run its focused tests, stage only `src/lib/launcher-strands/`, `src/components/launcher-backdrop.tsx`, `src/app/[locale]/page.tsx`, `src/app/globals.css`, `DESIGN.md`, or `CLAUDE.md` as applicable, and commit that correction separately as `fix: align strand launcher with design system` before creating the evidence commit.

- [ ] **Step 3: Run full automated verification**

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e:launcher
npm run build
npm run verify
git diff --check
```

Expected: every command exits 0 with no new warning attributable to the feature.

- [ ] **Step 4: Prove bundle separation from production artifacts**

Run:

```bash
npx next experimental-analyze --output
```

Inspect `.next/diagnostics/analyze` by route. Record the generated artifact path and confirm the initial/shared client graph and non-landing routes contain no `three`, `three/webgpu`, `three/tsl`, `field.ts`, `webgpu.ts`, or `webgl2.ts`; they may appear only in the landing runtime's deferred client chunk.

- [ ] **Step 5: Verify the real localhost flow**

Start `npm run dev` from the implementation worktree and use the in-app browser at `/vi`. Check fallback-first load, local strand deformation under mouse, coarse/touch emulation scrolling, Wiki fixed back button, reduced motion, resize, hidden/resume, and no console/hydration errors. Capture a screenshot for the evidence document.

- [ ] **Step 6: Commit Task 8**

```bash
git add docs/superpowers/verification/2026-08-17-interactive-strands.md
git commit -m "docs: verify interactive strand launcher"
```

- [ ] **Step 7: Request whole-branch review**

Review the complete merge-base-to-HEAD diff for spec compliance, shader/runtime correctness, cleanup, accessibility, initial bundle isolation, design-system scope, and preservation of unrelated dirty work. Resolve Critical/Important findings through the SDD fix loop, then rerun the complete verification commands before presenting branch-finishing options.
