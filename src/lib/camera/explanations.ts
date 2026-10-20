/**
 * What each camera parameter actually does, in both languages.
 *
 * The parameter *name* stays English everywhere (rule 3) — only the explanation
 * is translated. Keyed by the canonical setting key so a parameter cannot be
 * renamed without the explanation following; `explanations.test.ts` fails if any
 * parameter loses its entry.
 *
 * Picture Profile text is carried over from the original sonycolorlab, which had
 * both locales already. Creative Look text is written from Sony's own
 * descriptions in the ILCE-7M4 help guide (TP1000640837).
 */

import { CL_RANGES, PP_RANGES, WB_KELVIN, WB_SHIFT_AXIS, type Range } from './constants';

export type Explanation = { en: string; vi: string };

/*
 * Every bound below is read from `constants.ts` (rules 1 and 5): typed into the
 * prose, a widened range left both the text and its test stale and green.
 * Signed ranges carry an explicit `+`, the way the camera shows them.
 */
const bound = (r: Range, n: number) => (r.min < 0 && n > 0 ? `+${n}` : String(n));
const span = (r: Range, to: string) => `${bound(r, r.min)} ${to} ${bound(r, r.max)}`;

/** Picture Profile — keyed to `ppSettingsSchema` fields and Color Depth channels. */
export const PP_EXPLANATIONS = {
  blackLevel: {
    en: "Adjusts the master black level. Lower (−) values deepen the shadows for rich, punchy blacks. Higher (+) values lift the shadows for a soft, matte, film-like faded look without affecting highlight contrast.",
    vi: "Điều chỉnh mức đen tổng thể của hình ảnh. Giá trị âm (−) làm vùng tối sâu hơn, cho màu đen đậm và tương phản mạnh. Giá trị dương (+) nâng vùng tối lên, tạo vẻ mờ (matte) như phim cũ mà không ảnh hưởng đến tương phản vùng sáng.",
  },
  gamma: {
    en: "Selects the gamma curve that defines overall tonal response and contrast foundation. Options range from standard contrast (Movie/Still) to smooth filmic curves (Cine1–4, S-Cinetone) or ultra-wide dynamic range for grading (S-Log2/S-Log3, HLG).",
    vi: "Chọn đường cong Gamma, quyết định cách máy tái tạo dải sáng tối và độ tương phản nền. Từ tương phản chuẩn (Movie/Still), đường cong mềm kiểu điện ảnh (Cine1–4, S-Cinetone) đến dynamic range cực rộng để hậu kỳ (S-Log2/S-Log3, HLG).",
  },
  blackGamma: {
    en: `Controls contrast specifically in low-luminance shadow regions. 'Range' (Narrow/Middle/Wide) sets the shadow width affected, while 'Level' (${span(PP_RANGES.blackGammaLevel, 'to')}) darkens or lightens that shadow zone to fine-tune shadow texture.`,
    vi: `Tinh chỉnh tương phản riêng cho vùng tối có độ sáng thấp. 'Range' (Narrow/Middle/Wide) chọn độ rộng của vùng tối chịu tác động, còn 'Level' (${span(PP_RANGES.blackGammaLevel, 'đến')}) làm tối hoặc sáng riêng vùng đó để tinh chỉnh chi tiết vùng tối.`,
  },
  knee: {
    en: `Controls highlight compression to preserve bright details and prevent highlight clipping. Auto mode handles highlight rolloff automatically; Manual mode lets you set the compression start threshold (Point: ${PP_RANGES.kneeManualPoint.min}%–${PP_RANGES.kneeManualPoint.max}%) and roll-off steepness (Slope: ${span(PP_RANGES.kneeManualSlope, 'to')}).`,
    vi: `Kiểm soát mức nén vùng sáng để giữ chi tiết và tránh cháy sáng. Chế độ Auto tự xử lý phần chuyển vùng sáng; chế độ Manual cho phép đặt ngưỡng bắt đầu nén (Point: ${PP_RANGES.kneeManualPoint.min}%–${PP_RANGES.kneeManualPoint.max}%) và độ dốc của đường nén (Slope: ${span(PP_RANGES.kneeManualSlope, 'đến')}).`,
  },
  colorMode: {
    en: "Determines the color matrix and color space reproduction type. Matches color rendering characteristics to the chosen Gamma (e.g. S-Cinetone for natural skin tones, Cinema/Pro for rich movie colors, or ITU709 for standard broadcast).",
    vi: "Xác định ma trận màu và không gian màu. Cần chọn phù hợp với Gamma (ví dụ: S-Cinetone cho skintone tự nhiên, Cinema/Pro cho màu điện ảnh đậm đà, ITU709 cho màu truyền hình chuẩn).",
  },
  saturation: {
    en: `Adjusts overall color intensity across all channels. Higher values yield vibrant, vivid colors; lower values produce muted, desaturated tones. Range is ${span(PP_RANGES.saturation, 'to')} — dramatically wider than Creative Look saturation.`,
    vi: `Điều chỉnh độ bão hoà (cường độ đậm nhạt) của toàn bộ màu sắc trong ảnh. Giá trị cao cho màu sắc rực rỡ, tươi tắn; giá trị thấp tạo màu nhạt, dịu nhẹ. Dải điều chỉnh từ ${span(PP_RANGES.saturation, 'đến')} rộng hơn rất nhiều so với Creative Look.`,
  },
  colorPhase: {
    en: "Shifts the entire color spectrum hue globally. Negative (-) values shift all colors towards green; positive (+) values shift colors towards red/magenta. Useful for subtle global hue correction or matching camera bodies.",
    vi: "Xoay toàn bộ sắc độ (hue) của quang phổ màu sắc trên ảnh. Giá trị âm (-) ngả toàn bộ màu về phía xanh lá; giá trị dương (+) ngả về phía đỏ/hồng. Hữu ích khi cần cân chỉnh nhẹ tông màu tổng thể hoặc đồng bộ giữa hai máy.",
  },
  colorDepth: {
    en: "Adjusts the luminance and saturation depth of 6 colour channels (R, G, B, C, M, Y) independently. Positive (+) values deepen a channel, making it darker and richer; negative (−) values lighten and pale it. A key tool for signature colour recipes.",
    vi: "Điều chỉnh riêng độ đậm và độ sáng cho 6 kênh màu (R đỏ, G lục, B lam, C lục lam, M cánh sen, Y vàng). Giá trị dương (+) làm kênh màu đậm và sâu hơn; giá trị âm (−) làm kênh màu sáng và nhạt đi. Đây là công cụ chủ chốt tạo nên cá tính của từng công thức màu.",
  },
  detail: {
    en: `Master control for in-camera edge sharpening. Lower values (towards ${bound(PP_RANGES.detailLevel, PP_RANGES.detailLevel.min)}) give a soft, organic, film-like texture; higher values (towards ${bound(PP_RANGES.detailLevel, PP_RANGES.detailLevel.max)}) give a crisp, very sharp digital look.`,
    vi: `Bộ điều khiển trung tâm xử lý độ sắc nét đường viền. Giá trị thấp (về phía ${bound(PP_RANGES.detailLevel, PP_RANGES.detailLevel.min)}) tạo cảm giác mềm mại, mượt mà như phim nhựa; giá trị cao (về phía ${bound(PP_RANGES.detailLevel, PP_RANGES.detailLevel.max)}) cho hình ảnh kỹ thuật số vô cùng sắc nét, chi tiết.`,
  },
} as const satisfies Record<string, Explanation>;

/** Picture Profile Detail sub-parameters (Adjust, V/H Balance, B/W Balance, Limit, Crispening, Hi-Light Detail). */
export const PP_DETAIL_EXPLANATIONS = {
  level: {
    en: `Sets the master sharpening level (${span(PP_RANGES.detailLevel, 'to')}). Negative (−) values soften edge contours for an organic, film-like texture; positive (+) values sharpen fine details.`,
    vi: `Thiết lập mức sắc nét chung (${span(PP_RANGES.detailLevel, 'đến')}). Giá trị âm (−) làm mềm đường viền cho cảm giác như phim; giá trị dương (+) làm sắc nét các chi tiết nhỏ.`,
  },
  mode: {
    en: "Selects Auto for automatic camera detail processing or Manual to unlock full manual tuning of V/H Balance, B/W Balance, Limit, Crispening, and Hi-Light Detail.",
    vi: "Chọn Auto để máy tự động điều chỉnh sắc nét hoặc Manual để mở khoá tinh chỉnh thủ công toàn bộ V/H Balance, B/W Balance, Limit, Crispening và Hi-Light Detail.",
  },
  vhBalance: {
    en: `Adjusts the sharpening balance between vertical and horizontal edge lines. Range is ${bound(PP_RANGES.detailVhBalance, PP_RANGES.detailVhBalance.min)} (accentuates vertical lines) to ${bound(PP_RANGES.detailVhBalance, PP_RANGES.detailVhBalance.max)} (accentuates horizontal lines).`,
    vi: `Cân bằng độ sắc nét giữa đường viền chiều dọc và chiều ngang. Dải từ ${bound(PP_RANGES.detailVhBalance, PP_RANGES.detailVhBalance.min)} (nhấn mạnh các đường nét dọc) đến ${bound(PP_RANGES.detailVhBalance, PP_RANGES.detailVhBalance.max)} (nhấn mạnh các đường nét ngang).`,
  },
  bwBalance: {
    en: "Selects the sharpening edge balance between dark borders (Black Detail) and bright borders (White Detail), from Type1 (black-edge heavy) to Type5 (white-edge heavy).",
    vi: "Lựa chọn tỷ lệ sắc nét đường viền giữa viền tối (Black Detail) và viền sáng (White Detail), từ Type1 (thiên về viền đen đậm) đến Type5 (thiên về viền sáng rực).",
  },
  limit: {
    en: `Caps how far detail sharpening can go (${span(PP_RANGES.detailLimit, 'to')}), preventing white halos and harsh over-sharpened edges around high-contrast areas.`,
    vi: `Giới hạn biên độ sắc nét tối đa (${span(PP_RANGES.detailLimit, 'đến')}) nhằm ngăn chặn hiện tượng viền sáng (halo) hay vệt nhiễu gắt xung quanh các mép ảnh có độ tương phản cao.`,
  },
  crispening: {
    en: `Sets the noise threshold limit (${span(PP_RANGES.detailCrispening, 'to')}). Higher values prevent the camera from sharpening subtle sensor noise in flat uniform areas like skin tones, water, or sky.`,
    vi: `Đặt ngưỡng lọc nhiễu hạt (${span(PP_RANGES.detailCrispening, 'đến')}). Giá trị cao giúp máy không làm sắc nét các hạt nhiễu nhỏ ở vùng bề mặt phẳng mượt như da mặt, mặt nước hay bầu trời.`,
  },
  hiLightDetail: {
    en: `Adjusts detail sharpening level (${span(PP_RANGES.detailHiLightDetail, 'to')}) specifically in high-luminance highlight zones to maintain smooth highlight rolloff or boost bright texture.`,
    vi: `Điều chỉnh mức độ sắc nét (${span(PP_RANGES.detailHiLightDetail, 'đến')}) riêng cho các vùng chiếu sáng mạnh (highlight), giúp bảo tồn độ cuộn sáng mềm mịn hoặc tăng chi tiết bề mặt vùng sáng.`,
  },
} as const satisfies Record<string, Explanation>;

/** Color Depth channels. A higher value deepens that colour and lowers its luminance. */
export const COLOR_DEPTH_EXPLANATIONS = {
  R: {
    en: 'Red channel. Increase (+) for darker, richer reds — lipstick, skin. Decrease (-) for lighter, paler reds.',
    vi: 'Kênh đỏ. Tăng (+) để đỏ tối và đậm hơn — son môi, da. Giảm (-) để sáng và nhạt hơn.',
  },
  G: {
    en: 'Green channel. Increase (+) for darker, richer greens — foliage. Decrease (-) for lighter, paler greens.',
    vi: 'Kênh lục. Tăng (+) để xanh lá tối và đậm hơn — cây cỏ. Giảm (-) để sáng và nhạt hơn.',
  },
  B: {
    en: 'Blue channel. Increase (+) for darker, richer blues — clothing, streets. Decrease (-) for lighter, paler blues.',
    vi: 'Kênh lam. Tăng (+) để xanh dương tối và đậm hơn — quần áo, đường phố. Giảm (-) để sáng và nhạt hơn.',
  },
  C: {
    en: 'Cyan channel. Increase (+) for darker, richer cyan — sky, water. Decrease (-) for lighter, paler cyan.',
    vi: 'Kênh lục lam. Tăng (+) để màu da trời tối và đậm hơn — bầu trời, mặt nước. Giảm (-) để sáng và nhạt hơn.',
  },
  M: {
    en: 'Magenta channel. Increase (+) for darker, richer magenta — skin tones, lipstick. Decrease (-) for lighter, paler magenta.',
    vi: 'Kênh cánh sen. Tăng (+) để hồng/tím tối và đậm hơn — tông da, son môi. Giảm (-) để sáng và nhạt hơn.',
  },
  Y: {
    en: 'Yellow channel. Increase (+) for darker, richer yellows — Asian skin tones. Decrease (-) for lighter, paler yellows.',
    vi: 'Kênh vàng. Tăng (+) để vàng tối và đậm hơn — tông da người châu Á. Giảm (-) để sáng và nhạt hơn.',
  },
} as const satisfies Record<string, Explanation>;

/** Creative Look adjustments, from Sony's own descriptions in the ILCE-7M4 guide. */
export const CL_EXPLANATIONS = {
  contrast: {
    en: 'The higher the value, the more the difference between light and shadow is accentuated.',
    vi: 'Giá trị càng cao, chênh lệch giữa vùng sáng và vùng tối càng được nhấn mạnh.',
  },
  highlights: {
    en: 'Adjusts the brightness of the bright areas. Higher values make them brighter.',
    vi: 'Điều chỉnh độ sáng của vùng sáng. Giá trị cao hơn làm vùng sáng sáng hơn.',
  },
  shadows: {
    en: 'Adjusts the darkness of the dark areas. Higher values make them brighter.',
    vi: 'Điều chỉnh độ tối của vùng tối. Giá trị cao hơn làm vùng tối sáng lên.',
  },
  fade: {
    en: 'Adjusts the degree of fade — a milky lift on the whole image. Larger values make the effect greater. Never negative.',
    vi: 'Điều chỉnh mức độ phai màu — độ mờ sữa phủ toàn ảnh. Giá trị lớn hơn cho hiệu ứng mạnh hơn. Không bao giờ âm.',
  },
  saturation: {
    en: `The higher the value, the more vivid the colour. Range is ${span(CL_RANGES.saturation, 'to')} — much narrower than Picture Profile saturation. Cannot be adjusted on the BW or SE Looks.`,
    vi: `Giá trị càng cao màu càng rực. Dải giá trị ${span(CL_RANGES.saturation, 'đến')} — hẹp hơn nhiều so với Saturation của Picture Profile. Không chỉnh được trên Look BW hoặc SE.`,
  },
  sharpness: {
    en: 'Adjusts sharpness. Higher values accentuate contours; lower values soften them. Never negative.',
    vi: 'Điều chỉnh độ sắc nét. Giá trị cao làm đường viền rõ hơn, giá trị thấp làm mềm đi. Không bao giờ âm.',
  },
  sharpnessRange: {
    en: `Sets the range the sharpening applies to. A larger value applies it to finer outlines. Runs from ${span(CL_RANGES.sharpnessRange, 'to')} and is never negative.`,
    vi: `Đặt phạm vi áp dụng độ nét. Giá trị lớn hơn áp dụng cho đường viền mảnh hơn. Từ ${span(CL_RANGES.sharpnessRange, 'đến')}, không có giá trị âm.`,
  },
  clarity: {
    en: 'Adjusts the degree of clarity — local contrast in the mid-tones. Larger values make the effect greater. Never negative.',
    vi: 'Điều chỉnh độ trong trẻo — tương phản cục bộ ở vùng trung gian. Giá trị lớn hơn cho hiệu ứng mạnh hơn. Không bao giờ âm.',
  },
} as const satisfies Record<string, Explanation>;

/**
 * White Balance. These are controls, not Picture Profile settings, but they sit
 * in the same table so they need the same two kinds of help text.
 */
/**
 * How the White Balance section works as a whole, before any single row.
 *
 * The per-row text in `WB_EXPLANATIONS` cannot carry this: each row only knows
 * its own dial, and the thing readers get stuck on is the *relationship* — that
 * a high Kelvin renders warm rather than cool, and that a warm Kelvin sitting
 * next to a B shift therefore is not the mistake it looks like.
 *
 * The Kelvin step figures come from `WB_KELVIN` in `constants.ts` (2500–9900 in
 * 100K steps); the arithmetic that makes those steps coarse at the bottom and
 * fine at the top is just 10^6/K. At the bottom one Kelvin step is coarser than
 * a 0.25 shift step and at the top it is finer, which holds for any plausible
 * `MIRED_PER_SHIFT_STEP` — so the ends are named, never "warm" and "cool",
 * which in this paragraph would mean the opposite ends to a reader.
 */
const KELVIN_STEP_MIRED = {
  low: Math.round(1e6 / WB_KELVIN.min - 1e6 / (WB_KELVIN.min + WB_KELVIN.step)),
  high: Math.round(1e6 / (WB_KELVIN.max - WB_KELVIN.step) - 1e6 / WB_KELVIN.max),
};

export const WB_OVERVIEW: { en: string[]; vi: string[] } = {
  en: [
    'Three dials, one result. Temperature declares what light you are claiming to shoot under, and the two shifts nudge the outcome off that declaration.',
    'The part that trips almost everyone: a higher Kelvin number produces a warmer picture, not a cooler one. The number describes the light, not the output. Tell the camera the light is 8000K — very blue — and it compensates by adding amber, so the file comes out golden.',
    `That is why Temperature and Shift A/B are really one amber–blue axis in two different units, and why a warm Kelvin paired with a B shift is not a contradiction. It is a broad warm base with part of it deliberately pulled back. The two dials are not equally fine across the range: a single ${WB_KELVIN.step}K step is worth about ${KELVIN_STEP_MIRED.low} mired down at ${WB_KELVIN.min}K but only about ${KELVIN_STEP_MIRED.high} mired up at ${WB_KELVIN.max}K, so the shift is the finer control down at ${WB_KELVIN.min}K and the coarser one up at ${WB_KELVIN.max}K. On a low-Kelvin base it buys precision the Kelvin dial cannot give on its own.`,
    'Shift G/M is the second axis, and Kelvin never reaches it. It is the tint control: G cancels the green cast of fluorescent light and open shade, M goes the other way.',
  ],
  vi: [
    'Ba nút điều chỉnh, một kết quả. Temperature khai báo bạn đang chụp dưới nguồn sáng nào, còn hai shift đẩy kết quả lệch khỏi khai báo đó.',
    'Chỗ gần như ai cũng nhầm: số Kelvin càng cao thì ảnh càng ấm, chứ không phải càng lạnh. Con số đó mô tả ánh sáng, không phải mô tả ảnh ra. Bảo máy rằng ánh sáng là 8000K — tức rất xanh — thì máy bù lại bằng cách thêm hổ phách, nên file cho ra vàng ruộm.',
    `Vì vậy Temperature và Shift A/B thực chất là cùng một trục hổ phách–xanh dương, chỉ khác đơn vị; và một mức Kelvin ấm đi kèm shift B không hề mâu thuẫn. Đó là đặt nền ấm rộng rồi chủ động kéo bớt lại. Hai nút không tinh như nhau trên cả dải: một bước ${WB_KELVIN.step}K đáng khoảng ${KELVIN_STEP_MIRED.low} mired ở vùng ${WB_KELVIN.min}K nhưng chỉ khoảng ${KELVIN_STEP_MIRED.high} mired ở vùng ${WB_KELVIN.max}K, nên shift là nút tinh hơn ở vùng ${WB_KELVIN.min}K và thô hơn ở vùng ${WB_KELVIN.max}K. Với nền Kelvin thấp, shift cho độ chính xác mà riêng nút Kelvin không có.`,
    'Shift G/M là trục thứ hai, và Kelvin không bao giờ chạm tới. Đây là nút chỉnh sắc lệch (tint): G khử sắc xanh lá của đèn huỳnh quang và vùng bóng râm, M đi theo chiều ngược lại.',
  ],
};

export const WB_EXPLANATIONS = {
  temperature: {
    en: 'The colour temperature the camera balances for. Set it higher than the actual light and the image renders warmer; lower and it renders cooler.',
    vi: 'Nhiệt độ màu mà máy cân bằng theo. Đặt cao hơn ánh sáng thực thì ảnh ấm hơn; đặt thấp hơn thì ảnh lạnh hơn.',
  },
  shiftAb: {
    en: `Fine adjustment along the amber–blue axis, on top of the temperature. A warms the image, B cools it. Up to ${WB_SHIFT_AXIS.max} each way, in ${WB_SHIFT_AXIS.step} steps.`,
    vi: `Tinh chỉnh trên trục hổ phách–xanh dương, cộng thêm vào nhiệt độ màu. A làm ảnh ấm lên, B làm lạnh đi. Tối đa ${WB_SHIFT_AXIS.max} mỗi phía, bước ${String(WB_SHIFT_AXIS.step).replace('.', ',')}.`,
  },
  shiftGm: {
    en: 'Fine adjustment along the green–magenta axis. This is the tint control — it corrects casts that temperature alone cannot reach, such as fluorescent light.',
    vi: 'Tinh chỉnh trên trục xanh lá–cánh sen. Đây là điều chỉnh sắc lệch (tint) — xử lý những sắc lệch mà nhiệt độ màu không chạm tới, ví dụ ánh đèn huỳnh quang.',
  },
} as const satisfies Record<string, Explanation>;

export type Locale = 'en' | 'vi';
