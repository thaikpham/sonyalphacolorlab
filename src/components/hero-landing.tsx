'use client';

import { useState, useEffect, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

// 1. Picture Profile Ticker Options
const PP_PRESET_TICKER_OPTIONS = [
  'PP11 (S-Cinetone) · S-Gamut3.Cine',
  'PP10 (HLG2) · BT.2020',
  'PP7 (S-Log2) · S-Gamut',
  'PP8 (S-Log3) · S-Gamut3',
  'PP1 (Movie) · ITU709',
  'PP2 (Still) · Still Gamma',
];

const PP_PARAMS_TICKER_OPTIONS = [
  'Black Level -2 · Knee Auto · Saturation +4',
  'Color Mode S-Cinetone · Black Gamma +1',
  'Color Phase +2 · Color Depth R+3 / G+1 / B-2',
  'Detail Level +2 · Detail Adjust Crisp +1',
  'Saturation -5 · Color Phase -1 · Black Level +4',
  'Color Depth M-2 / Y+2 / C+1 · Detail Level -1',
];

// 2. White Balance Shift Ticker Options
const WB_PRESET_TICKER_OPTIONS = [
  'Daylight (5500K)',
  'Shade (7000K)',
  'Cloudy (6000K)',
  'Tungsten (3200K)',
  'Fluorescent: Warm White (3000K)',
  'Custom Kelvin (4300K)',
];

const WB_PARAMS_TICKER_OPTIONS = [
  'A-B: A+3 · G-M: M+1',
  'A-B: B+2 · G-M: G+4',
  'A-B: A+7 · G-M: G+2',
  'A-B: B+4 · G-M: M+3',
  'A-B: A+1 · G-M: G-1',
  'A-B: B+1 · G-M: M+4',
];

// 3. Creative Look Ticker Options
const CL_PRESET_TICKER_OPTIONS = [
  'ST (Standard)',
  'PT (Portrait)',
  'NT (Neutral)',
  'VV (Vivid)',
  'VV2 (Vivid 2)',
  'FL (Film-like)',
  'IN (Instant Film)',
  'SH (Soft Highkey)',
  'BW (Black & White)',
  'SE (Sepia)',
];

// Creative Look Parameters Ticker Options (Unsigned Fade, Sharpness, Clarity, Sharpness Range)
const CL_PARAMS_TICKER_OPTIONS = [
  'Contrast +1 · Highlight -5 · Shadow +2',
  'Fade 3 · Saturation -2 · Sharpness 4',
  'Clarity 2 · Sharpness Range 3 · Fade 1',
  'Contrast +2 · Highlight -1 · Saturation +3',
  'Shadow -3 · Fade 4 · Sharpness 5 · Clarity 3',
  'Highlight -2 · Shadow +1 · Saturation -1',
];

const GLITCH_CHARS = '01#%&$█▓░⚡<>/[]{}?@';

function getRandomGlitchString(length: number): string {
  let res = '';
  for (let i = 0; i < length; i++) {
    res += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
  }
  return res;
}

// 18 Sparse Matrix Micro-Dots accurately mapped to Sony WB Shift Regions
// Delays are mathematically synchronized with 14s radar beam center hit (+0.292s = 7.5deg)
const RADAR_DOTS = [
  // Primary Axes (A, G, B, M)
  { cx: 82, cy: 50, color: 'oklch(84% 0.28 75)', delay: '0.29s' },     // A (Amber Right 0deg + 7.5deg center)
  { cx: 72, cy: 72, color: 'oklch(78% 0.30 25)', delay: '2.04s' },    // A+M Quadrant (45deg + 7.5deg)
  { cx: 50, cy: 82, color: 'oklch(76% 0.35 330)', delay: '3.79s' },   // M (Magenta Bottom 90deg + 7.5deg)
  { cx: 28, cy: 72, color: 'oklch(74% 0.30 285)', delay: '5.54s' },   // B+M Quadrant (135deg + 7.5deg)
  { cx: 18, cy: 50, color: 'oklch(80% 0.26 240)', delay: '7.29s' },    // B (Blue Left 180deg + 7.5deg)
  { cx: 28, cy: 28, color: 'oklch(82% 0.25 185)', delay: '9.04s' },   // B+G Quadrant (225deg + 7.5deg)
  { cx: 50, cy: 18, color: 'oklch(88% 0.32 145)', delay: '10.79s' },  // G (Green Top 270deg + 7.5deg)
  { cx: 72, cy: 28, color: 'oklch(86% 0.28 110)', delay: '12.54s' },  // A+G Quadrant (315deg + 7.5deg)
  
  // Soft Inner Scatter Regions
  { cx: 64, cy: 38, color: 'oklch(86% 0.28 110)', delay: '12.71s' },  // A+G Soft Inner (319deg + 7.5deg)
  { cx: 62, cy: 62, color: 'oklch(78% 0.30 25)', delay: '2.04s' },    // A+M Soft Inner (45deg + 7.5deg)
  { cx: 38, cy: 62, color: 'oklch(74% 0.30 285)', delay: '5.54s' },   // B+M Soft Inner (135deg + 7.5deg)
  { cx: 38, cy: 38, color: 'oklch(82% 0.25 185)', delay: '9.04s' },   // B+G Soft Inner (225deg + 7.5deg)

  // Fullscreen Outer Extreme Bounds
  { cx: 92, cy: 32, color: 'oklch(84% 0.28 75)', delay: '13.39s' },   // A Deep Extreme (337deg + 7.5deg)
  { cx: 92, cy: 68, color: 'oklch(84% 0.28 75)', delay: '1.19s' },    // A Deep Extreme (23deg + 7.5deg)
  { cx: 68, cy: 92, color: 'oklch(76% 0.35 330)', delay: '2.89s' },   // M Deep Extreme (67deg + 7.5deg)
  { cx: 32, cy: 92, color: 'oklch(76% 0.35 330)', delay: '4.69s' },   // M Deep Extreme (113deg + 7.5deg)
  { cx: 8, cy: 68, color: 'oklch(80% 0.26 240)', delay: '6.39s' },    // B Deep Extreme (157deg + 7.5deg)
  { cx: 8, cy: 32, color: 'oklch(80% 0.26 240)', delay: '8.19s' },    // B Deep Extreme (203deg + 7.5deg)
];

export function HeroLanding() {
  const t = useTranslations('heroLanding');
  const router = useRouter();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [activeAccent, setActiveAccent] = useState<'default' | 'pp' | 'wb' | 'cl'>('default');
  
  // Ticker and Glitch states
  const [tickerIndex, setTickerIndex] = useState(0);
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchText, setGlitchText] = useState({
    pp: PP_PRESET_TICKER_OPTIONS[0],
    ppParams: PP_PARAMS_TICKER_OPTIONS[0],
    wb: WB_PRESET_TICKER_OPTIONS[0],
    wbParams: WB_PARAMS_TICKER_OPTIONS[0],
    cl: CL_PRESET_TICKER_OPTIONS[0],
    clParams: CL_PARAMS_TICKER_OPTIONS[0],
  });

  // Dynamic ASCII Ticker & Glitch Scramble every 1 second
  useEffect(() => {
    const timer = setInterval(() => {
      setIsGlitching(true);
      
      // Phase 1: Rapid Glitch Scramble (First 150ms)
      setGlitchText({
        pp: getRandomGlitchString(22),
        ppParams: getRandomGlitchString(28),
        wb: getRandomGlitchString(18),
        wbParams: getRandomGlitchString(20),
        cl: getRandomGlitchString(16),
        clParams: getRandomGlitchString(28),
      });

      // Phase 2: Settle on next option string
      setTimeout(() => {
        setTickerIndex((prev) => {
          const next = prev + 1;
          setGlitchText({
            pp: PP_PRESET_TICKER_OPTIONS[next % PP_PRESET_TICKER_OPTIONS.length],
            ppParams: PP_PARAMS_TICKER_OPTIONS[next % PP_PARAMS_TICKER_OPTIONS.length],
            wb: WB_PRESET_TICKER_OPTIONS[next % WB_PRESET_TICKER_OPTIONS.length],
            wbParams: WB_PARAMS_TICKER_OPTIONS[next % WB_PARAMS_TICKER_OPTIONS.length],
            cl: CL_PRESET_TICKER_OPTIONS[next % CL_PRESET_TICKER_OPTIONS.length],
            clParams: CL_PARAMS_TICKER_OPTIONS[next % CL_PARAMS_TICKER_OPTIONS.length],
          });
          return next;
        });
      }, 150);

      // Phase 3: Stop glitch animation class after 250ms
      setTimeout(() => {
        setIsGlitching(false);
      }, 250);

    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 14, y: -y * 14 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setActiveAccent('default');
  };

  const scrollToCatalog = (formatTarget?: 'pp' | 'cl' | 'all') => {
    // 1. Compute target search query parameters
    const sp = new URLSearchParams(window.location.search);
    if (formatTarget === 'pp' || formatTarget === 'cl') {
      sp.set('format', formatTarget);
      sp.delete('look');
    } else {
      // 'all' or WB Shift card clicked -> reset format filter to ALL
      sp.delete('format');
      sp.delete('look');
    }

    const qs = sp.toString();
    const targetUrl = qs ? `/?${qs}` : '/';

    // 2. Update route state in-place without resetting scroll position
    router.push(targetUrl, { scroll: false });

    // 3. Smoothly scroll down to the recipe catalog without interruption
    requestAnimationFrame(() => {
      const el = document.getElementById('recipe-catalog');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  // Dynamic glow colors based on hovered node
  const accentGlow = 
    activeAccent === 'pp' 
      ? 'oklch(78% 0.25 240 / 0.35)' 
      : activeAccent === 'wb' 
      ? 'oklch(85% 0.3 140 / 0.35)' 
      : activeAccent === 'cl' 
      ? 'oklch(75% 0.35 330 / 0.35)' 
      : 'oklch(78% 0.25 240 / 0.15)';

  return (
    <section 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden min-h-[calc(100dvh-6rem)] sm:min-h-[calc(100dvh-7rem)] flex flex-col justify-center items-center pt-8 pb-12 px-4 sm:px-8 my-2 rounded-3xl y2k-glow-border perspective-1000 bg-[#040406] backdrop-blur-3xl text-center border border-white/10 shadow-[0_30px_90px_-20px_rgba(0,0,0,1)] transition-transform duration-200 ease-out"
    >
      {/* Persistent Analog Photographic Film Grain Overlay */}
      <div className="analog-film-grain" />

      {/* Dynamic 35mm Vintage Film Burn Light Leaks */}
      <div className="film-burn-leak" />

      {/* Fullscreen Full-Bleed WB Shift Matrix Radar Visualizer Background */}
      <div className="pointer-events-none absolute inset-0 w-full h-full flex items-center justify-center opacity-35 overflow-hidden">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full absolute inset-0"
          role="img"
          aria-label="WB Shift Matrix Radar Fullscreen Visualizer"
        >
          {/* Ultra-Hairline Matrix Grids */}
          <rect x="5" y="5" width="90" height="90" fill="none" stroke="oklch(100% 0 0 / 0.08)" strokeWidth="0.08" />
          <rect x="15" y="15" width="70" height="70" fill="none" stroke="oklch(100% 0 0 / 0.12)" strokeWidth="0.08" />
          <rect x="28" y="28" width="44" height="44" fill="none" stroke="oklch(100% 0 0 / 0.15)" strokeWidth="0.08" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(85% 0.3 140 / 0.12)" strokeWidth="0.06" strokeDasharray="0.5 1.5" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="oklch(78% 0.25 240 / 0.12)" strokeWidth="0.06" strokeDasharray="1 1" />
          <circle cx="50" cy="50" r="14" fill="none" stroke="oklch(75% 0.35 330 / 0.12)" strokeWidth="0.06" strokeDasharray="0.5 1" />

          {/* Ultra-Hairline Coordinate Axes */}
          <line x1="0" y1="50" x2="100" y2="50" stroke="oklch(100% 0 0 / 0.2)" strokeWidth="0.1" />
          <line x1="50" y1="0" x2="50" y2="100" stroke="oklch(100% 0 0 / 0.2)" strokeWidth="0.1" />

          {/* Rotating Radar 15-Degree Sector Fan Beam (Narrow Sleek Beam) */}
          <g className="animate-radar-sweep origin-center">
            <path d="M 50 50 L 98 50 A 48 48 0 0 0 96.36 37.58 Z" fill="url(#fullscreenRadarGrad)" opacity="0.6" />
          </g>

          <defs>
            <radialGradient id="fullscreenRadarGrad">
              <stop offset="0%" stopColor="oklch(85% 0.3 140)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="oklch(85% 0.3 140)" stopOpacity="0" />
            </radialGradient>
            
            {/* Region 1: Green (G) Top Axis - Pure Vibrant Green */}
            <radialGradient id="dotGradGreenDeep" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="oklch(88% 0.32 145)" />
              <stop offset="100%" stopColor="oklch(40% 0.25 145)" />
            </radialGradient>

            {/* Region 2: Amber (A) Right Axis - Rich Warm Amber/Orange */}
            <radialGradient id="dotGradAmberDeep" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="oklch(84% 0.28 75)" />
              <stop offset="100%" stopColor="oklch(45% 0.22 65)" />
            </radialGradient>

            {/* Region 3: Magenta (M) Bottom Axis - Deep Vivid Magenta */}
            <radialGradient id="dotGradMagentaDeep" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="oklch(76% 0.35 330)" />
              <stop offset="100%" stopColor="oklch(38% 0.26 330)" />
            </radialGradient>

            {/* Region 4: Blue (B) Left Axis - Deep Cobalt Cyan-Blue */}
            <radialGradient id="dotGradBlueDeep" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="oklch(80% 0.26 240)" />
              <stop offset="100%" stopColor="oklch(38% 0.20 240)" />
            </radialGradient>

            {/* Quadrant Blend 3D Gradients */}
            <radialGradient id="dotGradAmberGreen" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="oklch(86% 0.28 110)" />
              <stop offset="100%" stopColor="oklch(45% 0.20 105)" />
            </radialGradient>

            <radialGradient id="dotGradBlueGreen" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="oklch(82% 0.25 185)" />
              <stop offset="100%" stopColor="oklch(42% 0.18 180)" />
            </radialGradient>

            <radialGradient id="dotGradBlueMagenta" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="oklch(74% 0.30 285)" />
              <stop offset="100%" stopColor="oklch(38% 0.22 280)" />
            </radialGradient>

            <radialGradient id="dotGradAmberMagenta" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="oklch(78% 0.30 25)" />
              <stop offset="100%" stopColor="oklch(42% 0.22 20)" />
            </radialGradient>
          </defs>

          {/* Flat Minimalist Round Nodes - Timed to illuminate precisely as radar sweeps past */}
          {RADAR_DOTS.map((dot, idx) => (
            <circle
              key={idx}
              cx={dot.cx}
              cy={dot.cy}
              r="0.55"
              fill={dot.color}
              className="animate-radar-dot"
              style={{ animationDelay: dot.delay }}
            />
          ))}
        </svg>
      </div>

      {/* Dynamic Ambient Spectral Glow Halo */}
      <div 
        style={{ 
          transform: `translate3d(${tilt.x * 2.5}px, ${tilt.y * 2.5}px, 0)`,
          backgroundColor: accentGlow 
        }}
        className="pointer-events-none absolute -top-32 -left-32 h-[32rem] w-[32rem] rounded-full blur-[100px] transition-all duration-500 ease-out" 
      />
      <div 
        style={{ 
          transform: `translate3d(${-tilt.x * 2.5}px, ${-tilt.y * 2.5}px, 0)`,
          backgroundColor: accentGlow 
        }}
        className="pointer-events-none absolute -bottom-32 -right-32 h-[32rem] w-[32rem] rounded-full blur-[100px] transition-all duration-500 ease-out" 
      />

      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center justify-center my-auto py-6 preserve-3d">
        {/* Holographic Chrome Headline with 3D Parallax */}
        <h1 
          style={{ transform: `translateZ(45px) rotateX(${tilt.y * 0.25}deg) rotateY(${tilt.x * 0.25}deg)` }}
          className="text-4xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.25] pt-2 mb-4 transition-transform duration-150"
        >
          <span className="iridescent-text-lead inline-block px-2 drop-shadow-[0_10px_20px_oklch(75%_0.35_330_/_0.4)]">
            {t('headlineLead')}
          </span>
          <span className="iridescent-text-accent inline-block text-3xl sm:text-6xl lg:text-7xl mt-2 font-sans font-bold tracking-wider drop-shadow-[0_10px_20px_oklch(85%_0.3_140_/_0.4)]">
            {t('headlineAccent')}
          </span>
        </h1>

        {/* Subhead / Intro Description */}
        <p 
          style={{ transform: 'translateZ(25px)' }}
          className="max-w-2xl text-base sm:text-xl text-ink-muted leading-relaxed mb-10 transition-transform duration-150 font-sans"
        >
          {t('subhead')}
        </p>

        {/* 3D Holographic Optics Architecture Diagram Model */}
        <div 
          style={{ 
            transform: `rotateX(${tilt.y * 0.45}deg) rotateY(${tilt.x * 0.45}deg)`,
            transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className="relative w-full max-w-4xl preserve-3d"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-stretch relative preserve-3d">
            {/* Branch 1: Picture Profile (Left 3D Card) */}
            <div 
              onMouseEnter={() => setActiveAccent('pp')}
              onClick={(e) => {
                e.stopPropagation();
                scrollToCatalog('pp');
              }}
              className="holo-glass-card y2k-3d-card-left p-6 sm:p-7 rounded-3xl flex flex-col justify-between text-left relative group border border-white/15 cursor-pointer hover:border-[oklch(78%_0.25_240_/_0.6)] hover:shadow-[0_0_30px_oklch(78%_0.25_240_/_0.25)] transition-all duration-300"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-md bg-[oklch(78%_0.25_240_/_0.15)] text-[oklch(78%_0.25_240)] border border-[oklch(78%_0.25_240_/_0.3)] uppercase tracking-wider">
                    PP MODE
                  </span>
                </div>
                <div className="font-bold text-ink text-base sm:text-lg mb-2 font-sans">
                  {t('featurePp')}
                </div>
              </div>

              {/* Stacked Cyber Glitch Code Runner Badges (Presets + Parameters) */}
              <div className="flex flex-col gap-2 mt-4">
                {/* Ticker 1: Picture Profile Preset Mode */}
                <div className="h-9 min-h-[2.25rem] w-full text-xs font-mono bg-black/70 px-3 rounded-xl border flex items-center justify-start overflow-hidden text-ellipsis whitespace-nowrap border-[oklch(78%_0.25_240_/_0.3)] text-[oklch(78%_0.25_240)] shadow-[0_0_15px_oklch(78%_0.25_240_/_0.15)] group-hover:border-[oklch(78%_0.25_240_/_0.6)] transition-all duration-300">
                  <span className="text-[oklch(85%_0.3_140)] mr-2 font-bold animate-pulse shrink-0">&gt;_</span>
                  <span className={`cyber-glitch-text truncate ${isGlitching ? 'is-glitching' : ''}`}>
                    {glitchText.pp}
                  </span>
                </div>

                {/* Ticker 2: Picture Profile Fine-Tuning Parameters */}
                <div className="h-9 min-h-[2.25rem] w-full text-[11px] font-mono bg-black/70 px-3 rounded-xl border flex items-center justify-start overflow-hidden text-ellipsis whitespace-nowrap border-[oklch(78%_0.25_240_/_0.2)] text-[oklch(78%_0.25_240_/_0.85)] shadow-[0_0_10px_oklch(78%_0.25_240_/_0.1)] group-hover:border-[oklch(78%_0.25_240_/_0.5)] transition-all duration-300">
                  <span className="text-[oklch(85%_0.3_140)] mr-2 font-bold animate-pulse shrink-0">#</span>
                  <span className={`cyber-glitch-text truncate ${isGlitching ? 'is-glitching' : ''}`}>
                    {glitchText.ppParams}
                  </span>
                </div>
              </div>
            </div>

            {/* Core Node: WB Shift Matrix Simulation (Center Elevated 3D Hologram Card) */}
            <div 
              onMouseEnter={() => setActiveAccent('wb')}
              onClick={(e) => {
                e.stopPropagation();
                scrollToCatalog('all');
              }}
              className="holo-glass-card y2k-3d-card-center p-6 sm:p-7 rounded-3xl border-2 border-[oklch(85%_0.3_140_/_0.7)] shadow-[0_0_40px_oklch(85%_0.3_140_/_0.3)] flex flex-col justify-between text-left relative z-10 cursor-pointer group hover:border-[oklch(85%_0.3_140)] hover:shadow-[0_0_55px_oklch(85%_0.3_140_/_0.45)] transition-all duration-300"
            >
              <div>
                <div className="flex items-center justify-between mb-3 mt-1">
                  <span className="text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-md bg-[oklch(85%_0.3_140_/_0.15)] text-[oklch(85%_0.3_140)] border border-[oklch(85%_0.3_140_/_0.3)] uppercase tracking-wider">
                    REQUIRED
                  </span>
                </div>
                <div className="font-bold text-ink text-base sm:text-lg mb-2 font-sans">
                  {t('featureWb')}
                </div>
              </div>

              {/* Stacked Cyber Glitch Code Runner Badges (Presets + Shift Vectors) */}
              <div className="flex flex-col gap-2 mt-4">
                {/* Ticker 1: White Balance Preset / Kelvin Mode */}
                <div className="h-9 min-h-[2.25rem] w-full text-xs font-mono bg-black/70 px-3 rounded-xl border flex items-center justify-start overflow-hidden text-ellipsis whitespace-nowrap border-[oklch(85%_0.3_140_/_0.3)] text-[oklch(85%_0.3_140)] shadow-[0_0_15px_oklch(85%_0.3_140_/_0.15)] group-hover:border-[oklch(85%_0.3_140_/_0.6)] transition-all duration-300">
                  <span className="text-[oklch(78%_0.25_240)] mr-2 font-bold animate-pulse shrink-0">&gt;_</span>
                  <span className={`cyber-glitch-text truncate ${isGlitching ? 'is-glitching' : ''}`}>
                    {glitchText.wb}
                  </span>
                </div>

                {/* Ticker 2: White Balance Shift Coordinates (A-B & G-M Vectors) */}
                <div className="h-9 min-h-[2.25rem] w-full text-[11px] font-mono bg-black/70 px-3 rounded-xl border flex items-center justify-start overflow-hidden text-ellipsis whitespace-nowrap border-[oklch(85%_0.3_140_/_0.2)] text-[oklch(85%_0.3_140_/_0.85)] shadow-[0_0_10px_oklch(85%_0.3_140_/_0.1)] group-hover:border-[oklch(85%_0.3_140_/_0.5)] transition-all duration-300">
                  <span className="text-[oklch(78%_0.25_240)] mr-2 font-bold animate-pulse shrink-0">#</span>
                  <span className={`cyber-glitch-text truncate ${isGlitching ? 'is-glitching' : ''}`}>
                    {glitchText.wbParams}
                  </span>
                </div>
              </div>
            </div>

            {/* Branch 2: Creative Look (Right 3D Card) */}
            <div 
              onMouseEnter={() => setActiveAccent('cl')}
              onClick={(e) => {
                e.stopPropagation();
                scrollToCatalog('cl');
              }}
              className="holo-glass-card y2k-3d-card-right p-6 sm:p-7 rounded-3xl flex flex-col justify-between text-left relative group border border-white/15 cursor-pointer hover:border-[oklch(75%_0.35_330_/_0.6)] hover:shadow-[0_0_30px_oklch(75%_0.35_330_/_0.25)] transition-all duration-300"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-md bg-[oklch(75%_0.35_330_/_0.15)] text-[oklch(75%_0.35_330)] border border-[oklch(75%_0.35_330_/_0.3)] uppercase tracking-wider">
                    CL MODE
                  </span>
                </div>
                <div className="font-bold text-ink text-base sm:text-lg mb-2 font-sans">
                  {t('featureCl')}
                </div>
              </div>

              {/* Stacked Cyber Glitch Code Runner Badges (Presets + Parameters) */}
              <div className="flex flex-col gap-2 mt-4">
                {/* Ticker 1: Creative Look Preset Name */}
                <div className="h-9 min-h-[2.25rem] w-full text-xs font-mono bg-black/70 px-3 rounded-xl border flex items-center justify-start overflow-hidden text-ellipsis whitespace-nowrap border-[oklch(75%_0.35_330_/_0.3)] text-[oklch(75%_0.35_330)] shadow-[0_0_15px_oklch(75%_0.35_330_/_0.15)] group-hover:border-[oklch(75%_0.35_330_/_0.6)] transition-all duration-300">
                  <span className="text-[oklch(85%_0.3_140)] mr-2 font-bold animate-pulse shrink-0">&gt;_</span>
                  <span className={`cyber-glitch-text truncate ${isGlitching ? 'is-glitching' : ''}`}>
                    {glitchText.cl}
                  </span>
                </div>

                {/* Ticker 2: Creative Look Parameter Values */}
                <div className="h-9 min-h-[2.25rem] w-full text-[11px] font-mono bg-black/70 px-3 rounded-xl border flex items-center justify-start overflow-hidden text-ellipsis whitespace-nowrap border-[oklch(75%_0.35_330_/_0.2)] text-[oklch(75%_0.35_330_/_0.85)] shadow-[0_0_10px_oklch(75%_0.35_330_/_0.1)] group-hover:border-[oklch(75%_0.35_330_/_0.5)] transition-all duration-300">
                  <span className="text-[oklch(78%_0.25_240)] mr-2 font-bold animate-pulse shrink-0">#</span>
                  <span className={`cyber-glitch-text truncate ${isGlitching ? 'is-glitching' : ''}`}>
                    {glitchText.clParams}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
