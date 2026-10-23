/**
 * Alpha ColorLab's own Picture Profile library — 23 originals, cooked from the
 * way Sony's Help Guide for Creators explains each parameter (Gamma / Color
 * Mode, Black Level / Black Gamma / Knee, Saturation / Color Phase / Color
 * Depth, Detail), never from memory and never from anyone else's recipes.
 *
 * They replace the 36 Picture Profiles withdrawn on 2026-10-23 as matching a
 * licensed third-party collection (see RETIRED_LEGACY_IDS in
 * src/lib/recipes/redirects.ts). Each one was checked against recipeSchema,
 * against Sony's own constraints (no Knee Auto on a gamma Sony says turns it
 * off, no slope +5, |Color Phase| ≤ 2, no Color Depth at ±7) and for distance
 * from the withdrawn set.
 *
 * `published: false` on every one, deliberately (D8): the numbers are design
 * hypotheses until the owner has shot each on the a7 IV. Publishing is an
 * editor's act in /admin/colorlab, after at least one real photograph is
 * attached.
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
      name: 'SCL-PP-048: Huế Silk',
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
    intent: 'daylight portrait — bright clean skin, quiet background',
    description: 'Soft S-Cinetone contrast with skin lifted a touch brighter and less flushed, while foliage and sky stay slightly deeper so the face separates from the background. Built for daylight portraits in open shade.'
  },
  {
    recipe: {
      id: 'SCL-PP-049',
      slug: 'clear-day',
      name: 'SCL-PP-049: Clear Day',
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
      name: 'SCL-PP-050: Linen Editorial',
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
      name: 'SCL-PP-051: Sa Pa Morning',
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
        blackLevel: -3,
        gamma: 'Cine1',
        blackGamma: {
          range: 'Wide',
          level: -2
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
      name: 'SCL-PP-052: Mekong Noon',
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
        colorPhase: 1,
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
      name: 'SCL-PP-053: Mũi Né Dusk',
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
    description: 'The flattest recipe in the set on purpose: an early, very gentle knee and opened shadows keep the sun’s glow and the foreground together, with warm white balance and extra saturation so it still reads as a sunset. Soft by design.'
  },
  {
    recipe: {
      id: 'SCL-PP-054',
      slug: 'phu-quoc-blue',
      name: 'SCL-PP-054: Phú Quốc Blue',
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
      name: 'SCL-PP-055: Tam Cốc Green',
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
      name: 'SCL-PP-056: Hội An Lantern',
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
      name: 'SCL-PP-057: Tết Blossom',
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
        colorPhase: 1,
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
      name: 'SCL-PP-058: Đà Lạt Mist',
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
      name: 'SCL-PP-059: Hà Nội Winter',
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
        saturation: 2,
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
      name: 'SCL-PP-060: Chợ Lớn Slide',
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
    intent: 'dense slide-film punch — deep blacks, rich warm colour',
    description: 'Dense, slide-film punch: Cine3 contrast with deep blacks, every colour deepened a little and a warm turn in the hues. For street, markets and bold daylight scenes.'
  },
  {
    recipe: {
      id: 'SCL-PP-061',
      slug: 'sai-gon-cafe',
      name: 'SCL-PP-061: Sài Gòn Café',
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
      name: 'SCL-PP-062: Neon Night',
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
    intent: 'city night — clean cyan streets, rolled-off signs',
    description: 'City night with clean cyan and blue accents, deep Cine4 blacks and signs rolled off by the knee. Made for street lamps and neon; in daylight it renders strongly blue.'
  },
  {
    recipe: {
      id: 'SCL-PP-063',
      slug: 'ben-thanh-night',
      name: 'SCL-PP-063: Bến Thành Night',
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
      name: 'SCL-PP-064: Old Quarter Mono',
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
      name: 'SCL-PP-065: Pearl Mono',
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
      name: 'SCL-PP-066: Hồ Tây Golden',
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
        colorPhase: 1,
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
      name: 'SCL-PP-067: Mộc Châu Frost',
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
      name: 'SCL-PP-068: Vũng Tàu Pop',
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
      name: 'SCL-PP-069: Hẻm Noir',
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
      name: 'SCL-PP-070: Late Night Mono',
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
  }
];
