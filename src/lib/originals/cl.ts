/**
 * Alpha ColorLab's own Creative Look recipes — eight, for Looks and moods the
 * Sony Asia library leaves empty: no BW, NT or cool SH recipe there, and one
 * PT. Creative Look parameters only (`clSettingsSchema` through recipeSchema,
 * so a stray Picture Profile key is a validation error), cooked from Sony's
 * Help Guide description of each Look and adjustment, never from memory.
 *
 * Same shape and same rules as src/lib/originals/pp.ts: `published: false`
 * until shot on the a7 IV (D8), names `CL-NNN-Mood Words`
 * (src/lib/recipes/names.ts), Vietnamese prose in data/translations.vi.json,
 * situations, style and tone in data/recipe-taxonomy.json. Each was checked
 * for distance from every Sony Asia recipe of the same Look.
 *
 * Numbered after the 37 Sony Asia recipes (038–045). The importer hands an
 * unpinned Sony Asia row the next free number after its own pins, so a new
 * scrape row would ask for 038; scripts/emit-seed.ts refuses the duplicate
 * rather than letting one URL name two recipes.
 *
 * Read by scripts/emit-seed.ts, which validates each entry and refuses the
 * whole emit on the first failure.
 */

import type { OriginalRecipe } from './pp';

export const ORIGINAL_CL: readonly OriginalRecipe[] = [
  {
    recipe: {
      id: 'CL-038',
      slug: 'mono-deep-noir',
      name: 'CL-038-Mono Deep Noir',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500
      },
      tags: [
        'black-and-white',
        'high-contrast',
        'noir',
        'street'
      ],
      settings: {
        look: 'BW',
        contrast: 6,
        highlights: -2,
        shadows: -4,
        fade: 0,
        sharpness: 6,
        sharpnessRange: 3,
        clarity: 5
      },
      format: 'cl',
      published: false
    },
    intent: 'hard black & white — deep blacks, gritty edges',
    description: 'Hard black and white on the BW Look: Contrast well up and Shadows pulled down for deep blacks, Highlights eased a little so whites keep their texture, and Clarity with raised Sharpness for gritty edges. For street at night and hard light.'
  },
  {
    recipe: {
      id: 'CL-039',
      slug: 'mono-airy-portrait',
      name: 'CL-039-Mono Airy Portrait',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500
      },
      tags: [
        'black-and-white',
        'portrait',
        'soft'
      ],
      settings: {
        look: 'BW',
        contrast: -3,
        highlights: -4,
        shadows: 3,
        fade: 2,
        sharpness: 2,
        sharpnessRange: 2,
        clarity: 0
      },
      format: 'cl',
      published: false
    },
    intent: 'soft black & white portrait — open greys, smooth skin',
    description: 'Soft black and white for portraits on the BW Look: lower Contrast, Shadows lifted and Highlights pulled back for an open, airy grey scale, a little Fade, and low Sharpness with no Clarity so skin stays smooth.'
  },
  {
    recipe: {
      id: 'CL-040',
      slug: 'neutral-clean-product',
      name: 'CL-040-Neutral Clean Product',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5500
      },
      tags: [
        'product',
        'neutral',
        'catalogue',
        'fashion'
      ],
      settings: {
        look: 'NT',
        contrast: 1,
        highlights: -2,
        shadows: 0,
        fade: 0,
        saturation: 0,
        sharpness: 5,
        sharpnessRange: 3,
        clarity: 2
      },
      format: 'cl',
      published: false
    },
    intent: 'product — restrained colour, whites kept in detail',
    description: 'The NT Look with almost nothing added: a step of Contrast, Highlights eased so white products and fabrics keep their detail, moderate Sharpness and a little Clarity for texture, and Saturation left at zero. For product, catalogue and clothing shots that want restrained colour.'
  },
  {
    recipe: {
      id: 'CL-041',
      slug: 'portrait-golden-daylight',
      name: 'CL-041-Portrait Golden Daylight',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5600,
        shift: {
          ab: {
            axis: 'A',
            amount: 2
          },
          gm: {
            axis: 'M',
            amount: 0.5
          }
        }
      },
      tags: [
        'portrait',
        'golden-hour',
        'warm',
        'skin'
      ],
      settings: {
        look: 'PT',
        contrast: -1,
        highlights: -4,
        shadows: 2,
        fade: 1,
        saturation: 1,
        sharpness: 2,
        sharpnessRange: 2,
        clarity: 0
      },
      format: 'cl',
      published: false
    },
    intent: 'golden portrait — warm, rosy skin, soft',
    description: 'The PT Look warmed for golden light: an A2 amber shift with a touch of magenta keeps skin rosy rather than yellow, Highlights pulled well down to hold sunlit skin, and Shadows lifted with a little less Contrast for a soft finish. Low Sharpness, no Clarity. For portraits in late sun and window-lit rooms.'
  },
  {
    recipe: {
      id: 'CL-042',
      slug: 'airy-cool-pastel',
      name: 'CL-042-Airy Cool Pastel',
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
        'high-key',
        'pastel',
        'cool-tone',
        'portrait'
      ],
      settings: {
        look: 'SH',
        contrast: -3,
        highlights: -2,
        shadows: 3,
        fade: 3,
        saturation: -2,
        sharpness: 2,
        sharpnessRange: 2,
        clarity: 0
      },
      format: 'cl',
      published: false
    },
    intent: 'cool high key — pale pastel, soft',
    description: 'Soft Highkey taken cool: a blue shift on 5200K, lower Contrast and Saturation, Shadows lifted and some Fade for a pale, pastel finish, with low Sharpness and no Clarity to keep it soft. For bright portraits, fashion and white interiors.'
  },
  {
    recipe: {
      id: 'CL-043',
      slug: 'film-matte-cool',
      name: 'CL-043-Film Matte Cool',
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
        'matte',
        'faded',
        'cool-tone',
        'street'
      ],
      settings: {
        look: 'FL',
        contrast: 3,
        highlights: -4,
        shadows: 2,
        fade: 6,
        saturation: -3,
        sharpness: 3,
        sharpnessRange: 3,
        clarity: 2
      },
      format: 'cl',
      published: false
    },
    intent: 'cool matte film — lifted blacks, low colour',
    description: 'The FL Look with a cool, matte finish: a strong Fade lifts the blacks into grey while Contrast stays up so the image keeps its shape, with Highlights pulled down, Shadows lifted, Saturation lowered and a blue shift. For cool street scenes and everyday moments.'
  },
  {
    recipe: {
      id: 'CL-044',
      slug: 'instant-amber-soft',
      name: 'CL-044-Instant Amber Soft',
      whiteBalance: {
        mode: 'kelvin',
        kelvin: 5800,
        shift: {
          ab: {
            axis: 'A',
            amount: 2
          }
        }
      },
      tags: [
        'instant',
        'warm',
        'soft',
        'everyday'
      ],
      settings: {
        look: 'IN',
        contrast: -2,
        highlights: -3,
        shadows: 2,
        fade: 3,
        saturation: 2,
        sharpness: 2,
        sharpnessRange: 2,
        clarity: 0
      },
      format: 'cl',
      published: false
    },
    intent: 'warm instant — soft, faded, a little more colour',
    description: 'The IN Look made warmer and softer: an A2 amber shift, lower Contrast with Highlights pulled down and Shadows lifted, some Fade and a little more Saturation, with low Sharpness. For cafés, home and everyday snapshots in daylight.'
  },
  {
    recipe: {
      id: 'CL-045',
      slug: 'vivid-tropical-punchy',
      name: 'CL-045-Vivid Tropical Punchy',
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
        'tropical',
        'beach',
        'vivid',
        'travel'
      ],
      settings: {
        look: 'VV2',
        contrast: 2,
        highlights: -3,
        shadows: -1,
        fade: 0,
        saturation: 3,
        sharpness: 4,
        sharpnessRange: 3,
        clarity: 4
      },
      format: 'cl',
      published: false
    },
    intent: 'tropical — punchy colour, held highlights',
    description: 'VV2 pushed for tropical light: more Contrast and Saturation, Highlights pulled down to hold bright skies and sand, Shadows a step darker and Clarity for punch, on a slightly warm white balance. For beaches, islands and bright travel days.'
  }
];
