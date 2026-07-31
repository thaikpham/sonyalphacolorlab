import { useState } from 'react';

const KelvinIndicator: React.FC<{ temp: number; label: string; color: string }> = ({ temp, label, color }) => (
  <div className="flex flex-col items-center gap-3 flex-1">
    <div className={`w-full h-10 rounded-xl ${color} border border-white/20 shadow-xl opacity-90 hover:opacity-100 transition-opacity`}></div>
    <div className="text-center">
      <span className="text-xs font-bold text-white block">{temp}K</span>
      <span className="text-[9px] text-[#555] font-bold uppercase tracking-tighter">{label}</span>
    </div>
  </div>
);

const WBStep: React.FC<{ num: string; title: string; desc: string }> = ({ num, title, desc }) => (
  <div className="flex gap-6 group">
    <div className="flex flex-col items-center">
      <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-xs font-bold text-white/40 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-500 transition-all duration-300">
        {num}
      </div>
      <div className="w-px h-full bg-white/[0.06] my-2"></div>
    </div>
    <div className="pb-10">
      <h5 className="text-sm font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">{title}</h5>
      <p className="text-[11px] text-white/40 leading-relaxed font-medium">{desc}</p>
    </div>
  </div>
);

export const LightingSection: React.FC = () => {
  const [activeMood, setActiveMood] = useState<'clean' | 'warm' | 'cinematic'>('clean');

  const moods = {
    clean: { title: "Trong trẻo / Mỹ phẩm (5600K)", desc: "Sử dụng ánh sáng trắng ban ngày để tôn vinh màu sắc chính xác nhất của sản phẩm.", icon: "rebase_edit" },
    warm: { title: "Ấm áp / Thời trang (4500K)", desc: "Sử dụng ánh sáng vàng trung tính để tạo cảm giác gần gũi, tôn da mịn màng.", icon: "wb_twilight" },
    cinematic: { title: "Điện ảnh / Talkshow (3200K)", desc: "Sự kết hợp giữa ánh sáng vàng ấm và đèn RGB tạo chiều sâu không gian.", icon: "movie" }
  };

  return (
    <div className="space-y-12 pb-20 w-full animate-fade">
      <div className="border-b border-white/[0.06] pb-10">
        <h2 className="text-3xl lg:text-4xl font-bold mb-4 tracking-tight">Quy Trình Thiết Lập Ánh Sáng</h2>
        <p className="text-white/40 text-sm leading-relaxed max-w-2xl font-medium">
          Hướng dẫn dành cho Nhân viên kỹ thuật Sony. Thiết kế ánh sáng chuẩn 3 điểm và thực hiện cân bằng trắng để màu da và màu sản phẩm lên hình chính xác 100%.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
        <div className="xl:col-span-8 space-y-10">
          {/* Kelvin Map */}
          <div className="glass-card rounded-[40px] p-8 lg:p-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-purple-400 text-xl">thermostat</span>
                </div>
                <h3 className="text-lg font-bold text-white">Thang Nhiệt Độ Màu (Kelvin)</h3>
              </div>
              <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Scale Guide</div>
            </div>
            
            <div className="flex gap-4 lg:gap-6 mb-10">
              <KelvinIndicator temp={3200} label="Warm Yellow (Studio)" color="bg-orange-500" />
              <KelvinIndicator temp={4500} label="Neutral White" color="bg-yellow-100" />
              <KelvinIndicator temp={5600} label="Daylight (Standard)" color="bg-white" />
              <KelvinIndicator temp={6500} label="Cool Blue" color="bg-blue-300" />
            </div>
            
            <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/[0.06] flex items-start gap-4">
              <span className="material-symbols-outlined text-purple-400">info</span>
              <p className="text-xs text-white/50 leading-relaxed font-medium italic">
                **Quy tắc Sony:** Cố định nhiệt độ đèn chính (Key Light) ở mức **5600K** là giải pháp an toàn nhất giúp khớp hoàn hảo với cảm biến Sony Alpha ở chế độ Custom White Balance, tái hiện dải màu S-Cinetone tối ưu nhất.
              </p>
            </div>
          </div>

          {/* WB Section */}
          <div className="glass-card rounded-[40px] p-8 lg:p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <span className="material-symbols-outlined text-[180px] text-purple-500">palette</span>
            </div>
            
            <div className="flex items-center gap-4 mb-10 border-b border-white/[0.06] pb-8">
              <div className="w-14 h-14 rounded-[20px] bg-white/[0.02] flex items-center justify-center border border-white/[0.06]">
                <span className="material-symbols-outlined text-purple-400 text-2xl">colorize</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Đo Cân Bằng Trắng (Custom White Balance)</h3>
                <p className="text-[9px] text-white/30 uppercase tracking-[0.3em] font-bold mt-1">Sử dụng Thẻ Xám Trung Tính 18% (Gray Card)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
              <div className="space-y-1">
                <WBStep num="01" title="Cố định nguồn sáng" desc="Bật hệ thống đèn Studio (đặc biệt là Key Light ở 5600K). Tắt/che toàn bộ các nguồn sáng ngoại lai từ cửa sổ hoặc đèn hành lang để không làm nhiễu cảm biến." />
                <WBStep num="02" title="Đặt thẻ xám (Gray Card)" desc="Đặt thẻ xám 18% ngay tại vị trí Host (Người dẫn live) sẽ đứng hoặc ngồi. Hướng trực diện mặt thẻ xám về phía ống kính camera Sony." />
                <WBStep num="03" title="Truy cập Menu Sony Alpha" desc="Vào Menu máy ảnh → Exposure/Color → White Balance → Chọn 'Custom Setup'. Đưa vòng tròn ngắm trên màn hình nằm trọn trong vùng màu xám của thẻ." />
                <WBStep num="04" title="Đo & Khóa thông số" desc="Nhấn nút chọn ở giữa để máy chụp đo sáng. Máy ảnh Sony sẽ tự tính toán Kelvin (VD: 5500K, A1 G1) chính xác. Nhấn lưu vào bộ nhớ Custom 1 để khóa thông số." />
              </div>

              <div className="space-y-6">
                <div className="bg-white/[0.02] rounded-[32px] border border-white/[0.06] p-8">
                  <h4 className="text-xs font-bold text-[#666] uppercase mb-6 tracking-widest">Tại sao nhân viên Sony phải đo WB?</h4>
                  <ul className="space-y-5">
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
                      <p className="text-xs text-white/60 font-medium">Tránh hoàn toàn hiện tượng máy tự động đổi màu khi host mặc áo màu khác nhau (Auto WB bị lừa).</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
                      <p className="text-xs text-white/60 font-medium">Bảo toàn hệ màu da hồng hào tự nhiên đặc trưng của Sony (Skin tone S-Cinetone/Creative Look FL/IN).</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-green-500 text-base">check_circle</span>
                      <p className="text-xs text-white/60 font-medium">Đảm bảo màu sắc sản phẩm của khách hàng (VD: quần áo, mỹ phẩm) hiển thị chuẩn xác 100% trên thiết bị người xem.</p>
                    </li>
                  </ul>
                  <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#808080] rounded-xl border border-white/[0.1] shadow-lg flex items-center justify-center text-[10px] text-white/40 font-bold">18%</div>
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">18% Neutral Gray Card</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="xl:col-span-4 space-y-6">
          <div className="glass-card rounded-[40px] p-8 flex flex-col items-center text-center">
            <h4 className="text-[10px] font-bold text-[#666] uppercase mb-8 tracking-[0.2em]">Bố Trí Đèn 3 Điểm Chuẩn (3-Point)</h4>
            <div className="relative w-48 h-48 mx-auto mb-10">
              <div className="absolute inset-0 border border-white/[0.06] rounded-full"></div>
              {/* Host */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-[#181818] border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.05)]">
                  <span className="material-symbols-outlined text-purple-400 text-2xl">person</span>
                </div>
              </div>
              {/* Light Positions */}
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-yellow-400 rounded-2xl flex flex-col items-center justify-center shadow-lg animate-pulse">
                <span className="text-[9px] font-black text-black">KEY</span>
              </div>
              <div className="absolute top-1/2 -left-6 -translate-y-1/2 w-12 h-12 bg-blue-500/30 rounded-2xl flex flex-col items-center justify-center border border-blue-400/20">
                <span className="text-[9px] font-black text-white">FILL</span>
              </div>
              <div className="absolute -bottom-4 right-1/4 w-12 h-12 bg-purple-600/30 rounded-2xl flex flex-col items-center justify-center border border-purple-500/20">
                <span className="text-[9px] font-black text-white">HAIR</span>
              </div>
            </div>
            
            <div className="w-full space-y-3 text-left">
              {(['clean', 'warm', 'cinematic'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveMood(key)}
                  className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                    activeMood === key ? 'bg-white text-black border-white' : 'bg-white/[0.01] border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  <span className={`material-symbols-outlined ${activeMood === key ? 'text-black' : 'text-purple-400'}`}>
                    {moods[key].icon}
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold uppercase tracking-widest">{moods[key].title}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-6 bg-gradient-to-br from-purple-600/10 to-transparent rounded-[32px] border border-purple-500/10">
            <h5 className="text-[10px] font-bold text-purple-400 uppercase mb-3 tracking-widest">Lưu Ý Kỹ Thuật (Pro Tip)</h5>
            <p className="text-[11px] text-white/50 leading-relaxed font-medium">
              Luôn đặt đèn chính (Key Light) ở góc **45 độ** so với trục máy ảnh và hướng từ trên xuống 45 độ để tạo bóng đổ tự nhiên trên sống mũi và khuôn mặt host (kỹ thuật ánh sáng Rembrandt).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
