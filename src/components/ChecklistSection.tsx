import { useState } from 'react';

interface ChecklistItem {
  id: number;
  text: string;
  category: 'camera' | 'audio' | 'lighting' | 'network';
  checked: boolean;
}

export const ChecklistSection: React.FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>([
    // Camera Settings
    { id: 1, text: 'Đảm bảo cắm Pin ảo DC-C1 vào nguồn điện AC ổn định cho máy ảnh (Tránh dùng pin sạc USB-C trực tiếp gây nóng máy).', category: 'camera', checked: false },
    { id: 2, text: 'Cài đặt thông số màn trập (Shutter Speed) cố định ở 1/50 hoặc 1/100 tùy theo tần số điện lưới 50Hz để tránh sọc màn hình.', category: 'camera', checked: false },
    { id: 3, text: 'Kích hoạt Real-time Eye AF (Lấy nét mắt) và đặt AF Transition Speed (Tốc độ chuyển nét) ở mức 5 (Fastest) cho cam cận sản phẩm.', category: 'camera', checked: false },
    { id: 4, text: 'Bật chế độ Product Showcase (nếu sử dụng Sony ZV-E10 II) để tự động chuyển nét từ mặt host sang sản phẩm.', category: 'camera', checked: false },
    
    // Audio Settings
    { id: 5, text: 'Bật nguồn cấp điện Phantom 48V trên Soundcard Elgato Wave XLR cho micro Condenser Sony C-80.', category: 'audio', checked: false },
    { id: 6, text: 'Cài đặt Preamp Gain ở mức 32dB và kiểm tra dải đèn nhảy âm thanh trên OBS ở ngưỡng an toàn -6dB đến -12dB.', category: 'audio', checked: false },
    { id: 7, text: 'Áp bộ lọc lọc ồn (Noise Suppression) và bộ nén (Compressor) cho mic thu âm trong cài đặt filter của OBS.', category: 'audio', checked: false },
    
    // Lighting Setup
    { id: 8, text: 'Bật hệ thống ánh sáng 3 điểm (Key Light 5600K, Fill Light giảm bóng, Backlight tách nền).', category: 'lighting', checked: false },
    { id: 9, text: 'Thực hiện đo Custom White Balance bằng thẻ xám 18% (Gray Card) trực diện ống kính và khóa thông số nhiệt độ màu.', category: 'lighting', checked: false },
    
    // Network & Software Setup
    { id: 10, text: 'Khởi chạy phần mềm OBS Studio và TikTok Live Studio bằng quyền Administrator (Run as Administrator).', category: 'network', checked: false },
    { id: 11, text: 'Cắm cáp LAN trực tiếp vào máy tính (Không sử dụng Wi-Fi để tránh rớt khung hình).', category: 'network', checked: false },
    { id: 12, text: 'Kích hoạt tính năng Dynamic Bitrate trong cài đặt Advanced của OBS đề phòng mạng chập chờn.', category: 'network', checked: false },
  ]);

  const toggle = (id: number) => {
    setItems(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const progress = Math.round((items.filter(i => i.checked).length / items.length) * 100);

  const categories = [
    { id: 'camera', label: 'Thiết Lập Camera Sony', icon: 'photo_camera', color: 'text-blue-400' },
    { id: 'audio', label: 'Cấu Hình Âm Thanh', icon: 'graphic_eq', color: 'text-orange-400' },
    { id: 'lighting', label: 'Đồng Bộ Ánh Sáng & WB', icon: 'flare', color: 'text-yellow-400' },
    { id: 'network', label: 'Phần Mềm & Mạng LAN', icon: 'router', color: 'text-green-400' },
  ];

  return (
    <div className="space-y-8 animate-fade pb-20 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/[0.06] pb-8">
        <div>
          <h2 className="text-3xl font-bold mb-2">Checklist Vận Hành Livestream</h2>
          <p className="text-white/40 text-sm">Các đầu việc kỹ thuật cốt lõi nhân viên Sony cần kiểm tra và bấm xác nhận trước khi bắt đầu bấm nút phát sóng (Go Live).</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-4xl font-bold text-purple-400">{progress}%</div>
          <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Tiến trình chuẩn bị</div>
        </div>
      </div>

      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-gradient-to-r from-purple-600 to-blue-500 h-full transition-all duration-500 ease-out" 
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-8">
        {categories.map((cat) => {
          const catItems = items.filter(i => i.category === cat.id);
          return (
            <div key={cat.id} className="space-y-3">
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${cat.color}`}>
                <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                {cat.label}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {catItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={`w-full flex items-start gap-4 p-4 rounded-2xl border transition-all text-left group ${
                      item.checked 
                        ? 'bg-purple-950/10 border-purple-500/20 text-white/40' 
                        : 'bg-[#121212] border-white/5 text-white/80 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 mt-0.5 transition-all ${
                      item.checked ? 'bg-purple-600 border-purple-600' : 'border-white/20 group-hover:border-white/40'
                    }`}>
                      {item.checked && <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>}
                    </div>
                    <span className={`text-[11px] font-semibold leading-relaxed ${item.checked ? 'line-through' : ''}`}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {progress === 100 && (
        <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/30 p-8 rounded-3xl text-center animate-bounce shadow-lg shadow-green-500/5">
          <span className="material-symbols-outlined text-green-400 text-5xl mb-3">verified</span>
          <h3 className="text-xl font-bold text-green-400 mb-2">Đạt Tiêu Chuẩn Phát Sóng!</h3>
          <p className="text-xs text-green-400/70 max-w-md mx-auto leading-relaxed">
            Hệ thống máy ảnh, âm thanh, ánh sáng và mạng LAN đã được đồng bộ hóa hoàn hảo. Nhân viên kỹ thuật có thể bàn giao bảng điều khiển và bắt đầu buổi live.
          </p>
        </div>
      )}
    </div>
  );
};
