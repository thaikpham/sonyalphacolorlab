export type SpecDataType = 'text' | 'number' | 'url' | 'dropdown';

export interface SpecFieldMeta {
  key: string;
  type: SpecDataType;
  unit?: string;
  options?: string[];
  placeholder?: string;
}

export const SPEC_FIELD_META: Record<string, SpecFieldMeta> = {
  // Camera & Lens shared/specific
  format: {
    key: 'format',
    type: 'dropdown',
    options: ['Full-frame', 'APS-C'],
  },
  sensor: {
    key: 'sensor',
    type: 'text',
    placeholder: 'ví dụ: Full-frame 35 mm (35,9 x 23,9 mm) Exmor R CMOS',
  },
  effectivePixels: {
    key: 'effectivePixels',
    type: 'text',
    placeholder: 'ví dụ: 33,0 MP',
  },
  isoRange: {
    key: 'isoRange',
    type: 'text',
    placeholder: 'ví dụ: 100–32000 (mở rộng 50–102400)',
  },
  autofocus: {
    key: 'autofocus',
    type: 'text',
    placeholder: 'ví dụ: 759 điểm phase-detection',
  },
  video: {
    key: 'video',
    type: 'text',
    placeholder: 'ví dụ: 4K 60p',
  },
  stabilization: {
    key: 'stabilization',
    type: 'text',
    placeholder: 'ví dụ: Cơ chế dịch chuyển cảm biến hình ảnh với bù 5 trục',
  },
  viewfinder: {
    key: 'viewfinder',
    type: 'dropdown',
    /* The seed's own form. "No EVF" is not an option: it is `null`, which the
       editor's empty "not published" choice already writes. */
    options: ['9 437 184 điểm ảnh', '3 686 400 điểm ảnh', '2 359 296 điểm ảnh'],
  },
  lcd: {
    key: 'lcd',
    type: 'text',
    placeholder: 'ví dụ: TFT 7,5 cm (3,0 inch), 1 036 800 điểm',
  },
  mediaSlots: {
    key: 'mediaSlots',
    type: 'dropdown',
    options: [
      'CFexpress Type A / SD x2',
      'CFexpress Type A / SD',
      'CFexpress Type A',
      'SD x2',
      'SD',
    ],
  },
  battery: {
    key: 'battery',
    /* Free text, not a list: the seed has a dozen CIPA figures and several
       video runtimes in minutes, and no fixed list can match them. */
    type: 'text',
    placeholder: 'ví dụ: 530 ảnh (LCD)',
  },
  weight: {
    key: 'weight',
    type: 'number',
    unit: 'g',
    placeholder: 'ví dụ: 658',
  },
  dimensions: {
    key: 'dimensions',
    type: 'text',
    placeholder: 'ví dụ: 131,3 x 96,4 x 79,8 mm',
  },
  focalLength: {
    key: 'focalLength',
    type: 'text',
    placeholder: 'ví dụ: 24-70mm',
  },
  maxAperture: {
    key: 'maxAperture',
    type: 'text',
    placeholder: 'ví dụ: f/2.8',
  },
  minAperture: {
    key: 'minAperture',
    type: 'text',
    placeholder: 'ví dụ: f/22',
  },
  construction: {
    key: 'construction',
    type: 'text',
    placeholder: 'ví dụ: 17 thành phần / 12 nhóm',
  },
  angleOfView: {
    key: 'angleOfView',
    type: 'text',
    placeholder: 'ví dụ: 84° - 34°',
  },
  minFocusDistance: {
    key: 'minFocusDistance',
    type: 'text',
    placeholder: 'ví dụ: 0.21m',
  },
  maxMagnification: {
    key: 'maxMagnification',
    type: 'text',
    placeholder: 'ví dụ: 0.32x',
  },
  filterDiameter: {
    key: 'filterDiameter',
    type: 'number',
    unit: 'mm',
    placeholder: 'ví dụ: 82',
  },
  apertureBlades: {
    key: 'apertureBlades',
    type: 'dropdown',
    options: ['11 (khẩu tròn)', '9 (khẩu tròn)', '7 (khẩu tròn)'],
  },
  compatibility: {
    key: 'compatibility',
    type: 'text',
    placeholder: 'ví dụ: Máy ảnh Sony ngàm E',
  },
  specsSource: {
    key: 'specsSource',
    type: 'url',
    placeholder: 'https://www.sony.com.vn/...',
  },
};

export function getSpecMeta(key: string): SpecFieldMeta {
  return (
    SPEC_FIELD_META[key] ?? {
      key,
      type: 'text',
      placeholder: 'Nhập giá trị…',
    }
  );
}
