/**
 * What a *specific* setting value is doing to the image.
 *
 * Distinct from `explanations.ts`, which says what a parameter does in general.
 * This reads the recipe's actual number and says what that number produces —
 * "Black Level -7" is not the same story as "Black Level +7", and a reader
 * trying to understand a recipe needs the second kind of answer.
 *
 * Every effect is tagged with the axis it acts on (contrast / colour / detail)
 * so a reader can scan a recipe and see where its character comes from.
 *
 * Intensity is derived from each parameter's own range in `constants.ts`, never
 * from hardcoded thresholds — widen a range and the wording follows.
 */

import {
  CL_RANGES,
  PP_RANGES,
  WB_PRESETS,
  WB_PRESETS_STILL_ONLY,
  WB_SHIFT_AXIS,
  type ClParam,
  type Range,
} from './constants';
import type { ClSettings, PpSettings, WhiteBalance } from './schema';
import { MIRED_PER_SHIFT_STEP, gradeWarmth, wbBalance, type Warmth, type WbBalance } from './color';

export type EffectAxis = 'contrast' | 'color' | 'detail';
export type Effect = { axis: EffectAxis; en: string; vi: string };

/** -2 strong down · -1 mild down · 0 neutral · +1 mild up · +2 strong up */
export type Step = -2 | -1 | 0 | 1 | 2;

/**
 * Where a value sits in its range: −1..1 around 0 for a signed range, 0..1
 * above the minimum otherwise.
 *
 * The one definition of "how far along" a dial is, read by the wording here
 * and by the palette (`palette.ts`), so words and colour cannot disagree. A
 * signed range is measured on each side of 0 separately, which is what lets
 * PP Saturation ±32 and CL Saturation ±9 meet at the same endpoints.
 */
export function fraction(value: number, range: Range): number {
  if (range.min < 0) {
    if (value === 0) return 0;
    return value > 0 ? value / range.max : value / -range.min;
  }
  const span = range.max - range.min;
  return span === 0 ? 0 : (value - range.min) / span;
}

/**
 * A signed fraction (−1..1) as a graded step: 0 only at 0, strong past 55%.
 * The signed half of `step()`, for a reading that combines two fractions
 * (the recipe name's colour word: Saturation with mean Color Depth).
 */
export function stepOfFraction(f: number): Step {
  if (f === 0) return 0;
  const strong = Math.abs(f) >= 0.55;
  return f > 0 ? (strong ? 2 : 1) : strong ? -2 : -1;
}

/**
 * Where a value sits in its own range, as a graded step.
 * "Strong" is past 55% of the distance to the bound, which keeps the wording
 * honest for both a ±7 scale and a ±32 one.
 *
 * A signed range reads `fraction()` directly. An unsigned one is graded
 * around its midpoint, not its minimum, so it keeps its own arithmetic.
 */
export function step(value: number, range: Range): Step {
  if (range.min < 0 && range.max > 0) return stepOfFraction(fraction(value, range));
  const pivot = range.min < 0 ? 0 : (range.min + range.max) / 2;
  if (value === pivot) return 0;
  const span = value > pivot ? range.max - pivot : pivot - range.min;
  if (span === 0) return 0;
  const ratio = Math.abs(value - pivot) / span;
  const strong = ratio >= 0.55;
  return value > pivot ? (strong ? 2 : 1) : strong ? -2 : -1;
}

/**
 * Where an intensity sits above its minimum: 0 only AT the minimum, then
 * mild, then strong past 55% of the range.
 *
 * Fade, Sharpness, Clarity and the PP Detail Limit / Crispening / Hi-Light
 * Detail have no "less than neutral" — their minimum is "none" and every step
 * up adds some. Grading them around the midpoint (`step()`) sent the whole low
 * half of each range to the minimum's wording: Fade 3 read "No fade".
 */
export function stepFromMin(value: number, range: Range): Step {
  if (value <= range.min) return 0;
  const span = range.max - range.min;
  if (span === 0) return 0;
  return (value - range.min) / span >= 0.55 ? 2 : 1;
}

type Phrases = Partial<Record<Step, [en: string, vi: string]>>;

function pick(axis: EffectAxis, phrases: Phrases, s: Step): Effect {
  const [en, vi] = phrases[s] ?? phrases[0] ?? ['', ''];
  return { axis, en, vi };
}

/** A table with no negative steps describes an intensity that rises from its
    minimum; every other table is graded around its centre. */
function grade(axis: EffectAxis, phrases: Phrases, value: number, range: Range): Effect {
  const centred = phrases[-1] !== undefined || phrases[-2] !== undefined;
  return pick(axis, phrases, centred ? step(value, range) : stepFromMin(value, range));
}

// ---------------------------------------------------------------------------
// Picture Profile
// ---------------------------------------------------------------------------

const blackLevel: Phrases = {
  [-2]: ['Blacks crushed hard — deep, punchy shadows with dense contrast', 'Vùng đen bị nén mạnh — bóng sâu, tương phản tối dứt khoát'],
  [-1]: ['Shadows deepened slightly — tighter contrast in dark tones', 'Vùng tối sâu hơn nhẹ — siết tương phản vùng tối'],
  0: ['Blacks left at the camera default — neutral shadow baseline', 'Vùng đen giữ nguyên mặc định của máy'],
  1: ['Shadows lifted slightly — subtle matte texture in dark areas', 'Vùng tối nâng nhẹ — bề mặt mờ dịu nhẹ ở vùng bóng'],
  2: ['Shadows lifted strongly — milky, film-like faded blacks', 'Vùng tối nâng mạnh — đen mờ sữa, chất phim nhựa vintage'],
};

const blackGammaLevel: Phrases = {
  [-2]: ['Shadow detail pulled well down — dense, moody dark areas', 'Chi tiết vùng tối kéo xuống nhiều — vùng tối dày, u trầm'],
  [-1]: ['Shadow detail pulled down slightly — tighter shadow gradation', 'Chi tiết vùng tối kéo xuống nhẹ — siết độ chuyển vùng tối'],
  0: ['Shadow gradation left flat — baseline shadow rendering', 'Chuyển tông vùng tối giữ nguyên mặc định'],
  1: ['Shadow detail opened up a little — clearer shadow regions', 'Chi tiết vùng tối mở ra chút — vùng tối rõ hơn'],
  2: ['Shadow detail opened well up — airy, visible dark areas', 'Chi tiết vùng tối mở nhiều — vùng tối thoáng, nhìn rõ chi tiết'],
};

const ppSaturation: Phrases = {
  [-2]: ['Colour pulled way down — subdued, near-monochrome palette', 'Màu giảm rất mạnh — bảng màu trầm, gần như đơn sắc'],
  [-1]: ['Colour restrained — muted, subtle palette', 'Màu tiết chế — bảng màu trầm dịu'],
  0: ['Colour intensity left neutral — standard camera baseline', 'Cường độ màu giữ trung tính mặc định'],
  1: ['Colour pushed up — richer, punchier hues without shouting', 'Màu đẩy lên — đậm đà hơn mà chưa bị gắt'],
  2: ['Colour pushed hard — vivid, high-impact hues', 'Màu đẩy mạnh — rực rỡ, gây ấn tượng thị giác'],
};

const colorPhase: Phrases = {
  [-2]: ['Whole palette rotated towards green', 'Toàn bộ bảng màu xoay về phía xanh lá'],
  [-1]: ['Palette nudged slightly green', 'Bảng màu lệch nhẹ sang xanh lá'],
  0: ['Hue left where the camera puts it', 'Sắc độ giữ nguyên như máy'],
  1: ['Palette nudged slightly red', 'Bảng màu lệch nhẹ sang đỏ'],
  2: ['Whole palette rotated towards red', 'Toàn bộ bảng màu xoay về phía đỏ'],
};

const detailLevel: Phrases = {
  [-2]: ['Sharpening well down — soft, filmic rendering', 'Giảm nét nhiều — mềm mại, chất phim nhựa'],
  [-1]: ['Sharpening eased off slightly — gentle edge softness', 'Giảm nét nhẹ — đường viền mềm mại hơn'],
  0: ['Sharpening at the camera default', 'Độ nét giữ mặc định'],
  1: ['Edges crisped up a little — cleaner detail definition', 'Đường viền sắc hơn chút — chi tiết nét hơn'],
  2: ['Edges crisped up hard — modern, cut-out look', 'Đường viền rất sắc — hiện đại, tách bạch rõ'],
};

/** Per-channel Color Depth. Higher = that colour is deeper and darker. */
function colorDepthEffect(channel: string, value: number, names: [string, string]): Effect {
  const s = step(value, PP_RANGES.colorDepth);
  const [en, vi] = names;
  const phrases: Phrases = {
    [-2]: [`${en} much paler and lighter`, `${vi} nhạt và sáng hơn nhiều`],
    [-1]: [`${en} slightly paler`, `${vi} nhạt hơn chút`],
    0: [`${en} left untouched`, `${vi} giữ nguyên`],
    1: [`${en} slightly deeper`, `${vi} sâu hơn chút`],
    2: [`${en} much deeper and richer`, `${vi} sâu và đậm hơn nhiều`],
  };
  return pick('color', phrases, s);
}

const CHANNEL_NAMES: Record<string, [string, string]> = {
  R: ['Reds', 'Sắc đỏ'],
  G: ['Greens', 'Sắc xanh lá'],
  B: ['Blues', 'Sắc xanh dương'],
  C: ['Cyans', 'Sắc lục lam'],
  M: ['Magentas', 'Sắc cánh sen'],
  Y: ['Yellows', 'Sắc vàng'],
};

/** Gamma curves grouped by what they do, rather than 15 separate strings. */
function gammaEffect(gamma: string): Effect {
  if (gamma.startsWith('S-Log')) {
    return {
      axis: 'contrast',
      en: 'Flat log curve — maximum dynamic range, meant for grading afterwards',
      vi: 'Đường log phẳng — dynamic range tối đa, dành để hậu kỳ',
    };
  }
  if (gamma.startsWith('HLG')) {
    return {
      axis: 'contrast',
      en: 'HDR curve — wide range that still looks natural straight out of camera',
      vi: 'Đường HDR — dải rộng mà vẫn tự nhiên ngay từ máy',
    };
  }
  if (gamma === 'S-Cinetone') {
    return {
      axis: 'contrast',
      en: 'Soft cinematic curve — gentle highlights, flattering skin',
      vi: 'Đường điện ảnh mềm — vùng sáng dịu, da đẹp',
    };
  }
  if (gamma.startsWith('Cine')) {
    const n = Number(gamma.replace('Cine', '')) || 1;
    return {
      axis: 'contrast',
      en:
        n <= 2
          ? 'Film curve with lifted shadows — subdued, gradation-rich'
          : 'Film curve with firmer contrast in the dark areas',
      vi:
        n <= 2
          ? 'Đường phim với vùng tối được nâng — trầm, giàu chuyển tông'
          : 'Đường phim với tương phản chắc hơn ở vùng tối',
    };
  }
  if (gamma.startsWith('ITU709')) {
    return {
      axis: 'contrast',
      en: 'Broadcast-standard curve — neutral, predictable contrast',
      vi: 'Đường chuẩn phát sóng — tương phản trung tính, dễ đoán',
    };
  }
  return {
    axis: 'contrast',
    en: 'Standard curve — contrast as the camera renders it by default',
    vi: 'Đường chuẩn — tương phản như máy hiển thị mặc định',
  };
}

function colorModeEffect(mode: string): Effect {
  if (mode === 'Black & White') {
    return { axis: 'color', en: 'Saturation removed entirely — monochrome', vi: 'Bỏ hoàn toàn màu — đơn sắc' };
  }
  if (mode.startsWith('S-Gamut')) {
    return {
      axis: 'color',
      en: 'Wide gamut — holds more colour than the screen shows, for grading',
      vi: 'Gamut rộng — giữ nhiều màu hơn màn hình hiển thị, để hậu kỳ',
    };
  }
  if (mode === 'S-Cinetone' || mode === 'Cinema') {
    return { axis: 'color', en: 'Cinematic colour — restrained, filmic hues', vi: 'Màu điện ảnh — sắc độ tiết chế, chất phim' };
  }
  if (mode === 'Pro' || mode === '709tone' || mode === 'ITU709 Matrix') {
    return { axis: 'color', en: 'Broadcast colour — accurate and neutral', vi: 'Màu chuẩn phát sóng — chính xác, trung tính' };
  }
  /* Sony, TP0000909109: BT.2020 is the gamut of the HDR standard ITU-R
     BT.2100; 709 records HLG in HDTV (ITU-R BT.709) colour. Both only with an
     HLG gamma, but they are not the same gamut. */
  if (mode === 'BT.2020') {
    return { axis: 'color', en: 'Wide HDR gamut (BT.2020), paired with an HLG curve', vi: 'Gamut HDR rộng (BT.2020), đi cùng đường HLG' };
  }
  if (mode === '709') {
    return { axis: 'color', en: 'HDTV (BT.709) colour, recorded with an HLG curve', vi: 'Màu chuẩn HDTV (BT.709), ghi cùng đường HLG' };
  }
  return { axis: 'color', en: 'Standard colour reproduction', vi: 'Tái tạo màu tiêu chuẩn' };
}

const vhBalance: Phrases = {
  [-2]: ['Vertical detail favoured — edges thicken up and down', 'Ưu tiên chi tiết dọc — viền dày theo chiều trên dưới'],
  [-1]: ['Leaning towards vertical detail', 'Nghiêng về chi tiết dọc'],
  0: ['Vertical and horizontal detail balanced', 'Chi tiết dọc và ngang cân bằng'],
  1: ['Leaning towards horizontal detail', 'Nghiêng về chi tiết ngang'],
  2: ['Horizontal detail favoured — edges thicken left and right', 'Ưu tiên chi tiết ngang — viền dày theo chiều trái phải'],
};

const detailLimit: Phrases = {
  0: ['Edge enhancement capped hard — halos suppressed', 'Giới hạn chặt phần tăng viền — hạn chế quầng sáng'],
  1: ['Edge enhancement moderately capped', 'Giới hạn vừa phải phần tăng viền'],
  2: ['Edge enhancement unrestricted', 'Không giới hạn phần tăng viền'],
};

const crispening: Phrases = {
  0: ['Sharpening applied to noise as well as subject', 'Tăng nét áp lên cả nhiễu lẫn chủ thể'],
  1: ['Some sharpening held back off noise', 'Bớt tăng nét trên nhiễu'],
  2: ['Sharpening kept well off noise — cleaner grain', 'Hầu như không tăng nét trên nhiễu — hạt sạch hơn'],
};

const hiLightDetail: Phrases = {
  0: ['No extra detail in the bright areas', 'Không thêm chi tiết ở vùng sáng'],
  1: ['Some added definition in bright areas', 'Thêm chút độ rõ ở vùng sáng'],
  2: ['Bright areas given the most edge definition', 'Vùng sáng được tăng viền nhiều nhất'],
};

/** B/W Balance runs Type1 (black detail) to Type5 (white detail). */
function bwBalanceEffect(type: string): Effect {
  const n = Number(type.replace(/\D/g, '')) || 3;
  if (n <= 2) {
    return {
      axis: 'detail',
      en: 'Weighted to black detail — edges read hard and present',
      vi: 'Nghiêng về chi tiết đen — viền chắc, hiện diện rõ',
    };
  }
  if (n >= 4) {
    return {
      axis: 'detail',
      en: 'Weighted to white detail — edges read clean and glossy',
      vi: 'Nghiêng về chi tiết trắng — viền sạch, bóng',
    };
  }
  return {
    axis: 'detail',
    en: 'Black and white detail balanced',
    vi: 'Chi tiết đen và trắng cân bằng',
  };
}

export function ppEffects(s: PpSettings): Record<string, Effect> {
  const knee: Effect =
    s.knee.mode === 'Auto'
      ? { axis: 'contrast', en: 'Highlights rolled off automatically', vi: 'Vùng sáng được nén tự động' }
      : s.knee.slope >= PP_RANGES.kneeManualSlope.max
        ? { axis: 'contrast', en: 'Knee effectively off — highlights run straight to clipping', vi: 'Knee gần như tắt — vùng sáng chạy thẳng tới cháy' }
        : s.knee.slope < 0
          ? { axis: 'contrast', en: 'Gentle roll-off — wider range, softer highlight gradation', vi: 'Nén thoải — dải rộng hơn, chuyển vùng sáng mềm' }
          : { axis: 'contrast', en: 'Firm roll-off — highlights compressed to hold detail', vi: 'Nén dứt khoát — vùng sáng ép lại để giữ chi tiết' };

  const effects: Record<string, Effect> = {
    blackLevel: pick('contrast', blackLevel, step(s.blackLevel, PP_RANGES.blackLevel)),
    gamma: gammaEffect(s.gamma),
    blackGamma: pick('contrast', blackGammaLevel, step(s.blackGamma.level, PP_RANGES.blackGammaLevel)),
    knee,
    colorMode: colorModeEffect(s.colorMode),
    saturation: pick('color', ppSaturation, step(s.saturation, PP_RANGES.saturation)),
    colorPhase: pick('color', colorPhase, step(s.colorPhase, PP_RANGES.colorPhase)),
    detailLevel: pick('detail', detailLevel, step(s.detail.level, PP_RANGES.detailLevel)),
    detailMode:
      s.detail.mode === 'Auto'
        ? { axis: 'detail', en: 'Camera decides the detail sub-settings', vi: 'Máy tự quyết các thông số chi tiết phụ' }
        : { axis: 'detail', en: 'Detail sub-settings dialled in by hand', vi: 'Các thông số chi tiết phụ được chỉnh tay' },
    vhBalance: pick('detail', vhBalance, step(s.detail.vhBalance, PP_RANGES.detailVhBalance)),
    bwBalance: bwBalanceEffect(s.detail.bwBalance),
    detailLimit: grade('detail', detailLimit, s.detail.limit, PP_RANGES.detailLimit),
    crispening: grade('detail', crispening, s.detail.crispening, PP_RANGES.detailCrispening),
    hiLightDetail: grade('detail', hiLightDetail, s.detail.hiLightDetail, PP_RANGES.detailHiLightDetail),
  };

  for (const [channel, names] of Object.entries(CHANNEL_NAMES)) {
    effects[`colorDepth.${channel}`] = colorDepthEffect(
      channel,
      s.colorDepth[channel as keyof typeof s.colorDepth],
      names,
    );
  }

  return effects;
}

// ---------------------------------------------------------------------------
// White Balance
// ---------------------------------------------------------------------------

/**
 * Each White Balance row describes what *that control alone* is doing.
 *
 * Deliberately not the combined cast: the reader is looking at three separate
 * dials, and telling them "the net result is warm" on the Kelvin row would be
 * wrong the moment the shift pulls the other way. The combined reading is
 * `wbSummary()` below, which is a separate statement in a separate place.
 *
 * Kelvin is judged in mireds, the scale colour temperature is actually additive
 * on — 2500K to 3000K is a far bigger visual step than 9000K to 9500K.
 */

const KELVIN_PHRASES: Record<Warmth, [en: string, vi: string]> = {
  'strong-warm': ['Set well above the light — renders strongly warm', 'Đặt cao hơn nhiều so với ánh sáng — ảnh ra rất ấm'],
  warm: ['Set above neutral — renders warmer', 'Đặt trên mức trung tính — ảnh ấm hơn'],
  neutral: ['Close to neutral daylight', 'Gần với ánh sáng ban ngày trung tính'],
  cool: ['Set below neutral — renders cooler', 'Đặt dưới mức trung tính — ảnh lạnh hơn'],
  'strong-cool': ['Set well below the light — renders strongly cool', 'Đặt thấp hơn nhiều so với ánh sáng — ảnh ra rất lạnh'],
};

function kelvinEffect(mired: number): Effect {
  const [en, vi] = KELVIN_PHRASES[gradeWarmth(mired)];
  return { axis: 'color', en, vi };
}

/**
 * How hard a shift pushes, as a share of the grid's full throw: strong past
 * 55% (the cut `step()` uses), mild under a quarter. On today's 0–7 grid that
 * is 4 and up, and 1.5 and down — widen `WB_SHIFT_AXIS` and the wording
 * follows. One helper for the row and the summary's tint, so they agree.
 */
function shiftStrength(amount: number): 'mild' | 'medium' | 'strong' {
  const ratio = amount / WB_SHIFT_AXIS.max;
  if (ratio >= 0.55) return 'strong';
  return ratio < 0.25 ? 'mild' : 'medium';
}

function shiftEffect(axisLetter: 'A' | 'B' | 'G' | 'M', amount: number): Effect {
  // A shift left at zero is set but not shifting. The admin form starts every
  // shift there, and "Slight blue coolness" for B0 described a cast that is
  // not in the frame.
  if (amount === 0) {
    return axisLetter === 'A' || axisLetter === 'B'
      ? { axis: 'color', en: 'No amber–blue shift', vi: 'Không dịch trên trục hổ phách–xanh dương' }
      : { axis: 'color', en: 'No green–magenta tint', vi: 'Không ám trên trục xanh lá–cánh sen' };
  }
  const strength = shiftStrength(amount);
  const grade = <T,>(s: T, m: T, w: T) => (strength === 'strong' ? s : strength === 'mild' ? w : m);

  switch (axisLetter) {
    case 'A':
      return {
        axis: 'color',
        en: grade('Full amber push — clearly warmer', 'Amber push — noticeably warmer', 'Slight amber warmth'),
        vi: grade('Đẩy hổ phách hết cỡ — ấm lên rõ rệt', 'Đẩy hổ phách — ấm lên thấy rõ', 'Ấm nhẹ về phía hổ phách'),
      };
    case 'B':
      return {
        axis: 'color',
        en: grade('Full blue push — clearly cooler', 'Blue push — noticeably cooler', 'Slight blue coolness'),
        vi: grade('Đẩy xanh dương hết cỡ — lạnh đi rõ rệt', 'Đẩy xanh dương — lạnh đi thấy rõ', 'Lạnh nhẹ về phía xanh dương'),
      };
    case 'G':
      return {
        axis: 'color',
        en: grade('Strong green tint', 'Green tint', 'Slight green tint'),
        vi: grade('Ám xanh lá mạnh', 'Ám xanh lá', 'Ám xanh lá nhẹ'),
      };
    default:
      return {
        axis: 'color',
        en: grade('Strong magenta tint', 'Magenta tint', 'Slight magenta tint'),
        vi: grade('Ám cánh sen mạnh', 'Ám cánh sen', 'Ám cánh sen nhẹ'),
      };
  }
}

/**
 * What each light-source preset is balancing for.
 *
 * Deliberately no Kelvin equivalents. Sony's White Balance page names the
 * sources and says the camera "adjusts the color tones to suit the selected
 * light source" — it does not publish a temperature for any of them, and
 * writing "Cloudy ≈ 6000K" here would be exactly the invented camera value
 * rule 1 exists to stop. Direction is safe to state; a number is not.
 */
const PRESET_PHRASES: Record<(typeof WB_PRESETS)[number], [en: string, vi: string]> = {
  Daylight: [
    'Balanced for direct sun — the baseline outdoor setting',
    'Cân bằng cho nắng trực tiếp — mức nền khi chụp ngoài trời',
  ],
  Shade: [
    'Balanced for open shade, which is bluer than direct sun, so the camera adds warmth',
    'Cân bằng cho vùng bóng râm — nơi ánh sáng xanh hơn nắng trực tiếp, nên máy bù thêm ấm',
  ],
  Cloudy: [
    'Balanced for overcast light — a little warmth added against a flat grey sky',
    'Cân bằng cho trời nhiều mây — thêm chút ấm để bù lại bầu trời xám phẳng',
  ],
  Incandescent: [
    'Balanced for tungsten bulbs — cools hard, because the source is far warmer than daylight',
    'Cân bằng cho đèn dây tóc — làm lạnh mạnh, vì nguồn sáng ấm hơn ánh sáng ngày rất nhiều',
  ],
  'Fluor.: Warm White': [
    'Balanced for warm-white fluorescent tubes, including the green cast they carry',
    'Cân bằng cho đèn huỳnh quang trắng ấm (Warm White), kể cả sắc xanh lá mà loại đèn này mang theo',
  ],
  'Fluor.: Cool White': [
    'Balanced for cool-white fluorescent tubes, including the green cast they carry',
    'Cân bằng cho đèn huỳnh quang trắng lạnh (Cool White), kể cả sắc xanh lá mà loại đèn này mang theo',
  ],
  'Fluor.: Day White': [
    'Balanced for day-white fluorescent tubes, including the green cast they carry',
    'Cân bằng cho đèn huỳnh quang trắng ban ngày (Day White), kể cả sắc xanh lá mà loại đèn này mang theo',
  ],
  'Fluor.: Daylight': [
    'Balanced for daylight fluorescent tubes, including the green cast they carry',
    'Cân bằng cho đèn huỳnh quang ánh sáng ban ngày (Daylight), kể cả sắc xanh lá mà loại đèn này mang theo',
  ],
  Flash: ['Balanced for the flash tube', 'Cân bằng cho đèn flash'],
  'Underwater Auto': [
    'Auto balance tuned for underwater, where the scene skews blue-green',
    'Cân bằng tự động cho môi trường dưới nước, nơi cảnh ngả xanh lam–lục',
  ],
};

export function wbEffects(wb: WhiteBalance): Record<string, Effect> {
  const effects: Record<string, Effect> = {};

  if (wb.mode === 'kelvin') {
    effects.temperature = kelvinEffect(wbBalance(wb).kelvin);
  } else if (wb.mode === 'preset') {
    const [en, vi] = PRESET_PHRASES[wb.preset];
    // Read from the sourced list, so a second still-only preset says so too.
    const stillOnly = (WB_PRESETS_STILL_ONLY as readonly string[]).includes(wb.preset);
    effects.temperature = stillOnly
      ? {
          axis: 'color',
          en: `${en}. Sony documents this one as still images only`,
          vi: `${vi}. Sony ghi rõ chế độ này chỉ dùng khi chụp ảnh tĩnh`,
        }
      : { axis: 'color', en, vi };
  } else {
    effects.temperature = {
      axis: 'color',
      en: 'Camera decides the temperature per frame — consistent only if the light is',
      vi: 'Máy tự quyết nhiệt độ màu từng khung — chỉ nhất quán khi ánh sáng nhất quán',
    };
  }

  if (wb.shift?.ab) effects.shiftAb = shiftEffect(wb.shift.ab.axis, wb.shift.ab.amount);
  if (wb.shift?.gm) effects.shiftGm = shiftEffect(wb.shift.gm.axis, wb.shift.gm.amount);

  return effects;
}

// ---------------------------------------------------------------------------
// White Balance — the combined reading
// ---------------------------------------------------------------------------

/**
 * The three rows above answer "what is this dial doing". They do not answer the
 * question readers actually arrive with, which is "so what does the picture
 * look like" — and for the commonest pairing in this catalogue, a warm Kelvin
 * with a B shift, the three rows read as a contradiction until someone points
 * out that Temperature and Shift A/B are the same axis in different units.
 *
 * So this says two things the per-row text structurally cannot:
 *   - `interplay` — why the two amber–blue controls are set against each other
 *     (or stacked), naming this recipe's own numbers.
 *   - `net` — where they land together, in terms of what shows up in the frame.
 *
 * Both are qualitative on purpose. The magnitude comes from `wbBalance()`,
 * whose shift-step size is fitted rather than published, so this grades the
 * result into bands and never states a temperature the camera will produce.
 */
export type WbSummary = {
  /** Where the three dials land together. Always present. */
  net: Effect;
  /**
   * Why Temperature and Shift A/B appear to fight. Present only when both are
   * set and both are off neutral — otherwise there is no interplay to explain.
   */
  interplay?: Effect;
};

/**
 * The summary's neutral band is wider than the Kelvin row's, and has to be.
 *
 * A Kelvin figure converts to mireds exactly, so the row can grade it at 12.
 * The A/B shift's mired value cannot: `MIRED_PER_SHIFT_STEP` is fitted to eight
 * hand-read labels, not published by Sony. Once a shift is in play, a net
 * inside one shift step of neutral would flip sides if that estimate is off —
 * "Mojave Sun" (7000K B3) lands 0.1 mired cool on the current figure and warm
 * on a smaller one. Naming a direction there would be inventing precision, so
 * the honest reading is that the two controls cancel.
 */
function gradeNet(balance: WbBalance): Warmth | 'balanced' {
  const band = balance.shift !== 0 ? MIRED_PER_SHIFT_STEP : 12;
  if (Math.abs(balance.warmth) >= band) return gradeWarmth(balance.warmth);
  // "Cancel" needs two controls that both do something and pull opposite
  // ways. Two that push the same way stack, and a Kelvin the Temperature row
  // calls neutral is not a base for anything to cancel.
  return opposedPair(balance) ? 'balanced' : 'neutral';
}

/** Kelvin off neutral by the Temperature row's own grade, and a shift against it. */
function opposedPair(balance: WbBalance): boolean {
  return (
    balance.shift !== 0 &&
    gradeWarmth(balance.kelvin) !== 'neutral' &&
    Math.sign(balance.kelvin) !== Math.sign(balance.shift)
  );
}

const NET_PHRASES: Record<Warmth | 'balanced', [en: string, vi: string]> = {
  'strong-warm': [
    'reads strongly warm — sunlit skin, whites tipping to cream, blues held well back',
    'ra rất ấm — da bắt nắng, vùng trắng ngả kem, sắc xanh bị đẩy lùi rõ',
  ],
  warm: [
    'reads warm — a Golden Hour lean, with whites carrying a light cream cast',
    'ra ấm — nghiêng về tông Golden Hour, vùng trắng phủ nhẹ sắc kem',
  ],
  neutral: [
    'reads close to neutral — whites stay white, so the recipe’s colour character comes from the Picture Profile or Look rather than from the balance',
    'gần trung tính — vùng trắng vẫn là trắng, nên chất màu của công thức đến từ Picture Profile hoặc Look chứ không phải từ cân bằng trắng',
  ],
  balanced: [
    'lands close to neutral — the Kelvin setting and the A/B shift very nearly cancel each other, so whatever colour character the recipe has is coming from the Picture Profile or Look, not from the white balance',
    'rơi vào khoảng gần trung tính — mức Kelvin và WB Shift A/B gần như triệt tiêu nhau, nên chất màu của công thức đến từ Picture Profile hoặc Look chứ không phải từ cân bằng trắng',
  ],
  cool: [
    'reads cool — a blue-hour lean, with whites carrying a light slate cast',
    'ra lạnh — nghiêng về giờ xanh, vùng trắng phủ nhẹ sắc xám xanh',
  ],
  'strong-cool': [
    'reads strongly cool — icy whites, cooled skin, blues pushed forward',
    'ra rất lạnh — vùng trắng lạnh buốt, da nguội đi, sắc xanh nổi lên',
  ],
};

/**
 * The neutral readings above say the white balance contributes no colour at
 * all. With a G/M tint on top that is false — the tint IS the white balance —
 * so a tinted recipe gets a reading confined to the amber–blue axis, and the
 * tint sentence that follows says the rest.
 */
const NET_PHRASES_TINTED: Record<'neutral' | 'balanced', [en: string, vi: string]> = {
  neutral: [
    'reads close to neutral on the amber–blue axis — the white balance adds no warmth or coolness',
    'gần trung tính trên trục hổ phách–xanh dương — cân bằng trắng không thêm ấm hay lạnh',
  ],
  balanced: [
    'lands close to neutral on the amber–blue axis — the Kelvin setting and the A/B shift very nearly cancel each other, so the white balance adds no warmth or coolness',
    'rơi vào khoảng gần trung tính trên trục hổ phách–xanh dương — mức Kelvin và WB Shift A/B gần như triệt tiêu nhau, nên cân bằng trắng không thêm ấm hay lạnh',
  ],
};

/** Green–magenta, graded on the shift's own 0–7 throw rather than in mireds. */
type Tint = 'strong-magenta' | 'magenta' | 'none' | 'green' | 'strong-green';

/**
 * A whole sentence, not a trailing clause. The net phrases already end in one,
 * and appending a second produced "…, with whites carrying a light slate cast,
 * with a light magenta lean in skin tones."
 */
const TINT_PHRASES: Record<Tint, [en: string, vi: string]> = {
  'strong-magenta': [
    ' A firm magenta tint sits over that — skin lifts rosy.',
    ' Phủ lên trên là sắc cánh sen rõ — da ửng hồng.',
  ],
  magenta: [
    ' A light magenta lean sits over that, most visible in skin tones.',
    ' Phủ lên trên là sắc cánh sen nhẹ, thấy rõ nhất ở tông da.',
  ],
  none: ['', ''],
  green: [
    ' A light green lean sits over that, which suits foliage and open shade.',
    ' Phủ lên trên là sắc xanh lá nhẹ, hợp với cây lá và vùng bóng râm.',
  ],
  'strong-green': [
    ' A firm green tint sits over that — foliage and shade go cleaner, skin goes flatter.',
    ' Phủ lên trên là sắc xanh lá rõ — cây lá và vùng râm sạch hơn, tông da phẳng hơn.',
  ],
};

function gradeTint(gm: { axis: 'G' | 'M'; amount: number } | undefined): Tint {
  if (!gm || gm.amount === 0) return 'none';
  const strong = shiftStrength(gm.amount) === 'strong';
  if (gm.axis === 'M') return strong ? 'strong-magenta' : 'magenta';
  return strong ? 'strong-green' : 'green';
}

/**
 * What the A/B shift does to the Kelvin base it opposes. Chosen from the same
 * `gradeNet()` the net sentence uses, so the two never disagree about where
 * the pair lands — and inside the band, where the net names no side, neither
 * does this.
 */
const PULL_PHRASES: Record<'partial' | 'cancel' | 'past', [en: string, vi: string]> = {
  partial: ['pulls part of it back', 'kéo bớt lại một phần'],
  cancel: ['pulls it back to about neutral', 'kéo về gần như trung tính'],
  past: ['pulls past it to the other side', 'kéo vượt qua sang phía ngược lại'],
};

export function wbSummary(wb: WhiteBalance): WbSummary {
  const balance = wbBalance(wb);
  const netGrade = gradeNet(balance);
  const tint = gradeTint(wb.shift?.gm);
  const [netEn, netVi] =
    tint !== 'none' && (netGrade === 'neutral' || netGrade === 'balanced')
      ? NET_PHRASES_TINTED[netGrade]
      : NET_PHRASES[netGrade];
  const [tintEn, tintVi] = TINT_PHRASES[tint];

  // A preset names the light the camera is balancing *for*, so "whites stay
  // white" is not the story — how the frame reads depends on how far the real
  // light sits from that named source, which the recipe cannot know. With no
  // A/B shift pulling against it (a zero shift is none), the shift is the only
  // part we can describe.
  if (wb.mode === 'preset' && !wb.shift?.ab?.amount) {
    return {
      net: {
        axis: 'color',
        en: `Overall the camera balances for ${wb.preset}, and nothing pulls against it — the cast you actually get depends on how far the real light sits from that source.${tintEn}`,
        vi: `Tổng thể máy cân bằng theo ${wb.preset}, và không có gì kéo ngược lại — sắc lệch thu được phụ thuộc vào việc ánh sáng thực lệch bao xa so với nguồn đó.${tintVi}`,
      },
    };
  }

  const net: Effect = {
    axis: 'color',
    en: `Overall this ${netEn}.${tintEn}`,
    vi: `Tổng thể ảnh ${netVi}.${tintVi}`,
  };

  const ab = wb.shift?.ab;
  // No Kelvin, no A/B shift, or either sitting on neutral — nothing pulls
  // against anything, and inventing a tension to explain would just be noise.
  // "Neutral" for the Kelvin is the Temperature row's own grade, so the row
  // cannot read "Close to neutral daylight" beside a "warm base" here.
  if (wb.mode !== 'kelvin' || !ab || ab.amount === 0 || gradeWarmth(balance.kelvin) === 'neutral') {
    return { net };
  }

  const k = `${wb.kelvin}K`;
  const s = `${ab.axis}${ab.amount}`;

  if (!opposedPair(balance)) {
    return {
      net,
      interplay: {
        axis: 'color',
        en: `${k} and ${s} push the same way, so they stack — the cast is stronger than either figure suggests on its own.`,
        vi: `${k} và ${s} đẩy cùng chiều nên cộng dồn — sắc lệch mạnh hơn những gì từng con số gợi ra.`,
      },
    };
  }

  const warmBase = balance.kelvin > 0;
  // Past it when the shift outweighs the base: Kyoto Jade's 3700K A7 lands
  // warm, and "pulls part of it back" contradicted the net sentence above.
  const pull =
    netGrade === 'balanced'
      ? 'cancel'
      : Math.abs(balance.shift) > Math.abs(balance.kelvin)
        ? 'past'
        : 'partial';
  const [pullEn, pullVi] = PULL_PHRASES[pull];
  return {
    net,
    interplay: {
      axis: 'color',
      en:
        `Not a contradiction: Temperature and Shift A/B are the same amber–blue axis in different units. ` +
        `${k} sets a ${warmBase ? 'warm' : 'cool'} base and ${s} ${pullEn}. ` +
        `Read the pair, never either number by itself.`,
      vi:
        `Không hề mâu thuẫn: Temperature và Shift A/B là cùng một trục hổ phách–xanh dương, chỉ khác đơn vị. ` +
        `${k} đặt nền ${warmBase ? 'ấm' : 'lạnh'}, còn ${s} ${pullVi}. ` +
        `Hãy đọc cả cặp, đừng đọc riêng một con số.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Creative Look
// ---------------------------------------------------------------------------

const CL_PHRASES: Record<ClParam, { axis: EffectAxis; phrases: Phrases }> = {
  contrast: {
    axis: 'contrast',
    phrases: {
      [-2]: ['Contrast well down — flat, gentle tonality', 'Giảm tương phản nhiều — tông phẳng, dịu'],
      [-1]: ['Contrast eased slightly', 'Giảm tương phản nhẹ'],
      0: ['Contrast as the Look defines it', 'Tương phản theo đúng Look'],
      1: ['Contrast raised a little', 'Tăng tương phản chút'],
      2: ['Contrast raised hard — strong light-to-dark separation', 'Tăng tương phản mạnh — sáng tối tách bạch rõ'],
    },
  },
  highlights: {
    axis: 'contrast',
    phrases: {
      [-2]: ['Bright areas pulled well down — highlights protected', 'Vùng sáng kéo xuống nhiều — giữ được chi tiết sáng'],
      [-1]: ['Bright areas pulled down slightly', 'Vùng sáng kéo xuống nhẹ'],
      0: ['Bright areas left as the Look renders them', 'Vùng sáng giữ nguyên theo Look'],
      1: ['Bright areas lifted a little', 'Vùng sáng nâng nhẹ'],
      2: ['Bright areas lifted hard — airy, high-key', 'Vùng sáng nâng mạnh — thoáng, high-key'],
    },
  },
  shadows: {
    axis: 'contrast',
    phrases: {
      [-2]: ['Dark areas pushed well down — heavy, dense shadows', 'Vùng tối đẩy xuống nhiều — bóng nặng, dày'],
      [-1]: ['Dark areas pushed down slightly', 'Vùng tối đẩy xuống nhẹ'],
      0: ['Dark areas left as the Look renders them', 'Vùng tối giữ nguyên theo Look'],
      1: ['Dark areas opened up a little', 'Vùng tối mở ra chút'],
      2: ['Dark areas opened well up — shadow detail stays visible', 'Vùng tối mở nhiều — chi tiết vùng tối vẫn rõ'],
    },
  },
  fade: {
    axis: 'contrast',
    phrases: {
      0: ['No fade — blacks stay true', 'Không phai — vùng đen giữ nguyên'],
      1: ['Slight milky lift across the frame', 'Phủ nhẹ lớp mờ sữa lên toàn khung'],
      2: ['Strong faded wash — matte, vintage feel', 'Phai mạnh — bề mặt lì, cảm giác hoài cổ'],
    },
  },
  saturation: {
    axis: 'color',
    phrases: {
      [-2]: ['Colour pulled well down — subdued', 'Màu giảm nhiều — trầm lắng'],
      [-1]: ['Colour restrained slightly', 'Màu tiết chế nhẹ'],
      0: ['Colour as the Look defines it', 'Màu theo đúng Look'],
      1: ['Colour lifted a little', 'Màu nâng nhẹ'],
      2: ['Colour lifted hard — vivid', 'Màu nâng mạnh — rực rỡ'],
    },
  },
  sharpness: {
    axis: 'detail',
    phrases: {
      0: ['No sharpening — softest rendering', 'Không tăng nét — mềm nhất'],
      1: ['Moderate edge definition', 'Đường viền vừa phải'],
      2: ['Strong edge definition — crisp detail', 'Đường viền rõ mạnh — chi tiết sắc'],
    },
  },
  sharpnessRange: {
    axis: 'detail',
    phrases: {
      [-2]: ['Sharpening kept to broad edges only', 'Chỉ tăng nét ở đường viền lớn'],
      [-1]: ['Sharpening on medium and broad edges', 'Tăng nét ở đường viền vừa và lớn'],
      0: ['Sharpening across the middle range', 'Tăng nét ở dải trung bình'],
      1: ['Sharpening reaching into finer detail', 'Tăng nét lan tới chi tiết mảnh hơn'],
      2: ['Sharpening applied to the finest detail', 'Tăng nét tới chi tiết mảnh nhất'],
    },
  },
  clarity: {
    axis: 'detail',
    phrases: {
      0: ['No clarity boost — smooth mid-tones', 'Không tăng độ trong — vùng trung gian mượt'],
      1: ['Mild local contrast in the mid-tones', 'Tương phản cục bộ nhẹ ở vùng trung gian'],
      2: ['Strong local contrast — textures stand out', 'Tương phản cục bộ mạnh — kết cấu nổi rõ'],
    },
  },
};

/** Monochrome Looks: nothing about hue applies. */
function lookEffect(look: string): Effect {
  if (look === 'BW') return { axis: 'color', en: 'Monochrome — no colour at all', vi: 'Đơn sắc — không màu' };
  if (look === 'SE') return { axis: 'color', en: 'Sepia monotone — warm single-hue rendering', vi: 'Đơn sắc nâu — một tông ấm duy nhất' };
  if (look === 'VV' || look === 'VV2') return { axis: 'color', en: 'Vivid base — saturation and contrast raised before any adjustment', vi: 'Nền Vivid — bão hoà và tương phản đã cao sẵn trước khi chỉnh' };
  if (look === 'FL') return { axis: 'color', en: 'Film base — moody colour with sharp contrast', vi: 'Nền Film — màu u trầm với tương phản gắt' };
  if (look === 'IN') return { axis: 'color', en: 'Instant base — matte texture, contrast and colour suppressed', vi: 'Nền Instant — bề mặt lì, tương phản và màu bị nén' };
  if (look === 'SH') return { axis: 'color', en: 'Soft Highkey base — bright, airy, gentle', vi: 'Nền Soft Highkey — sáng, thoáng, dịu' };
  if (look === 'PT') return { axis: 'color', en: 'Portrait base — skin rendered soft', vi: 'Nền Portrait — da lên mềm' };
  if (look === 'NT') return { axis: 'color', en: 'Neutral base — saturation and sharpness lowered for grading', vi: 'Nền Neutral — giảm bão hoà và độ nét để hậu kỳ' };
  return { axis: 'color', en: 'Standard base — balanced across subjects', vi: 'Nền Standard — cân bằng cho mọi chủ thể' };
}

export function clEffects(s: ClSettings): Record<string, Effect> {
  const effects: Record<string, Effect> = { look: lookEffect(s.look) };

  for (const [param, def] of Object.entries(CL_PHRASES) as [ClParam, (typeof CL_PHRASES)[ClParam]][]) {
    const value = s[param];
    if (value === undefined) continue; // Saturation on BW/SE
    effects[param] = grade(def.axis, def.phrases, value, CL_RANGES[param]);
  }

  return effects;
}

export const AXIS_LABELS: Record<EffectAxis, { en: string; vi: string }> = {
  contrast: { en: 'Contrast', vi: 'Tương phản' },
  color: { en: 'Colour', vi: 'Màu' },
  detail: { en: 'Detail', vi: 'Chi tiết' },
};
