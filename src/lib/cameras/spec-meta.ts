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
    options: ['Full-frame', 'APS-C', '1"-Type', 'Trung bình (Medium Format)'],
  },
  sensor: {
    key: 'sensor',
    type: 'text',
    placeholder: 'VD: Full-frame 35mm Exmor R CMOS',
  },
  effectivePixels: {
    key: 'effectivePixels',
    type: 'text',
    placeholder: 'VD: 33.0 MP',
  },
  isoRange: {
    key: 'isoRange',
    type: 'text',
    placeholder: 'VD: ISO 100 - 32000 (Mở rộng 50 - 102400)',
  },
  autofocus: {
    key: 'autofocus',
    type: 'text',
    placeholder: 'VD: 759 điểm Phase-Detection AF, Real-Time Eye AF',
  },
  video: {
    key: 'video',
    type: 'text',
    placeholder: 'VD: 4K 60p, 10-Bit 4:2:2, S-Cinetone',
  },
  stabilization: {
    key: 'stabilization',
    type: 'text',
    placeholder: 'VD: Chống rung 5 trục In-Body lên tới 8.5 stop',
  },
  viewfinder: {
    key: 'viewfinder',
    type: 'dropdown',
    options: [
      'Có (EVF OLED 9.44M điểm)',
      'Có (EVF OLED 3.68M điểm)',
      'Có (EVF OLED 2.36M điểm)',
      'Không có EVF',
    ],
  },
  lcd: {
    key: 'lcd',
    type: 'text',
    placeholder: 'VD: 3.0 inch Touchscreen 1.03M điểm Vari-Angle',
  },
  mediaSlots: {
    key: 'mediaSlots',
    type: 'dropdown',
    options: [
      'Dual CFexpress Type A / SD (Tương thích UHS-II)',
      'Dual SD / SDHC / SDXC (Tương thích UHS-II)',
      'Single SD / SDHC / SDXC (Tương thích UHS-II)',
      'Dual CFexpress Type B / SD',
    ],
  },
  battery: {
    key: 'battery',
    type: 'dropdown',
    options: [
      'NP-FZ100 (Khoảng 580 ảnh)',
      'NP-FW50 (Khoảng 360 ảnh)',
      'NP-BX1 (Khoảng 260 ảnh)',
    ],
  },
  weight: {
    key: 'weight',
    type: 'number',
    unit: 'g',
    placeholder: 'VD: 658',
  },
  dimensions: {
    key: 'dimensions',
    type: 'text',
    placeholder: 'VD: 131.3 x 96.4 x 79.8 mm',
  },
  focalLength: {
    key: 'focalLength',
    type: 'text',
    placeholder: 'VD: 24-70mm',
  },
  maxAperture: {
    key: 'maxAperture',
    type: 'text',
    placeholder: 'VD: f/2.8',
  },
  minAperture: {
    key: 'minAperture',
    type: 'text',
    placeholder: 'VD: f/22',
  },
  construction: {
    key: 'construction',
    type: 'text',
    placeholder: 'VD: 15 thấu kính / 12 nhóm',
  },
  angleOfView: {
    key: 'angleOfView',
    type: 'text',
    placeholder: 'VD: 84° - 34°',
  },
  minFocusDistance: {
    key: 'minFocusDistance',
    type: 'text',
    placeholder: 'VD: 0.21m',
  },
  maxMagnification: {
    key: 'maxMagnification',
    type: 'text',
    placeholder: 'VD: 0.32x',
  },
  filterDiameter: {
    key: 'filterDiameter',
    type: 'number',
    unit: 'mm',
    placeholder: 'VD: 82',
  },
  apertureBlades: {
    key: 'apertureBlades',
    type: 'dropdown',
    options: ['11 lá khẩu tròn', '9 lá khẩu tròn', '7 lá khẩu tròn'],
  },
  compatibility: {
    key: 'compatibility',
    type: 'text',
    placeholder: 'VD: Tất cả máy ảnh Sony E-Mount',
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
      placeholder: `Nhập giá trị ${key}...`,
    }
  );
}
