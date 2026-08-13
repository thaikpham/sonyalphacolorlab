'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { ECOSYSTEM_APPS, type EcosystemAppDef } from '@/lib/ecosystem';

export function DiIcon() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="font-mono text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter bg-gradient-to-br from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent drop-shadow-md select-none">
        DI
      </span>
    </div>
  );
}

export function PeIcon() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="font-mono text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter bg-gradient-to-br from-cyan-200 via-sky-300 to-indigo-400 bg-clip-text text-transparent drop-shadow-md select-none">
        PE
      </span>
    </div>
  );
}

type Props = {
  size?: 'md' | 'lg';
  onNavigate?: () => void;
};

export function LauncherGrid({ size = 'lg', onNavigate }: Props) {
  const [subView, setSubView] = useState<'main' | 'sonywiki'>('main');

  const tileClass =
    size === 'lg'
      ? 'w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48'
      : 'w-32 h-32 sm:w-40 sm:h-40';

  const labelClass =
    size === 'lg'
      ? 'text-[1rem] sm:text-lg lg:text-xl'
      : 'text-[1rem] sm:text-lg';

  const handleTileClick = (app: EcosystemAppDef, e: React.MouseEvent) => {
    if (app.key === 'wiki') {
      e.preventDefault();
      setSubView('sonywiki');
    } else if (onNavigate) {
      setTimeout(onNavigate, 200);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* Main Ecosystem Apps View */}
      {subView === 'main' ? (
        <div className="grid w-full max-w-3xl grid-cols-2 items-center justify-items-center gap-x-8 gap-y-12 sm:gap-x-16 sm:gap-y-16 transition-all duration-300 animate-fadeIn">
          {ECOSYSTEM_APPS.map((app) => {
            const shell = `group app-enter ${app.enter} flex flex-col items-center text-center max-w-[240px] cursor-pointer`;
            
            const body = (
              <>
                <div className={`app-tile-shell ${tileClass} mb-3 sm:mb-4`}>
                  <span aria-hidden className="app-glow" />
                  <div className={`app-tile w-full h-full ${app.iconInset} flex items-center justify-center`}>
                    <Image
                      src={app.icon}
                      alt=""
                      width={200}
                      height={200}
                      unoptimized
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <h2 className={`${labelClass} font-bold text-white transition-colors tracking-wide drop-shadow-md ${app.accent ?? ''}`}>
                  {app.name}
                </h2>
              </>
            );

            if (app.key === 'wiki') {
              return (
                <button
                  key={app.key}
                  type="button"
                  onClick={(e) => handleTileClick(app, e)}
                  className={shell}
                >
                  {body}
                </button>
              );
            }

            if (app.external) {
              return (
                <a
                  key={app.key}
                  href={app.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onNavigate && setTimeout(onNavigate, 200)}
                  className={shell}
                >
                  {body}
                </a>
              );
            }

            return (
              <Link
                key={app.key}
                href={app.href}
                onClick={onNavigate}
                className={shell}
              >
                {body}
              </Link>
            );
          })}
        </div>
      ) : (
        /* Sony Wiki Sub-Division View (DI & PE Tiles) */
        <div className="flex flex-col items-center justify-center w-full max-w-3xl transition-all duration-300 animate-fadeIn">
          {/* Viewport Top-Left Back Button */}
          <button
            type="button"
            onClick={() => setSubView('main')}
            className="fixed top-5 left-5 sm:top-8 sm:left-8 z-[100000] px-4 py-2 rounded-full bg-black/70 hover:bg-black/90 text-white/90 hover:text-white font-mono text-xs font-bold border border-white/20 hover:border-amber-400/50 transition-all flex items-center gap-2 cursor-pointer shadow-2xl backdrop-blur-xl hover:scale-105"
          >
            <span className="text-amber-400">←</span>
            <span>Quay lại ứng dụng</span>
          </button>

          {/* Sub-App Grid: DI (Digital Imaging) & PE (Personal Entertainment) */}
          <div className="grid w-full grid-cols-2 items-center justify-items-center gap-x-8 gap-y-12 sm:gap-x-16 sm:gap-y-16">
            {/* DI - Digital Imaging */}
            <Link
              href="/cameras"
              onClick={onNavigate}
              className="group flex flex-col items-center text-center max-w-[260px] cursor-pointer"
            >
              <div className={`app-tile-shell ${tileClass} mb-3 sm:mb-4`}>
                <span aria-hidden className="app-glow" />
                <div className="app-tile w-full h-full flex items-center justify-center overflow-hidden border border-amber-400/40">
                  <DiIcon />
                </div>
              </div>
              <h2 className={`${labelClass} font-bold text-white group-hover:text-amber-300 transition-colors tracking-wide drop-shadow-md`}>
                DI · Digital Imaging
              </h2>
              <p className="text-[11px] sm:text-xs text-white/70 mt-1 font-sans">
                Máy ảnh, Ống kính & Phụ kiện
              </p>
            </Link>

            {/* PE - Personal Entertainment */}
            <Link
              href="/audio"
              onClick={onNavigate}
              className="group flex flex-col items-center text-center max-w-[260px] cursor-pointer"
            >
              <div className={`app-tile-shell ${tileClass} mb-3 sm:mb-4`}>
                <span aria-hidden className="app-glow" />
                <div className="app-tile w-full h-full flex items-center justify-center overflow-hidden border border-cyan-400/40">
                  <PeIcon />
                </div>
              </div>
              <h2 className={`${labelClass} font-bold text-white group-hover:text-cyan-300 transition-colors tracking-wide drop-shadow-md`}>
                PE · Personal Entertainment
              </h2>
              <p className="text-[11px] sm:text-xs text-white/70 mt-1 font-sans">
                Tai nghe, Loa & Thiết bị âm thanh
              </p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
