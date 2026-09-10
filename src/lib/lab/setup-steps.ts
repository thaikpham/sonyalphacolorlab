/**
 * The eight settings a new Sony Alpha owner should change before the first
 * shoot, and the two menu trees they live in.
 *
 * Sony split the menu in two: a6400 and ZV-E10 keep the old `Camera Settings1/2`
 * tabs, a6700 and ZV-E10 II moved to the `Exposure/Color` · `Focus` · `Setup`
 * grouping. Same setting, same value, different path — so the paths are
 * computed from one `MenuVersion` rather than duplicated into two step lists.
 * Two lists is how the recap table and the step body drift apart: someone
 * corrects a path in one and not the other, and the tool starts contradicting
 * itself on the same screen.
 *
 * `stepId` is version-independent on purpose. Completion is a fact about the
 * camera ("ISO Auto is capped"), not about which menu tree you read to get
 * there — persisting `old-03` and `new-03` separately would silently reset a
 * reader's progress the moment they flipped the toggle to check a path.
 */

import type { MenuVersion } from './types'

/** The recommended ceiling. Above it an APS-C file loses skin detail. */
const ISO_MAX = '6400'

/** The shutter floor. Below it a standing subject's own movement blurs. */
const MIN_SS = '1/125'

export type Setting = {
  readonly label: string
  readonly value: string
  /** Full menu path for the selected version, arrows included. */
  readonly path: string
}

export type SetupStep = {
  /** Stable across menu versions — the persistence key. */
  readonly id: string
  /** "01"–"08". Rendered in the gutter and the jump bar. */
  readonly n: string
  /** `#` target for the jump bar. */
  readonly anchor: string
  readonly kicker: string
  readonly title: string
  readonly settings: readonly Setting[]
  readonly why: string
  /** An optional aside — one step carries the back-button-AF technique. */
  readonly tip?: {
    readonly title: string
    readonly body: string
    readonly settings: readonly { readonly label: string; readonly path: string }[]
  }
}

/** The paths, both trees, in one table so a correction lands once. */
function paths(v: MenuVersion) {
  const isNew = v === 'new'
  return {
    mode: isNew
      ? 'Vòng xoay MODE → A (a6700) · MENU → Shooting → Shooting Mode → Shoot Mode → A (ZV-E10 II)'
      : 'Vòng xoay MODE → A (a6400) · Nút MODE → A (ZV-E10)',
    iso: isNew
      ? 'MENU → Exposure/Color → Exposure → ISO → ISO AUTO'
      : 'MENU → Camera Settings1 → ISO → ISO AUTO',
    minss: isNew
      ? 'MENU → Exposure/Color → Exposure → ISO AUTO Min. SS'
      : 'MENU → Camera Settings1 → ISO AUTO Min. SS',
    focusMode: isNew
      ? 'MENU → Focus → AF/MF → Focus Mode'
      : 'MENU → Camera Settings1 → Focus Mode',
    focusArea: isNew
      ? 'MENU → Focus → Focus Area → Focus Area'
      : 'MENU → Camera Settings1 → Focus Area',
    customKey: isNew
      ? 'MENU → Setup → Operation Customize → Custom Key/Dial Set. → nút AEL (hoặc C1) → AF ON'
      : 'MENU → Camera Settings2 → Custom Key (Shoot) → AEL Button (hoặc C1) → AF ON',
    afShutter: isNew
      ? 'MENU → Focus → AF/MF → AF w/ Shutter → Off'
      : 'MENU → Camera Settings1 → AF w/ shutter → Off',
    metering: isNew
      ? 'MENU → Exposure/Color → Metering → Metering Mode'
      : 'MENU → Camera Settings1 → Metering Mode',
    facePriority: isNew
      ? 'MENU → Exposure/Color → Metering → Face Priority in Multi Mtr.'
      : 'MENU → Camera Settings1 → Face Priority in Multi Metering',
    look: isNew
      ? 'MENU → Exposure/Color → Color/Tone → Creative Look'
      : 'MENU → Camera Settings1 → Creative Style',
    brightness: isNew
      ? 'MENU → Setup → Display Option → Monitor Brightness'
      : 'MENU → Setup → Monitor Brightness',
    quality: isNew
      ? 'MENU → Setup → Display Option → Display Quality'
      : 'MENU → Setup → Display Quality',
  }
}

export function setupSteps(v: MenuVersion): readonly SetupStep[] {
  const isNew = v === 'new'
  const p = paths(v)
  /* Sony renamed the feature between the two menu generations; the tool shows
     whichever name is printed on the reader's camera. */
  const look = isNew ? 'Creative Look' : 'Creative Style'
  const lookVal = isNew ? 'ST hoặc PT' : 'Standard hoặc Portrait'
  const lookNeutral = isNew ? 'ST' : 'Standard'
  const lookPortrait = isNew ? 'PT' : 'Portrait'

  const raw: readonly Omit<SetupStep, 'n' | 'anchor'>[] = [
    {
      id: 'shoot-mode',
      kicker: 'Phơi sáng · chế độ chụp',
      title: 'Chụp ở chế độ A hoặc P để máy tự đo sáng',
      settings: [{ label: 'Shoot Mode', value: 'A (ưu tiên khẩu) hoặc P', path: p.mode }],
      why: 'A và P là hai chế độ có đo sáng tự động: máy đọc ánh sáng của cảnh rồi tự chọn thông số còn lại cho đủ sáng. Chỉ cần một trong ba thông số — khẩu độ, tốc độ, ISO — đang ở Auto thì vòng bù sáng EV được kích hoạt: xoay EV về + là ảnh sáng lên, về − là tối đi, đúng như kéo thanh sáng khi chụp bằng điện thoại. Ở chế độ M với cả ba thông số đặt tay, vòng EV không còn tác dụng vì không còn gì để máy tự bù. Người mới nên bắt đầu ở A: bạn chỉ chọn độ mờ nền, mọi thứ khác máy lo.',
    },
    {
      id: 'iso-auto-range',
      kicker: 'Phơi sáng · ISO',
      title: `Giới hạn ISO Auto trong khoảng 100 – ${ISO_MAX}`,
      settings: [
        {
          label: 'ISO AUTO Min / Max',
          value: `100 – ${ISO_MAX}`,
          path: `${p.iso} → Minimum 100 · Maximum ${ISO_MAX}`,
        },
      ],
      why: `ISO là thông số thứ ba của tam giác sáng — độ nhạy sáng của cảm biến. Để ISO Auto nhưng có trần: máy tự nâng ISO khi trời tối để giữ tốc chụp an toàn, nhưng không vượt quá ${ISO_MAX} — mức mà ảnh vẫn còn sạch và giữ được chi tiết. Đặt trần quá thấp thì trong nhà máy buộc phải hạ tốc và ảnh nhòe; đặt quá cao thì ảnh bết, mất chi tiết da và nhiễu hạt màu.`,
    },
    {
      id: 'min-shutter',
      kicker: 'Phơi sáng · sàn tốc độ',
      title: `ISO AUTO Min. SS đặt ${MIN_SS}`,
      settings: [
        { label: 'ISO AUTO Min. SS', value: MIN_SS, path: `${p.minss} → ${MIN_SS}` },
      ],
      why: `Đây là mục nằm ngay cạnh ISO trong menu, và là mục quan trọng nhất mà người mới hay bỏ qua. Nó đặt sàn tốc độ: khi ánh sáng giảm, máy sẽ nâng ISO chứ không hạ tốc xuống dưới ${MIN_SS}. Nếu không đặt, máy có xu hướng ưu tiên ISO thấp và kéo tốc về 1/30 hay 1/15 — ảnh sạch nhiễu nhưng nhòe vì rung tay và vì người trong ảnh chuyển động. Ảnh nhiễu còn cứu được, ảnh nhòe thì không.`,
    },
    {
      id: 'focus-mode',
      kicker: 'Lấy nét · chế độ',
      title: 'Focus Mode để AF-C (Continuous AF)',
      settings: [
        { label: 'Focus Mode', value: 'AF-C', path: `${p.focusMode} → Continuous AF` },
      ],
      why: 'AF-C giữ nét liên tục: máy bám theo chủ thể suốt lúc bạn ngắm, kể cả khi chủ thể bước tới hoặc chính bạn đổi chỗ. AF-S thì khoá nét một lần rồi thôi — chỉ đúng khi cả bạn và chủ thể đều đứng yên. Lỗi kinh điển của người mới là khoá nét ở AF-S, rồi nghiêng máy hoặc bước lại nửa bước, và ảnh nét vào bức tường sau lưng chủ thể.',
    },
    {
      id: 'focus-area',
      kicker: 'Lấy nét · vùng nét',
      title: 'Focus Area chọn Tracking: Zone',
      settings: [
        { label: 'Focus Area', value: 'Tracking: Zone', path: `${p.focusArea} → Tracking: Zone` },
      ],
      why: 'Zone là một vùng vừa phải — không phải cả khung (máy tự chọn, hay nét vào hậu cảnh), cũng không phải một điểm bé xíu (khó ngắm khi cầm tay). Thêm Tracking: bạn chỉ cần đưa vùng đó lên chủ thể và bấm nét, máy khoá vào chủ thể rồi bám theo nó khi nó di chuyển trong khung. Bạn được rảnh tay bố cục lại mà nét vẫn dính đúng chỗ.',
      tip: {
        title: 'Lấy nét bằng ngón tay cái (AF-ON)',
        body: 'Gán AF ON cho nút AEL (hoặc C1) rồi tắt lấy nét ở nửa cò. Từ đó ngón cái giữ AF-ON là bám nét, nhả ra là khoá nét ngay tại đó, còn ngón trỏ chỉ còn một việc: bấm chụp. Không còn cảnh vừa muốn giữ nét vừa sợ bấm chụp sớm — đây là cách bấm của người chụp chuyên nghiệp và dễ hơn nửa cò sau khoảng một buổi tập.',
        settings: [
          { label: 'Gán AF ON', path: p.customKey },
          { label: 'Tắt nét nửa cò', path: p.afShutter },
        ],
      },
    },
    {
      id: 'metering',
      kicker: 'Đo sáng',
      title: 'Metering để Multi và bật ưu tiên khuôn mặt',
      settings: [
        { label: 'Metering Mode', value: 'Multi', path: `${p.metering} → Multi` },
        { label: 'Face Priority in Multi', value: 'On', path: `${p.facePriority} → On` },
      ],
      why: 'Multi chia khung thành nhiều ô, đo sáng từng ô rồi lấy trung bình có trọng số — an toàn nhất cho gần như mọi cảnh, khác với Spot chỉ đo đúng một điểm nên rất dễ cháy hoặc tối cả ảnh. Bật thêm Face Priority: khi có khuôn mặt trong khung, máy ưu tiên phơi sáng đúng cho mặt người, không để mặt tối đen vì trời sau lưng quá sáng.',
    },
    {
      id: 'creative-look',
      kicker: 'Màu ảnh',
      title: `${look} chọn ${lookVal}`,
      settings: [
        {
          label: look,
          value: lookVal,
          path: `${p.look} → ${isNew ? 'ST · PT' : 'Standard · Portrait'}`,
        },
      ],
      why: `Đây là "màu ảnh" máy áp vào file JPEG. ${lookNeutral} là màu chuẩn, trung tính, dễ chỉnh lại sau. ${lookPortrait} làm tông da mềm và hồng hào hơn — chụp người thì chọn nó. Tránh VV/Vivid: rực rỡ trên màn hình nhưng bệt màu, da đỏ và rất khó cứu. Nếu bạn chụp RAW thì lựa chọn này chỉ ảnh hưởng bản xem trước, còn chụp JPEG thì nó là màu cuối cùng.`,
    },
    {
      id: 'monitor',
      kicker: 'Màn hình',
      title: 'Monitor Brightness: Sunny Weather · Display Quality: High',
      settings: [
        { label: 'Monitor Brightness', value: 'Sunny Weather', path: `${p.brightness} → Sunny Weather` },
        { label: 'Display Quality', value: 'High', path: `${p.quality} → High` },
      ],
      why: 'Sunny Weather đẩy màn hình lên mức sáng nhất để bạn còn nhìn thấy khung ảnh khi chụp ngoài trời nắng — mức Manual mặc định thường tối om giữa trưa. Display Quality: High làm hình trong màn hình và trong ống ngắm mịn, chi tiết hơn, nên bạn kiểm tra nét chính xác hơn. Cả hai đều tốn pin hơn, đổi lại trải nghiệm ngắm và xem ảnh dễ hơn hẳn.',
    },
  ]

  return raw.map((s, i) => ({
    ...s,
    n: String(i + 1).padStart(2, '0'),
    anchor: `step-${i + 1}`,
  }))
}

export type RecapRow = {
  readonly n: string
  readonly label: string
  readonly value: string
  readonly path: string
}

/**
 * Every setting the tool asks for, flattened — including the ones inside the
 * AF-ON aside, which are real menu changes and would otherwise be the two the
 * reader forgets they made.
 */
export function recapRows(steps: readonly SetupStep[]): readonly RecapRow[] {
  const rows: RecapRow[] = []
  for (const step of steps) {
    for (const s of step.settings) {
      rows.push({ n: step.n, label: s.label, value: s.value, path: s.path })
    }
    for (const t of step.tip?.settings ?? []) {
      rows.push({ n: step.n, label: t.label, value: 'AF-ON', path: t.path })
    }
  }
  return rows
}

/** Every step id, for the progress denominator and for pruning stale storage. */
export const STEP_IDS: readonly string[] = setupSteps('old').map((s) => s.id)
