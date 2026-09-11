/**
 * The article catalogue and the two filter vocabularies.
 *
 * In the design handoff these three articles lived in an `ARTICLES` array
 * inside the prototype's HTML, and its README flags that as the one thing to
 * replace: "in production this should come from a CMS or MDX". This module is
 * the seam where that happens. Nothing outside it knows where an article came
 * from — the feed and the article view both go through `getArticle` and
 * `ARTICLES`, so swapping this file for a Supabase query or an MDX loader
 * later is a change to one module, not to every renderer.
 *
 * Until then the content is typed rather than parsed, which buys the thing a
 * CMS cannot: `ARTICLE-SPEC.md`'s block vocabulary is checked at build time.
 */

import type { Article, LevelId, TopicId } from './types'

/**
 * Ten topics, in the order they appear in the rail. The order is editorial —
 * setup first because it is where a new reader lands, firmware last because
 * it is the one nobody browses for. Not alphabetical, and not by count.
 *
 * Labels are Vietnamese in both locales for the same reason article bodies
 * are: they name the article's subject, and the articles are Vietnamese.
 */
export const TOPICS: readonly { readonly id: TopicId; readonly label: string }[] = [
  { id: 'setup', label: 'Thiết lập máy' },
  { id: 'color', label: 'Màu ảnh & Creative Look' },
  { id: 'af', label: 'Lấy nét & AF' },
  { id: 'exposure', label: 'Phơi sáng & đo sáng' },
  { id: 'lens', label: 'Ống kính' },
  { id: 'body', label: 'Body & so sánh máy' },
  { id: 'video', label: 'Video / cinematic' },
  { id: 'post', label: 'Hậu kỳ & LUT' },
  { id: 'gear', label: 'Phụ kiện & workflow' },
  { id: 'firmware', label: 'Firmware' },
] as const

export const LEVELS: readonly { readonly id: LevelId; readonly label: string }[] = [
  { id: 'newbie', label: 'Newbie' },
  { id: 'mid', label: 'Khá' },
  { id: 'pro', label: 'Nâng cao' },
] as const

const TOPIC_LABELS = new Map(TOPICS.map((t) => [t.id, t.label]))
const LEVEL_LABELS = new Map(LEVELS.map((l) => [l.id, l.label]))

export function topicLabel(id: TopicId): string {
  return TOPIC_LABELS.get(id) ?? id
}

export function levelLabel(id: LevelId): string {
  return LEVEL_LABELS.get(id) ?? id
}

export const ARTICLES: readonly Article[] = [
  {
    id: 'back-button-af',
    topic: 'af',
    level: 'mid',
    archetype: 'technique',
    read: '7 phút đọc',
    title: 'Lấy nét bằng ngón tay cái: bỏ nửa cò, dùng AF-ON',
    dek: 'Tách việc lấy nét ra khỏi nút chụp. Ba thay đổi trong menu, và một buổi tập để tay quen.',
    blocks: [
      {
        t: 'tldr',
        items: [
          'Gán AF ON cho nút AEL (hoặc C1), rồi tắt AF w/ shutter.',
          'Ngón cái giữ nút là bám nét, nhả ra là khoá nét — ngón trỏ chỉ còn việc bấm chụp.',
          'Đi cùng AF-C và Tracking: Zone thì mới phát huy hết.',
        ],
      },
      {
        t: 'p',
        text: 'Ở cách bấm mặc định, nửa cò làm hai việc cùng lúc: lấy nét và chờ chụp. Hệ quả là bạn luôn phải chọn giữa giữ nét và bấm chụp — và trong lúc do dự thì khoảnh khắc đã qua. Chuyển nét sang một nút riêng cho ngón cái là cách gỡ đúng cái xung đột đó.',
      },
      { t: 'h', text: 'Ba thay đổi trong menu' },
      {
        t: 'menu',
        old: 'MENU → Camera Settings2 → Custom Key (Shoot) → AEL Button → AF ON',
        new: 'MENU → Setup → Operation Customize → Custom Key/Dial Set. → nút AEL → AF ON',
      },
      {
        t: 'menu',
        old: 'MENU → Camera Settings1 → AF w/ shutter → Off',
        new: 'MENU → Focus → AF/MF → AF w/ Shutter → Off',
      },
      {
        t: 'callout',
        label: 'Vì sao phải tắt AF w/ shutter',
        text: 'Nếu để On, nửa cò vẫn lấy nét và bạn có hai nút làm cùng một việc — tay sẽ quay về thói quen cũ trong lúc gấp. Tắt nó là cách buộc thói quen mới hình thành.',
      },
      { t: 'h', text: 'Tập trong một buổi' },
      {
        t: 'p',
        text: 'Đặt AF-C và Focus Area là Tracking: Zone. Đưa vùng nét lên chủ thể, giữ ngón cái để máy bắt và bám, rồi bố cục lại thoải mái — nét vẫn dính vào chủ thể. Muốn khoá nét tại một điểm để bố cục kiểu khác: nhả ngón cái ra, nét đứng lại ngay đó cho tới khi bạn bấm lại.',
      },
      {
        t: 'table',
        head: ['Tình huống', 'Ngón cái', 'Ngón trỏ'],
        caption: 'Cùng một cách bấm cho cả ba tình huống — đó là điểm mạnh của nó.',
        rows: [
          ['Chủ thể đứng yên', 'Bấm rồi nhả (khoá nét)', 'Bấm chụp'],
          ['Chủ thể di chuyển', 'Giữ liên tục', 'Bấm chụp nhiều lần'],
          ['Chụp qua vật cản', 'Nhả trước khi vật cản đi ngang', 'Bấm chụp'],
        ],
      },
      {
        t: 'compare',
        beforeLabel: 'Nửa cò',
        afterLabel: 'AF-ON',
        caption:
          'Cùng một cảnh có người bước qua trước ống kính: nửa cò dễ chuyển nét sang vật cản, AF-ON giữ nét ở chủ thể vì bạn chủ động nhả nút.',
      },
      {
        t: 'checklist',
        label: 'Sau khi đổi, kiểm tra lại',
        items: [
          'Nửa cò không còn lấy nét nữa',
          'Nút AEL (hoặc C1) lấy nét khi giữ',
          'Focus Mode đang là AF-C',
          'Focus Area đang là Tracking: Zone',
        ],
      },
    ],
  },
  {
    id: 'iso-auto-min-ss',
    topic: 'exposure',
    level: 'newbie',
    archetype: 'setup-guide',
    read: '5 phút đọc',
    title: 'ISO Auto và Min. SS: mục bị bỏ qua nhiều nhất trong menu Sony',
    dek: 'Vì sao ảnh trong nhà của bạn nhòe dù ISO chỉ có 400 — và một dòng cài đặt sửa được nó.',
    blocks: [
      {
        t: 'tldr',
        items: [
          'Đặt ISO Auto 100 – 6400, rồi đặt ISO AUTO Min. SS là 1/125.',
          'Không có Min. SS, máy ưu tiên ISO thấp và hạ tốc xuống 1/30 — ảnh sạch nhiễu nhưng nhòe.',
          'Ảnh nhiễu còn cứu được ở hậu kỳ, ảnh nhòe thì không.',
        ],
      },
      {
        t: 'p',
        text: 'Khi để ISO Auto, máy phải chọn giữa hai cái xấu: nâng ISO cho nhiễu lên, hay hạ tốc màn trập cho ảnh có nguy cơ nhòe. Mặc định máy nghiêng về ISO thấp — nghe hợp lý, nhưng đó là lý do rất nhiều ảnh trong nhà của người mới bị nhòe ở ISO chỉ 400.',
      },
      {
        t: 'menu',
        old: 'MENU → Camera Settings1 → ISO → ISO AUTO (Min 100 / Max 6400)',
        new: 'MENU → Exposure/Color → Exposure → ISO → ISO AUTO (Min 100 / Max 6400)',
      },
      {
        t: 'menu',
        old: 'MENU → Camera Settings1 → ISO AUTO Min. SS → 1/125',
        new: 'MENU → Exposure/Color → Exposure → ISO AUTO Min. SS → 1/125',
      },
      { t: 'h', text: 'Chọn con số nào' },
      {
        t: 'p',
        text: 'Min. SS là sàn tốc độ màn trập: máy được phép nâng ISO tuỳ ý nhưng không được đi chậm hơn con số này. Chọn nó theo chủ thể bạn chụp, không theo tiêu cự ống kính — người cử động nhanh hơn tay bạn rung.',
      },
      {
        t: 'table',
        head: ['Bạn chụp gì', 'Min. SS', 'Vì sao'],
        caption: 'Chọn theo chủ thể, không theo tiêu cự — người cử động nhanh hơn máy rung.',
        rows: [
          ['Chân dung đứng yên', '1/125', 'Đủ cho hơi thở và dịch chuyển nhẹ'],
          ['Trẻ con, tiệc, đường phố', '1/250', 'Người bước và tay vung nhanh hơn nhiều'],
          ['Phong cảnh có chân máy', '1/30 hoặc thấp hơn', 'Không có gì chuyển động, ưu tiên ISO thấp'],
        ],
      },
      {
        t: 'callout',
        label: 'Trần ISO là một lời hứa, không phải giới hạn cứng',
        text: 'Khi ánh sáng tụt quá thấp, máy đã ở trần ISO 6400 và vẫn thiếu sáng thì nó sẽ hạ tốc xuống dưới Min. SS. Lúc đó ảnh tối đi hoặc nhòe là dấu hiệu bạn cần ống kính khẩu lớn hơn, không phải cần sửa cài đặt.',
      },
      {
        t: 'compare',
        beforeLabel: '1/30, ISO 400',
        afterLabel: '1/125, ISO 1600',
        caption:
          'Cùng một khung trong nhà: bản ISO cao có nhiễu nhưng nét, bản ISO thấp sạch hơn mà mất chi tiết vì nhòe.',
      },
      {
        t: 'checklist',
        label: 'Ba dòng cần đúng',
        items: [
          'ISO: AUTO',
          'ISO AUTO Minimum 100 · Maximum 6400',
          'ISO AUTO Min. SS: 1/125',
        ],
      },
    ],
  },
  {
    id: 'body-ev-vs-flash-ev-sony-flash-ttl',
    topic: 'exposure',
    level: 'mid',
    archetype: 'explainer',
    read: '8 phút đọc',
    title: 'Body EV chỉnh background, Flash EV chỉnh chủ thể',
    dek: 'Chụp flash mà background lúc cháy lúc tối thui. Trên máy Sony có hai thanh EV riêng biệt — một cho ánh sáng môi trường, một cho đèn — và đa số chỉ đụng tới một.',
    blocks: [
      {
        t: 'tldr',
        items: [
          'Body EV lo background, Flash EV lo chủ thể — hai thanh chạy song song, không còn phải đánh đổi.',
          'Đổi Exp.comp.set sang Ambient only trước, nếu không Body EV sẽ kéo tụt luôn công suất đèn.',
          'Chế độ A, ISO Auto, shutter không nhanh hơn 1/160s, Flash Mode để Rear Sync.',
        ],
      },
      {
        t: 'p',
        text: 'Tấm đầu: mặt đẹp, background cháy trắng. Kéo sáng xuống chụp lại thì tấm sau background đúng ý, mặt tối thui. Vấn đề không nằm ở đèn. Một tấm ảnh có flash là hai lớp sáng chồng lên nhau, và máy Sony cho bạn một thanh bù sáng riêng cho từng lớp — đa số người dùng chỉ đụng tới một trong hai.',
      },
      { t: 'h', text: 'Vì sao hai thanh tách được nhau' },
      {
        t: 'p',
        text: 'Lớp ambient là ánh sáng môi trường, phụ thuộc vào khẩu, tốc và ISO — bạn thấy nó rõ nhất ở background. Lớp flash chỉ kéo dài khoảng một phần nghìn giây, nên dù shutter là 1/160s hay 1/15s thì cú đèn vẫn lọt trọn vào bên trong: tốc độ màn trập không làm flash sáng hay tối đi. Shutter chậm hơn thì chỉ có ambient lọt vào nhiều hơn, background sáng lên còn chủ thể vẫn y nguyên. Đó là cần gạt tách biệt của bạn.',
      },
      {
        t: 'figure',
        alt: 'Sơ đồ hai lớp sáng: dải ambient trải suốt thời gian phơi sáng, cú flash là một vạch hẹp nằm gọn bên trong',
        caption:
          'Cùng một khung ở 1/160s và 1/15s với công suất đèn giữ nguyên — chủ thể sáng như nhau, chỉ background đổi.',
      },
      { t: 'h', text: 'Dựng máy và đổi Exp.comp.set' },
      {
        t: 'p',
        text: 'Chế độ A, ISO Auto, khẩu chọn theo ý, shutter không nhanh hơn 1/160s — đó là tốc độ đồng bộ đèn của ZV-E10, nhanh hơn mức này thì màn trập chưa mở hết mà đèn đã đánh xong và ảnh có một dải đen cắt ngang. Gắn đèn vào thì máy thường tự giới hạn giúp bạn, cứ biết con số để đỡ hoảng khi chụp nắng gắt. Nhưng có một mục mặc định sai phải sửa trước khi tin vào bất cứ thứ gì phía dưới: Sony để Exp.comp.set ở Ambient & Flash, nghĩa là bạn kéo Body EV xuống một stop thì máy hạ luôn công suất đèn một stop, và cả background lẫn mặt cùng tối đi.',
      },
      {
        t: 'menu',
        old: 'MENU → Camera Settings1 → Exp.comp.set → Ambient only',
        new: 'MENU → Exposure/Color → Flash → Exp.comp.set → Ambient only',
      },
      {
        t: 'menu',
        old: 'MENU → Camera Settings1 → Flash Mode → Rear Sync.',
        new: 'MENU → Exposure/Color → Flash → Flash Mode → Rear Sync.',
      },
      { t: 'h', text: 'Kéo Body EV để dìm background' },
      {
        t: 'p',
        text: 'Body EV xuống thì máy tăng tốc màn trập hoặc hạ ISO, ambient lọt vào ít đi và background thẫm lại, trong khi flash TTL vẫn tự đo và bơm đủ sáng cho mặt nên chủ thể gần như không đổi. Đây là cách làm ra background dramatic mà không cần thêm đèn: bạn không làm chủ thể sáng lên, bạn dìm môi trường xuống. ZV-E10 không có bánh xe EV riêng, nên gán Exposure Comp. ra Control Wheel hoặc nút C1 trong Custom Key (Shoot) — bạn sẽ đụng vào nó liên tục, đừng để nó nằm trong menu. Muốn thấy trước background mà không phải chụp thử, gán thêm Shot. Result Preview vào một nút Custom: giữ nút là máy hiện đúng kết quả với khẩu đã khép và tốc, ISO thực tế, thả ra là về bình thường.',
      },
      {
        t: 'compare',
        beforeLabel: 'Body EV 0',
        afterLabel: 'Body EV -1.7',
        caption:
          'Cùng khẩu, cùng đèn TTL, chỉ khác Body EV: mặt giữ nguyên độ sáng, còn trời sau lưng chuyển từ trắng bệch sang lại có màu.',
      },
      { t: 'h', text: 'Kéo Flash EV để sửa chủ thể' },
      {
        t: 'p',
        text: 'Ở chế độ TTL, máy bắn một cú pre-flash, đo phản hồi rồi tự tính công suất — tính theo thuật toán, không theo gu của bạn. Flash Comp. là chỗ bạn nói thêm rằng tính xong thì cộng trừ giúp mình chừng này, trong dải ±3.0 EV. Nó chỉ tác động lên phần đèn chiếu tới, thường là mặt và thân trên, còn background ở xa nên gần như không nhận được gì. TTL vẫn là máy đoán: chủ thể mặc áo trắng thì nó giảm công suất và mặt bị tối, mặc đồ đen thì ngược lại — Flash EV chính là chỗ để sửa những lần đoán sai đó.',
      },
      {
        t: 'table',
        head: ['Bạn muốn', 'Body EV', 'Flash EV'],
        caption:
          'Điểm xuất phát, không phải công thức — đo trên ZV-E10 với đèn TTL gắn hotshoe và Exp.comp.set để Ambient only. Mỗi lần xem lại ảnh chỉ cần hỏi hai câu: background thế nào, và mặt thế nào.',
        rows: [
          ['Dramatic, chủ thể nổi bật', '-1 → -2', '0 → +0.7'],
          ['Trong nhà, tự nhiên', '-0.3 → 0', '-1 → -0.7'],
          ['Chống ngược sáng ban ngày', '-0.3 → -1', '0 → +1'],
          ['Tông sáng, airy', '0 → +0.7', '-1.3 → -0.7'],
          ['Golden hour, giữ màu trời', '-1 → -1.7', '+0.3 → +1'],
        ],
      },
      {
        t: 'checklist',
        label: 'Trước khi bấm tấm đầu tiên',
        items: [
          'Chế độ A, ISO Auto',
          'Shutter không nhanh hơn 1/160s',
          'Flash Mode đang là Rear Sync.',
          'Exp.comp.set đang là Ambient only',
          'Exposure Comp. đã gán ra Control Wheel hoặc C1',
          'Shot. Result Preview đã gán vào một nút Custom',
        ],
      },
    ],
  },
] as const

export function getArticle(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id)
}
