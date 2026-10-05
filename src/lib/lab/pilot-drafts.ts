/**
 * The pilot content from the knowledge brief — six reference pages and three
 * experiment frames — as DRAFTS for the owner to review. Nothing here is
 * published by any code path:
 *
 * - the reading path never sees this file (it reads `lab_articles`, or the
 *   compiled `ARTICLES`, which these are not part of);
 * - the development store seeds them with `status: 'draft'`;
 * - `npm run push:lab -- --target content --with-pilot-drafts` inserts them as
 *   drafts and never overwrites a row that exists.
 *
 * Two rules the content follows, and the gates that hold them to it:
 *
 * 1. **No claim beyond a Sony page read in full.** Every range, enum and
 *    mechanism below is restated from a Help Guide page — the ones
 *    `constants.ts` cites, plus the ILCE-7M4 File Format page below — or is
 *    ColorLab's own explanation (`explanations.ts`) and says so. The pages
 *    were written against the repository's citations while the help-guide
 *    host was unreachable, then re-read in raw text on 2026-10-05 once the
 *    owner opened it; that pass corrected two claims (what Color Mode `Pro` is
 *    for, and HLG grouped with the log curves) and dated every source. Which
 *    pages to publish is still the owner's call in `/admin/blog` — see
 *    `docs/plans/2026-10-05-pilot-content.md`.
 * 2. **No invented results.** The three experiment frames carry no photograph,
 *    no EXIF, no measured value and no "I tried this". What only a real shoot
 *    can fill in is marked `[CẦN BỔ SUNG: …]`, and publishing refuses any page
 *    that still contains the marker (`placeholder`).
 */

import { HELP_GUIDE_SOURCES } from '@/lib/camera/constants'
import { EMPTY_META } from './meta'
import type { Article, ArticleMeta, SourceRef } from './types'

/** A Sony page `constants.ts` cites, with the day it was last re-read there. */
function sony(key: keyof typeof HELP_GUIDE_SOURCES, scope?: string): SourceRef {
  const s = HELP_GUIDE_SOURCES[key]
  return {
    url: s.url,
    title: s.title,
    publisher: 'Sony Help Guide',
    checkedAt: s.checkedAt,
    ...(scope ? { scope } : {}),
  }
}

/**
 * Help Guide pages a draft cites that hold no camera value, so they are not
 * `constants.ts`'s to cite. Same rule: read in full, dated.
 */
export const PILOT_EXTRA_SOURCES = {
  fileFormatIlce7m4: {
    url: 'https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000659396.html',
    title: 'ILCE-7M4 Help Guide — File Format (still image)',
    publisher: 'Sony Help Guide',
    scope: 'ILCE-7M4',
    checkedAt: '2026-10-05',
  },
} as const satisfies Record<string, SourceRef>

const meta = (m: Partial<ArticleMeta>): ArticleMeta => ({ ...EMPTY_META, ...m })

const TODO = (what: string) => `[CẦN BỔ SUNG: ${what}]`

export const PILOT_DRAFTS: readonly Article[] = [
  // ---------------------------------------------------------------------
  // Reference pages (kind: knowledge)
  // ---------------------------------------------------------------------
  {
    id: 'picture-profile-va-creative-look',
    kind: 'knowledge',
    topic: 'color',
    level: 'newbie',
    archetype: 'explainer',
    read: '5 phút đọc',
    title: 'Picture Profile và Creative Look: hai hệ màu không dùng chung',
    dek: 'Cả hai đều chỉnh màu ngay trong máy, nhưng máy chỉ cho bật một trong hai. Mỗi công thức ColorLab vì vậy là White Balance cộng đúng một hệ.',
    meta: meta({
      section: 'sony-color',
      order: 1,
      concepts: ['pp', 'cl', 'cl.look', 'pp.saturation', 'cl.saturation'],
      related: [{ kind: 'knowledge', id: 'white-balance-shift' }],
      sources: [sony('clIlce7m4', 'ILCE-7M4'), sony('ppIlce7m4', 'ILCE-7M4'), sony('ppColor')],
    }),
    blocks: [
      {
        t: 'p',
        text: 'Máy Sony Alpha có hai cách cài màu ngay trong máy: Picture Profile (PP) và Creative Look (CL). Chúng không cộng dồn với nhau. Theo Help Guide của Sony, khi Picture Profile đặt khác Off thì Creative Look bị khoá về [-] — muốn dùng Creative Look phải tắt Picture Profile trước.',
      },
      { t: 'h', text: 'Picture Profile chỉnh từng tầng của tín hiệu' },
      {
        t: 'p',
        text: 'Trên ILCE-7M4, Picture Profile có chín mục cài đặt: Black Level, Gamma, Black Gamma, Knee, Color Mode, Saturation, Color Phase, Color Depth và Detail. Gamma và Color Mode đặt nền tương phản và không gian màu; các mục còn lại tinh chỉnh vùng tối, vùng sáng, độ đậm từng kênh màu và độ nét. Sony ghi rằng các mục và lựa chọn có thể khác theo máy.',
      },
      { t: 'h', text: 'Creative Look bắt đầu từ một Look rồi chỉnh tám thanh' },
      {
        t: 'p',
        text: 'Creative Look chọn một trong mười Look dựng sẵn — ST, PT, NT, VV, VV2, FL, IN, SH, BW, SE — rồi cho chỉnh tám thông số: Contrast, Highlights, Shadows, Fade, Saturation, Sharpness, Sharpness Range và Clarity.',
      },
      {
        t: 'table',
        head: ['Điểm khác', 'Picture Profile', 'Creative Look'],
        rows: [
          ['Saturation', '−32 đến +32', '−9 đến +9'],
          ['Thông số không có dấu', 'Detail: Limit và Crispening 0 đến 7, Hi-Light Detail 0 đến 4', 'Fade, Sharpness, Clarity 0 đến 9; Sharpness Range 1 đến 5'],
          ['Đơn sắc', 'Color Mode Black & White', 'Look BW và SE — không chỉnh được Saturation'],
        ],
        caption: 'Dải giá trị theo các trang Help Guide trong mục Nguồn; Creative Look đối chiếu theo ILCE-7M4.',
      },
      {
        t: 'callout',
        label: 'Khi đọc Saturation trong một công thức',
        text: 'Hai thanh cùng tên nhưng khác thang đo. Từ 0 lên mức cao nhất, Saturation +6 trên Picture Profile mới đi chưa tới một phần năm quãng đường; trên Creative Look là hai phần ba.',
      },
      { t: 'h', text: 'Vì sao mỗi công thức chỉ chọn một hệ' },
      {
        t: 'p',
        text: 'Mỗi công thức trên ColorLab là White Balance cộng đúng một hệ: hoặc Picture Profile, hoặc Creative Look. Phần White Balance — chế độ cân bằng trắng và WB Shift — dùng chung cho cả hai, nên đọc giống nhau dù công thức thuộc hệ nào.',
      },
      {
        t: 'checklist',
        label: 'Trước khi nhập một công thức',
        items: [
          'Công thức ghi PP hay CL',
          'Với công thức CL: Picture Profile đang là Off',
          'White Balance và WB Shift đặt đúng như công thức',
        ],
      },
    ],
  },
  {
    id: 'white-balance-shift',
    kind: 'knowledge',
    topic: 'color',
    level: 'newbie',
    archetype: 'explainer',
    read: '6 phút đọc',
    title: 'White Balance Shift: nhiệt độ màu và hai trục tinh chỉnh',
    dek: 'Ba cách đặt White Balance, hai trục shift, và vì sao Kelvin cao lại cho ảnh ấm hơn.',
    meta: meta({
      section: 'sony-color',
      order: 2,
      concepts: ['wb', 'wb.temperature', 'wb.shiftAb', 'wb.shiftGm'],
      sources: [sony('wbIlce7m4', 'ILCE-7M4')],
    }),
    blocks: [
      {
        t: 'p',
        text: 'White Balance trong một công thức có hai phần: chế độ cân bằng trắng, và độ lệch WB Shift đặt chồng lên nó. Hai phần này dùng chung cho cả Picture Profile lẫn Creative Look.',
      },
      { t: 'h', text: 'Ba cách đặt cân bằng trắng' },
      {
        t: 'table',
        head: ['Chế độ', 'Đặt gì', 'Ví dụ trong ColorLab'],
        rows: [
          ['Kelvin (C.Temp.)', 'Một nhiệt độ màu cụ thể', '5600K'],
          ['Auto', 'Máy tự đo', 'AWB, AWB (Priority White), AWB (Priority Ambience)'],
          ['Preset nguồn sáng', 'Một nguồn sáng có sẵn trong menu', 'Daylight, Shade, Cloudy, Underwater Auto'],
        ],
        caption: 'Tên chế độ Auto giữ đúng cách ghi trong dữ liệu công thức; menu máy ghi là Auto, Auto: White và Auto: Ambience.',
      },
      {
        t: 'callout',
        label: 'Custom 1–3 không có trong công thức',
        text: 'Custom ghi lại một tấm card trắng đo trong một căn phòng cụ thể. Người khác không tái tạo được, nên ColorLab không dùng làm giá trị công thức.',
      },
      { t: 'h', text: 'Kelvin cao cho ảnh ấm hơn, không phải lạnh hơn' },
      {
        t: 'p',
        text: 'Con số Kelvin mô tả ánh sáng bạn khai báo với máy, không mô tả ảnh ra. Khai báo 8000K — ánh sáng rất xanh — thì máy bù bằng cách thêm hổ phách, nên ảnh ra ấm. Đặt Kelvin cao hơn ánh sáng thật thì ảnh ấm lên; thấp hơn thì lạnh đi.',
      },
      { t: 'h', text: 'Hai trục shift' },
      {
        t: 'p',
        text: 'Trục A–B lệch về hổ phách (A) hoặc xanh dương (B); trục G–M lệch về xanh lá (G) hoặc cánh sen (M). ColorLab ghi tối đa 7 mỗi phía với bước 0,25, lấy từ dữ liệu công thức hiện có. Help Guide của ILCE-7M4 không ghi giới hạn hay bước của hai trục này, cũng không ghi dải Kelvin — hãy đối chiếu trên máy của bạn.',
      },
      {
        t: 'callout',
        label: 'Khi thấy Kelvin ấm đi kèm shift B',
        text: 'Nhiệt độ màu và trục A–B thật ra là cùng một trục hổ phách–xanh dương, chỉ khác đơn vị. Kelvin ấm cộng shift B không mâu thuẫn: đó là đặt nền ấm rộng rồi kéo bớt lại. Trục G–M thì Kelvin không chạm tới.',
      },
      {
        t: 'checklist',
        label: 'Khi nhập phần White Balance',
        items: [
          'Đúng chế độ: Kelvin, Auto hay preset',
          'Đúng giá trị Kelvin hoặc tên preset',
          'Đúng hướng và mức shift A–B',
          'Đúng hướng và mức shift G–M',
        ],
      },
    ],
  },
  {
    id: 'color-depth',
    kind: 'knowledge',
    topic: 'color',
    level: 'mid',
    archetype: 'explainer',
    read: '5 phút đọc',
    title: 'Color Depth: chỉnh độ đậm từng kênh màu trong Picture Profile',
    dek: 'Sáu kênh R, G, B, C, M, Y, mỗi kênh từ −7 đến +7. Giá trị dương làm màu đậm và tối hơn, giá trị âm làm màu sáng và nhạt hơn.',
    meta: meta({
      section: 'sony-color',
      order: 3,
      concepts: ['pp.colorDepth', 'pp.saturation', 'pp.colorPhase'],
      prerequisites: ['picture-profile-va-creative-look'],
      sources: [sony('ppColor'), sony('ppIlce7m4', 'ILCE-7M4')],
    }),
    blocks: [
      {
        t: 'p',
        text: 'Color Depth là mục của Picture Profile. Thay vì tăng giảm mọi màu cùng lúc như Saturation, nó chỉnh riêng sáu kênh: đỏ (R), lục (G), lam (B), lục lam (C), cánh sen (M) và vàng (Y).',
      },
      { t: 'h', text: 'Dấu của giá trị nói gì' },
      {
        t: 'p',
        text: 'Mỗi kênh nhận giá trị từ −7 đến +7. Tăng (+) làm kênh đó đậm và tối hơn; giảm (−) làm kênh đó sáng và nhạt đi. Color Depth vì vậy đổi cả độ sáng của màu, không chỉ độ bão hoà. Màu càng đậm thì thay đổi càng rõ; màu trung tính như xám gần như không đổi.',
      },
      {
        t: 'table',
        head: ['Kênh', 'Thường thấy ở', 'Khi tăng (+)'],
        rows: [
          ['R — đỏ', 'Son môi, da', 'Đỏ tối và đậm hơn'],
          ['G — lục', 'Cây cỏ', 'Xanh lá tối và đậm hơn'],
          ['B — lam', 'Quần áo, đường phố', 'Xanh dương tối và đậm hơn'],
          ['C — lục lam', 'Bầu trời, mặt nước', 'Màu da trời tối và đậm hơn'],
          ['M — cánh sen', 'Tông da, son môi', 'Hồng tím tối và đậm hơn'],
          ['Y — vàng', 'Tông da người châu Á', 'Vàng tối và đậm hơn'],
        ],
        caption: 'Ví dụ chủ thể theo phần giải thích thông số của ColorLab; dải −7 đến +7 theo Help Guide trong mục Nguồn.',
      },
      { t: 'h', text: 'Color Depth khác Saturation và Color Phase thế nào' },
      {
        t: 'p',
        text: 'Saturation (−32 đến +32) đổi cường độ của mọi màu cùng lúc. Color Phase (−7 đến +7) xoay toàn bộ sắc độ — âm ngả về xanh lá, dương ngả về đỏ. Trong ba công cụ, chỉ Color Depth tác động lên từng kênh riêng.',
      },
      {
        t: 'callout',
        label: 'Nếu công thức dùng Creative Look',
        text: 'Creative Look không có Color Depth. Công thức CL chỉnh màu bằng Look và tám thanh của nó, nên không có mục này để tìm trong menu Creative Look.',
      },
    ],
  },
  {
    id: 'gamma-va-color-mode',
    kind: 'knowledge',
    topic: 'color',
    level: 'mid',
    archetype: 'explainer',
    read: '6 phút đọc',
    title: 'Gamma và Color Mode: đường cong sáng tối và không gian màu',
    dek: 'Hai mục nền của Picture Profile. Gamma quyết định cách máy dựng dải sáng tối; Color Mode quyết định ma trận và không gian màu đi cùng.',
    meta: meta({
      section: 'fundamentals',
      order: 1,
      concepts: ['pp', 'pp.gamma', 'pp.colorMode', 'pp.knee', 'pp.blackGamma'],
      sources: [sony('ppGammaColorMode'), sony('ppBlackKnee'), sony('ppIlce7m4', 'ILCE-7M4')],
    }),
    blocks: [
      {
        t: 'p',
        text: 'Trong Picture Profile, Gamma và Color Mode đặt nền cho mọi chỉnh sửa khác. Chọn sai cặp này thì các thanh tinh chỉnh phía sau chỉ đang sửa một nền không hợp.',
      },
      { t: 'h', text: 'Gamma chọn đường cong sáng tối' },
      {
        t: 'p',
        text: 'Gamma quyết định cách máy tái tạo dải sáng tối và độ tương phản nền. Các lựa chọn ColorLab ghi nhận gồm Movie, Still, S-Cinetone, Cine1 đến Cine4, ITU709, ITU709(800%), S-Log2, S-Log3, HLG và HLG1 đến HLG3: từ tương phản chuẩn, qua đường cong mềm kiểu điện ảnh, tới dải động rất rộng dành cho hậu kỳ.',
      },
      { t: 'h', text: 'Color Mode chọn ma trận và không gian màu' },
      {
        t: 'p',
        text: 'Color Mode xác định ma trận màu và không gian màu: Movie, Still, S-Cinetone, Cinema, Pro, 709tone, ITU709 Matrix, Black & White, S-Gamut, S-Gamut3, S-Gamut3.Cine, BT.2020 và 709. Mỗi Color Mode được thiết kế để đi với một Gamma: Movie, Still và S-Cinetone với Gamma cùng tên; Cinema với Cine1 và Cine2; Pro (tông màu máy quay chuyên nghiệp của Sony) và ITU709 Matrix với ITU709; S-Gamut với S-Log2; S-Gamut3 và S-Gamut3.Cine với S-Log3. BT.2020 và 709 chỉ chọn được khi Gamma là HLG. Không phải máy nào cũng có đủ danh sách này — Color Mode của ILCE-7M4 không có 709tone.',
      },
      {
        t: 'table',
        head: ['Mục', 'Quyết định', 'Tác động tới'],
        rows: [
          ['Gamma', 'Đường cong sáng tối', 'Tương phản nền, vùng sáng và vùng tối'],
          ['Color Mode', 'Ma trận và không gian màu', 'Cách mọi màu được tái tạo'],
          ['Knee, Black Gamma', 'Tinh chỉnh hai đầu đường cong', 'Vùng sáng gắt và vùng tối'],
        ],
        caption: 'Chọn Gamma và Color Mode trước, tinh chỉnh hai đầu đường cong sau.',
      },
      {
        t: 'callout',
        label: 'Nếu chọn S-Log2, S-Log3 hoặc HLG',
        text: 'S-Log2 và S-Log3 được thiết kế với giả định hình sẽ được xử lý sau khi quay, nên một công thức dùng chúng chưa phải kết quả cuối cùng. HLG thì khác: đó là gamma ghi HDR theo chuẩn ITU-R BT.2100, để xem trên màn hình hỗ trợ HLG.',
      },
    ],
  },
  {
    id: 'raw-jpeg-va-cai-dat-mau',
    kind: 'knowledge',
    topic: 'color',
    level: 'newbie',
    archetype: 'explainer',
    read: '4 phút đọc',
    title: 'RAW, JPEG và cài đặt màu trong máy',
    dek: 'Công thức màu là cài đặt trong máy. Máy áp dụng nó vào ảnh máy tự xử lý; với RAW, kết quả tuỳ phần mềm bạn dùng để mở file.',
    meta: meta({
      section: 'fundamentals',
      order: 2,
      concepts: ['wb', 'pp', 'cl'],
      related: [{ kind: 'knowledge', id: 'picture-profile-va-creative-look' }],
      sources: [PILOT_EXTRA_SOURCES.fileFormatIlce7m4, sony('ppIlce7m4', 'ILCE-7M4')],
    }),
    blocks: [
      {
        t: 'p',
        text: 'Một công thức ColorLab là tập cài đặt trong máy: White Balance cộng Picture Profile hoặc Creative Look. Máy áp dụng chúng khi tự xử lý ảnh, tức là vào file JPEG máy xuất ra.',
      },
      { t: 'h', text: 'Với RAW, phần mềm quyết định' },
      {
        t: 'p',
        text: 'Với file RAW, máy không xử lý ảnh — Sony mô tả định dạng này là để xử lý trên máy tính. Cài đặt màu trong máy có được áp dụng khi mở RAW hay không tuỳ phần mềm bạn dùng, nên hãy kiểm tra với phần mềm của mình trước khi đánh giá một công thức qua file RAW.',
      },
      {
        t: 'callout',
        label: 'Ngay cả khi phần mềm dùng cài đặt lúc chụp',
        text: 'Help Guide của ILCE-7M4 ghi rằng khi phát triển RAW theo cài đặt lúc chụp, bốn mục Picture Profile không được áp dụng: Black Level, Black Gamma, Knee và Color Depth. Một công thức PP dựa nhiều vào các mục này sẽ trông khác trên RAW.',
      },
      { t: 'h', text: 'So công thức sao cho công bằng' },
      {
        t: 'p',
        text: 'Muốn so hai công thức, hãy so ảnh máy xuất ra trực tiếp, chụp cùng cảnh và cùng ánh sáng. So một JPEG với một RAW đã chỉnh trên máy tính là so hai quy trình, không phải hai công thức.',
      },
      {
        t: 'checklist',
        label: 'Trước khi đánh giá một công thức',
        items: [
          'Có file JPEG do máy xuất ra',
          'Cùng cảnh, cùng ánh sáng cho mỗi lần so',
          'Đánh giá trên file chưa chỉnh',
        ],
      },
    ],
  },
  {
    id: 'chon-cong-thuc-theo-may',
    kind: 'knowledge',
    topic: 'color',
    level: 'newbie',
    archetype: 'setup-guide',
    read: '4 phút đọc',
    title: 'Chọn công thức theo máy ảnh của bạn',
    dek: 'Trước khi chọn theo màu, kiểm tra máy có hệ màu mà công thức dùng. ColorLab chưa xác minh từng đời máy, nên bước này bạn tự đối chiếu.',
    meta: meta({
      section: 'workflows',
      order: 1,
      concepts: ['pp', 'cl'],
      prerequisites: ['picture-profile-va-creative-look'],
      sources: [sony('clIlce7m4', 'ILCE-7M4'), sony('ppColor')],
    }),
    blocks: [
      {
        t: 'p',
        text: 'Một công thức chỉ dùng được trọn vẹn khi máy có đủ các mục nó cần. Picture Profile và Creative Look không có mặt trên mọi đời máy, và dải giá trị có thể khác theo máy.',
      },
      { t: 'h', text: 'Ba bước đối chiếu' },
      {
        t: 'p',
        text: 'Bước một: xem công thức thuộc hệ nào — nhãn PP hay CL trên trang công thức. Bước hai: mở Help Guide của đúng mẫu máy bạn có và tìm mục tương ứng. Bước ba: so từng giá trị trong công thức với dải giá trị Help Guide ghi cho máy đó.',
      },
      {
        t: 'callout',
        label: 'Khi Help Guide của máy bạn ghi khác',
        text: 'Tin Help Guide của máy bạn. Dải giá trị ColorLab dùng được đối chiếu theo các trang trong mục Nguồn; các thông số Creative Look mới đối chiếu theo ILCE-7M4.',
      },
      { t: 'h', text: 'Khi máy không có hệ màu công thức dùng' },
      {
        t: 'p',
        text: 'Một công thức Creative Look không chuyển sang Picture Profile được bằng cách chép số: hai hệ dùng thang đo khác nhau, ví dụ Saturation −9 đến +9 so với −32 đến +32. Hãy chọn một công thức thuộc hệ máy bạn có thay vì quy đổi.',
      },
      {
        t: 'checklist',
        label: 'Trước khi nhập công thức vào máy',
        items: [
          'Máy có hệ màu công thức dùng',
          'Mỗi giá trị nằm trong dải Help Guide của máy',
          'Picture Profile là Off nếu công thức là Creative Look',
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------
  // Experiment frames (kind: article) — need a real shoot before anything
  // ---------------------------------------------------------------------
  {
    id: 'thu-nghiem-white-balance-duoi-den-led',
    kind: 'article',
    topic: 'color',
    level: 'mid',
    archetype: 'versus',
    read: '',
    title: 'Thử nghiệm: White Balance dưới đèn LED trong nhà',
    dek: TODO('một câu kết luận sau khi có ảnh thử thật'),
    meta: meta({ related: [{ kind: 'knowledge', id: 'white-balance-shift' }] }),
    blocks: [
      { t: 'tldr', items: [TODO('kết luận 1'), TODO('kết luận 2'), TODO('kết luận 3')] },
      {
        t: 'p',
        text: 'Cùng một cảnh dưới đèn LED trong nhà, chụp với các chế độ White Balance khác nhau và giữ nguyên mọi thông số còn lại. Kết quả chỉ được điền sau khi có ảnh chụp thật.',
      },
      { t: 'h', text: 'Dựng cảnh thử' },
      {
        t: 'p',
        text: 'Chọn một cảnh có mảng trắng hoặc xám trung tính và một vùng da người. Cố định máy trên chân, phơi sáng thủ công, chụp JPEG. Ghi lại tên đèn và nhiệt độ màu nhà sản xuất công bố nếu có.',
      },
      {
        t: 'table',
        head: ['Cài đặt White Balance', 'Quan sát', 'Ghi chú'],
        rows: [
          ['AWB', '', ''],
          ['AWB (Priority White)', '', ''],
          ['Kelvin theo thông số đèn', '', ''],
          ['Daylight', '', ''],
        ],
        caption: TODO('máy, ống kính, đèn và thông số phơi sáng của buổi chụp'),
      },
      { t: 'h', text: 'Hai kết quả khác nhau rõ nhất' },
      {
        t: 'compare',
        beforeLabel: 'AWB',
        afterLabel: 'AWB (Priority White)',
        caption: TODO('chú thích sau khi có cặp ảnh thật'),
      },
      { t: 'p', text: TODO('nhận xét dựa trên ảnh thật') },
      {
        t: 'checklist',
        label: 'Trước khi chụp bộ ảnh thử',
        items: [
          'Máy trên chân, phơi sáng thủ công',
          'Có mảng trắng hoặc xám trong khung',
          'Chỉ đổi White Balance giữa các tấm',
          'Ghi lại tên và thông số đèn',
        ],
      },
    ],
  },
  {
    id: 'thu-nghiem-mot-cong-thuc-ba-loai-anh-sang',
    kind: 'article',
    topic: 'color',
    level: 'newbie',
    archetype: 'versus',
    read: '',
    title: 'Thử nghiệm: một công thức dưới ba loại ánh sáng',
    dek: TODO('một câu kết luận sau khi có ảnh thử thật'),
    meta: meta({ related: [{ kind: 'knowledge', id: 'raw-jpeg-va-cai-dat-mau' }] }),
    blocks: [
      { t: 'tldr', items: [TODO('kết luận 1'), TODO('kết luận 2'), TODO('kết luận 3')] },
      {
        t: 'p',
        text: 'Một công thức được chụp trong ba điều kiện ánh sáng khác nhau, giữ nguyên toàn bộ cài đặt màu. Mục đích là thấy phần nào của màu đến từ công thức và phần nào đến từ ánh sáng.',
      },
      { t: 'h', text: 'Chọn công thức và cảnh' },
      {
        t: 'p',
        text: `${TODO('chọn một công thức và gắn vào mục Liên kết liên quan')} Chụp cùng một chủ thể ở ba nơi, cùng ống kính và cùng khung hình nếu có thể.`,
      },
      {
        t: 'table',
        head: ['Ánh sáng', 'Quan sát', 'Ghi chú'],
        rows: [
          ['Nắng trực tiếp', '', ''],
          ['Bóng râm', '', ''],
          ['Đèn trong nhà', '', ''],
        ],
        caption: TODO('máy, ống kính và thông số phơi sáng thật của từng tấm'),
      },
      { t: 'h', text: 'Hai điều kiện khác nhau rõ nhất' },
      {
        t: 'compare',
        beforeLabel: TODO('ánh sáng và thông số tấm 1'),
        afterLabel: TODO('ánh sáng và thông số tấm 2'),
        caption: TODO('chú thích sau khi có cặp ảnh thật'),
      },
      { t: 'p', text: TODO('nhận xét dựa trên ảnh thật') },
      {
        t: 'checklist',
        label: 'Giữ nguyên giữa các tấm',
        items: [
          'Cùng công thức, không chỉnh thêm',
          'Cùng ống kính và tiêu cự',
          'Ghi lại thông số phơi sáng từng tấm',
        ],
      },
    ],
  },
  {
    id: 'so-sanh-hai-cau-hinh-cung-canh',
    kind: 'article',
    topic: 'color',
    level: 'mid',
    archetype: 'versus',
    read: '',
    title: 'Thử nghiệm: Picture Profile và Creative Look trên cùng một cảnh',
    dek: TODO('một câu kết luận sau khi có ảnh thử thật'),
    meta: meta({
      related: [{ kind: 'knowledge', id: 'picture-profile-va-creative-look' }],
      prerequisites: ['picture-profile-va-creative-look'],
    }),
    blocks: [
      { t: 'tldr', items: [TODO('kết luận 1'), TODO('kết luận 2'), TODO('kết luận 3')] },
      {
        t: 'p',
        text: 'Hai cấu hình — một công thức Picture Profile và một công thức Creative Look — chụp cùng một cảnh, cùng ánh sáng, cùng phơi sáng. Chỉ hệ màu thay đổi.',
      },
      { t: 'h', text: 'Hai cấu hình được so' },
      {
        t: 'p',
        text: TODO('chọn một công thức PP và một công thức CL, gắn cả hai vào mục Liên kết liên quan'),
      },
      {
        t: 'table',
        head: ['Hạng mục', 'Picture Profile', 'Creative Look'],
        rows: [
          ['Tông da', '', ''],
          ['Vùng sáng', '', ''],
          ['Vùng tối', '', ''],
        ],
        caption: TODO('máy, ống kính, ánh sáng và thông số phơi sáng thật'),
      },
      { t: 'h', text: 'Cùng khung hình, hai hệ màu' },
      {
        t: 'compare',
        beforeLabel: TODO('tên công thức PP'),
        afterLabel: TODO('tên công thức CL'),
        caption: TODO('chú thích sau khi có cặp ảnh thật'),
      },
      { t: 'p', text: TODO('nhận xét dựa trên ảnh thật') },
      {
        t: 'checklist',
        label: 'Điều kiện để so công bằng',
        items: [
          'Cùng cảnh và cùng ánh sáng',
          'Cùng phơi sáng thủ công',
          'Picture Profile là Off khi chụp tấm Creative Look',
        ],
      },
    ],
  },
]
