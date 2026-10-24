/**
 * Alpha ColorLab's own Picture Profile library — 35 originals, cooked from the
 * way Sony's Help Guide for Creators explains each parameter (Gamma / Color
 * Mode, Black Level / Black Gamma / Knee, Saturation / Color Phase / Color
 * Depth, Detail), never from memory and never from anyone else's recipes.
 *
 * The first 23 (048–070) replace the 36 Picture Profiles withdrawn on
 * 2026-10-23 as matching a licensed third-party collection (see
 * RETIRED_LEGACY_IDS in src/lib/recipes/redirects.ts); the next 12 (071–082),
 * added 2026-10-24, fill moods the catalogue had no recipe for. Each one was
 * checked against recipeSchema, against Sony's own constraints (no Knee Auto
 * on a gamma Sony says turns it off, no slope +5, |Color Phase| ≤ 2 and 0 on
 * a portrait recipe, no Color Depth at ±7, a documented Gamma / Color Mode
 * pair or a stated reason) and for distance from that collection. The rules
 * are pinned in originals.test.ts.
 *
 * Cine3 and Cine4 with the Still colour mode (060, 062, 071, 074) is the set's
 * one departure from Sony's pairing, by design and said so in each `intent`:
 * the curve's contrast under Still's hues.
 *
 * Names are `PP-NNN-Mood Words` (src/lib/recipes/names.ts); the slug keeps the
 * place each was first imagined for.
 *
 * `published: false` on every one, deliberately (D8): the numbers are design
 * hypotheses until the owner has shot each on the a7 IV. Publishing is an
 * editor's act in /admin/colorlab.
 *
 * Vietnamese prose lives in data/translations.vi.json like every other
 * recipe's; the situations, style and tone in data/recipe-taxonomy.json.
 * `intent` is the one-line brief the recipe was cooked to, kept beside the
 * numbers so a later tuning pass knows what to tune towards.
 *
 * Read by scripts/emit-seed.ts, which validates each entry and refuses the
 * whole emit on the first failure.
 */

import type { Recipe } from '../camera/schema';

export type OriginalRecipe = {
  readonly recipe: Recipe;
  /** The brief the numbers were cooked to. */
  readonly intent: string;
  /** English description, the seed's `en` translation. */
  readonly description: string;
};

export const ORIGINAL_PP: readonly OriginalRecipe[] = [
  {
    recipe: {
      id: 'SCL-PP-048',
      slug: 'hue-silk',
      name: 'PP-048-Soft Clean Portrait',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5300,
        shift: {
          gm: {
            axis: 'M',
            amount: 0.5
          }
        }
      },
      tags: [
        'portrait',
        'skin',
        'soft',
        'natural'
      ],
      settings: {
        blackLevel: -1,
        gamma: 'S-Cinetone',
        blackGamma: {
          range: 'Middle',
          level: 1
        },
        knee: {
          mode: 'Manual',
          point: 90,
          slope: -1
        },
        colorMode: 'S-Cinetone',
        saturation: 6,
        colorPhase: 0,
        colorDepth: {
          R: -2,
          G: 1,
          B: 2,
          C: 1,
          M: -2,
          Y: -1
        },
        detail: {
          level: -2,
          mode: 'Manual',
          vhBalance: -1,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 4,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'daylight portrait — bright clean skin, quiet background (Knee 90% −1 is nearly inert: try 85% +1, Sony’s film-like pair, after the shoot)',
    description: 'Soft S-Cinetone contrast with skin lifted a touch brighter and less flushed, while foliage and sky stay slightly deeper so the face separates from the background. Built for daylight portraits in open shade.'
  },
  {
    recipe: {
      id: 'SCL-PP-049',
      slug: 'clear-day',
      name: 'PP-049-Clean Natural Daylight',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500
      },
      tags: [
        'everyday',
        'clean',
        'natural',
        'travel'
      ],
      settings: {
        blackLevel: -2,
        gamma: 'Still',
        blackGamma: {
          range: 'Narrow',
          level: -1
        },
        knee: {
          mode: 'Manual',
          point: 95,
          slope: 1
        },
        colorMode: 'Still',
        saturation: 6,
        colorPhase: 0,
        colorDepth: {
          R: -1,
          G: 1,
          B: 2,
          C: 1,
          M: 0,
          Y: -1
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 3,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'everyday — the camera’s own colour, a little cleaner',
    description: 'The camera’s own colour made a little cleaner: firmer blacks, a light knee that eases only the brightest highlights, and a small lift in saturation. A dependable everyday setting for daylight.'
  },
  {
    recipe: {
      id: 'SCL-PP-050',
      slug: 'linen-editorial',
      name: 'PP-050-Neutral Crisp Studio',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5600,
        shift: {
          ab: {
            axis: 'B',
            amount: 0.5
          }
        }
      },
      tags: [
        'fashion',
        'editorial',
        'product',
        'neutral'
      ],
      settings: {
        blackLevel: -1,
        gamma: 'ITU709',
        blackGamma: {
          range: 'Middle',
          level: 1
        },
        knee: {
          mode: 'Auto'
        },
        colorMode: 'Pro',
        saturation: 4,
        colorPhase: 0,
        colorDepth: {
          R: -1,
          G: 0,
          B: 1,
          C: 1,
          M: 0,
          Y: -1
        },
        detail: {
          level: 1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 4,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'fashion and product — true fabric colour, clean whites',
    description: 'Broadcast-style colour on the ITU709 curve, the pairing Sony documents for it: fabrics stay true, whites stay clean and neutral, with a touch more texture. For fashion, lookbooks and product.'
  },
  {
    recipe: {
      id: 'SCL-PP-051',
      slug: 'sa-pa-morning',
      name: 'PP-051-Range Soft Landscape',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5600,
        shift: {
          ab: {
            axis: 'B',
            amount: 0.5
          }
        }
      },
      tags: [
        'landscape',
        'dynamic-range',
        'backlight',
        'mountain'
      ],
      settings: {
        blackLevel: -1,
        gamma: 'Cine1',
        blackGamma: {
          range: 'Wide',
          level: 2
        },
        knee: {
          mode: 'Manual',
          point: 88,
          slope: -2
        },
        colorMode: 'Cinema',
        saturation: 12,
        colorPhase: 0,
        colorDepth: {
          R: -1,
          G: 3,
          B: 3,
          C: 3,
          M: -1,
          Y: -2
        },
        detail: {
          level: 1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 4,
          hiLightDetail: 3
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'backlight and mountains — hold sky and shadow out of camera',
    description: 'Cine1 with a gentle knee keeps both a bright sky and shaded ground in the frame, then saturation and deeper greens and blues bring the colour back so it looks finished, not flat. For backlit landscapes and mountain mornings.'
  },
  {
    recipe: {
      id: 'SCL-PP-052',
      slug: 'mekong-noon',
      name: 'PP-052-Range Bright Daylight',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5400,
        shift: {
          ab: {
            axis: 'A',
            amount: 1
          }
        }
      },
      tags: [
        'travel',
        'dynamic-range',
        'harsh-light',
        'street'
      ],
      settings: {
        blackLevel: -3,
        gamma: 'S-Cinetone',
        blackGamma: {
          range: 'Middle',
          level: 2
        },
        knee: {
          mode: 'Manual',
          point: 85,
          slope: -2
        },
        colorMode: 'S-Cinetone',
        saturation: 10,
        colorPhase: 0,
        colorDepth: {
          R: -1,
          G: 2,
          B: 4,
          C: 4,
          M: 0,
          Y: -2
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 5,
          hiLightDetail: 3
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'harsh midday sun — open the shadows, roll the highlights',
    description: 'For hard midday sun: shadows opened with Black Gamma, highlights rolled off early, and sky and water deepened so colour survives the glare. Straight out of camera, no grading.'
  },
  {
    recipe: {
      id: 'SCL-PP-053',
      slug: 'mui-ne-dusk',
      name: 'PP-053-Range Warm Dusk',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 6200
      },
      tags: [
        'sunset',
        'dynamic-range',
        'golden-hour',
        'warm'
      ],
      settings: {
        blackLevel: -2,
        gamma: 'Cine1',
        blackGamma: {
          range: 'Wide',
          level: 3
        },
        knee: {
          mode: 'Manual',
          point: 80,
          slope: -4
        },
        colorMode: 'Cinema',
        saturation: 14,
        colorPhase: 1,
        colorDepth: {
          R: -1,
          G: 1,
          B: 3,
          C: 2,
          M: 1,
          Y: -2
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 5,
          hiLightDetail: 4
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'sunsets and into-the-sun — the widest range this set gets out of camera',
    description: 'Deliberately one of the flattest colour recipes here: an early, very gentle knee and opened shadows keep the sun’s glow and the foreground together, with warm white balance and extra saturation so it still reads as a sunset. Soft by design.'
  },
  {
    recipe: {
      id: 'SCL-PP-054',
      slug: 'phu-quoc-blue',
      name: 'PP-054-Cyan Vivid Coast',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5200,
        shift: {
          ab: {
            axis: 'B',
            amount: 1
          }
        }
      },
      tags: [
        'vivid',
        'beach',
        'travel',
        'summer'
      ],
      settings: {
        blackLevel: -2,
        gamma: 'Still',
        blackGamma: {
          range: 'Narrow',
          level: -2
        },
        knee: {
          mode: 'Manual',
          point: 95,
          slope: 1
        },
        colorMode: 'Still',
        saturation: 16,
        colorPhase: -1,
        colorDepth: {
          R: -1,
          G: 2,
          B: 4,
          C: 5,
          M: -1,
          Y: -3
        },
        detail: {
          level: 1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 3,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'sea, sky and sand — fresh turquoise, clean whites',
    description: 'Fresh and clean: slightly cool whites, turquoise water and sky pushed deeper, sand and yellows kept bright. Made for beaches, pools and summer travel.'
  },
  {
    recipe: {
      id: 'SCL-PP-055',
      slug: 'tam-coc-green',
      name: 'PP-055-Green Vivid Nature',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5800,
        shift: {
          ab: {
            axis: 'A',
            amount: 1
          }
        }
      },
      tags: [
        'vivid',
        'landscape',
        'nature',
        'green'
      ],
      settings: {
        blackLevel: -3,
        gamma: 'Still',
        blackGamma: {
          range: 'Narrow',
          level: -2
        },
        knee: {
          mode: 'Manual',
          point: 92,
          slope: 0
        },
        colorMode: 'Still',
        saturation: 15,
        colorPhase: 1,
        colorDepth: {
          R: 0,
          G: 5,
          B: 3,
          C: 3,
          M: -1,
          Y: -4
        },
        detail: {
          level: 1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 3,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'rice fields and foliage — rich greens that stay natural',
    description: 'Rich greens that stay natural: deeper leaf greens, brighter yellow-greens and a small warm turn so rice fields glow instead of going emerald. For landscapes, gardens and countryside.'
  },
  {
    recipe: {
      id: 'SCL-PP-056',
      slug: 'hoi-an-lantern',
      name: 'PP-056-Warm Vivid Festival',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 6000
      },
      tags: [
        'vivid',
        'festival',
        'ao-dai',
        'tet'
      ],
      settings: {
        blackLevel: -2,
        gamma: 'Movie',
        blackGamma: {
          range: 'Middle',
          level: 0
        },
        knee: {
          mode: 'Auto',
          sensitivity: 'Mid'
        },
        colorMode: 'Movie',
        saturation: 14,
        colorPhase: 1,
        colorDepth: {
          R: 2,
          G: 1,
          B: 2,
          C: 1,
          M: 1,
          Y: -1
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 4,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'festivals, áo dài and Tết reds — saturated without clipping red',
    description: 'Saturated and warm for festivals, áo dài and Tết, with reds deepened rather than brightened so they keep texture instead of clipping. Golds stay bright.'
  },
  {
    recipe: {
      id: 'SCL-PP-057',
      slug: 'tet-blossom',
      name: 'PP-057-Rosy Bright Portrait',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 6000,
        shift: {
          gm: {
            axis: 'M',
            amount: 0.75
          }
        }
      },
      tags: [
        'tet',
        'ao-dai',
        'flowers',
        'portrait'
      ],
      settings: {
        blackLevel: -1,
        gamma: 'Still',
        blackGamma: {
          range: 'Middle',
          level: 1
        },
        knee: {
          mode: 'Manual',
          point: 92,
          slope: 0
        },
        colorMode: 'Still',
        saturation: 13,
        colorPhase: 0,
        colorDepth: {
          R: -1,
          G: 2,
          B: 1,
          C: 0,
          M: 2,
          Y: -4
        },
        detail: {
          level: -1,
          mode: 'Manual',
          vhBalance: -1,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 4,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'Tết portraits among apricot and peach blossom — bright yellows, rosy pinks, clean skin',
    description: 'For Tết portraits among apricot and peach blossom: yellow blossoms kept bright, pinks a little richer, skin lifted and a soft rosy warmth over the frame.'
  },
  {
    recipe: {
      id: 'SCL-PP-058',
      slug: 'da-lat-mist',
      name: 'PP-058-Cool Pastel Matte',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5200,
        shift: {
          ab: {
            axis: 'B',
            amount: 1
          }
        }
      },
      tags: [
        'retro',
        'pastel',
        'faded',
        'romantic'
      ],
      settings: {
        blackLevel: 5,
        gamma: 'Cine1',
        blackGamma: {
          range: 'Wide',
          level: 2
        },
        knee: {
          mode: 'Manual',
          point: 85,
          slope: -1
        },
        colorMode: 'Cinema',
        saturation: -4,
        colorPhase: 0,
        colorDepth: {
          R: -2,
          G: 1,
          B: -2,
          C: 2,
          M: -2,
          Y: 1
        },
        detail: {
          level: -1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 5,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'matte pastel with cool shadows — romantic, foggy days',
    description: 'Lifted, matte blacks and cool pastel colour with a pale sky. Romantic and foggy; suits overcast portraits and misty hills.'
  },
  {
    recipe: {
      id: 'SCL-PP-059',
      slug: 'ha-noi-winter',
      name: 'PP-059-Warm Muted Nostalgia',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 6000,
        shift: {
          ab: {
            axis: 'A',
            amount: 1
          }
        }
      },
      tags: [
        'retro',
        'warm',
        'nostalgic',
        'street'
      ],
      settings: {
        blackLevel: 3,
        gamma: 'Movie',
        blackGamma: {
          range: 'Wide',
          level: 1
        },
        knee: {
          mode: 'Auto'
        },
        colorMode: 'Movie',
        saturation: -8,
        colorPhase: 1,
        colorDepth: {
          R: 1,
          G: 2,
          B: -3,
          C: -1,
          M: 0,
          Y: 2
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 5,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'muted warm nostalgia — old walls, overcast streets',
    description: 'Muted, warm nostalgia: low saturation, ochre yellows and olive greens deepened, blues faded. For old walls, overcast streets and quiet everyday moments.'
  },
  {
    recipe: {
      id: 'SCL-PP-060',
      slug: 'cho-lon-slide',
      name: 'PP-060-Warm Dense Slide',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5000,
        shift: {
          ab: {
            axis: 'A',
            amount: 2
          }
        }
      },
      tags: [
        'retro',
        'slide-film',
        'contrast',
        'street'
      ],
      settings: {
        blackLevel: -4,
        gamma: 'Cine3',
        blackGamma: {
          range: 'Narrow',
          level: -2
        },
        knee: {
          mode: 'Manual',
          point: 90,
          slope: 1
        },
        colorMode: 'Still',
        saturation: 12,
        colorPhase: 2,
        colorDepth: {
          R: 3,
          G: 2,
          B: 3,
          C: 1,
          M: 2,
          Y: 1
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 4,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'dense slide-film punch — deep blacks, rich warm colour (Cine3 with Still colour, off Sony’s pairing by design: Cine3’s contrast under Still’s hues)',
    description: 'Dense, slide-film punch: Cine3 contrast with deep blacks, every colour deepened a little and a warm turn in the hues. For street, markets and bold daylight scenes.'
  },
  {
    recipe: {
      id: 'SCL-PP-061',
      slug: 'sai-gon-cafe',
      name: 'PP-061-Tungsten Soft Indoor',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 3400
      },
      tags: [
        'indoor',
        'cafe',
        'tungsten',
        'lifestyle'
      ],
      settings: {
        blackLevel: -1,
        gamma: 'Movie',
        blackGamma: {
          range: 'Wide',
          level: 2
        },
        knee: {
          mode: 'Auto',
          sensitivity: 'High'
        },
        colorMode: 'Movie',
        saturation: 4,
        colorPhase: -1,
        colorDepth: {
          R: -2,
          G: 1,
          B: 3,
          C: 2,
          M: -1,
          Y: -2
        },
        detail: {
          level: -1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 3,
          crispening: 6,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'tungsten cafés and homes — cosy, not orange',
    description: 'Designed for warm indoor bulbs (around 2700–3200K): it keeps the cosy warmth but stops skin and wood turning orange, and the knee starts early to hold the lamps. In daylight it renders strongly blue.'
  },
  {
    recipe: {
      id: 'SCL-PP-062',
      slug: 'neon-night',
      name: 'PP-062-Cyan Deep Night',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 3800,
        shift: {
          ab: {
            axis: 'B',
            amount: 1
          }
        }
      },
      tags: [
        'night',
        'city-lights',
        'street',
        'cinematic'
      ],
      settings: {
        blackLevel: -3,
        gamma: 'Cine4',
        blackGamma: {
          range: 'Narrow',
          level: -2
        },
        knee: {
          mode: 'Manual',
          point: 90,
          slope: -1
        },
        colorMode: 'Still',
        saturation: 10,
        colorPhase: -1,
        colorDepth: {
          R: -1,
          G: 0,
          B: 3,
          C: 4,
          M: 2,
          Y: -2
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 3,
          crispening: 6,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'city night — clean cyan streets, rolled-off signs (Cine4 with Still colour, off Sony’s pairing by design: Cine4’s dark contrast under Still’s hues)',
    description: 'City night with clean cyan and blue accents, deep Cine4 blacks and signs rolled off by the knee. Made for street lamps and neon; in daylight it renders strongly blue.'
  },
  {
    recipe: {
      id: 'SCL-PP-063',
      slug: 'ben-thanh-night',
      name: 'PP-063-Warm Vivid Night',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 4000
      },
      tags: [
        'night',
        'night-market',
        'street-food',
        'travel'
      ],
      settings: {
        blackLevel: -2,
        gamma: 'Still',
        blackGamma: {
          range: 'Wide',
          level: 1
        },
        knee: {
          mode: 'Manual',
          point: 88,
          slope: -1
        },
        colorMode: 'Still',
        saturation: 10,
        colorPhase: 0,
        colorDepth: {
          R: 1,
          G: 1,
          B: 2,
          C: 1,
          M: 1,
          Y: -2
        },
        detail: {
          level: -1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 3,
          crispening: 6,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'night markets under mixed bulbs and LEDs — lively, warm, not orange',
    description: 'For night markets and food stalls under mixed bulbs and LEDs: warm and lively, reds of lanterns and food deepened, yellows kept bright, bright lamps rolled off and noise kept quiet. In daylight it renders blue.'
  },
  {
    recipe: {
      id: 'SCL-PP-064',
      slug: 'old-quarter-mono',
      name: 'PP-064-Mono Crisp Street',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500
      },
      tags: [
        'black-and-white',
        'street',
        'documentary',
        'classic'
      ],
      settings: {
        blackLevel: -4,
        gamma: 'Still',
        blackGamma: {
          range: 'Narrow',
          level: -1
        },
        knee: {
          mode: 'Manual',
          point: 95,
          slope: 1
        },
        colorMode: 'Black & White',
        saturation: 0,
        colorPhase: 0,
        colorDepth: {
          R: -1,
          G: 0,
          B: 3,
          C: 2,
          M: 0,
          Y: -2
        },
        detail: {
          level: 1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type2',
          limit: 6,
          crispening: 3,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'street black & white — medium contrast, firm blacks',
    description: 'Street black and white with medium contrast and firm blacks, crisp, with a little extra detail kept in the shadows.'
  },
  {
    recipe: {
      id: 'SCL-PP-065',
      slug: 'pearl-mono',
      name: 'PP-065-Mono Soft Portrait',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500
      },
      tags: [
        'black-and-white',
        'portrait',
        'soft',
        'fine-art'
      ],
      settings: {
        blackLevel: -1,
        gamma: 'Cine1',
        blackGamma: {
          range: 'Middle',
          level: 1
        },
        knee: {
          mode: 'Manual',
          point: 88,
          slope: -1
        },
        colorMode: 'Black & White',
        saturation: 0,
        colorPhase: 0,
        colorDepth: {
          R: -3,
          G: 1,
          B: 1,
          C: 0,
          M: -1,
          Y: -2
        },
        detail: {
          level: -2,
          mode: 'Manual',
          vhBalance: -1,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 5,
          hiLightDetail: 0
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'portrait black & white — soft gradation, gentle detail',
    description: 'Soft black and white for portraits: Cine1’s gentle shadow contrast, smooth highlights, and detail eased on faces and bright areas.'
  },
  {
    recipe: {
      id: 'SCL-PP-066',
      slug: 'ho-tay-golden',
      name: 'PP-066-Golden Soft Portrait',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 6000,
        shift: {
          ab: {
            axis: 'A',
            amount: 1
          }
        }
      },
      tags: [
        'portrait',
        'golden-hour',
        'warm',
        'family'
      ],
      settings: {
        blackLevel: -2,
        gamma: 'Cine2',
        blackGamma: {
          range: 'Middle',
          level: 1
        },
        knee: {
          mode: 'Manual',
          point: 86,
          slope: -1
        },
        colorMode: 'Cinema',
        saturation: 8,
        colorPhase: 0,
        colorDepth: {
          R: -2,
          G: 1,
          B: 2,
          C: 1,
          M: -1,
          Y: -2
        },
        detail: {
          level: -2,
          mode: 'Manual',
          vhBalance: -1,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 4,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'golden-hour portraits — warm glow on skin without turning orange',
    description: 'For portraits in the last hour of sun: a warm glow over the frame, skin and golden light kept bright rather than muddy orange, and Cine2’s soft highlights holding the backlight.'
  },
  {
    recipe: {
      id: 'SCL-PP-067',
      slug: 'moc-chau-frost',
      name: 'PP-067-Cool Crisp Airy',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 4600,
        shift: {
          ab: {
            axis: 'B',
            amount: 1
          }
        }
      },
      tags: [
        'cool-tone',
        'crisp',
        'winter',
        'architecture'
      ],
      settings: {
        blackLevel: 0,
        gamma: 'Still',
        blackGamma: {
          range: 'Middle',
          level: 1
        },
        knee: {
          mode: 'Manual',
          point: 94,
          slope: 1
        },
        colorMode: 'Still',
        saturation: 4,
        colorPhase: -1,
        colorDepth: {
          R: -1,
          G: 1,
          B: 2,
          C: 1,
          M: 1,
          Y: -1
        },
        detail: {
          level: 1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 4,
          hiLightDetail: 3
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'cool, airy and crisp — winter hills, mist, glass and concrete',
    description: 'Cool, airy and crisp: whites lean blue, shadows stay open, colour is held back and fine detail in mist, frost and cloud is kept. For winter hills and clean city architecture.'
  },
  {
    recipe: {
      id: 'SCL-PP-068',
      slug: 'vung-tau-pop',
      name: 'PP-068-Punchy Vivid Pop',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5400,
        shift: {
          ab: {
            axis: 'B',
            amount: 0.5
          }
        }
      },
      tags: [
        'vivid',
        'graphic',
        'colourful',
        'street-style'
      ],
      settings: {
        blackLevel: -3,
        gamma: 'Still',
        blackGamma: {
          range: 'Narrow',
          level: -2
        },
        knee: {
          mode: 'Manual',
          point: 96,
          slope: 2
        },
        colorMode: 'Still',
        saturation: 20,
        colorPhase: 0,
        colorDepth: {
          R: 2,
          G: 2,
          B: 3,
          C: 2,
          M: 2,
          Y: -2
        },
        detail: {
          level: 2,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 6,
          crispening: 3,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'bold graphic colour — painted walls, signage, street style',
    description: 'The boldest colour in the set: strong saturation on clean neutral whites, every hue deepened except yellow, which stays bright, and crisp edges. For painted walls, signage and street style.'
  },
  {
    recipe: {
      id: 'SCL-PP-069',
      slug: 'hem-noir',
      name: 'PP-069-Mono Hard Noir',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 7500
      },
      tags: [
        'black-and-white',
        'high-contrast',
        'noir',
        'street'
      ],
      settings: {
        blackLevel: -7,
        gamma: 'Movie',
        blackGamma: {
          range: 'Narrow',
          level: -4
        },
        knee: {
          mode: 'Manual',
          point: 100,
          slope: 2
        },
        colorMode: 'Black & White',
        saturation: 0,
        colorPhase: 0,
        colorDepth: {
          R: -2,
          G: 1,
          B: 3,
          C: 3,
          M: 1,
          Y: -2
        },
        detail: {
          level: 2,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type2',
          limit: 6,
          crispening: 2,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'dramatic black & white — deep blacks, bright whites, hard light (warm WB meant as an orange filter: verify)',
    description: 'Dramatic black and white: blacks pushed deep, whites left bright with a late knee, and strong edge detail. For alleys, hard sunlight and graphic street scenes.'
  },
  {
    recipe: {
      id: 'SCL-PP-070',
      slug: 'late-night-mono',
      name: 'PP-070-Mono Soft Night',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 4000
      },
      tags: [
        'black-and-white',
        'night',
        'low-light',
        'street'
      ],
      settings: {
        blackLevel: -2,
        gamma: 'Cine4',
        blackGamma: {
          range: 'Wide',
          level: 2
        },
        knee: {
          mode: 'Manual',
          point: 88,
          slope: -1
        },
        colorMode: 'Black & White',
        saturation: 0,
        colorPhase: 0,
        colorDepth: {
          R: 0,
          G: 0,
          B: 2,
          C: 1,
          M: 0,
          Y: -1
        },
        detail: {
          level: -1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 3,
          crispening: 7,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'black & white after dark — open shadows, quiet noise',
    description: 'Black and white for after dark: Cine4 keeps contrast in the darks while Black Gamma opens them, street lamps roll off, and noise is not sharpened.'
  },
  {
    recipe: {
      id: 'SCL-PP-071',
      slug: 'silver-hard-muted',
      name: 'PP-071-Silver Hard Muted',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500,
        shift: {
          ab: {
            axis: 'B',
            amount: 0.5
          }
        }
      },
      tags: [
        'bleach-bypass',
        'muted',
        'contrast',
        'street'
      ],
      settings: {
        blackLevel: -6,
        gamma: 'Cine4',
        blackGamma: {
          range: 'Narrow',
          level: -3
        },
        knee: {
          mode: 'Manual',
          point: 92.5,
          slope: 1
        },
        colorMode: 'Still',
        saturation: -14,
        colorPhase: 0,
        colorDepth: {
          R: 1,
          G: 0,
          B: 1,
          C: 0,
          M: 0,
          Y: 1
        },
        detail: {
          level: 2,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type2',
          limit: 6,
          crispening: 3,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'bleach bypass — hard, silvery, colour held right down (Cine4 with Still colour, off Sony’s pairing by design: Cine4’s dark contrast under Still’s hues)',
    description: 'A bleach-bypass mood: Cine4’s deep dark contrast, blacks pressed down by Black Level and a Narrow Black Gamma, and Saturation well below zero so colour turns silvery — the low saturation is the look, not a fault. Reds, blues and yellows are held a step denser so they do not wash out, and firm edge detail suits street and fashion.'
  },
  {
    recipe: {
      id: 'SCL-PP-072',
      slug: 'teal-orange-cinema',
      name: 'PP-072-Teal Orange Cinema',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5600,
        shift: {
          ab: {
            axis: 'A',
            amount: 1.5
          }
        }
      },
      tags: [
        'teal-orange',
        'cinematic',
        'portrait',
        'street'
      ],
      settings: {
        blackLevel: -3,
        gamma: 'Cine2',
        blackGamma: {
          range: 'Middle',
          level: -2
        },
        knee: {
          mode: 'Manual',
          point: 85,
          slope: -1
        },
        colorMode: 'Cinema',
        saturation: 12,
        colorPhase: 0,
        colorDepth: {
          R: -2,
          G: 3,
          B: 4,
          C: 5,
          M: 1,
          Y: -2
        },
        detail: {
          level: -1,
          mode: 'Manual',
          vhBalance: -1,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 5,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'teal and orange — warm skin, teal skies and shade',
    description: 'Teal and orange in camera: an amber white balance warms skin, while Color Depth deepens green, cyan and blue, so foliage, skies and water sit deep and cool beside it. Red and yellow are lifted and paled a little so faces stay light, and Cine2 with an early, gentle knee keeps the highlights soft. For portraits and street scenes.'
  },
  {
    recipe: {
      id: 'SCL-PP-073',
      slug: 'bright-airy-studio',
      name: 'PP-073-Bright Airy Studio',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500
      },
      tags: [
        'high-key',
        'studio',
        'bright',
        'portrait'
      ],
      settings: {
        blackLevel: 4,
        gamma: 'Cine2',
        blackGamma: {
          range: 'Middle',
          level: 3
        },
        knee: {
          mode: 'Manual',
          point: 80,
          slope: 2
        },
        colorMode: 'Cinema',
        saturation: 2,
        colorPhase: 0,
        colorDepth: {
          R: -2,
          G: -1,
          B: -1,
          C: -1,
          M: -1,
          Y: -2
        },
        detail: {
          level: -3,
          mode: 'Manual',
          vhBalance: -1,
          bwBalance: 'Type4',
          limit: 4,
          crispening: 4,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'high key — bright, airy studio and white walls',
    description: 'High key, clean and light: Black Level and Black Gamma lift the shadows, Cine2 keeps contrast low, and a knee from 80% rounds off white backgrounds without flattening them. Negative Color Depth on every hue pales colour slightly, and softened detail with Type4 keeps skin smooth and whites glossy. For studio, white walls and window light.'
  },
  {
    recipe: {
      id: 'SCL-PP-074',
      slug: 'dark-rich-velvet',
      name: 'PP-074-Dark Rich Velvet',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5800,
        shift: {
          ab: {
            axis: 'A',
            amount: 1
          }
        }
      },
      tags: [
        'low-key',
        'moody',
        'portrait',
        'interior'
      ],
      settings: {
        blackLevel: -8,
        gamma: 'Cine4',
        blackGamma: {
          range: 'Narrow',
          level: -5
        },
        knee: {
          mode: 'Manual',
          point: 95,
          slope: 1
        },
        colorMode: 'Still',
        saturation: 8,
        colorPhase: 0,
        colorDepth: {
          R: -1,
          G: 3,
          B: 3,
          C: 2,
          M: 2,
          Y: -1
        },
        detail: {
          level: -1,
          mode: 'Manual',
          vhBalance: -1,
          bwBalance: 'Type2',
          limit: 4,
          crispening: 5,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'low key — rich warm colour out of deep shadow (Cine4 with Still colour, off Sony’s pairing by design: Cine4’s dark contrast under Still’s hues)',
    description: 'Low key and warm: Cine4 with a strongly negative Black Level and a Narrow Black Gamma sinks the shadows, while a late knee leaves the highlights bright. Greens, blues and magentas are deepened and reds and yellows kept a touch lighter, so skin stands out warm against a dark ground. For moody portraits and interiors lit by one window.'
  },
  {
    recipe: {
      id: 'SCL-PP-075',
      slug: 'warm-pastel-cream',
      name: 'PP-075-Warm Pastel Cream',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 6200,
        shift: {
          ab: {
            axis: 'A',
            amount: 0.5
          }
        }
      },
      tags: [
        'pastel',
        'cream',
        'soft',
        'cafe'
      ],
      settings: {
        blackLevel: 4,
        gamma: 'Cine1',
        blackGamma: {
          range: 'Wide',
          level: 3
        },
        knee: {
          mode: 'Manual',
          point: 85,
          slope: -1
        },
        colorMode: 'Cinema',
        saturation: -6,
        colorPhase: 0,
        colorDepth: {
          R: -2,
          G: -1,
          B: -1,
          C: 0,
          M: -2,
          Y: -2
        },
        detail: {
          level: -2,
          mode: 'Manual',
          vhBalance: -1,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 5,
          hiLightDetail: 1
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'warm pastel — creamy, lifted, low colour',
    description: 'Warm pastel: Black Level and a Wide Black Gamma lift the shadows and mid-greys, Cine1 keeps contrast low, and Saturation below zero with negative Color Depth on red, yellow and magenta turns colour towards cream. A slightly warm white balance. For cafés, interiors, soft portraits and light fashion.'
  },
  {
    recipe: {
      id: 'SCL-PP-076',
      slug: 'violet-cool-dusk',
      name: 'PP-076-Violet Cool Dusk',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 4200,
        shift: {
          gm: {
            axis: 'M',
            amount: 2
          }
        }
      },
      tags: [
        'blue-hour',
        'dusk',
        'violet',
        'city'
      ],
      settings: {
        blackLevel: -3,
        gamma: 'Still',
        blackGamma: {
          range: 'Middle',
          level: 0
        },
        knee: {
          mode: 'Manual',
          point: 90,
          slope: -1
        },
        colorMode: 'Still',
        saturation: 12,
        colorPhase: 0,
        colorDepth: {
          R: 0,
          G: 1,
          B: 4,
          C: 2,
          M: 3,
          Y: -1
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 6,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'blue hour — cool, violet, saturated',
    description: 'Blue hour, turned towards violet: a low Kelvin cools the frame and a magenta shift tips it violet, with blue and magenta deepened and yellow kept light so lamps stay clean. A gentle knee holds lit windows and the last light in the sky, and raised Crispening keeps noise out of the sharpening. For dusk over cities, water and hills; in daylight it renders strongly blue-violet.'
  },
  {
    recipe: {
      id: 'SCL-PP-077',
      slug: 'cool-muted-overcast',
      name: 'PP-077-Cool Muted Overcast',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5000,
        shift: {
          ab: {
            axis: 'B',
            amount: 1
          }
        }
      },
      tags: [
        'overcast',
        'rainy-day',
        'muted',
        'everyday'
      ],
      settings: {
        blackLevel: 2,
        gamma: 'Movie',
        blackGamma: {
          range: 'Wide',
          level: 3
        },
        knee: {
          mode: 'Auto'
        },
        colorMode: 'Movie',
        saturation: -10,
        colorPhase: 0,
        colorDepth: {
          R: 0,
          G: 1,
          B: 1,
          C: 1,
          M: 0,
          Y: 0
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 4,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'overcast — calm, cool, quiet colour that does not go grey',
    description: 'Grey-day calm: a cool white balance, Black Level and a Wide Black Gamma open the shadows and mid-greys, and Saturation below zero quiets colour, while green, blue and cyan are deepened a step so they do not go grey. Movie gamma with Knee Auto. For overcast streets, rain and everyday walks.'
  },
  {
    recipe: {
      id: 'SCL-PP-078',
      slug: 'amber-vivid-autumn',
      name: 'PP-078-Amber Vivid Autumn',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 6000,
        shift: {
          ab: {
            axis: 'A',
            amount: 1.5
          }
        }
      },
      tags: [
        'autumn',
        'foliage',
        'vivid',
        'landscape'
      ],
      settings: {
        blackLevel: -3,
        gamma: 'Still',
        blackGamma: {
          range: 'Narrow',
          level: -1
        },
        knee: {
          mode: 'Manual',
          point: 92,
          slope: 1
        },
        colorMode: 'Still',
        saturation: 14,
        colorPhase: 0,
        colorDepth: {
          R: 2,
          G: -1,
          B: 2,
          C: 1,
          M: 0,
          Y: 2
        },
        detail: {
          level: 1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 2,
          hiLightDetail: 3
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'autumn — warm, saturated leaves, not film',
    description: 'Autumn colour: an amber white balance and strong Saturation, with reds and yellows deepened so leaves read rich rather than bright orange, and green lifted and paled a little so it steps back. Firm blacks and a light knee on the Still curve. For autumn landscapes, gardens and travel in warm light.'
  },
  {
    recipe: {
      id: 'SCL-PP-079',
      slug: 'warm-rich-table',
      name: 'PP-079-Warm Rich Table',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5800,
        shift: {
          ab: {
            axis: 'A',
            amount: 1
          }
        }
      },
      tags: [
        'food',
        'daylight',
        'table',
        'cafe'
      ],
      settings: {
        blackLevel: -2,
        gamma: 'S-Cinetone',
        blackGamma: {
          range: 'Middle',
          level: 1
        },
        knee: {
          mode: 'Manual',
          point: 88,
          slope: -1
        },
        colorMode: 'S-Cinetone',
        saturation: 10,
        colorPhase: 0,
        colorDepth: {
          R: 1,
          G: 1,
          B: 0,
          C: 0,
          M: 0,
          Y: -1
        },
        detail: {
          level: 1,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type4',
          limit: 5,
          crispening: 4,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'daylight food — warm, rich, glossy',
    description: 'Food in daylight: S-Cinetone colour with a warm white balance and raised Saturation, reds and greens deepened a step so sauces and herbs look rich, and yellows kept bright. A gentle knee holds reflections on plates and glass, and Type4 B/W Balance favours white detail for a clean, glossy finish. For tables by a window and markets.'
  },
  {
    recipe: {
      id: 'SCL-PP-080',
      slug: 'range-hlg-daylight',
      name: 'PP-080-Range HLG Daylight',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500
      },
      tags: [
        'hdr',
        'hlg',
        'dynamic-range',
        'landscape'
      ],
      settings: {
        blackLevel: 0,
        gamma: 'HLG2',
        blackGamma: {
          range: 'Middle',
          level: 0
        },
        knee: {
          mode: 'Manual',
          point: 95,
          slope: 0
        },
        colorMode: '709',
        saturation: 8,
        colorPhase: 0,
        colorDepth: {
          R: 0,
          G: 1,
          B: 1,
          C: 1,
          M: 0,
          Y: 0
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 4,
          hiLightDetail: 3
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'HDR delivery — HLG range for grading, flat on SDR',
    description: 'For HDR delivery and grading: HLG2 with the 709 colour mode records the wider range HLG is made for, so it is meant for an HDR screen; on an ordinary SDR screen straight out of camera it looks flat. Saturation is raised a little, green, blue and cyan deepened a step, and a knee at 95% eases only the very top. For landscapes and travel.'
  },
  {
    recipe: {
      id: 'SCL-PP-081',
      slug: 'flat-log-base',
      name: 'PP-081-Flat Log Base',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500
      },
      tags: [
        's-log3',
        'log',
        'grading',
        'flat'
      ],
      settings: {
        blackLevel: 0,
        gamma: 'S-Log3',
        blackGamma: {
          range: 'Middle',
          level: 0
        },
        knee: {
          mode: 'Auto'
        },
        colorMode: 'S-Gamut3.Cine',
        saturation: 0,
        colorPhase: 0,
        colorDepth: {
          R: 0,
          G: 0,
          B: 0,
          C: 0,
          M: 0,
          Y: 0
        },
        detail: {
          level: -7,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 4,
          crispening: 4,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'grade later — the base Sony gives for PP8, not a look',
    description: 'Not a look: the base Sony gives for PP8 — S-Log3 with S-Gamut3.Cine and Detail at −7, so no in-camera sharpening is baked in — with every other setting at zero, and Knee off as it is on S-Log. It records flat, low-contrast footage meant for grading or a LUT afterwards.'
  },
  {
    recipe: {
      id: 'SCL-PP-082',
      slug: 'cyan-vivid-monsoon',
      name: 'PP-082-Cyan Vivid Monsoon',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 4800,
        shift: {
          ab: {
            axis: 'B',
            amount: 1
          }
        }
      },
      tags: [
        'monsoon',
        'rain',
        'cyan',
        'street'
      ],
      settings: {
        blackLevel: -1,
        gamma: 'Movie',
        blackGamma: {
          range: 'Wide',
          level: 1
        },
        knee: {
          mode: 'Auto'
        },
        colorMode: 'Movie',
        saturation: 10,
        colorPhase: 0,
        colorDepth: {
          R: 0,
          G: 1,
          B: 2,
          C: 4,
          M: 0,
          Y: -1
        },
        detail: {
          level: 0,
          mode: 'Manual',
          vhBalance: 0,
          bwBalance: 'Type3',
          limit: 5,
          crispening: 5,
          hiLightDetail: 2
        }
      },
      format: 'pp',
      published: false
    },
    intent: 'monsoon — cool, saturated colour on grey days',
    description: 'Rainy-season colour: a cool white balance with a blue shift and raised Saturation, cyan deepened most and then blue, so wet streets, umbrellas and grey skies keep their colour, and yellow lifted to stay bright. A Wide Black Gamma opens the shade a little, with Knee Auto on the Movie curve. For monsoon streets and travel on grey days.'
  }
];
