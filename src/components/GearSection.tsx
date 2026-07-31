import { useState } from 'react';

const ComboCard: React.FC<{
  type: string;
  title: string;
  priceRange: string;
  description: string;
  items: string[];
  icon: string;
  color: string;
}> = ({ type, title, priceRange, description, items, icon, color }) => (
  <div className="glass-card rounded-[32px] p-8 flex flex-col h-full group relative overflow-hidden">
    <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 transition-opacity group-hover:opacity-20 ${color}`}></div>
    
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 relative z-10 ${color}`}>
      <span className="material-symbols-outlined text-white text-2xl">{icon}</span>
    </div>
    
    <div className="mb-6 relative z-10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#888]">{type}</span>
        <div className="h-px flex-1 bg-white/[0.06]"></div>
      </div>
      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-white/90 transition-colors">{title}</h3>
      <p className="text-xs text-white/40 leading-relaxed font-medium">{description}</p>
    </div>
    
    <div className="flex-1 space-y-3 mb-8 relative z-10">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-4 h-4 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[12px] text-white/40">done</span>
          </div>
          <span className="text-[11px] text-white/70 font-medium leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
    
    <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between relative z-10 mt-auto">
      <div className="flex flex-col">
        <span className="text-[8px] font-bold text-[#555] uppercase tracking-widest">Đơn giá định lượng</span>
        <span className="text-xs font-bold text-purple-400">{priceRange}</span>
      </div>
      <span className="text-[9px] px-2.5 py-1 rounded bg-white/5 border border-white/5 text-white/40 font-bold uppercase tracking-wider">Sony Studio</span>
    </div>
  </div>
);

export const GearSection: React.FC = () => {
  const [viewMode, setViewMode] = useState<'combos' | 'individual'>('combos');

  return (
    <div className="space-y-12 pb-20 w-full animate-fade">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/[0.06] pb-10">
        <div className="max-w-2xl">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 tracking-tight">Cấu Hình & Giải Pháp Thiết Bị Sony</h2>
          <p className="text-white/40 text-sm leading-relaxed font-medium">
            Tài liệu hướng dẫn tư vấn dành cho Nhân viên Sony. Đề xuất các combo livestream dựa trên nhu cầu của khách hàng, đảm bảo tính đồng bộ của hệ sinh thái Sony.
          </p>
        </div>
        <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1.5 gap-1 self-start lg:self-auto shrink-0">
          <button 
            onClick={() => setViewMode('combos')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all ${viewMode === 'combos' ? 'bg-white text-black shadow-xl' : 'text-[#666] hover:text-white/60'}`}
          >
            Giải pháp Combo chính thức
          </button>
          <button 
            onClick={() => setViewMode('individual')}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all ${viewMode === 'individual' ? 'bg-white text-black shadow-xl' : 'text-[#666] hover:text-white/60'}`}
          >
            Chi tiết Linh kiện lẻ
          </button>
        </div>
      </div>

      {viewMode === 'combos' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          <ComboCard 
            type="COMBO-01 (Dành cho vloggers/cá nhân)"
            title="Combo 1: Sony ZV-E10 II Lite"
            priceRange="~75.760.364đ"
            description="Giải pháp livestream 1 góc máy nhỏ gọn, chi phí tối ưu nhất, phù hợp cho sáng tạo nội dung cá nhân."
            icon="auto_videocam"
            color="bg-blue-600"
            items={[
              "Camera: Sony ZV-E10 II (Kit 16-50mm) - Lấy nét mắt AI, chế độ Product Showcase",
              "Ống kính: FE 18-105mm f/4 G OSS - Zoom điện êm ái, đa dụng cảnh toàn đến cận",
              "Nguồn điện: Pin Ảo Sony DC-C1 cấp nguồn AC liên tục, giảm nóng máy",
              "Thiết bị vận hành: Elgato Camlink 4K & Laptop ASUS TUF Gaming F16",
              "Phụ kiện: Chân máy Benro KH25PC, L-Plate dựng dọc 9:16, cáp HDMI Micro"
            ]}
          />
          <ComboCard 
            type="COMBO-02 (Bán hàng & Live liên tục)"
            title="Combo 2: Sony FX30 Pro"
            priceRange="~93.930.364đ"
            description="Livestream bán hàng chuyên nghiệp, thời trang, F&B, yêu cầu hoạt động liên tục 24/7 không lo quá nhiệt."
            icon="shopping_bag"
            color="bg-purple-600"
            items={[
              "Camera: Sony FX30 (Cảm biến Super35, quạt tản nhiệt chủ động không bao giờ sập nguồn)",
              "Ống kính: FE 18-105mm f/4 G OSS - Zoom điện đa dụng cảnh toàn đến cận sản phẩm",
              "Nguồn điện: Pin Ảo Sony DC-C1 đảm bảo vận hành bền bỉ cả ngày",
              "Thiết bị vận hành: Elgato Camlink 4K & Laptop ASUS TUF Gaming F16",
              "Phụ kiện: Chân máy Benro KH25PC, L-Plate dựng dọc 9:16, cáp HDMI Fullsize"
            ]}
          />
          <ComboCard 
            type="COMBO-03 (High-end Studio & Thời trang)"
            title="Combo 3: Alpha 7 IV High-End"
            priceRange="~186.299.636đ"
            description="Hệ thống 2 góc máy cao cấp sử dụng cảm biến Full Frame 33MP cho độ xóa phông cực mịn và màu sắc da điện ảnh."
            icon="diamond"
            color="bg-orange-600"
            items={[
              "Camera chính: Sony Alpha 7 IV (Full Frame) + Ống kính FE 24-70mm f/2.8 GM II",
              "Camera cận: Sony ZV-E10 II (Cận cảnh sản phẩm/mẫu thử) + FE 90mm f/2.8 G Macro OSS",
              "Bộ trộn hình: Blackmagic ATEM Mini Pro (Hỗ trợ switch 4 cổng HDMI phần cứng)",
              "Nguồn điện: 2 x Pin Ảo Sony DC-C1 cấp nguồn cho 2 máy",
              "Vận hành & Phụ kiện: Laptop ASUS TUF F16, 2 Tripod Benro, 2 L-Plate, 2 Cáp HDMI"
            ]}
          />
          <ComboCard 
            type="COMBO-04 (Elite Studio & Talkshow)"
            title="Combo 4: Sony FX30 + FX3 Elite"
            priceRange="~236.634.727đ"
            description="Cấu hình cao cấp nhất dành cho Studio lớn, Talkshow chuyên nghiệp, kết hợp hai dòng máy Cinema Line hàng đầu."
            icon="movie"
            color="bg-red-600"
            items={[
              "Camera chính: Sony FX3 (Full Frame Cinema, dải động 15+ stops, XLR Audio Handle)",
              "Camera cận: Sony FX30 (Super35 Cinema, bắt chi tiết sản phẩm chuẩn màu S-Cinetone)",
              "Ống kính: FE 24-70mm f/2.8 GM II (Cam chính) & FE 70-200mm f/4 Macro G II (Cam cận)",
              "Bộ trộn hình: Blackmagic ATEM Mini Pro kết nối 2 máy ảnh qua cổng HDMI",
              "Nguồn điện & Phụ kiện: 2 Pin Ảo Sony DC-C1, Laptop ASUS TUF F16, 2 Tripod Benro, 2 L-Plate"
            ]}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[
            { name: "Sony FX3", desc: "Máy quay Cinema Full-frame cao cấp, tản nhiệt chủ động, tay cầm XLR.", tag: "Camera", link: "https://www.sony.com.vn/interchangeable-lens-cameras/products/ilme-fx3" },
            { name: "Sony Alpha 7 IV", desc: "Cảm biến Full Frame 33MP, hệ thống lấy nét mắt AI, màu da S-Cinetone.", tag: "Camera", link: "https://www.sony.com.vn/interchangeable-lens-cameras/products/ilce-7m4" },
            { name: "Sony FX30", desc: "Cinema Line cảm biến Super35, có quạt tản nhiệt, live liên tục không lo sập.", tag: "Camera", link: "https://www.sony.com.vn/interchangeable-lens-cameras/products/ilme-fx30" },
            { name: "Sony ZV-E10 II", desc: "APS-C thế hệ mới, chế độ Product Showcase tự động lấy nét cận cảnh.", tag: "Camera", link: "https://www.sony.com.vn/electronics/may-anh-ky-thuat-so-may-anh/zv-e10m2" },
            { name: "FE 24-70mm F2.8 GM II", desc: "Ống kính G Master khẩu lớn cao cấp nhất, độ sắc nét tuyệt đối.", tag: "Lens", link: "https://www.sony.com.vn/lenses/products/sel2470gm2" },
            { name: "FE 18-105mm F4 G OSS", desc: "Ống kính Zoom điện tử, đa dụng chuyển đổi góc quay mượt mà.", tag: "Lens", link: "https://www.sony.com.vn/electronics/ong-kinh-may-anh/selp18105g" },
            { name: "FE 90mm F2.8 G Macro", desc: "Ống kính chuyên biệt quay cận cảnh sản phẩm nhỏ, trang sức, mỹ phẩm.", tag: "Lens", link: "https://www.sony.com.vn/electronics/ong-kinh-may-anh/sel90m28g" },
            { name: "FE 70-200mm F4 G Macro II", desc: "Lens zoom tele & macro, linh hoạt bắt cận cảnh từ khoảng cách xa.", tag: "Lens", link: "https://www.sony.com.vn/lenses/products/sel70200g2" },
            { name: "Micro Condenser C-80", desc: "Microphone Condenser phòng thu chuyên nghiệp, giọng ấm và dày.", tag: "Audio", link: "https://www.sony.com.vn/microphones/products/c-80" },
            { name: "Micro không dây ECM-W3S", desc: "Hệ thống mic ghém kẹp áo chất lượng cao, lọc ồn thông minh.", tag: "Audio", link: "https://www.sony.com.vn/camera-accessories/products/ecm-w3s" },
            { name: "Pin ảo Sony DC-C1", desc: "Cấp nguồn trực tiếp từ điện lưới AC, giảm nhiệt lượng sinh ra cho máy.", tag: "Phụ kiện", link: "https://www.sony.com.vn/electronics/pin-va-bo-sac-may-anh-ong-kinh-roi/dc-c1" },
            { name: "Atem Mini Pro", desc: "Bàn trộn switch HDMI phần cứng của Blackmagic, độ trễ bằng không.", tag: "Thiết bị vận hành", link: "https://kyma.vn" },
          ].map((item, i) => (
            <a 
              key={i} 
              href={item.link} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="glass-card p-6 rounded-2xl flex flex-col gap-4 hover:border-purple-500/20 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-purple-500/10 transition-colors">
                  <span className="material-symbols-outlined text-white/30 group-hover:text-purple-400 transition-colors">
                    {item.tag === 'Camera' ? 'photo_camera' : item.tag === 'Lens' ? 'lens' : item.tag === 'Audio' ? 'mic' : 'settings'}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{item.tag}</span>
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">{item.name}</h4>
                <p className="text-[10px] text-white/40 font-medium leading-relaxed">{item.desc}</p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Modern Info Banner - Full Width */}
      <div className="relative rounded-[40px] p-8 lg:p-12 overflow-hidden bg-gradient-to-br from-purple-900/30 via-blue-900/10 to-transparent border border-white/[0.06]">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[200px] text-purple-400">spatial_tracking</span>
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-purple-300">Công nghệ Sony độc quyền</span>
          </div>
          <h3 className="text-2xl font-bold mb-4 tracking-tight text-white">Chế độ Product Showcase & Real-time Eye AF</h3>
          <p className="text-xs text-white/60 leading-relaxed mb-6 font-medium">
            Hầu hết các livestreamer hàng đầu và các nhãn hàng thời trang lựa chọn hệ thống Sony do tính năng **Real-time Eye AF** tự động bắt nét vào mắt của người mẫu và chế độ **Product Showcase** trên máy ZV-E10 II/FX30 giúp máy tự động chuyển nét từ mặt sang sản phẩm một cách mượt mà nhất khi đưa sản phẩm đến gần camera.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-xs text-purple-400">verified</span>
              <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest">Tản nhiệt chủ động (Active Cooling)</span>
            </div>
            <div className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center gap-2.5">
              <span className="material-symbols-outlined text-xs text-blue-400">face</span>
              <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest">Màu da chuyên nghiệp (S-Cinetone)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
