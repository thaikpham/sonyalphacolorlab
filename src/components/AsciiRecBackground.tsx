import { useEffect, useRef } from "react";

interface AsciiRecBackgroundProps {
  videoFocused: boolean;
  kioskMode?: boolean;
  className?: string;
}

interface StaticGlyph {
  x: number;
  y: number;
  glyph: string;
  alpha: number;
  fontSize: number;
}

interface LiveRecLabel {
  x: number;
  y: number;
  text: string;
  bornAt: number;
  lifeTime: number;
  blinkRate: number;
  phase: number;
  driftX: number;
  driftY: number;
}

interface LabelAnchor {
  x: number;
  y: number;
  weight: number;
}

interface QualityProfile {
  name: "mobile" | "tablet" | "desktop";
  dprCap: number;
  fps: number;
  maxLabels: number;
  maxStaticGlyphs: number;
  cellDensity: number;
  cellWidth: number;
  cellHeight: number;
  glyphFontSize: number;
  labelFontSize: number;
  spawnMinMs: number;
  spawnMaxMs: number;
  labelAlphaMin: number;
  labelAlphaMax: number;
  motionEnabled: boolean;
  shadowBlur: number;
  spacingX: number;
  spacingY: number;
  initialFillRatio: number;
}

const BACKGROUND_COLOR = "#040915";
const ASCII_MICRO_GLYPHS = [".", ":", "+", "|", "/", "\\", "-", "=", "L", "I", "V", "E", "S", "O", "N", "Y"];
const ASCII_WORD_GLYPHS = ["LIVE", "SONY", "STUDIO", "ON AIR"];
const ASCII_LABEL_GLYPHS = ["LIVE", "SONY", "STUDIO", "ON AIR", "LIVE SONY", "SONY STUDIO", "STUDIO ON AIR"];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hashNoise(seed: number) {
  const hashed = Math.sin(seed) * 43758.5453123;
  return hashed - Math.floor(hashed);
}

function bandStrength(value: number, center: number, width: number) {
  return 1 - clamp(Math.abs(value - center) / width, 0, 1);
}

function pickQualityProfile(
  width: number,
  height: number,
  reducedMotion: boolean,
  videoFocused: boolean,
  kioskMode: boolean,
): QualityProfile {
  const shortestEdge = Math.min(width, height);
  const isMobile = width < 768 || shortestEdge < 560;
  const isTablet = !isMobile && width < 1180;
  const isConstrainedMode = kioskMode || videoFocused;

  if (reducedMotion) {
    return {
      name: isMobile ? "mobile" : isTablet ? "tablet" : "desktop",
      dprCap: isConstrainedMode ? 1 : isMobile || isTablet ? 1.25 : 1.5,
      fps: 0,
      maxLabels: 0,
      maxStaticGlyphs: isConstrainedMode ? (isMobile ? 140 : isTablet ? 180 : 220) : isMobile ? 220 : isTablet ? 300 : 380,
      cellDensity: isConstrainedMode ? (isMobile ? 0.14 : isTablet ? 0.16 : 0.18) : isMobile ? 0.22 : isTablet ? 0.24 : 0.26,
      cellWidth: isMobile ? 74 : isTablet ? 90 : 104,
      cellHeight: isMobile ? 22 : isTablet ? 24 : 26,
      glyphFontSize: isMobile ? 16 : isTablet ? 18 : 20,
      labelFontSize: isMobile ? 24 : isTablet ? 26 : 28,
      spawnMinMs: 0,
      spawnMaxMs: 0,
      labelAlphaMin: 0,
      labelAlphaMax: 0,
      motionEnabled: false,
      shadowBlur: 0,
      spacingX: isMobile ? 124 : isTablet ? 146 : 172,
      spacingY: isMobile ? 76 : isTablet ? 88 : 100,
      initialFillRatio: 0,
    };
  }

  return {
    name: isMobile ? "mobile" : isTablet ? "tablet" : "desktop",
    dprCap: kioskMode ? 1 : isMobile || isTablet ? 1.25 : 1.5,
    fps: kioskMode ? (isMobile ? 8 : 10) : isMobile || shortestEdge < 720 ? 12 : videoFocused ? 16 : 20,
    maxLabels: kioskMode ? (isMobile ? 4 : isTablet ? 6 : 8) : isMobile ? 12 : isTablet ? 20 : 30,
    maxStaticGlyphs: kioskMode ? (isMobile ? 150 : isTablet ? 200 : 280) : isMobile ? 280 : isTablet ? 420 : videoFocused ? 540 : 640,
    cellDensity: kioskMode ? (isMobile ? 0.13 : isTablet ? 0.15 : 0.18) : videoFocused ? (isMobile ? 0.2 : isTablet ? 0.22 : 0.24) : isMobile ? 0.24 : isTablet ? 0.27 : 0.3,
    cellWidth: isMobile ? 74 : isTablet ? 90 : 104,
    cellHeight: isMobile ? 22 : isTablet ? 24 : 26,
    glyphFontSize: isMobile ? 16 : isTablet ? 18 : 20,
    labelFontSize: isMobile ? 24 : isTablet ? 26 : 28,
    spawnMinMs: kioskMode ? 520 : videoFocused ? 280 : isMobile ? 220 : 140,
    spawnMaxMs: kioskMode ? 980 : videoFocused ? 620 : isMobile ? 520 : 340,
    labelAlphaMin: kioskMode ? 0.1 : videoFocused ? 0.14 : 0.18,
    labelAlphaMax: kioskMode ? 0.18 : videoFocused ? 0.28 : 0.36,
    motionEnabled: true,
    shadowBlur: kioskMode ? 4 : videoFocused ? 8 : 10,
    spacingX: isMobile ? 124 : isTablet ? 146 : 172,
    spacingY: isMobile ? 76 : isTablet ? 88 : 100,
    initialFillRatio: kioskMode ? 0.42 : videoFocused ? 0.74 : 0.88,
  };
}

function buildStaticGlyphs(width: number, height: number, profile: QualityProfile) {
  const columns = Math.ceil(width / profile.cellWidth) + 1;
  const rows = Math.ceil(height / profile.cellHeight) + 1;
  const estimatedCells = Math.max(1, columns * rows);
  const estimatedGlyphs = Math.max(1, estimatedCells * profile.cellDensity);
  // Keep density visually balanced while capping total glyphs on large canvases.
  const densityBudgetScale = Math.min(1, profile.maxStaticGlyphs / estimatedGlyphs);
  const glyphs: StaticGlyph[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const seed = (column + 1) * 12.9898 + (row + 1) * 78.233 + width * 0.017 + height * 0.013;
      const chance = hashNoise(seed);
      const rawX = column * profile.cellWidth + hashNoise(seed * 1.41) * profile.cellWidth * 0.72;
      const rawY = row * profile.cellHeight + hashNoise(seed * 1.93) * profile.cellHeight * 0.86;
      const normalizedX = rawX / width;
      const distY = Math.abs(rawY - height / 2) / (height / 2);
      const edgeY = clamp(distY, 0, 1);
      const leftBand = bandStrength(normalizedX, 0.09, 0.18);
      const rightBand = bandStrength(normalizedX, 0.91, 0.18);
      const sideBand = Math.max(leftBand, rightBand);
      const verticalFeather = 0.88 + edgeY * 0.12;
      const density = profile.cellDensity * densityBudgetScale * (0.06 + sideBand * 1.26) * verticalFeather;

      if (chance > density) continue;

      const glyphNoise = hashNoise(seed * 2.17);
      let glyph = ASCII_MICRO_GLYPHS[Math.floor(hashNoise(seed * 2.71) * ASCII_MICRO_GLYPHS.length)] ?? ".";
      let fontSize = profile.glyphFontSize;

      if (glyphNoise > 0.965) {
        glyph = ASCII_WORD_GLYPHS[Math.floor(hashNoise(seed * 3.17) * ASCII_WORD_GLYPHS.length)] ?? "LIVE";
        fontSize = profile.glyphFontSize * 0.98;
      } else if (glyphNoise > 0.86) {
        glyph = ASCII_WORD_GLYPHS[Math.floor(hashNoise(seed * 3.61) * ASCII_WORD_GLYPHS.length)] ?? "SONY";
        fontSize = profile.glyphFontSize * 0.82;
      }

      const isWord = glyph.length > 1;
      const baseAlpha = isWord ? 0.082 : 0.04;
      const alpha = baseAlpha * (0.76 + hashNoise(seed * 2.61) * 0.38) * (0.42 + sideBand * 0.94);

      glyphs.push({
        x: Math.round(rawX),
        y: Math.round(rawY),
        glyph,
        alpha,
        fontSize,
      });
    }
  }

  return glyphs;
}

function buildLabelAnchors(width: number, height: number, profile: QualityProfile) {
  const stepX = profile.spacingX;
  const stepY = profile.spacingY;
  const columns = Math.ceil(width / stepX) + 1;
  const rows = Math.ceil(height / stepY) + 1;
  const anchors: LabelAnchor[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const seed = (column + 1) * 17.731 + (row + 1) * 53.127 + width * 0.009 + height * 0.021;
      const x = column * stepX + hashNoise(seed * 1.11) * stepX * 0.6;
      const y = row * stepY + hashNoise(seed * 1.67) * stepY * 0.5;
      const normalizedX = x / width;
      const distX = Math.abs(x - width / 2) / (width / 2);
      const distY = Math.abs(y - height / 2) / (height / 2);
      const edgeY = clamp(distY, 0, 1);
      const edgeWeight = clamp(Math.hypot(distX, edgeY), 0, 1);
      const leftBand = bandStrength(normalizedX, 0.08, 0.14);
      const rightBand = bandStrength(normalizedX, 0.92, 0.14);
      const sideBand = Math.max(leftBand, rightBand);
      const centerPenalty = normalizedX > 0.34 && normalizedX < 0.66 ? 0.04 : normalizedX > 0.24 && normalizedX < 0.76 ? 0.24 : 1;
      const verticalBand = 0.92 + edgeY * 0.08;
      const rhythmicWeight = 0.78 + ((row + column) % 3) * 0.12;

      anchors.push({
        x,
        y,
        weight: (0.02 + sideBand * 1.9 + edgeWeight * 0.08) * verticalBand * centerPenalty * rhythmicWeight,
      });
    }
  }

  return anchors;
}

function drawStaticLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  profile: QualityProfile,
  glyphs: StaticGlyph[],
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${profile.glyphFontSize}px "Courier New", Courier, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.shadowBlur = 0;

  for (const glyph of glyphs) {
    const fillAlpha = glyph.alpha;
    ctx.font = `${glyph.fontSize}px "Courier New", Courier, monospace`;
    ctx.fillStyle = `rgba(122, 194, 255, ${fillAlpha})`;
    ctx.fillText(glyph.glyph, glyph.x, glyph.y);
  }
}

function drawLiveRecLabel(
  ctx: CanvasRenderingContext2D,
  label: LiveRecLabel,
  now: number,
  profile: QualityProfile,
) {
  const age = now - label.bornAt;

  if (age >= label.lifeTime) return false;

  const fadeMs = 900;
  let fade = 1;

  if (age < fadeMs) fade = age / fadeMs;
  if (age > label.lifeTime - fadeMs) fade = (label.lifeTime - age) / fadeMs;

  const blinkCurve = (Math.sin((now + label.phase) / label.blinkRate) + 1) / 2;
  const blinkAlpha = profile.labelAlphaMin + blinkCurve * (profile.labelAlphaMax - profile.labelAlphaMin);
  const finalAlpha = fade * blinkAlpha;
  const progress = clamp(age / label.lifeTime, 0, 1);
  const driftWave = Math.sin((now + label.phase * 0.6) / 620);
  const drawX = label.x + label.driftX * progress + driftWave * 3.5;
  const drawY = label.y + label.driftY * progress;

  ctx.font = `bold ${profile.labelFontSize}px "Courier New", Courier, monospace`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.shadowBlur = profile.shadowBlur;
  ctx.shadowColor = `rgba(82, 198, 255, ${finalAlpha * 0.48})`;
  ctx.fillStyle = `rgba(164, 225, 255, ${finalAlpha})`;
  ctx.fillText(label.text, drawX, drawY);

  return true;
}

export function AsciiRecBackground({ videoFocused, kioskMode = false, className }: AsciiRecBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    const staticCanvas = document.createElement("canvas");
    const staticCtx = staticCanvas.getContext("2d", { alpha: false });

    if (!ctx || !staticCtx) return;

    const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const labels: LiveRecLabel[] = [];
    let profile = pickQualityProfile(
      container.clientWidth,
      container.clientHeight,
      reducedMotionMedia.matches,
      videoFocused,
      kioskMode,
    );
    let anchors = buildLabelAnchors(container.clientWidth, container.clientHeight, profile);
    let glyphs = buildStaticGlyphs(container.clientWidth, container.clientHeight, profile);
    let cssWidth = 0;
    let cssHeight = 0;
    let dpr = 1;
    let rafId = 0;
    let resizeRafId = 0;
    let lastFrameAt = 0;
    let nextSpawnAt = 0;

    const syncMetadata = () => {
      container.dataset.motionMode = profile.motionEnabled ? "animated" : "reduced";
      container.dataset.quality = profile.name;
      canvas.dataset.fps = String(profile.fps);
    };

    const setCanvasSize = () => {
      const bounds = container.getBoundingClientRect();
      cssWidth = Math.max(1, Math.round(bounds.width));
      cssHeight = Math.max(1, Math.round(bounds.height));
      dpr = Math.min(window.devicePixelRatio || 1, profile.dprCap);

      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      staticCanvas.width = Math.round(cssWidth * dpr);
      staticCanvas.height = Math.round(cssHeight * dpr);
      staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const configureScene = () => {
      profile = pickQualityProfile(
        container.clientWidth,
        container.clientHeight,
        reducedMotionMedia.matches,
        videoFocused,
        kioskMode,
      );
      setCanvasSize();
      glyphs = buildStaticGlyphs(cssWidth, cssHeight, profile);
      anchors = buildLabelAnchors(cssWidth, cssHeight, profile);
      labels.splice(profile.maxLabels);
      drawStaticLayer(staticCtx, cssWidth, cssHeight, profile, glyphs);
      syncMetadata();
    };

    const pickWeightedAnchor = () => {
      if (!anchors.length) return null;

      const totalWeight = anchors.reduce((sum, anchor) => sum + anchor.weight, 0);
      let cursor = Math.random() * totalWeight;

      for (const anchor of anchors) {
        cursor -= anchor.weight;
        if (cursor > 0) continue;

        const labelWidth = profile.labelFontSize * 9.6;
        const x = clamp(anchor.x, 14, Math.max(14, cssWidth - labelWidth - 14));
        const y = clamp(anchor.y, 18, Math.max(18, cssHeight - 18));
        return { x, y };
      }

      return null;
    };

    const chooseAnchor = () => {
      if (!anchors.length) return null;

      const minDistance = profile.labelFontSize * 3.2;

      for (let attempt = 0; attempt < 18; attempt += 1) {
        const anchor = pickWeightedAnchor();
        if (!anchor) break;

        const text = ASCII_LABEL_GLYPHS[Math.floor(Math.random() * ASCII_LABEL_GLYPHS.length)] ?? "LIVE";
        const labelWidth = profile.labelFontSize * (text.length * 0.56);
        const x = clamp(anchor.x, 14, Math.max(14, cssWidth - labelWidth - 14));
        const y = clamp(anchor.y, profile.labelFontSize, Math.max(profile.labelFontSize, cssHeight - profile.labelFontSize));
        const overlapsExisting = labels.some((label) => Math.hypot(label.x - x, label.y - y) < minDistance);

        if (!overlapsExisting) {
          return { x, y, text };
        }
      }

      const fallback = pickWeightedAnchor();
      if (!fallback) return null;

      const text = ASCII_LABEL_GLYPHS[Math.floor(Math.random() * ASCII_LABEL_GLYPHS.length)] ?? "LIVE";
      const labelWidth = profile.labelFontSize * (text.length * 0.56);

      return {
        x: clamp(fallback.x, 14, Math.max(14, cssWidth - labelWidth - 14)),
        y: clamp(fallback.y, profile.labelFontSize, Math.max(profile.labelFontSize, cssHeight - profile.labelFontSize)),
        text,
      };
    };

    const seedLabels = (now: number) => {
      labels.length = 0;

      if (!profile.motionEnabled) return;

      const desired = Math.max(3, Math.round(profile.maxLabels * profile.initialFillRatio));

      for (let index = 0; index < desired; index += 1) {
        const anchor = chooseAnchor();
        if (!anchor) continue;

        const ageOffset = Math.random() * 2400;
        labels.push({
          x: anchor.x,
          y: anchor.y,
          text: anchor.text,
          bornAt: now - ageOffset,
          lifeTime: 3800 + Math.random() * 2200,
          blinkRate: 720 + Math.random() * 760,
          phase: Math.random() * 6000,
          driftX: (Math.random() - 0.5) * 20,
          driftY: -12 - Math.random() * 22,
        });
      }
    };

    const spawnLabel = (now: number) => {
      if (!profile.motionEnabled || labels.length >= profile.maxLabels) return;

      const anchor = chooseAnchor();
      if (!anchor) return;

      labels.push({
        x: anchor.x,
        y: anchor.y,
        text: anchor.text,
        bornAt: now,
        lifeTime: 3800 + Math.random() * 2200,
        blinkRate: 720 + Math.random() * 760,
        phase: Math.random() * 6000,
        driftX: (Math.random() - 0.5) * 20,
        driftY: -12 - Math.random() * 22,
      });
    };

    const renderFrame = (now: number) => {
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.drawImage(staticCanvas, 0, 0, cssWidth, cssHeight);

      if (profile.motionEnabled) {
        if (now >= nextSpawnAt && labels.length < profile.maxLabels) {
          spawnLabel(now);
          nextSpawnAt = now + profile.spawnMinMs + Math.random() * (profile.spawnMaxMs - profile.spawnMinMs);
        }

        for (let index = labels.length - 1; index >= 0; index -= 1) {
          const isAlive = drawLiveRecLabel(ctx, labels[index], now, profile);
          if (!isAlive) {
            labels.splice(index, 1);
          }
        }
      }

      ctx.shadowBlur = 0;
    };

    const tick = (now: number) => {
      if (document.visibilityState !== "visible") return;

      if (!profile.motionEnabled) {
        renderFrame(now);
        return;
      }

      const frameInterval = 1000 / profile.fps;

      if (!lastFrameAt || now - lastFrameAt >= frameInterval) {
        lastFrameAt = now;
        renderFrame(now);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
      lastFrameAt = 0;
      const now = performance.now();
      seedLabels(now);
      nextSpawnAt = now + profile.spawnMinMs * 0.6;
      renderFrame(now);

      if (profile.motionEnabled && document.visibilityState === "visible") {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const scheduleResize = () => {
      if (resizeRafId) return;

      resizeRafId = window.requestAnimationFrame(() => {
        resizeRafId = 0;
        configureScene();
        startLoop();
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startLoop();
        return;
      }

      window.cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const handleMotionChange = () => {
      configureScene();
      startLoop();
    };

    configureScene();
    startLoop();

    window.addEventListener("resize", scheduleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    reducedMotionMedia.addEventListener("change", handleMotionChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.cancelAnimationFrame(resizeRafId);
      window.removeEventListener("resize", scheduleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      reducedMotionMedia.removeEventListener("change", handleMotionChange);
    };
  }, [kioskMode, videoFocused]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-testid="ascii-rec-background"
      data-kiosk-mode={kioskMode ? "true" : "false"}
      data-video-focused={videoFocused ? "true" : "false"}
      className={`ascii-rec-bg ${className ?? ""}`.trim()}
    >
      <canvas ref={canvasRef} data-testid="ascii-rec-canvas" className="ascii-rec-bg__canvas" />
      <div data-testid="ascii-rec-scanlines" className="ascii-rec-bg__scanlines" />
      <div data-testid="ascii-rec-vignette" className="ascii-rec-bg__vignette" />
    </div>
  );
}
