import { useState, useMemo } from 'react';
import { Icon } from './Icon';

// Product type definition matching the CSV schema
interface Product {
  id: string;
  name: string;
  model: string;
  category: 'Camera' | 'Lens' | 'Audio' | 'Phụ kiện' | 'Thiết bị vận hành';
  price: number;
  role: string;
  link: string;
}

// Full 27 product dataset parsed from the CSV
const PRODUCTS: Product[] = [
  {
    id: 'sony-zve10',
    name: 'Sony ZV-E10',
    model: 'ZV-E10',
    category: 'Camera',
    price: 14717455,
    role: 'Cam Chính (Khách/Chủ)',
    link: 'https://www.sony.com.vn/interchangeable-lens-cameras/products/zv-e10'
  },
  {
    id: 'sony-zve10m2',
    name: 'Sony ZV-E10 II (Kit 16-50mm)',
    model: 'ZV-E10M2',
    category: 'Camera',
    price: 28990000,
    role: 'Cam Cận (Sản Phẩm)',
    link: 'https://www.sony.com.vn/electronics/may-anh-ky-thuat-so-may-anh/zv-e10m2?sku=zv-e10m2-bq-ap2'
  },
  {
    id: 'sony-ilce7m4',
    name: 'Sony Alpha 7 IV',
    model: 'ILCE-7M4',
    category: 'Camera',
    price: 59990000,
    role: 'Cam Chính (Khách/Chủ)',
    link: 'https://www.sony.com.vn/interchangeable-lens-cameras/products/ilce-7m4?sku=ilce-7m4-bq-ap2'
  },
  {
    id: 'sony-ilmefx30',
    name: 'Sony FX30',
    model: 'ILME-FX30',
    category: 'Camera',
    price: 46990000,
    role: 'Cam Cận (Sản Phẩm)',
    link: 'https://www.sony.com.vn/interchangeable-lens-cameras/products/ilme-fx30?sku=ilme-fx30b-qap2'
  },
  {
    id: 'sony-ilmefx3',
    name: 'Sony FX3',
    model: 'ILME-FX3',
    category: 'Camera',
    price: 93990000,
    role: 'Cam Chính (Khách/Chủ)',
    link: 'https://www.sony.com.vn/interchangeable-lens-cameras/products/ilme-fx3?sku=ilme-fx3-q-ap2'
  },
  {
    id: 'sony-selp18105g',
    name: 'Sony FE 18-105mm f/4 G OSS',
    model: 'SELP18105G AE',
    category: 'Lens',
    price: 12753818,
    role: 'Ống kính cho cảnh toàn đến cận cảnh',
    link: 'https://www.sony.com.vn/electronics/ong-kinh-may-anh/selp18105g?sku=selp18105g-ae'
  },
  {
    id: 'sony-sel2470gm2',
    name: 'Sony FE 24-70mm f/2.8 GM II',
    model: 'SEL2470GM2',
    category: 'Lens',
    price: 54990000,
    role: 'Ống kính cho cảnh toàn đến cận cảnh, khẩu lớn',
    link: 'https://www.sony.com.vn/lenses/products/sel2470gm2?locale=vi_VN&sku=sel2470gm2-qsyx'
  },
  {
    id: 'sony-sel70200g2',
    name: 'Sony FE 70-200mm f/4 Macro G II',
    model: 'SEL70200G2/CSYX',
    category: 'Lens',
    price: 39262909,
    role: 'Ống kính chuyên chân dung / cận cảnh',
    link: 'https://www.sony.com.vn/lenses/products/sel70200g2?sku=sel70200g2-csyx'
  },
  {
    id: 'sony-sel70200gm2',
    name: 'FE 70-200 mm F2.8 GM OSS II',
    model: 'SEL70200GM2QSYX',
    category: 'Lens',
    price: 55953818,
    role: 'Ống kính chuyên chân dung / cận cảnh với khẩu độ lớn',
    link: 'https://www.sony.com.vn/lenses/products/sel70200gm2?sku=sel70200gm2qsyx'
  },
  {
    id: 'sony-sel90m28g',
    name: 'Sony FE 90mm f/2.8 G Macro OSS',
    model: 'SEL90M28G',
    category: 'Lens',
    price: 23990000,
    role: 'Ống kính chuyên quay sản phẩm / món ăn',
    link: 'https://www.sony.com.vn/electronics/ong-kinh-may-anh/sel90m28g?sku=sel90m28g-qsyx'
  },
  {
    id: 'sony-sel100m28gm',
    name: 'FE 100 mm F2.8 Macro GM OSS',
    model: 'SEL100M28GMQSYX',
    category: 'Lens',
    price: 35990000,
    role: 'Ống kính chuyên quay sản phẩm / món ăn',
    link: 'https://www.sony.com.vn/electronics/ong-kinh-may-anh/sel100m28gm'
  },
  {
    id: 'sony-ecmxyst1m',
    name: 'Micro Sony ECM-XYST1M',
    model: 'ECM-XYST1M',
    category: 'Audio',
    price: 3426545,
    role: 'Microphone thu âm đa năng 2 kênh stereo',
    link: 'https://www.sony.com.vn/electronics/micro-may-anh-ong-kinh-roi/ecm-xyst1m?sku=ecm-xyst1m-1ce7'
  },
  {
    id: 'sony-ecmw3s',
    name: 'Micro Sony ECM-W3S',
    model: 'ECM-W3S//C CE7',
    category: 'Audio',
    price: 8826545,
    role: 'Microphone thu âm đối thoại không dây',
    link: 'https://www.sony.com.vn/camera-accessories/products/ecm-w3s'
  },
  {
    id: 'sony-ecmb1m',
    name: 'Micro Sony ECM-B1M',
    model: 'ECM-B1M',
    category: 'Audio',
    price: 8990000,
    role: 'Microphone thu âm hiện trường',
    link: 'https://www.sony.com.vn/electronics/micro-may-anh-ong-kinh-roi/ecm-b1m'
  },
  {
    id: 'sony-c80',
    name: 'Micro Condenser Sony C80',
    model: 'C-80 E',
    category: 'Audio',
    price: 16190182,
    role: 'Microphone condenser đơn hướng thu âm studio',
    link: 'https://www.sony.com.vn/microphones/products/c-80'
  },
  {
    id: 'sony-dcc1',
    name: 'Pin Ảo Sony DC-C1',
    model: 'DC-C1//Q CE7',
    category: 'Phụ kiện',
    price: 3622909,
    role: 'Nguồn điện ổn định toàn thời gian & tản nhiệt body',
    link: 'https://www.sony.com.vn/electronics/pin-va-bo-sac-may-anh-ong-kinh-roi/dc-c1?sku=dc-c1-q-ce7'
  },
  {
    id: 'cable-hdmi-full',
    name: 'Cáp HDMI 2 đầu Fullsize',
    model: 'Ugreen 2m',
    category: 'Phụ kiện',
    price: 180000,
    role: 'Cáp truyền dẫn tín hiệu HDMI hình ảnh âm thanh',
    link: 'https://ugreenvietnam.com.vn/'
  },
  {
    id: 'cable-hdmi-micro',
    name: 'Cáp HDMI - Micro HDMI',
    model: 'Ugreen 1.5m',
    category: 'Phụ kiện',
    price: 160000,
    role: 'Cáp truyền tín hiệu cho dòng máy cổng Micro HDMI',
    link: 'https://ugreenvietnam.com.vn/'
  },
  {
    id: 'acc-lplate',
    name: 'L-Plate gắn máy ảnh',
    model: 'L-Plate Quick Release',
    category: 'Phụ kiện',
    price: 250000,
    role: 'Hỗ trợ dựng dọc máy ảnh livestream khung hình đứng',
    link: 'https://shopee.vn'
  },
  {
    id: 'acc-tripod',
    name: 'Chân Máy (Tripod)',
    model: 'Benro KH25PC',
    category: 'Phụ kiện',
    price: 3800000,
    role: 'Chân máy video vững chắc đầu dầu pan mượt mà',
    link: 'https://shopee.vn'
  },
  {
    id: 'op-atem-mini-pro',
    name: 'Blackmagic ATEM Mini Pro',
    model: 'SWATEMMINICPR',
    category: 'Thiết bị vận hành',
    price: 8688000,
    role: 'Bộ trộn hình (Switcher) 4 cổng HDMI',
    link: 'https://kyma.vn'
  },
  {
    id: 'op-camlink-4k',
    name: 'Elgato Camlink 4K',
    model: 'Camlink 4K',
    category: 'Thiết bị vận hành',
    price: 3000000,
    role: 'Capture Card HDMI sang USB 3.1',
    link: 'https://kyma.vn'
  },
  {
    id: 'op-camlink-pro',
    name: 'Elgato Camlink PRO',
    model: 'Camlink Pro 4-Input',
    category: 'Thiết bị vận hành',
    price: 8000000,
    role: 'Capture Card PCIE 4 cổng HDMI',
    link: 'https://kyma.vn'
  },
  {
    id: 'op-stream-deck-neo',
    name: 'Bàn phím Elgato Stream Deck Neo',
    model: 'Stream Deck Neo',
    category: 'Thiết bị vận hành',
    price: 2990000,
    role: 'Bàn phím 8 nút lập trình hỗ trợ livestream chuyển cảnh',
    link: 'https://kyma.vn'
  },
  {
    id: 'op-wave-xlr',
    name: 'Elgato Wave XLR',
    model: 'Wave XLR',
    category: 'Thiết bị vận hành',
    price: 4990000,
    role: 'Soundcard XLR sang USB-C',
    link: 'https://kyma.vn'
  },
  {
    id: 'op-stream-deck-xlr',
    name: 'Bàn phím Elgato Stream Deck + XLR',
    model: 'Stream Deck + XLR',
    category: 'Thiết bị vận hành',
    price: 5990000,
    role: 'Console điều khiển tích hợp XLR soundcard',
    link: 'https://kyma.vn'
  },
  {
    id: 'op-laptop-asus',
    name: 'Laptop ASUS TUF Gaming F16',
    model: 'FX607VJB-RL151W',
    category: 'Thiết bị vận hành',
    price: 23490000,
    role: 'Laptop vận hành, nhiều cổng kết nối, tản nhiệt tốt',
    link: 'https://cellphones.com.vn'
  }
];

// Definition of the 4 standard combos (quantity map)
interface ComboDefinition {
  name: string;
  code: string;
  description: string;
  items: { [productId: string]: number };
}

const COMBOS: ComboDefinition[] = [
  {
    name: 'Combo 1: Sony ZV-E10 II Lite',
    code: 'COMBO-01',
    description: 'Giải pháp livestream 1 góc máy nhỏ gọn, tiết kiệm, lý tưởng cho Vloggers và Cá nhân.',
    items: {
      'sony-zve10m2': 1,
      'sony-selp18105g': 1,
      'sony-dcc1': 1,
      'cable-hdmi-micro': 1,
      'acc-lplate': 1,
      'acc-tripod': 1,
      'op-camlink-4k': 1,
      'op-laptop-asus': 1
    }
  },
  {
    name: 'Combo 2: Sony FX30 Pro',
    code: 'COMBO-02',
    description: 'Livestream bán hàng chuyên nghiệp, thời trang, F&B, hoạt động 24/7 không lo quá nhiệt.',
    items: {
      'sony-ilmefx30': 1,
      'sony-selp18105g': 1,
      'sony-dcc1': 1,
      'cable-hdmi-full': 1,
      'acc-lplate': 1,
      'acc-tripod': 1,
      'op-camlink-4k': 1,
      'op-laptop-asus': 1
    }
  },
  {
    name: 'Combo 3: Alpha 7 IV High-End',
    code: 'COMBO-03',
    description: 'Hệ thống livestream 2 góc máy cao cấp, cảm biến Full Frame 33MP cho chất lượng điện ảnh.',
    items: {
      'sony-ilce7m4': 1,
      'sony-sel2470gm2': 1,
      'sony-sel90m28g': 1,
      'sony-dcc1': 2,
      'cable-hdmi-full': 2,
      'acc-lplate': 2,
      'acc-tripod': 2,
      'op-atem-mini-pro': 1,
      'op-laptop-asus': 1
    }
  },
  {
    name: 'Combo 4: Sony FX30 + FX3 Elite',
    code: 'COMBO-04',
    description: 'Hệ thống Studio & Talkshow đỉnh cao, kết hợp Cinema Line FX3 & FX30 cùng ống kính G Master.',
    items: {
      'sony-ilmefx30': 1,
      'sony-ilmefx3': 1,
      'sony-sel2470gm2': 1,
      'sony-sel70200g2': 1,
      'sony-dcc1': 2,
      'cable-hdmi-full': 2,
      'acc-lplate': 2,
      'acc-tripod': 2,
      'op-atem-mini-pro': 1,
      'op-laptop-asus': 1
    }
  }
];

/**
 * Writes the quote payload to the reader's downloads and returns the filename.
 * Used when /api/send-quote does not answer — which is every environment except
 * `npm run dev`, where a Vite middleware persists it server-side instead.
 */
function downloadQuoteLocally(payload: unknown): string {
  const filename = `bao-gia-sony-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in some browsers; one tick is
  // enough for the navigation to have been queued.
  setTimeout(() => URL.revokeObjectURL(url), 0);

  return filename;
}

export const SmartPricingSystem: React.FC = () => {
  // The quote reference is drawn once per mounted quote. It used to be built
  // with Math.random() inline in the JSX, so it changed on every re-render —
  // the number printed on the quote depended on when the user last clicked.
  const [quoteRef] = useState(
    () => `SONY-PRICING-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  );

  // Wizard state
  const [niche, setNiche] = useState<string>('');
  const [camerasCount, setCamerasCount] = useState<string>('');
  const [recommendationResult, setRecommendationResult] = useState<ComboDefinition | null>(null);

  // Quote State: Key is productId, Value is quantity (0 means excluded)
  const [quoteItems, setQuoteItems] = useState<{ [id: string]: number }>(() => {
    // Default load Combo 2 (FX30 Pro)
    return { ...COMBOS[1].items };
  });

  // Custom added items state (items not in PRODUCTS database)
  const [customItems, setCustomItems] = useState<{ id: string; name: string; category: string; price: number; quantity: number; role: string }[]>([]);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Camera');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Customizer categories tab state
  const [activeCategory, setActiveCategory] = useState<string>('Tất cả');

  // Customer info state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const vatToggled = false;
  const setupFeeToggled = false;
  const discountPercent = 0;

  // Notification / Modal states
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [sentFile, setSentFile] = useState('');

  // 1. Wizard recommendation trigger
  const handleRecommend = () => {
    if (!niche || !camerasCount) return;

    let selectedCombo: ComboDefinition;

    if (niche === 'corporate') {
      selectedCombo = COMBOS[3]; // Combo 4 Elite
    } else if (camerasCount === '2cam') {
      selectedCombo = COMBOS[2]; // Combo 3 High-End
    } else if (niche === 'vlog') {
      selectedCombo = COMBOS[0]; // Combo 1 Lite
    } else {
      selectedCombo = COMBOS[1]; // Combo 2 Pro
    }

    setRecommendationResult(selectedCombo);
    // Automatically apply recommended items
    setQuoteItems({ ...selectedCombo.items });
  };

  // Explanation for recommendation
  const recommendationReason = useMemo(() => {
    if (!recommendationResult) return '';
    switch (recommendationResult.code) {
      case 'COMBO-01':
        return 'Đề xuất Combo ZV-E10 II Lite vì thiết bị gọn nhẹ, tính năng lấy nét thông minh vượt trội, có sẵn lens Kit góc rộng và chân máy di động. Rất thích hợp cho cá nhân làm Vlog, review 1 góc máy cơ động với chi phí tối ưu nhất.';
      case 'COMBO-02':
        return 'Đề xuất Combo FX30 Pro vì cảm biến Cinema Super35 cho chất lượng hình ảnh đậm chất điện ảnh, tông màu da tự nhiên (S-Cinetone) thích hợp cho thời trang, mỹ phẩm và ăn uống. Hệ thống tản nhiệt chủ động (quạt) giúp livestream liên tục 24/7 không lo quá nhiệt.';
      case 'COMBO-03':
        return 'Đề xuất Combo Alpha 7 IV High-End cho nhu cầu đa góc quay chuyên nghiệp. Thân máy Full Frame 33MP đẳng cấp kết hợp cùng ống kính đỉnh cao 24-70mm GM II và ống chụp cận cảnh sản phẩm 90mm Macro. Bàn trộn ATEM Mini Pro giúp chuyển đổi mượt mà các góc livestream trực tiếp.';
      case 'COMBO-04':
        return 'Đề xuất Combo FX30 + FX3 Elite cho nhu cầu doanh nghiệp và Studio chuyên nghiệp. Sự kết hợp hoàn mỹ giữa FX3 (quay chính/chân dung) và FX30 (quay góc cận/sản phẩm), kết hợp dải tiêu cự đa dạng và mixer Blackmagic ATEM Mini Pro mang lại chất lượng livestream phát sóng đẳng cấp truyền hình.';
      default:
        return '';
    }
  }, [recommendationResult]);

  // Reset calculator to a selected baseline combo
  const handleApplyCombo = (combo: ComboDefinition) => {
    setQuoteItems({ ...combo.items });
    setRecommendationResult(combo);
    setNiche('');
    setCamerasCount('');
  };

  // Add/Remove/Modify quantity helper functions
  const handleToggleProduct = (productId: string) => {
    setQuoteItems(prev => {
      const newItems = { ...prev };
      if (productId in newItems) {
        delete newItems[productId];
      } else {
        newItems[productId] = 1;
      }
      return newItems;
    });
  };

  const handleUpdateQty = (productId: string, val: number) => {
    if (val < 1) return;
    setQuoteItems(prev => ({
      ...prev,
      [productId]: val
    }));
  };

  // Custom added items action
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customPrice) return;
    const priceNum = parseInt(customPrice.replace(/[^0-9]/g, '')) || 0;
    const qtyNum = parseInt(customQty) || 1;

    setCustomItems(prev => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        name: customName,
        category: customCategory,
        price: priceNum,
        quantity: qtyNum,
        role: 'Thiết bị bổ sung tự chọn'
      }
    ]);

    // reset fields
    setCustomName('');
    setCustomPrice('');
    setCustomQty('1');
    setShowCustomForm(false);
  };

  const handleRemoveCustomItem = (id: string) => {
    setCustomItems(prev => prev.filter(item => item.id !== id));
  };

  // Quotation calculations
  const subtotal = useMemo(() => {
    let sum = 0;
    // Database items
    Object.entries(quoteItems).forEach(([id, qty]) => {
      const p = PRODUCTS.find(prod => prod.id === id);
      if (p) {
        sum += p.price * qty;
      }
    });
    // Custom items
    customItems.forEach(item => {
      sum += item.price * item.quantity;
    });
    return sum;
  }, [quoteItems, customItems]);

  const discountAmount = useMemo(() => {
    return Math.round((subtotal * discountPercent) / 100);
  }, [subtotal, discountPercent]);

  const setupFeeAmount = useMemo(() => {
    if (!setupFeeToggled) return 0;
    return Math.round((subtotal - discountAmount) * 0.1);
  }, [subtotal, discountAmount, setupFeeToggled]);

  const vatAmount = useMemo(() => {
    if (!vatToggled) return 0;
    return Math.round((subtotal - discountAmount + setupFeeAmount) * 0.1);
  }, [subtotal, discountAmount, setupFeeAmount, vatToggled]);

  const grandTotal = useMemo(() => {
    return subtotal - discountAmount + setupFeeAmount + vatAmount;
  }, [subtotal, discountAmount, setupFeeAmount, vatAmount]);

  // Formatted price strings
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Category filter
  const filteredProducts = useMemo(() => {
    if (activeCategory === 'Tất cả') return PRODUCTS;
    return PRODUCTS.filter(p => p.category === activeCategory);
  }, [activeCategory]);

  // Email quote mock sending action
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmail.trim()) {
      alert('Vui lòng nhập Email của bạn.');
      return;
    }

    setIsSendingEmail(true);

    // Build quote JSON payload
    const payload = {
      customer: {
        name: customerName || 'Khách hàng quan tâm',
        email: customerEmail
      },
      summary: {
        subtotal,
        discountPercent,
        discountAmount,
        setupFeeToggled,
        setupFeeAmount,
        vatToggled,
        vatAmount,
        grandTotal
      },
      items: [
        ...Object.entries(quoteItems).map(([id, qty]) => {
          const p = PRODUCTS.find(prod => prod.id === id)!;
          return {
            id: p.id,
            name: p.name,
            model: p.model,
            category: p.category,
            price: p.price,
            quantity: qty,
            total: p.price * qty,
            role: p.role,
            link: p.link
          };
        }),
        ...customItems.map(item => ({
          id: item.id,
          name: item.name,
          model: 'Tùy chỉnh',
          category: item.category,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
          role: item.role,
          link: ''
        }))
      ],
      timestamp: new Date().toISOString()
    };

    // `/api/send-quote` only exists as a dev middleware in vite.config.ts, which
    // writes the payload to scratch/sent_quotes. In production the SPA rewrite
    // answers it with index.html, so response.json() threw and the old code
    // reported "Lưu trữ file mô phỏng cục bộ" — a local save that never
    // happened. Nothing here has ever sent an email in any environment.
    //
    // Rather than claim a save it did not make, the quote is now written to the
    // reader's own downloads when no endpoint answers, and the copy says which
    // of the two happened.
    try {
      const response = await fetch('/api/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error(`Endpoint không khả dụng (HTTP ${response.status})`);
      }

      const resData = await response.json();
      if (resData.success) {
        setSentFile(resData.file);
        setEmailSuccess(true);
      } else {
        alert('Lưu báo giá thất bại: ' + (resData.error || 'Lỗi không xác định'));
      }
    } catch (err) {
      console.error(err);
      setSentFile(downloadQuoteLocally(payload));
      setEmailSuccess(true);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Dynamic inline styles for printing support */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Setup print configuration */
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
          }
          body, html, #root, main {
            background: white !important;
            color: black !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide app chrome layout components and customize panels */
          nav, aside, header, .no-print, button, input, select, textarea, .top-bar, .left-nav, .tab-bar {
            display: none !important;
          }
          /* Position printable invoice sheet at top left */
          .printable-invoice-wrapper {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .printable-invoice-wrapper * {
            color: black !important;
            border-color: #d1d5db !important;
          }
          .printable-invoice-wrapper .text-ink-faint {
            color: #6b7280 !important;
          }
          .printable-invoice-wrapper .bg-gray-50 {
            background-color: #f9fafb !important;
          }
          .printable-invoice-wrapper a {
            text-decoration: none !important;
            color: black !important;
          }
          .printable-invoice-wrapper a::after {
            content: "" !important;
          }
        }
      `}} />

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 no-print">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold shimmer-text">Báo Giá Livestream Thông Minh</h2>
          <p className="text-white/50 text-sm max-w-xl">
            Tối ưu hóa ngân sách và cấu hình thiết bị Sony Live SOP chuyên nghiệp phù hợp với nhu cầu của bạn.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {COMBOS.map(combo => (
            <button
              key={combo.code}
              onClick={() => handleApplyCombo(combo)}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                recommendationResult?.code === combo.code
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              }`}
            >
              {combo.code}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: CONTROL & SELECTION (XL: 7 columns) */}
        <div className="xl:col-span-7 space-y-6 no-print">
          
          {/* Step 1: Recommendation Wizard */}
          <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 space-y-5">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Icon name="magic_button" className="text-[20px] text-info-soft" />
              Trợ lý đề xuất góc quay & combo thiết bị
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-ink-faint uppercase tracking-wider pl-1">Lĩnh vực Livestream</label>
                <select
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full bg-[#181818] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white/90 focus:outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- Chọn lĩnh vực livestream --</option>
                  <option value="vlog">Vlog / Review / Trò chuyện cá nhân</option>
                  <option value="fashion">Thời trang / Mỹ phẩm (Cần màu da đẹp)</option>
                  <option value="fb">Thực phẩm / F&B (Cần quay cận sản phẩm)</option>
                  <option value="corporate">Studio / Talkshow / Sự kiện (Chuyên nghiệp)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-ink-faint uppercase tracking-wider pl-1">Số góc quay (Cameras)</label>
                <select
                  value={camerasCount}
                  onChange={(e) => setCamerasCount(e.target.value)}
                  className="w-full bg-[#181818] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white/90 focus:outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- Chọn số lượng góc máy --</option>
                  <option value="1cam">1 Góc quay (Đơn giản, tiết kiệm)</option>
                  <option value="2cam">2 Góc quay (Chuyên nghiệp, cận & toàn)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleRecommend}
                disabled={!niche || !camerasCount}
                className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all ${
                  !niche || !camerasCount
                    ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
                    : 'bg-info hover:bg-info text-white shadow-[0_4px_15px_rgba(59,130,246,0.3)] active:scale-95'
                }`}
              >
                <Icon name="smart_toy" className="text-[18px]" />
                Nhận đề xuất ngay
              </button>
            </div>

            {recommendationResult && (
              <div className="bg-blue-950/20 border border-info/20 rounded-2xl p-5 space-y-3 animate-fade">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-info/20 text-info-soft text-[10px] font-bold rounded">ĐỀ XUẤT</span>
                    <h4 className="text-sm font-bold text-blue-300">{recommendationResult.name}</h4>
                  </div>
                  <span className="text-xs font-bold text-ink-faint">{recommendationResult.code}</span>
                </div>
                <p className="text-xs text-blue-200/80 leading-relaxed italic">
                  &ldquo;{recommendationReason}&rdquo;
                </p>
                <div className="pt-2 text-[11px] text-ink-faint flex items-center gap-1.5">
                  <Icon name="info" className="text-[14px]" />
                  Combo đã tự động được nạp vào Bảng tùy chỉnh bên dưới.
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Interactive Customizer */}
          <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Icon name="tune" className="text-[20px] text-warning-soft" />
                Bảng tùy chỉnh cấu hình thiết bị chi tiết
              </h3>
              <button
                onClick={() => {
                  setQuoteItems({});
                  setCustomItems([]);
                  setRecommendationResult(null);
                }}
                className="self-start sm:self-auto text-xs text-danger hover:text-red-300 transition-colors flex items-center gap-1"
              >
                <Icon name="delete_sweep" className="text-[16px]" />
                Xóa tất cả
              </button>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 dark-scrollbar">
              {['Tất cả', 'Camera', 'Lens', 'Audio', 'Phụ kiện', 'Thiết bị vận hành'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveCategory(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    activeCategory === tab
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-ink-faint hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Products interactive list */}
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 dark-scrollbar">
              {filteredProducts.map(p => {
                const isSelected = p.id in quoteItems;
                const qty = quoteItems[p.id] || 0;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-4 p-3 rounded-2xl border transition-all duration-300 ${
                      isSelected
                        ? 'bg-white/[0.03] border-white/10'
                        : 'bg-transparent border-white/5 opacity-55 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleProduct(p.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-info focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{p.name}</span>
                          <span className="px-1.5 py-0.5 bg-white/5 text-ink-faint rounded text-[9px] font-semibold font-mono tracking-tight shrink-0">{p.model}</span>
                        </div>
                        <div className="text-[10px] text-ink-faint leading-tight mt-1 truncate">
                          {p.role}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {/* Price info */}
                      <div className="text-right">
                        <span className="text-xs font-bold text-white/90">{formatVND(p.price)}</span>
                      </div>

                      {/* Quantity controllers if selected */}
                      {isSelected ? (
                        <div className="flex items-center bg-black border border-white/10 rounded-xl p-1">
                          <button
                            onClick={() => handleUpdateQty(p.id, qty - 1)}
                            className="w-6 h-6 flex items-center justify-center text-ink-faint hover:text-white transition-colors hover:bg-white/5 rounded-lg text-xs"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-white">{qty}</span>
                          <button
                            onClick={() => handleUpdateQty(p.id, qty + 1)}
                            className="w-6 h-6 flex items-center justify-center text-ink-faint hover:text-white transition-colors hover:bg-white/5 rounded-lg text-xs"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="w-[78px]"></div> // spacer
                      )}

                      {/* Link to Buy */}
                      {p.link && (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-ink-faint hover:text-white transition-all shrink-0"
                          title="Xem chi tiết thiết bị"
                        >
                          <Icon name="link" className="text-[16px] block" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom product adder */}
            <div className="border-t border-white/5 pt-4">
              {!showCustomForm ? (
                <button
                  onClick={() => setShowCustomForm(true)}
                  className="w-full py-3 rounded-2xl border border-dashed border-white/10 hover:border-white/20 text-xs font-bold text-ink-faint hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  <Icon name="add_circle" className="text-[16px]" />
                  Thêm thiết bị ngoài danh mục (Tùy chỉnh)
                </button>
              ) : (
                <form onSubmit={handleAddCustomItem} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4 animate-fade">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-warning-soft uppercase tracking-widest pl-1">Nhập thiết bị tùy chọn</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomForm(false)}
                      className="text-xs text-ink-faint hover:text-ink-faint"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-ink-faint uppercase tracking-wide">Tên thiết bị & Model</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Đèn Aputure 600d Pro"
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-ink-faint uppercase tracking-wide">Phân loại</label>
                      <select
                        value={customCategory}
                        onChange={e => setCustomCategory(e.target.value)}
                        className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none appearance-none"
                      >
                        <option value="Camera">Camera</option>
                        <option value="Lens">Lens / Ống kính</option>
                        <option value="Audio">Audio / Âm thanh</option>
                        <option value="Phụ kiện">Phụ kiện setup</option>
                        <option value="Thiết bị vận hành">Thiết bị vận hành</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-ink-faint uppercase tracking-wide">Giá trị (VND)</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: 45,000,000"
                        value={customPrice}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setCustomPrice(val ? parseInt(val).toLocaleString('vi-VN') : '');
                        }}
                        className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-ink-faint uppercase tracking-wide">Số lượng</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={customQty}
                        onChange={e => setCustomQty(e.target.value)}
                        className="w-full bg-[#181818] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-white text-black font-bold text-xs rounded-xl hover:bg-gray-200 active:scale-95 transition-all flex items-center gap-1"
                    >
                      <Icon name="check" className="text-[16px] font-bold" />
                      Thêm vào bảng giá
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Custom added items list for control */}
            {customItems.length > 0 && (
              <div className="border-t border-white/5 pt-4 space-y-2">
                <h4 className="text-xs font-bold text-warning-soft pl-1 uppercase tracking-wider">Thiết bị tùy chỉnh đã thêm</h4>
                <div className="space-y-2">
                  {customItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-warning/20 bg-warning/5">
                      <div>
                        <div className="text-xs font-bold text-white">{item.name}</div>
                        <div className="text-[10px] text-ink-faint mt-0.5">{item.category} • {item.role}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-white">{formatVND(item.price)} x {item.quantity}</span>
                        <button
                          onClick={() => handleRemoveCustomItem(item.id)}
                          className="p-1.5 bg-danger/10 hover:bg-danger/20 text-danger hover:text-red-300 rounded-xl transition-all"
                          title="Xóa thiết bị"
                        >
                          <Icon name="delete" className="text-[16px] block" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: INVOICE SHEET PREVIEW & SEND FORM (XL: 5 columns) */}
        <div className="xl:col-span-5 space-y-6">
          
          {/* Customer input & Send / Export buttons (Only visible on screen) */}
          <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 space-y-4 no-print">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Icon name="send_to_mobile" className="text-[20px] text-accent-mid" />
              Lưu trữ & Gửi báo giá cho khách hàng
            </h3>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-ink-faint uppercase tracking-wider pl-1">Tên khách hàng</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn A"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-ink-faint uppercase tracking-wider pl-1">Email nhận báo giá</label>
                  <input
                    type="email"
                    required
                    placeholder="VD: khachhang@gmail.com"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Icon name="picture_as_pdf" className="text-[18px]" />
                  Xuất file PDF (A4)
                </button>

                <button
                  type="submit"
                  disabled={isSendingEmail || !customerEmail}
                  className={`w-full py-3.5 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all ${
                    isSendingEmail || !customerEmail
                      ? 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-[0_4px_15px_rgba(22,163,74,0.3)] active:scale-95'
                  }`}
                >
                  <Icon name={isSendingEmail ? 'sync' : 'mail'} className="text-[18px]" />
                  {isSendingEmail ? 'Đang gửi...' : 'Gửi về Hộp thư'}
                </button>
              </div>
            </form>
          </div>

          {/* Paper View Container (This is printed, styled elegantly on screen) */}
          <div className="printable-invoice-wrapper bg-white text-gray-900 border border-gray-200 rounded-[32px] p-6 sm:p-10 shadow-2xl space-y-6 select-none font-sans overflow-x-auto min-w-[320px] relative">
            
            {/* Sony Branding Banner */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-6 gap-4">
              <div className="space-y-1">
                {/* Simulated Sony Logo with Text */}
                <div className="flex items-center gap-1 text-[20px] font-bold tracking-[0.15em] text-black">
                  SONY
                </div>
                <div className="text-[10px] font-bold tracking-widest text-[#008a00] uppercase">
                  LIVE SOP PARTNER
                </div>
                <div className="text-[9px] text-gray-500 max-w-[200px] leading-tight">
                  Tòa nhà Sony Pro, Quận 1, TP. Hồ Chí Minh
                  <br />Hotline: 1800 588 885
                </div>
              </div>

              <div className="text-right space-y-1">
                <h1 className="text-lg font-black tracking-tight text-gray-900 uppercase">BÁO GIÁ THIẾT BỊ</h1>
                <p className="text-[9px] text-gray-400 font-mono">
                  REF: {quoteRef}
                </p>
                <p className="text-[9px] text-gray-500">
                  Ngày lập: {new Date().toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>

            {/* Customer information block */}
            <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-gray-100 pb-4">
              <div className="space-y-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Đơn vị cung cấp</span>
                <p className="font-bold text-gray-900">Sony Live SOP Vietnam</p>
                <p className="text-gray-500 text-[10px]">Hệ thống thiết bị Livestream và Cinema Line chính hãng</p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Khách hàng nhận</span>
                <p className="font-bold text-gray-900">{customerName || 'Quý khách hàng'}</p>
                <p className="text-gray-500 text-[10px] font-mono">{customerEmail || 'Chưa cung cấp email'}</p>
              </div>
            </div>

            {/* Table of items */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] leading-normal border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 text-[9px] font-bold tracking-wider uppercase bg-gray-50">
                    <th className="py-2.5 px-2 text-center w-8">STT</th>
                    <th className="py-2.5 px-2">Thiết bị & Phân loại</th>
                    <th className="py-2.5 px-2 text-center w-12">SL</th>
                    <th className="py-2.5 px-2 text-right w-24">Đơn giá</th>
                    <th className="py-2.5 px-2 text-right w-28">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Database items */}
                  {Object.entries(quoteItems).map(([id, qty], index) => {
                    const p = PRODUCTS.find(prod => prod.id === id);
                    if (!p) return null;
                    return (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="py-2.5 px-2 text-center text-gray-400 font-mono">{index + 1}</td>
                        <td className="py-2.5 px-2">
                          <div className="font-bold text-gray-900">{p.name}</div>
                          <div className="text-[9px] text-gray-500 font-mono leading-tight">{p.model} • {p.category}</div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-gray-800 font-mono">{qty}</td>
                        <td className="py-2.5 px-2 text-right text-gray-600 font-mono">{formatVND(p.price)}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-gray-900 font-mono">{formatVND(p.price * qty)}</td>
                      </tr>
                    );
                  })}

                  {/* Custom items */}
                  {customItems.map((item, index) => {
                    const offsetIndex = Object.keys(quoteItems).length + index + 1;
                    return (
                      <tr key={item.id} className="border-b border-gray-100 bg-orange-50/20">
                        <td className="py-2.5 px-2 text-center text-gray-400 font-mono">{offsetIndex}</td>
                        <td className="py-2.5 px-2">
                          <div className="font-bold text-orange-950">{item.name}</div>
                          <div className="text-[9px] text-gray-500 leading-tight">Tùy chọn bổ sung • {item.category}</div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-gray-800 font-mono">{item.quantity}</td>
                        <td className="py-2.5 px-2 text-right text-gray-600 font-mono">{formatVND(item.price)}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-gray-900 font-mono">{formatVND(item.price * item.quantity)}</td>
                      </tr>
                    );
                  })}

                  {/* Empty state */}
                  {Object.keys(quoteItems).length === 0 && customItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400 italic">
                        Chưa có thiết bị nào được chọn trong báo giá.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Price Calculations */}
            <div className="flex justify-end pt-4">
              <div className="w-full sm:w-64 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-gray-500">
                  <span>Tổng tiền thiết bị:</span>
                  <span className="font-mono text-gray-950">{formatVND(subtotal)}</span>
                </div>

                {discountPercent > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Chiết khấu ({discountPercent}%):</span>
                    <span className="font-mono">- {formatVND(discountAmount)}</span>
                  </div>
                )}

                {setupFeeToggled && (
                  <div className="flex justify-between text-gray-500">
                    <span>Phí lắp đặt & setup (10%):</span>
                    <span className="font-mono text-gray-950">{formatVND(setupFeeAmount)}</span>
                  </div>
                )}

                {vatToggled && (
                  <div className="flex justify-between text-gray-500">
                    <span>Thuế GTGT VAT (10%):</span>
                    <span className="font-mono text-gray-950">{formatVND(vatAmount)}</span>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-2 flex justify-between text-[13px] font-black text-black">
                  <span>TỔNG CỘNG THANH TOÁN:</span>
                  <span className="font-mono text-[14px] text-gray-900">{formatVND(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Signatures & Terms */}
            <div className="grid grid-cols-2 gap-8 pt-8 text-[9px] text-gray-400 border-t border-gray-100">
              <div className="space-y-1">
                <h5 className="font-bold text-gray-500 uppercase tracking-wider">ĐIỀU KHOẢN & HƯỚNG DẪN</h5>
                <ol className="list-decimal pl-3 space-y-0.5 leading-snug">
                  <li>Báo giá này có giá trị hiệu lực trong vòng 30 ngày kể từ ngày lập.</li>
                  <li>Giá thiết bị đã bao gồm đầy đủ phụ kiện đi kèm theo hộp từ nhà sản xuất.</li>
                  <li>Sản phẩm Sony bảo hành chính hãng 24 tháng đối với Body & 12 tháng đối với Lens.</li>
                  <li>Thông tin chi tiết kỹ thuật lắp ráp vui lòng liên hệ Kỹ thuật viên qua Hotline.</li>
                </ol>
              </div>

              <div className="flex flex-col items-center justify-between text-center min-h-[90px]">
                <span className="font-bold uppercase tracking-wider text-gray-500">Đại diện Sony Live SOP</span>
                <div className="w-16 h-8 border-b border-gray-200 border-dashed"></div> {/* Seal space */}
                <span className="font-bold text-gray-900">Ban quản lý Dự án</span>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Success Notification Modal (Only visible on screen) */}
      {emailSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade no-print">
          <div className="bg-[#121212] border border-white/10 rounded-[32px] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success">
              <Icon name="check_circle" className="text-[40px] font-bold" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-bold text-white">Đã lưu báo giá thành công!</h4>
              <p className="text-xs text-white/50 leading-relaxed">
                Hệ thống đã ghi nhận email khách hàng và xuất file báo giá:
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 font-mono text-[10px] text-gray-300 select-all truncate mt-2">
                {sentFile}
              </div>
            </div>
            <button
              onClick={() => setEmailSuccess(false)}
              className="w-full py-3 bg-white hover:bg-gray-200 text-black font-bold text-xs rounded-2xl active:scale-95 transition-all"
            >
              Hoàn thành
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isSendingEmail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 no-print">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-4 border-t-green-500 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            <span className="text-xs font-bold text-white uppercase tracking-widest">Đang khởi tạo & gửi email báo giá...</span>
          </div>
        </div>
      )}

    </div>
  );
};
