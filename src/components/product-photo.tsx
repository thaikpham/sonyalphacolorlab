'use client';

import { useState } from 'react';
import Image from 'next/image';
import { isResizable } from '@/lib/images/catalogue-loader';

/**
 * Stands in for product photography the source does not publish.
 *
 * Shared by the catalogue grid, the compare picker and the product gallery, so
 * a dead photo reads the same on every surface rather than as a mark on one and
 * a broken-image box on the next.
 */
export function NoPhoto({ label }: { label?: string }) {
  return (
    <span className="flex flex-col items-center justify-center gap-1 text-void/40">
      <span className="text-title-2 leading-none" aria-hidden>
        ◫
      </span>
      {label && <span className="text-label font-semibold">{label}</span>}
    </span>
  );
}

/**
 * A catalogue photograph that degrades to the no-photo mark when the file does
 * not load.
 *
 * A missing `imageUrl` was already handled; a PRESENT but dead one was not, and
 * that is the case the catalogue actually has. 18 of its 94 products fail to
 * load today: 17 point at `www.sony.com.vn`, which answers 403 to anything that
 * is not its own page — a browser user-agent and a matching referer do not help
 * — and one B&H id has been withdrawn (it 404s at its original path too, so the
 * size rewrite is not what broke it). Those 18 rendered a broken-image box on a
 * white plate, which reads as a bug in the page rather than a gap in the source.
 *
 * `onError` is the only signal available: whether a remote image decoded is not
 * knowable at render time, and the failures are per-URL rather than per-host, so
 * there is nothing to branch on up front.
 */
export function ProductPhoto({
  src,
  alt,
  sizes,
  className,
  label,
  size,
}: {
  src: string | null | undefined;
  alt: string;
  /** Required unless `size` is given — `fill` needs it to pick a variant. */
  sizes?: string;
  className: string;
  label?: string;
  /** Fixed square instead of `fill`, for the table and picker thumbnails. */
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <NoPhoto label={label} />;

  if (size) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={className}
        /* One published file and no choice to make; see `isResizable`. */
        unoptimized={!isResizable(src)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      unoptimized={!isResizable(src)}
      onError={() => setFailed(true)}
    />
  );
}
