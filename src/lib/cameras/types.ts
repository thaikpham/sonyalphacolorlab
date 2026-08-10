export type CameraCategory = 'all' | 'full-frame' | 'aps-c' | 'cinema-line' | 'vlog';

export interface SonyCamera {
  id: string;
  sku: string;
  name: string;
  fullName: string;
  category: Exclude<CameraCategory, 'all'>;
  priceVnd: number;
  priceFormatted: string;
  url: string;
  imageUrl: string;
  features: string[];
}
