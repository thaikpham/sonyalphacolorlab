'use client';

import Image from 'next/image';
import { useState } from 'react';
import { RecipeColorField } from './recipe-color-field';

/**
 * A recipe's grid photograph, with the derived colour field behind it.
 *
 * Recipe photographs are served from Supabase Storage, and Storage is the part
 * of the stack that can stop answering while the rest of the page is fine: a
 * spent egress quota restricts the whole project and every image URL answers
 * `402` with a JSON body. The card was rendering `<Image>` whenever the recipe
 * had a path on file, so the whole grid became 210px of broken-image box —
 * indistinguishable, to a reader, from the site being broken.
 *
 * It cannot be caught server-side: the path exists in the seed either way, and
 * whether the bytes arrive is only known once a browser asks. So the swap
 * happens here, on `onError`, and lands on the same field an unphotographed
 * recipe shows. A degraded grid then reads as deliberate rather than broken.
 *
 * This does not make a restricted project serve images again — nothing in the
 * repo can. It stops the outage from looking like a bug in the page.
 */
export function RecipePhoto({
  src,
  alt,
  sizes,
  accent,
}: {
  src: string;
  alt: string;
  sizes: string;
  accent: string;
}) {
  /* The failed src, not a boolean: React reuses this component across cards as
     a filtered grid re-renders, and a boolean would carry one recipe's failure
     onto the next recipe's photograph. Comparing against the current src makes
     the state self-healing instead. */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) return <RecipeColorField accent={accent} />;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className="object-cover"
      onError={() => setFailedSrc(src)}
    />
  );
}
