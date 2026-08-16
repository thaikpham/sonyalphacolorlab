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
      {/* Main Image Stage.

          The plate stays white and opaque: the catalogue photos are B&H JPEGs
          shot on white, so a translucent frame would only put a white rectangle
          inside a dark one. The stroke round it is gone — the panel radius and
          elevation 1 are what make it read as an object. */}
      <div className="relative w-full aspect-[4/3] min-h-[18rem] rounded-lg bg-white p-4 shadow-[var(--elevation-1)] overflow-hidden">
        <Image
          src={currentImage}
          alt={`${productName} - Photo ${activeIndex + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 33vw"
          priority={activeIndex === 0}
          className="object-contain p-2"
        />
        {images.length > 1 && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-sm bg-void/70 backdrop-blur-[30px] shadow-[var(--elevation-1)] text-label font-semibold text-ink tabular-nums">
            {activeIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails — a rail, so it never advertises its own overflow. The
          selection is an accent-tinted fill round the plate, never a ring. */}
      {images.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scroll-silent">
          {images.map((imgUrl, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={`${imgUrl}-${idx}`}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`shrink-0 w-16 h-16 p-1 rounded-md cursor-pointer transition-opacity ${
                  isActive
                    ? 'bg-accent-500/25 shadow-[var(--elevation-1)]'
                    : 'bg-glass opacity-70 hover:opacity-100'
                }`}
                aria-label={`View photo ${idx + 1} of ${productName}`}
              >
                <span className="relative block w-full h-full rounded-sm bg-white overflow-hidden">
                  <Image
                    src={imgUrl}
                    alt={`Thumbnail ${idx + 1}`}
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
