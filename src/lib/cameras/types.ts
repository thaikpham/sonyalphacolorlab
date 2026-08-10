export type ProductCategory = 'all' | 'camera' | 'lens' | 'accessory';

export interface SonyCamera {
  id: string;
  sku: string;
  name: string;
  fullName: string;
  category: 'camera' | 'lens' | 'accessory';
  subCategory1: string;
  subCategory2: string;
  priceVnd: number;
  priceFormatted: string;
  url: string;
  imageUrl: string;
  features: string[];
}
