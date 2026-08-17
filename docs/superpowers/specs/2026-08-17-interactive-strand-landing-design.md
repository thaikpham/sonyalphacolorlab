# Interactive Strand Landing Background Design

**Date:** 2026-08-17

**Status:** Approved for implementation; r185.1 API audit incorporated

**Scope:** Alpha ColorLab localized launcher landing page only

## 1. Context and Evidence

The current launcher background is a dark WebP with whole-image pointer
parallax. That implementation does not meet the clarified requirement. The
background must be a real-time 3D field in which individual strands bend away
from a mouse or finger and recover, while the four launcher apps remain usable
above it.

The behavioral references are:

- the supplied screencast
  `/home/thaikpham/Videos/Screencasts/Screencast From 2026-08-17 14-30-10.webm`;
- the downloaded Omma export at
  `/home/thaikpham/Downloads/vary-vary-3d-website-the-digit/index.html`;
- the approved dark visual direction: black, graphite, silver, electric blue,
  cobalt, violet, and purple strands below liquid-glass launcher tiles.

The Omma export confirms that the reference is not image parallax. It renders
120,000 instanced five-segment blades, stores bend state on the GPU, raycasts
the pointer once to the field plane, and lets every blade compute its own
distance-based response. Its inner and outer radial forces produce the visible
crater around the pointer, while fast attack and slower recovery give the
field its elastic character.

The export is a useful behavior study, not production code. It is a single
2,519-line HTML file built for an older Three.js API, its package manifest omits
Three.js, and it lacks touch input, adaptive quality, cleanup, reduced-motion,
context-loss handling, and a non-GPU fallback. Its camera-on-scroll sequence,
depth-of-field pass, editor, branding, copy, and 120,000-blade default are not
part of this design.

## 2. Goals

1. Render genuinely independent strands, not a displaced photograph or a flat
   shader texture.
2. Make the field respond locally to mouse hover on desktop and finger drag on
   touch devices.
3. Target 60 frames per second on both desktop and mobile by adapting visual
   density and internal render resolution to the device and measured frame
   time.
4. Preserve launcher navigation, touch scrolling, safe areas, keyboard focus,
   the Wiki subview's fixed back button, and the existing liquid-glass faces.
5. Keep the localized page server-rendered and keep Three.js out of the initial
   landing JavaScript chunk.
6. Fail silently to the approved dark static artwork when motion is unwanted
   or real-time rendering cannot be sustained.
7. Add no Vercel Function, Image Optimization transformation, database read,
   or other server-side cost per frame or interaction.

## 3. Non-goals

- No copy of the Omma page, Abyssal branding, editor, settings panel, camera
  scroll story, or page content.
- No React Three Fiber, Drei, physics engine, video background, remote runtime
  dependency, post-processing, bloom, or depth of field.
- No strand-to-strand collision or physically exact hair simulation.
- No promise that unknown or thermally throttled hardware can hold 60fps at a
  fixed visual quality. The contract is to prioritize 60fps by reducing quality
  and to use the static fallback when the minimum tier remains unstable.
- No change to the shared launcher grid component, because it is also used in
  the site-header launcher.

## 4. Chosen Architecture

The landing page remains a Server Component. A small Client Component owns the
progressive enhancement boundary and dynamically loads an imperative Three.js
runtime only after capability and preference checks pass.

```text
src/app/[locale]/page.tsx (Server Component)
  |
  +-- LauncherBackdrop (small client shell)
  |     |
  |     +-- fingerprinted WebP fallback (always rendered underneath)
  |     +-- two React-owned canvases, one per backend attempt
  |     |     (both transparent until a successful first frame)
  |     +-- preference/capability/visibility gates
  |            |
  |            +-- import("launcher-strand-runtime") after initial paint
  |                    |
  |                    +-- WebGPU compute path
  |                    +-- WebGL2 analytic path
  |                    +-- adaptive quality controller
  |
  +-- LauncherGrid (existing content layer, unchanged)
```

`LauncherBackdrop` must not statically import Three.js. Its effect waits for one
animation frame, then uses `requestIdleCallback({ timeout: 1000 })`; browsers
without that API use a 150ms timer. Only then does it dynamically import the
runtime. This keeps HTML, the fallback image, and the four launcher actions
available before the 3D chunk is downloaded or compiled.

The runtime mounts into a canvas supplied by React; it never appends to
`document.body`. The public boundary is deliberately small:

```ts
type LauncherStrandRuntimeOptions = {
  canvases: {
    webgpu: HTMLCanvasElement;
    webgl2: HTMLCanvasElement;
  };
  stage: HTMLElement;
  signal: AbortSignal;
  backendPreference: 'auto' | 'webgl2';
  onReady: (backend: 'webgpu' | 'webgl2') => void;
  onFallback: (reason: LauncherStrandFallbackReason) => void;
};

type LauncherStrandDiagnostics = {
  state: LauncherStrandState;
  backend: 'webgpu' | 'webgl2' | null;
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
};

type LauncherStrandController = {
  dispose: () => void;
  getDiagnostics: () => LauncherStrandDiagnostics;
};

async function mountLauncherStrands(
  options: LauncherStrandRuntimeOptions,
): Promise<LauncherStrandController>;
```

Production always passes `backendPreference: 'auto'`; the explicit WebGL2 value
is a deterministic browser-test seam. The shell owns asynchronous cancellation
and visual readiness. The runtime owns the renderer, scene, geometry,
GPU/instance buffers, input sampling, observers, animation loop, adaptive
quality, diagnostics, and disposal.

`stage` is the shell's own full-inset backdrop root, obtained from a React ref;
it is not the Server Component's `<main>` and requires no ref to cross the
Server/Client boundary. The root supplies bounds only. Passive input listeners
attach to `window`, so `pointer-events: none` cannot prevent observation.

Three.js and its type package are pinned to the same exact tested release,
`0.185.1`, in both `package.json` and the lockfile. Imports use the package
subpaths `three/webgpu` and `three/tsl`; no CDN or runtime URL import is allowed.

## 5. Rendering Model

### 5.1 Shared scene

Both GPU paths render an `InstancedMesh` of original five-segment, two-sided
blade geometry. Each instance has a stable field position, rotation, height,
width, phase, cluster value, and palette value. A deterministic seed makes the
same tier visually stable across reloads and makes lower active counts retain
even spatial coverage. Instance order follows a two-dimensional R2
low-discrepancy sequence mapped from the unit square to the field disk; seeded
hash noise then perturbs position and attributes without reordering. Every
active prefix therefore spans the whole field instead of trimming one edge.

The blade vertex deformation is weighted toward the tip so roots stay planted.
Length normalization prevents stretched blades. Layered low-frequency wind
adds continuous motion without obscuring pointer response. The material is a
TSL node material with a graphite root, silver midtone, and controlled blue or
purple tip variation. Fog and a fixed perspective camera create depth without
a post-processing pass.

The canvas itself is transparent over the dark stage. No warm white, yellow,
green, or red highlight is introduced. Silver is a cool metallic grey, not a
white page wash. The launcher labels continue to meet the design system's rule
that text is lighter than its ground.

Both renderer attempts explicitly use `alpha: true`, `antialias: false`,
`samples: 0`, `stencil: false`, and `outputBufferType: UnsignedByteType`.
Depth remains enabled for the field geometry. These values avoid an implicit
multisample or half-float framebuffer cost that would invalidate the pixel
budget. No renderer default may silently replace them.

### 5.2 WebGPU compute path

When WebGPU initialization succeeds, separate maximum-capacity storage buffers
hold stable per-blade attributes, persistent bend state, and readiness; one
`vec4` array is not overloaded with all three responsibilities. Readiness starts
at zero, the update compute pass sets it to one, and the actual field material
multiplies opacity by readiness. One initialization compute pass always
dispatches the full maximum blade capacity so a later tier upgrade never exposes
zeroed stable attributes. Per-frame update dispatches only the active prefix,
followed by one instanced draw.

Every active blade combines:

- two low-frequency wind fields;
- a strong inner radial pointer force;
- a softer, wider outer radial force;
- quadratic falloff based on its own distance to the pointer;
- fast interpolation toward applied force and slower interpolation back to its
  resting state.

This preserves the reference's local crater, immediate split, and elastic
recovery while using an original scene, palette, camera, and implementation.

The compute attempt uses the dedicated `webgpu` canvas. Before `init()`, it
installs `renderer.onError` and `renderer.onDeviceLost`. After `init()`, it
checks the actual pinned-r185 backend flag rather than inferring support from
`navigator.gpu`; an automatic Three.js fallback to WebGL2 is not accepted as a
compute backend. Prewarm then performs this exact r185-compatible sequence:

1. `await renderer.compileAsync(scene, camera)`;
2. obtain the verified backend's `GPUDevice` while preserving the monotonic callback-error latch installed before `init()`; the latch is never cleared before readiness, so errors from init, compile, compute, or render all fail the attempt;
3. use one fenced-batch helper to push `validation` and then `out-of-memory`
   scopes, synchronously submit init compute, update compute, and a hidden
   render, await `device.queue.onSubmittedWorkDone()`, then pop
   `out-of-memory` and `validation` in LIFO order;
4. balance both scopes in the helper's `finally` path even after abort or
   device loss, and await one macrotask so Three's internal pipeline error
   promises and renderer callbacks can settle;
5. render the actual field/material/camera to a temporary 32x32 transparent
   render target and read it once with `readRenderTargetPixelsAsync()`. Require
   at least eight ready-gated pixels with alpha above 16, an occupied bounding
   box at least eight pixels wide and six pixels high, and occupancy in at least
   two of four equal bins on each axis; a failed compute pass leaves readiness
   at zero, while a failed distribution pass collapses coverage and fails the
   spatial check. An r185 render-pipeline failure that `compileAsync()`
   internally consumes likewise cannot appear “ready” with a skipped draw;
6. dispose the health target, submit a second update plus the real canvas
   render through a fresh fenced-batch scope pair; no scope is reused or popped
   twice;
7. publish readiness only if the health pixels passed, both fences returned no
   scoped error, no error/device-loss callback fired, and the mount was not
   aborted.

The pinned r185 API has no `compileComputeAsync()`, and its `computeAsync()`
resolves after submission rather than proving GPU completion, so neither is
treated as a readiness fence. The steady loop uses synchronous `compute()`.
The removed `waitForGPU()` API is not used. The 32x32 health readback is the only
startup pixel readback and is excluded from performance samples. Late
asynchronous backend errors still trigger the normal static-fallback path.

The small r185 adapter is the only module allowed to narrow backend properties
missing from `@types/three`, normalize the runtime object-shaped `onError`
payload, expose the verified `GPUDevice`/WebGL2 context, and define the timer
query and `navigator.connection` structural types. Version-sensitive casts do
not spread through the shell or policy modules.

### 5.3 WebGL2 analytic path

WebGL2 is a first-class interactive fallback, especially for mobile browsers
without WebGPU. It uses the dedicated `webgl2` canvas with
`WebGPURenderer({ forceWebGL: true })` and the same TSL node material, but does
not depend on storage-buffer compute. Each blade derives its deformation
analytically in the vertex stage from its stable instance data, wind, the
current pointer field, and a fixed six-slot age-weighted pointer ring. The ring
is a uniform array and its loop is statically bounded at six iterations.

Before `compileAsync()`, the WebGL attempt installs
`renderer.debug.onShaderError`; any invocation makes initialization fail. After
the first render it also checks that the WebGL2 context is not lost. This is a
required readiness latch because r185 can log a shader link failure and skip the
draw without rejecting the compile promise.

At most one world-space sample is processed per rendered frame. While contact
is active, movement of at least 0.12 field units and at least 33ms since the
previous insertion advances the ring; otherwise the newest slot is updated in
place. A held finger refreshes that slot so the crater stays open. On movement
or release, older slots decay with `2^(-age / 320ms)` and are zeroed at 900ms.
The summed field is clamped before deformation. This produces immediate attack,
a short trail, and bounded elastic recovery without per-blade state or an
unbounded vertex-shader loop.

If WebGPU device creation, backend verification, or compute prewarm fails, the
runtime attempts the WebGL2 analytic path once on the second, still-unbound
canvas. When renderer initialization fulfilled, failure cleanup uses one normal
`renderer.dispose()`; when `init()` rejected, the adapter performs direct
partial-backend cleanup and never calls `renderer.dispose()` or
`setAnimationLoop()`, both of which can re-enter initialization in r185. A
canvas that has acquired `webgpu` is never reused for `webgl2`. If WebGL2
initialization or its first frame also fails, the shell keeps the WebP fallback.
This explicit second path avoids assuming that every compute feature is portable
merely because Three.js can select a WebGL2 backend.

## 6. Pointer and Touch Interaction

The browser performs one camera-to-field-plane intersection for the latest
input point. It never raycasts against individual strands. The resulting world
coordinate is passed to the shader or compute update, where blades calculate
their own radial response.

Passive listeners attach to `window`, but samples are accepted only while their
client coordinates lie within the cached full-inset stage rectangle. Crossing
that boundary releases the field. Input uses native Pointer Events for mouse
and pen. Touch input uses passive Touch Events and ignores touch-typed Pointer
Events, so a hybrid browser never records the same contact through both event
families. This lets natural page scrolling remain available while the field
follows a finger.

Only the first active touch identifier owns the field; additional fingers are
ignored until that identifier ends. `touchend`, `touchcancel`, lost identifier,
window blur, and page hiding all clear ownership immediately. A WebGL2 pointer
slot is refreshed as “held” only while that exact identifier is still present,
so an OS-cancelled gesture cannot leave a permanent crater.

Event handlers only overwrite the latest client coordinate and active/released
flag; they do not read layout, raycast, allocate samples, or update the GPU. The
stage rectangle is cached and refreshed in one animation frame after resize or
scroll. Once per rendered frame, the runtime consumes the latest coordinate,
clamps it to that cached rectangle, converts it to normalized device
coordinates, and performs at most one field-plane raycast. High-frequency
pointer, pen, and touch streams are therefore coalesced to the 60Hz render
budget.

The canvas remains `pointer-events: none`. Listeners never call
`preventDefault()`, capture the pointer, or place an interactive layer above
the launcher. Tile clicks, keyboard activation, vertical scroll, browser edge
gestures, and the fixed Wiki back button therefore retain priority. Pointer
leave, pointer cancel, touch end, window blur, and page hiding release the
interaction field so strands recover instead of remaining pinned.

## 7. 60fps Quality Policy

All interactive tiers target the display's 60Hz cadence; there is no 30fps or
45fps cap. Initial quality is chosen by capabilities, pointer type, viewport
area, and backend rather than user-agent sniffing. A device is classified as
coarse-capable when `(any-pointer: coarse)` matches, even if it also has a
mouse; this conservative rule prevents a hybrid touchscreen from starting at
the desktop allocation.

| Initial tier | Active blades | DPR cap | Pixel budget | Target |
|---|---:|---:|---:|---:|
| WebGPU + fine pointer | 72,000 | 1.30 | 3.2 MP | 60fps |
| WebGPU + coarse pointer | 24,000 | 1.00 | 1.2 MP | 60fps |
| WebGL2 + fine pointer | 36,000 | 1.10 | 1.8 MP | 60fps |
| WebGL2 + coarse pointer | 16,000 | 0.90 | 0.9 MP | 60fps |

Effective DPR is bounded by both the tier and the physical work budget:

```text
min(devicePixelRatio, tierDprCap, sqrt(pixelBudget / (cssWidth * cssHeight)))
```

Render scale multiplies that effective DPR. Each backend/pointer combination has
an exact ordered ladder; downgrade moves right and upgrade moves left:

| Tier | Ordered `(active blades @ render scale)` ladder |
|---|---|
| WebGPU + fine | `72k@1.00`, `72k@0.85`, `72k@0.70`, `54k@0.70`, `36k@0.70`, `24k@0.65`, `16k@0.65` |
| WebGPU + coarse | `24k@1.00`, `24k@0.85`, `24k@0.70`, `18k@0.70`, `12k@0.70`, `8k@0.65` |
| WebGL2 + fine | `36k@1.00`, `36k@0.85`, `36k@0.70`, `28k@0.70`, `20k@0.70`, `12k@0.65` |
| WebGL2 + coarse | `16k@1.00`, `16k@0.85`, `16k@0.70`, `12k@0.70`, `8k@0.70`, `6k@0.65` |

Each initialized renderer calls `setAnimationLoop()` exactly once with a stable
adapter callback; the coordinator supplies or clears the adapter's current
application-frame callback and never starts a second render `requestAnimationFrame`
chain. A 90Hz or 120Hz display may invoke Three's loop faster than 60Hz, so the
runtime uses a logical interval of `1000 / 60` milliseconds and renders at most
once per animation callback. On every callback it counts how many logical deadlines
have elapsed, renders one frame when at least one is due, advances the deadline
accumulator, and records any additional elapsed deadlines as missed. It never
performs catch-up renders. This caps average compute/draw work at 60fps without
mistaking the normal alternating cadence of a 90Hz panel for overload.

Adaptation uses consecutive two-second windows:

- `submission fps` is submitted frames divided by visible, eligible window
  time;
- `miss ratio` is missed logical deadlines divided by elapsed logical
  deadlines;
- `submit p95` is the 95th percentile synchronous JavaScript time spent
  updating uniforms and submitting compute/render commands. It is a CPU
  pressure diagnostic, not a claim to measure GPU presentation time;
- WebGPU starts one non-blocking `device.queue.onSubmittedWorkDone()` probe every
  tenth submitted frame when no earlier probe is pending. Completion latency is
  recorded, and reaching the next probe point with one still pending records
  queue backlog;
- WebGL2 wraps every tenth render in an asynchronous
  `EXT_disjoint_timer_query_webgl2` query when supported, discards disjoint
  samples, and records GPU duration without blocking the frame;
- prewarm and the first 500ms after resize, visibility resume, or backend start
  are excluded.

Every asynchronous GPU probe captures a numeric `probeEpoch`. Pause, resume,
resize, backend start/change, quality change, fallback, and disposal increment
that epoch, synchronously clear the current pending flag, and retire/delete any
WebGL query handle. A queue promise or query result whose captured epoch no
longer matches performs no state write and cannot count as backlog. Disposal is
also checked before every probe callback. Background or bfcache time therefore
cannot leak into a fresh timing window or publish after unmount.

GPU pressure is normal when WebGPU completion p95 exceeds 18ms, a WebGPU probe
is still pending at its next sample point, or WebGL2 GPU-duration p95 exceeds
14ms. It is urgent above 33ms for WebGPU or 20ms for WebGL2. If the WebGL timer
extension is absent, cadence and submit metrics still drive in-session
adaptation, while the independent physical-device profiler gate below remains
mandatory.

One urgent window (`miss ratio > 10%`, `submit p95 > 16ms`, or urgent GPU
pressure) downgrades one ladder step. Otherwise, two consecutive windows with
`miss ratio > 5%` (`submission fps < 57`), `submit p95 > 12ms`, or normal GPU
pressure downgrade one step. Touch input does not suspend this protection; at
most one step is applied per window, so a sustained finger drag can lower
quality without oscillating or rebuilding.

Upgrade requires five consecutive windows with `miss ratio <= 1.7%`
(`submission fps >= 59`), `submit p95 <= 8ms`, and no normal GPU pressure, then
starts an eight-second cooldown before another change. At the minimum ladder
entry, three consecutive windows with `miss ratio > 16.7%`
(`submission fps < 50`), `submit p95 > 20ms`, urgent GPU pressure, or repeated
pending WebGPU probes permanently select the static fallback for that mount.

Resolution changes reuse the renderer and canvas. Instances are seeded in an
evenly distributed order, so an active prefix still covers the field.
Active-count changes update draw count immediately and set the WebGPU compute
dispatch size to the same count; they do not rebuild geometry or allocate
during input. Before an upgrade exposes a previously inactive WebGPU range, a
dedicated range-reset compute pass clears its interaction bend channels and one
normal update establishes current wind. Only then does draw count increase.
Reactivated blades therefore cannot reappear with a stale crater from before a
downgrade.

No post-processing, depth-of-field, shadows, MSAA, steady-state pixel readback,
or per-frame JavaScript allocation is allowed. The one startup health readback
and sparse asynchronous timing probes above are the only GPU instrumentation.
Uniforms and pointer sample arrays are updated in place.

## 8. Lifecycle, Fallback, and Accessibility

The fallback image is part of the server-rendered markup and always remains
under the canvas. The canvas starts at opacity zero. `onReady` fires only after
renderer initialization, prewarm, and one successful final render; CSS then
crossfades the canvas in. A rejected import, shader compilation error, device
loss, or context loss simply leaves or restores the fallback without a visible
error panel.

One mount follows a single-owner state machine:

```text
static -> scheduled -> loading -> initializing-webgpu
                                  | success -> running <-> paused
                                  | failure -> initializing-webgl2
                                                | success -> running <-> paused
                                                | failure -> static-failed
any nonterminal state -> disposed
running fatal context/device loss -> static-failed
```

`static-failed` is terminal for that mount; a late callback cannot restart it.
A fresh mount or a reduced-motion preference changing back to no-preference may
create a new state machine.

Three.js is not imported when either condition is true at mount:

- `prefers-reduced-motion: reduce`;
- `navigator.connection.saveData === true`.

The shell also subscribes to the reduced-motion media query. Enabling it while
the page is open disposes the runtime immediately; disabling it schedules a
fresh enhancement attempt if Save-Data is not active. Save-Data is re-evaluated
on each fresh mount but has no portable live-change event.

The application render callback pauses when the document is hidden, the page
receives `pagehide`, or an `IntersectionObserver` reports that the launcher stage
is no longer visible. Pinned r185 keeps its internal animation driver alive after
`setAnimationLoop(null)` until renderer disposal, so pause clears the adapter's
application callback and submits no compute/draw work; it does not claim to stop
that internal driver. `pageshow` is the symmetric bfcache resume signal. Resume
occurs only when the document and stage are both visible, and resets timing samples
so background-tab elapsed time cannot trigger a false quality downgrade. A
`ResizeObserver` batches size and camera updates into one animation frame and
calls `renderer.setSize(width, height, false)`.

Unmount and failed initialization perform the same idempotent cleanup:

- cancel pending animation-frame, idle, and timer work;
- signal any runtime initialization already in progress and prevent renderer
  creation, callback publication, or resource retention after the next
  cancellation check;
- stop `setAnimationLoop`;
- disconnect resize, intersection, visibility, pointer, and touch listeners;
- dispose geometry, material, instance/storage buffers, renderer resources,
  and the renderer;
- mark the mount disposed so an asynchronous result cannot publish after React
  Strict Mode cleanup or route navigation.

Calling the r185 renderer's `dispose()` while `init()` is pending or after
`init()` rejected is forbidden: those paths can skip backend disposal and
asynchronously re-enter the same initialization promise. Each backend attempt
therefore retains its initialization promise and an abort/epoch latch. Abort
prevents every publication immediately. A fulfilled init permits exactly one
normal renderer disposal; a rejected init is consumed and routed through the
r185 adapter's partial-backend cleanup, which releases any acquired backend
device/context and listeners directly without calling renderer `dispose()` or
`setAnimationLoop()`. Scene-side resources are disposed in both paths.

A dynamic `import()` request that has already started cannot be aborted. It may
finish downloading and evaluating into the browser cache after unmount, but the
post-import signal check must prevent renderer creation and every callback,
listener, loop, or GPU allocation.

The effect is decorative: the canvas has no accessible name, receives no focus,
and does not change the launcher's semantic structure. Reduced-motion users see
the same content and palette through the static image.

## 9. Bundle and Vercel Cost

The 3D engine is a client-only, landing-only dynamic chunk. Recipe, camera,
audio, admin, and header-launcher routes must not include Three.js. Bundle
analysis must confirm that the small `LauncherBackdrop` shell does not pull
`three`, `three/webgpu`, or `three/tsl` into the initial shared client graph.

The WebP is a fingerprinted static import with `unoptimized`, so it does not use
Vercel Image Optimization transformations. The canvas performs all simulation
locally. This design adds no Route Handler, Function invocation, Edge request,
Supabase query, or per-interaction network call. The only new network cost is a
cacheable static JavaScript chunk for users who pass the enhancement gates.

## 10. Implementation Surface

Planned changes are intentionally landing-local:

- keep `src/app/[locale]/page.tsx` as a Server Component and retain the backdrop
  below `LauncherGrid`;
- refactor `src/components/launcher-backdrop.tsx` into the progressive client
  shell;
- add an imperative `src/lib/launcher-strands/runtime.ts` dynamic module;
- add pure, testable quality and coordinate helpers under
  `src/lib/launcher-strands/`;
- keep `src/assets/launcher-oasis.webp` as the dark fallback and enforce its
  byte budget/signature contract;
- update the landing-only stage/canvas/liquid-glass rules in
  `src/app/globals.css` without changing generic launcher styles;
- remove the old whole-image parallax module and its behavior test;
- pin Three.js dependencies in `package.json` and `package-lock.json`;
- record this intentional landing-only interactive-motion exception in
  `DESIGN.md` and `CLAUDE.md` without weakening the rest of the motion rules;
- record the named physical-device evidence in
  `docs/superpowers/verification/2026-08-17-interactive-strands.md`.

The shared `LauncherGrid`, global surface primitives, generated token files,
proxy, APIs, catalogue data, and unrelated user changes remain out of scope.

## 11. Verification and Acceptance Criteria

### 11.1 Automated unit and contract tests

- Initial quality selection covers WebGPU/WebGL2, fine/coarse pointer, small and
  large viewport areas without user-agent branches.
- DPR calculation respects device DPR, tier cap, and pixel budget.
- Stage coordinates map correctly to normalized device coordinates at edges,
  center, scroll offsets, and resized bounds.
- Touch ownership tracks one identifier, ignores duplicate touch Pointer Events,
  and releases on end, cancel, loss, blur, and page hiding.
- Pause state combines page visibility, pagehide, and stage intersection.
- The 60Hz scheduler produces at most 60 renders per second from synthetic
  60Hz, 90Hz, and 120Hz callback streams and counts true missed deadlines.
- Every explicit quality ladder observes urgent/normal downgrade thresholds,
  reverse-order upgrade, cooldown, touch behavior, and terminal static
  fallback.
- A WebGPU blade-count upgrade resets and warms the newly active range before
  increasing draw count.
- Renderer doubles verify backend detection, r185 prewarm ordering, use of two
  separate canvases, error/device-loss transitions, and idempotent disposal.
- Reduced-motion changes and pagehide/pageshow exercise symmetric teardown and
  resume behavior.
- The fallback asset remains a valid WebP and at most 350KB.

### 11.2 Browser verification

- WebGPU path renders independent strands and a local two-radius crater.
- Forced WebGL2 path stays interactive and visually preserves local response
  and recovery.
- Disabled/unavailable GPU and failed initialization leave a usable WebP-backed
  launcher with no black flash. WebGL context loss is exercised through
  `WEBGL_lose_context`; WebGPU device-loss behavior is exercised through the
  injected renderer callback because browsers expose no portable loss trigger.
- Reduced motion and Save-Data do not request the Three.js dynamic chunk.
- Mouse hover and finger drag move only nearby strands; touch interaction does
  not block scroll, icon activation, or browser gestures.
- 320px portrait, the named performance profiles below, mobile landscape,
  desktop, resize, orientation change, and safe-area layouts remain correct.
- Opening the Wiki subview keeps its fixed back button at the viewport top-left,
  clickable above the canvas.
- Hiding the tab or moving the stage offscreen stops rendering; returning
  resumes without a time jump.
- Keyboard navigation, focus indication, labels, and contrast remain unchanged.

### 11.3 Performance and repository verification

Performance acceptance uses physical hardware, not mobile emulation:

- **D1 desktop floor:** Dell XPS 13 9310, Core i5-1135G7, Iris Xe 80 EU, 16GB
  RAM, Ubuntu 24.04.3 LTS, Linux 6.14 HWE, Mesa 25.0.7, AC power and performance
  power profile, current stable Chrome, hardware acceleration and WebGPU
  enabled, 1440x900 CSS viewport, DPR 1;
- **M1 Android floor:** a physical Google Pixel 7 at default Display size and
  browser zoom, current stable Chrome, native DPR, and the backend actually
  selected. The test does not override viewport dimensions; it records
  `visualViewport.width` and `visualViewport.height` with browser chrome in its
  normal test position;
- **M1-WGL compatibility/performance:** repeat M1 with the runtime's explicit
  `webgl2` test seam. This forced-WebGL2 run has the same numerical gate as the
  automatic backend;
- **M2 iOS floor:** a physical iPhone 13 at Standard Display Zoom and default
  Safari page zoom, current stable Safari, native DPR, and the selected backend.
  As with M1, its actual `visualViewport` is recorded rather than emulated.

Each profile receives a five-second excluded warmup followed by three 30-second
traces. A trace contains 20 seconds of continuous figure-eight pointer/finger
movement across the central 60% of the field and 10 seconds released. D1, M1,
M1-WGL, and M2 pass only when all three traces remain interactive, profiler
frame fps is at least 57, runtime submission fps is at least 57, miss ratio
is at most 5%, submit p95 is at most 12ms, and no terminal fallback occurs. The
median of the three traces is reported, but one failed run still fails
acceptance.

The test harness emits `performance.mark()` boundaries and one
`performance.measure('launcher-strands-measure', ...)` spanning exactly the
30-second measurement. Chrome runs record Perfetto with Chrome FrameReporter2,
Graphics.Pipeline, and `blink.user_timing`, with the launcher as the sole
foreground Chrome tab and browser UI left idle. The retained trace config sets
the Track Event option `filter_dynamic_event_names: false`; the harness rejects
a capture unless it contains exactly one process-scoped slice named
`launcher-strands-measure` with a duration between 29.9 and 30.1 seconds. This
prevents Chromium privacy filtering from replacing the dynamic name with the
generic `performance.measure` label.

Trace Processor obtains the renderer process from that process-scoped User
Timing measure, selects only compositor surface frames submitted by that
renderer, maps each selected surface to its first aggregated display frame,
and then counts only those display frames that reached
`STEP_SWAP_BUFFERS_ACK` inside the measure:

```sql
INCLUDE PERFETTO MODULE chrome.graphics_pipeline;
INCLUDE PERFETTO MODULE slices.with_context;

WITH bounds AS (
  SELECT
    ts AS start_ns,
    ts + dur AS end_ns,
    dur,
    upid AS renderer_upid
  FROM process_slice
  WHERE name = 'launcher-strands-measure'
  ORDER BY ts DESC
  LIMIT 1
), launcher_surfaces AS (
  SELECT DISTINCT surface.surface_frame_trace_id
  FROM chrome_graphics_pipeline_surface_frame_steps AS surface
  JOIN thread USING (utid)
  CROSS JOIN bounds
  WHERE thread.upid = bounds.renderer_upid
    AND surface.step = 'STEP_SUBMIT_COMPOSITOR_FRAME'
    AND surface.ts >= bounds.start_ns
    AND surface.ts < bounds.end_ns
), launcher_displays AS (
  SELECT DISTINCT mapping.display_trace_id
  FROM chrome_surface_frame_id_to_first_display_id AS mapping
  JOIN launcher_surfaces
    USING (surface_frame_trace_id)
), acknowledged AS (
  SELECT DISTINCT display.display_trace_id
  FROM chrome_graphics_pipeline_display_frame_steps AS display
  JOIN launcher_displays
    USING (display_trace_id)
  CROSS JOIN bounds
  WHERE display.step = 'STEP_SWAP_BUFFERS_ACK'
    AND display.ts >= bounds.start_ns
    AND display.ts < bounds.end_ns
)
SELECT
  COUNT(*) AS acknowledged_launcher_frames,
  COUNT(*) * 1000000000.0 / (SELECT dur FROM bounds) AS frame_fps
FROM acknowledged;
```

The renderer `upid` and surface-to-display mapping prevent Chrome UI, another
tab, or an unrelated compositor surface from inflating the launcher result.
Distinct trace IDs remove duplicate pipeline steps without relying on renderer
callback counts. The raw `.pftrace`, SQL, query output, selected renderer
`upid`, and measure duration are retained, so another reviewer can recompute
the `>=57` gate against the exact mapped Viz swap acknowledgements.

M2 records Safari Web Inspector's **Rendering Frames** timeline over the same
named User Timing measure. From the exported recording, `N` is the number of
`RenderingFrameTimelineRecord` start times within `[measureStart, measureEnd)`;
`frame_fps = N / ((measureEnd - measureStart) / 1000)`. The export and the
ordered start-time/duration CSV are retained, making gaps and frames longer than
16.667ms independently recountable. Runtime callback counts alone cannot
satisfy either browser gate.

The implementation evidence is committed at
`docs/superpowers/verification/2026-08-17-interactive-strands.md`. It records
device model, OS/browser/driver version, power mode, GPU/backend, measured
visual viewport, DPR, active blades, render scale, profiler frame fps and source,
runtime submission fps, miss ratio, submit p95, backend GPU timing/queue
latency, quality transitions, fallback state, and the raw three-run summaries.
It never reports a bare “60fps” claim without these conditions.

- Bundle analysis confirms Three.js exists only in the dynamic landing chunk.
- Ten repeated launcher-away-launcher navigations leave exactly the two
  React-owned canvases, at most one active animation loop/listener set, all
  prior controllers disposed, and no callback or GPU allocation after unmount.
  A dynamic chunk request already in flight may finish into browser cache.
- Dev and production checks show no hydration error.
- `npm run verify` passes before implementation is considered complete.

## 12. Licensing and Attribution

The downloaded export contains no license or notice, so its code is not copied
verbatim. The implementation reproduces the high-level GPU technique—instanced
blades, distance-based force, and elastic recovery—with original code, palette,
camera, scene, lifecycle, and adaptive system. It does not reuse Omma/Abyssal
branding, prose, or page structure.

Three.js is MIT-licensed. Its package-supplied license remains in the installed
dependency and distribution notices required by the dependency toolchain.

## 13. Risks and Controls

- **Experimental renderer/API changes:** exact dependency pins, lockfile, both
  backend smoke tests, and no unbounded upgrade are required.
- **Shader compile or device-loss variance:** prewarm behind the image, one
  explicit WebGL2 retry, and a permanent static fallback prevent a broken page.
- **Mobile heat and battery:** conservative coarse-pointer defaults,
  visibility/offscreen pause, no post-processing, and sustained adaptive
  downgrade constrain load.
- **Animation competes with navigation:** the canvas cannot receive pointer
  events, input sampling is passive, and launcher content stays in a higher
  stacking layer.
- **Glass readability over a changing field:** the approved landing-only face
  opacity, blur, highlight, and shadow remain; contrast is rechecked on both
  blue and purple peaks.
- **Quality oscillation:** asymmetric thresholds, long upgrade stability, and
  cooldown keep adaptation infrequent.

## 14. Locked Decisions

- The deliverable is real-time independent 3D strands, not image parallax.
- Desktop and mobile both target 60fps.
- Mobile remains interactive by finger drag.
- WebGPU compute is primary; an original WebGL2 analytic strand path is the
  interactive compatibility fallback; WebP is the final fallback.
- Visual quality may step down to protect frame cadence.
- Reduced-motion and Save-Data users receive the static fallback without
  downloading Three.js.
- The four launcher tiles retain landing-only liquid glass and remain above a
  non-interactive canvas.
- The runtime is landing-local, dynamically loaded, client-only, and adds no
  Vercel server compute.
