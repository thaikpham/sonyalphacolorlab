'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import catalogueImageLoader, { isResizable } from '@/lib/images/catalogue-loader';
import { NoPhoto } from './product-photo';

interface ProductGalleryViewerProps {
  primaryImageUrl: string;
  galleryUrls?: string[];
  productName: string;
}

/**
 * The photos to show, first occurrence wins.
 *
 * Deduplicated by the file the loader would actually serve, not by the stored
 * string. The seed stores B&H's `images/fb/<id>.jpg` as the primary and repeats
 * it in the gallery beside `images/images1000x1000/<id>.jpg` — the same photo
 * one size directory over — so an exact-string Set showed FX2 as "1 / 2" with
 * two identical thumbnails. The loader rewrites both to one rung, which makes
 * it the honest key: two URLs it serves as one file are one photo, and a
 * directory it does not resize is never merged with anything.
 *
 * `failed` holds the URLs that did not load (`www.sony.com.vn` answers 403 to
 * hotlinks; see `ProductPhoto`), so a dead photo leaves the rail instead of
 * sitting in it as a broken box.
 */
export function galleryImages(
  primary: string,
  gallery: readonly string[] = [],
  failed: ReadonlySet<string> = new Set(),
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [primary, ...gallery]) {
    if (!url || !url.trim() || failed.has(url)) continue;
    const key = catalogueImageLoader({ src: url, width: 4000 });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

export function ProductGalleryViewer({
  primaryImageUrl,
  galleryUrls = [],
  productName,
}: ProductGalleryViewerProps) {
  const t = useTranslations('cameras');
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const images = galleryImages(primaryImageUrl, galleryUrls, failed);

  const [activeIndex, setActiveIndex] = useState(0);
  /* A failure can shorten the list under the selection. */
  const shownIndex = Math.min(activeIndex, Math.max(images.length - 1, 0));
  const currentImage = images[shownIndex];

  const markFailed = (url: string) => setFailed((prev) => new Set(prev).add(url));

  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Main Image Stage.

          The plate stays white and opaque: the catalogue photos are B&H JPEGs
          shot on white, so a translucent frame would only put a white rectangle
          inside a dark one. The stroke round it is gone — the panel radius and
          elevation 1 are what make it read as an object. */}
      <div className="relative w-full aspect-[4/3] min-h-[18rem] rounded-lg bg-white p-4 shadow-[var(--elevation-1)] overflow-hidden">
        {currentImage ? (
          <Image
            key={currentImage}
            src={currentImage}
            alt={t('galleryPhotoAlt', { name: productName, index: shownIndex + 1 })}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            priority={shownIndex === 0}
            className="object-contain p-2"
            /* Sony's hosts publish one file; see `isResizable`. */
            unoptimized={!isResizable(currentImage)}
            onError={() => markFailed(currentImage)}
          />
        ) : (
          /* Nothing that loads: the mark the catalogue card shows, not a
             broken box with an alt text claiming a photo. */
          <span className="absolute inset-0 flex items-center justify-center">
            <NoPhoto label={t('noPhoto')} />
          </span>
        )}
        {images.length > 1 && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-sm bg-void/70 backdrop-blur-[30px] shadow-[var(--elevation-1)] text-label font-semibold text-ink tabular-nums">
            {shownIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails — a rail, so it never advertises its own overflow. The
          selection is an accent-tinted fill round the plate, never a ring. */}
      {images.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full scroll-silent">
          {images.map((imgUrl, idx) => {
            const isActive = idx === shownIndex;
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
                aria-label={t('galleryThumbLabel', { name: productName, index: idx + 1 })}
              >
                {/* Empty alt: the button's label already names the photo, and
                    a second name inside it is read twice. */}
                <span className="relative block w-full h-full rounded-sm bg-white overflow-hidden">
                  <Image
                    src={imgUrl}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                    unoptimized={!isResizable(imgUrl)}
                    onError={() => markFailed(imgUrl)}
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
