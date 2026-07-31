

const ProductHighlight: React.FC<{
  title: string;
  tagline: string;
  image: string;
  features: string[];
}> = ({ title, tagline, image, features }) => (
  <div className="glass-panel rounded-3xl overflow-hidden flex flex-col md:flex-row animate-fade border border-white/[0.05]">
    <div className="md:w-1/2 p-8 flex flex-col justify-center">
      <div className="inline-block bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold text-[#969696] uppercase tracking-wider mb-4">Featured Combo</div>
      <h3 className="text-3xl font-bold text-white mb-2">{title}</h3>
      <p className="text-[#969696] text-sm mb-6">{tagline}</p>
      <div className="grid grid-cols-1 gap-3">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[16px] text-white/40">check_circle</span>
            <span className="text-xs text-white/70">{f}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="md:w-1/2 relative min-h-[350px] bg-[#111] flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10" />
      <img 
        src={image} 
        alt={title}
        className="relative z-10 w-full h-auto object-contain drop-shadow-2xl scale-110 transition-transform duration-500 hover:scale-125" 
      />
    </div>
  </div>
);

export const ShowcaseSection: React.FC<{ onLaunch?: () => void }> = ({ onLaunch }) => {
  return (
    <div className="space-y-12 pb-12">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-[#969696] bg-clip-text text-transparent">Sony Vlogging Showcase</h2>
        <p className="text-[rgba(218,220,224,0.6)] text-sm max-w-lg mx-auto">
          Khám phá không gian trải nghiệm thực tế và giải pháp Livestream chuyên nghiệp.
        </p>
      </div>

      {/* Link Access Section */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[32px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 md:p-12 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="relative z-10 space-y-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Virtual Tour Access</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white">Trải nghiệm Sony Virtual Showcase</h3>
            <p className="text-sm text-[#969696] max-w-md">
              Khám phá không gian trải nghiệm thực tế ảo với các sản phẩm Sony chuyên nghiệp cho Livestream.
            </p>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <button 
              onClick={onLaunch}
              className="px-8 py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-2xl active:scale-95 bg-white text-black hover:bg-gray-100 w-full md:w-auto cursor-pointer"
            >
              <span className="material-symbols-outlined font-bold">play_arrow</span>
              Khởi động Showcase
            </button>
          </div>

          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <ProductHighlight 
          title="Sony ZV-E10 II"
          tagline="Sức mạnh cảm biến 26MP trong thiết kế nhỏ gọn, chuẩn mực mới cho Livestream 4K."
          image="https://www.sony.com.vn/image/93abd096494d8d8d03dafd80e3b21a53?fmt=png-alpha&wid=1578&hei=1050&bgcolor=F6F9FF"
          features={[
            "Cảm biến APS-C Exmor R CMOS 26.0 MP mới nhất",
            "Quay video 4K 60p 10-bit 4:2:2 chuyên nghiệp",
            "Chế độ Product Showcase (Giới thiệu sản phẩm) mượt mà",
            "Pin NP-FZ100 dung lượng lớn cho thời gian Live dài",
            "Hỗ trợ Creative Look giúp chỉnh màu nhanh không cần hậu kỳ"
          ]}
        />

        <ProductHighlight 
          title="E 35mm F1.8 OSS"
          tagline="Tiêu cự vàng cho chân dung và sản phẩm với độ nét kinh ngạc."
          image="https://d1ncau8tqf99kp.cloudfront.net/converted/81393_original_local_1200x1050_v3_converted.webp"
          features={[
            "Góc nhìn 52.5mm (quy đổi) - Chân thực như mắt người",
            "Khẩu độ F1.8 cho khả năng xóa phông (Bokeh) cực mịn",
            "Chống rung quang học OSS tích hợp sẵn trong ống kính",
            "Trọng lượng siêu nhẹ 154g, không gây mỏi khi quay lâu",
            "Động cơ lấy nét tuyến tính yên tĩnh tuyệt đối"
          ]}
        />
      </div>

      {/* Tech Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: 'view_in_ar', title: 'Product Showcase', desc: 'Lấy nét vật phẩm tức thì' },
          { icon: 'auto_awesome', title: 'Soft Skin Effect', desc: 'Làm mịn da tự nhiên' },
          { icon: 'battery_charging_full', title: 'Long Battery', desc: 'Sử dụng pin NP-FZ100' },
          { icon: 'blur_on', title: 'F1.8 Bokeh', desc: 'Xóa phông chuyên nghiệp' },
        ].map((item, i) => (
          <div key={i} className="glass-panel p-5 rounded-2xl border border-white/5 text-center hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined text-white/40 mb-3 text-2xl">{item.icon}</span>
            <h5 className="text-xs font-bold block mb-1">{item.title}</h5>
            <p className="text-[10px] text-[#969696] leading-tight">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
