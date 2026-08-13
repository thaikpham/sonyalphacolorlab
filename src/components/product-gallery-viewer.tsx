'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductGalleryViewerProps {
  primaryImageUrl: string;
  galleryUrls?: string[];
  productName: string;
}

export function ProductGalleryViewer({
  primaryImageUrl,
  galleryUrls = [],
  productName,
}: ProductGalleryViewerProps) {
  // Deduplicate and filter out empty strings
  const images = Array.from(
    new Set([primaryImageUrl, ...galleryUrls].filter((u) => u && u.trim().length > 0))
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const currentImage = images[activeIndex] || primaryImageUrl || '/logo.png';

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Main Image Stage */}
      <div className="relative w-full aspect-[4/3] lg:aspect-[4/3] min-h-[18rem] rounded-2xl bg-white border border-white/20 p-4 shadow-xl overflow-hidden group">
        <Image
          src={currentImage}
          alt={`${productName} - Photo ${activeIndex + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 33vw"
          priority={activeIndex === 0}
          className="object-contain p-2 transition-all duration-300 group-hover:scale-105"
        />
        {images.length > 1 && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white/90 text-[11px] font-mono font-medium shadow-md">
            {activeIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails Bar */}
      {images.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full custom-scrollbar">
          {images.map((imgUrl, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={`${imgUrl}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`relative shrink-0 w-16 h-16 rounded-xl border bg-white p-1 transition-all overflow-hidden cursor-pointer ${
                  isActive
                    ? 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg scale-105'
                    : 'border-white/20 opacity-70 hover:opacity-100 hover:border-white/40'
                }`}
                aria-label={`View photo ${idx + 1} of ${productName}`}
              >
                <Image
                  src={imgUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  sizes="64px"
                  className="object-contain p-1"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
