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

export type Explanation = { en: string; vi: string };

/** Picture Profile — keyed to `ppSettingsSchema` fields and Color Depth channels. */
export const PP_EXPLANATIONS = {
  blackLevel: {
    en: "Adjusts the master black level. Lower (-) values deepen shadow contrast for rich, punchy blacks. Higher (+) values lift shadows for a soft, matte, film-like faded look without affecting highlight contrast.",
    vi: "Điều chỉnh mức độ đen tổng thể của hình ảnh. Giá trị âm (-) làm sâu vùng tối, tăng tương phản. Giá trị dương (+) nâng vùng tối lên, tạo hiệu ứng mờ nhạt (matte) hoài cổ mà không làm cháy vùng sáng.",
  },
  gamma: {
    en: "Selects the gamma curve that defines overall tonal response and contrast foundation. Options range from standard contrast (Movie/Still) to smooth filmic curves (Cine1–4, S-Cinetone) or ultra-wide dynamic range for grading (S-Log2/S-Log3, HLG).",
    vi: "Lựa chọn đường cong Gamma định hình tương phản tổng thể và dải tương phản của ảnh. Bao gồm từ tương phản chuẩn (Movie/Still), tone màu điện ảnh dịu nhẹ (Cine1–4, S-Cinetone) cho đến dải tương phản rộng để hậu kỳ (S-Log2/S-Log3, HLG).",
  },
  blackGamma: {
    en: "Controls contrast specifically in low-luminance shadow regions. 'Range' (Narrow/Middle/Wide) sets the shadow width affected, while 'Level' (-7 to +7) darkens or lightens that shadow zone to fine-tune shadow texture.",
    vi: "Tinh chỉnh độ tương phản riêng cho vùng tối (bóng râm thấp). 'Range' (Narrow/Middle/Wide) xác định dải vùng tối bị ảnh hưởng, trong khi 'Level' (-7 đến +7) làm tối hoặc làm sáng riêng vùng đó để kiểm soát độ sâu shadow.",
  },
  knee: {
    en: "Controls highlight compression to preserve bright details and prevent highlight clipping. Auto mode handles highlight rolloff automatically; Manual mode lets you set the compression start threshold (Point: 75%–105%) and roll-off steepness (Slope: -5 to +5).",
    vi: "Kiểm soát độ nén vùng sáng (highlight) để ngăn hiện tượng cháy sáng. Chế độ Auto tự động xử lý mượt mà; chế độ Manual cho phép tự chọn ngưỡng bắt đầu nén (Point: 75%–105%) và độ cuộn dốc của đường nén (Slope: -5 đến +5).",
  },
  colorMode: {
    en: "Determines the color matrix and color space reproduction type. Matches color rendering characteristics to the chosen Gamma (e.g. S-Cinetone for natural skin tones, Cinema/Pro for rich movie colors, or ITU709 for standard broadcast).",
    vi: "Xác định ma trận màu sắc và không gian tái tạo màu. Cần chọn phù hợp với Gamma (ví dụ S-Cinetone tái tạo skintone da người tự nhiên, Cinema/Pro cho màu điện ảnh đậm đà, hoặc ITU709 cho màu truyền hình chuẩn).",
  },
  saturation: {
    en: "Adjusts overall color intensity across all channels. Higher values yield vibrant, vivid colors; lower values produce muted, desaturated tones. Range is -32 to +32 — dramatically wider than Creative Look saturation.",
    vi: "Điều chỉnh độ bão hòa (cường độ đậm nhạt) của toàn bộ màu sắc trong ảnh. Giá trị cao cho màu sắc rực rỡ, tươi tắn; giá trị thấp tạo màu nhạt, dịu nhẹ. Dải điều chỉnh từ -32 đến +32 rộng hơn rất nhiều so với Creative Look.",
  },
  colorPhase: {
    en: "Shifts the entire color spectrum hue globally. Negative (-) values shift all colors towards green; positive (+) values shift colors towards red/magenta. Useful for subtle global hue correction or matching camera bodies.",
    vi: "Xoay toàn bộ sắc độ (hue) của quang phổ màu sắc trên ảnh. Giá trị âm (-) ngả toàn bộ màu về phía xanh lá; giá trị dương (+) ngả về phía đỏ/hồng. Hữu ích khi cần cân chỉnh nhẹ tông màu tổng thể hoặc đồng bộ giữa hai máy.",
  },
  colorDepth: {
    en: "Adjusts color luminance and saturation depth independently for 6 color channels (R, G, B, C, M, Y). Positive (+) values deepen the channel by making it darker and richer; negative (-) values lighten and pale the channel. Key tool for signature color recipes.",
    vi: "Điều chỉnh độ sâu bão hòa và độ sáng riêng biệt cho 6 kênh màu (Đỏ, Xanh lá, Xanh dương, Xanh lam, Hồng cánh sen, Vàng). Giá trị dương (+) làm kênh màu đậm và sâu hơn; giá trị âm (-) làm kênh màu sáng và nhạt đi. Đây là công cụ nòng cốt tạo nên cá tính từng công thức màu.",
  },
  detail: {
    en: "Master control for in-camera edge sharpening signal processing. Lower values (-7 to -3) create a soft, organic filmic texture; higher values (+1 to +7) produce crisp, ultra-sharp modern digital images.",
    vi: "Bộ điều khiển trung tâm xử lý độ sắc nét đường viền. Giá trị thấp (-7 đến -3) tạo cảm giác mềm mại, mượt mà như phim nhựa; giá trị cao (+1 đến +7) cho hình ảnh kỹ thuật số vô cùng sắc nét, chi tiết.",
  },
} as const satisfies Record<string, Explanation>;

/** Picture Profile Detail sub-parameters (Adjust, V/H Balance, B/W Balance, Limit, Crispening, Hi-Light Detail). */
export const PP_DETAIL_EXPLANATIONS = {
  level: {
    en: "Sets the master sharpening level (-7 to +7). Negative (-) values soften edge contours for a organic filmic texture; positive (+) values sharpen fine details.",
    vi: "Thiết lập mức độ sắc nét trung tâm (-7 đến +7). Giá trị âm (-) làm mềm đường viền cho cảm giác cinematic; giá trị dương (+) làm sắc nét các chi tiết nhỏ.",
  },
  mode: {
    en: "Selects Auto for automatic camera detail processing or Manual to unlock full manual tuning of V/H Balance, B/W Balance, Limit, Crispening, and Hi-Light Detail.",
    vi: "Chọn Auto để máy tự động điều chỉnh sắc nét hoặc Manual để mở khóa tinh chỉnh thủ công toàn bộ V/H Balance, B/W Balance, Limit, Crispening và Hi-Light Detail.",
  },
  vhBalance: {
    en: "Adjusts the sharpening balance between vertical and horizontal edge lines. Range is -2 (accentuates vertical lines) to +2 (accentuates horizontal lines).",
    vi: "Cân bằng độ sắc nét giữa đường viền chiều dọc và chiều ngang. Dải từ -2 (nhấn mạnh các đường nét dọc) đến +2 (nhấn mạnh các đường nét ngang).",
  },
  bwBalance: {
    en: "Selects the sharpening edge balance between dark borders (Black Detail) and bright borders (White Detail), from Type1 (black-edge heavy) to Type5 (white-edge heavy).",
    vi: "Lựa chọn tỷ lệ sắc nét đường viền giữa viền tối (Black Detail) và viền sáng (White Detail), từ Type1 (thiên về viền đen đậm) đến Type5 (thiên về viền sáng rực).",
  },
  limit: {
    en: "Sets the maximum ceiling limit (0 to 7) for detail sharpening to prevent unsightly white halos or harsh over-sharpened artifacts around high-contrast edges.",
    vi: "Giới hạn biên độ sắc nét tối đa (0 đến 7) nhằm ngăn chặn hiện tượng viền sáng (halo) hay vệt nhiễu gắt xung quanh các mép ảnh có độ tương phản cao.",
  },
  crispening: {
    en: "Sets the noise threshold limit (0 to 7). Higher values prevent the camera from sharpening subtle sensor noise in flat uniform areas like skin tones, water, or sky.",
    vi: "Đặt ngưỡng lọc nhiễu hạt (0 đến 7). Giá trị cao giúp máy không làm sắc nét các hạt nhiễu nhỏ ở vùng bề mặt phẳng mượt như da mặt, mặt nước hay bầu trời.",
  },
  hiLightDetail: {
    en: "Adjusts detail sharpening level (0 to 4) specifically in high-luminance highlight zones to maintain smooth highlight rolloff or boost bright texture.",
    vi: "Điều chỉnh mức độ sắc nét (0 đến 4) riêng cho các vùng chiếu sáng mạnh (highlight), giúp bảo tồn độ cuộn sáng mềm mịn hoặc tăng chi tiết bề mặt vùng sáng.",
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
    en: 'The higher the value, the more vivid the colour. Range is -9 to +9 — much narrower than Picture Profile saturation. Cannot be adjusted on the BW or SE Looks.',
    vi: 'Giá trị càng cao màu càng rực. Dải giá trị -9 đến +9 — hẹp hơn nhiều so với Saturation của Picture Profile. Không chỉnh được trên Look BW hoặc SE.',
  },
  sharpness: {
    en: 'Adjusts sharpness. Higher values accentuate contours; lower values soften them. Never negative.',
    vi: 'Điều chỉnh độ sắc nét. Giá trị cao làm đường viền rõ hơn, giá trị thấp làm mềm đi. Không bao giờ âm.',
  },
  sharpnessRange: {
    en: 'Sets the range the sharpening applies to. A larger value applies it to finer outlines. Runs 1 to 5, never signed.',
    vi: 'Đặt phạm vi áp dụng độ nét. Giá trị lớn hơn áp dụng cho đường viền mảnh hơn. Từ 1 đến 5, không có dấu.',
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
export const WB_EXPLANATIONS = {
  temperature: {
    en: 'The colour temperature the camera balances for. Set it higher than the actual light and the image renders warmer; lower and it renders cooler.',
    vi: 'Nhiệt độ màu mà máy cân bằng theo. Đặt cao hơn ánh sáng thực thì ảnh ấm hơn; đặt thấp hơn thì ảnh lạnh hơn.',
  },
  shiftAb: {
    en: 'Fine adjustment along the amber–blue axis, on top of the temperature. A warms the image, B cools it. Seven steps each way, in quarter increments.',
    vi: 'Tinh chỉnh trên trục hổ phách–xanh dương, cộng thêm vào nhiệt độ màu. A làm ảnh ấm lên, B làm lạnh đi. Bảy bước mỗi phía, bước 0.25.',
  },
  shiftGm: {
    en: 'Fine adjustment along the green–magenta axis. This is the tint control — it corrects casts that temperature alone cannot reach, such as fluorescent light.',
    vi: 'Tinh chỉnh trên trục xanh lá–cánh sen. Đây là điều chỉnh tint — xử lý những sắc lệch mà nhiệt độ màu không chạm tới, ví dụ ánh đèn huỳnh quang.',
  },
} as const satisfies Record<string, Explanation>;

export type Locale = 'en' | 'vi';

/** Looks up an explanation, returning undefined rather than throwing. */
export function explain(
  table: Record<string, Explanation>,
  key: string,
  locale: Locale,
): string | undefined {
  return table[key]?.[locale];
}
