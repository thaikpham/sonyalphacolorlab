import { useState } from 'react';

const EncoderCard: React.FC<{ name: string; desc: string; bestFor: string; icon: string }> = ({ name, desc, bestFor, icon }) => (
  <div className="glass-card p-6 rounded-3xl flex flex-col h-full">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
        <span className="material-symbols-outlined text-purple-400 text-xl">{icon}</span>
      </div>
      <span className="text-xs font-bold text-white uppercase tracking-widest">{name}</span>
    </div>
    <p className="text-[11px] text-white/40 leading-relaxed font-medium mb-6 flex-1">{desc}</p>
    <div className="pt-4 border-t border-white/[0.06]">
      <span className="text-[9px] font-bold text-[#444] uppercase tracking-widest block mb-1">Cấu hình khuyến nghị:</span>
      <span className="text-[10px] font-bold text-purple-300 uppercase tracking-tight">{bestFor}</span>
    </div>
  </div>
);

export const SoftwareSection: React.FC = () => {
  const [subTab, setSubTab] = useState<'obs' | 'audio' | 'tiktok'>('obs');

  return (
    <div className="space-y-12 pb-20 w-full animate-fade">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-white/[0.06] pb-10">
        <div className="max-w-2xl">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 tracking-tight">Trung Tâm Cấu Hình Phần Mềm</h2>
          <p className="text-white/40 text-sm leading-relaxed font-medium">
            Hướng dẫn thiết lập luồng phát chuẩn dọc 1080x1920 (9:16) ở 60FPS. Tối ưu hóa card đồ họa phần cứng và đường đi của tín hiệu âm thanh chuyên nghiệp.
          </p>
        </div>
        <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1.5 gap-1 self-start lg:self-auto shrink-0 overflow-x-auto no-scrollbar">
          {(['obs', 'audio', 'tiktok'] as const).map((tab) => (
            <button 
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all whitespace-nowrap ${
                subTab === tab ? (tab === 'tiktok' ? 'bg-[#ff0050] text-white shadow-xl' : 'bg-white text-black shadow-xl') : 'text-[#666] hover:text-white/60'
              }`}
            >
              {tab === 'obs' ? 'Thiết lập OBS Studio' : tab === 'audio' ? 'Audio Signal Chain' : 'TikTok Live Studio'}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'obs' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in">
          <div className="xl:col-span-2 space-y-8">
            {/* Output Panel */}
            <div className="glass-card rounded-[40px] p-8 lg:p-10">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-purple-400">settings_suggest</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Cấu hình Output & Video (OBS)</h3>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {[
                  { label: "Độ phân giải", val: "1080x1920", sub: "Khung hình dọc 9:16" },
                  { label: "Bitrate video", val: "8000 Kbps", sub: "Khuyên dùng cho 1080p60" },
                  { label: "Rate Control", val: "CBR", sub: "Luồng truyền bitrate cố định" },
                  { label: "Keyframe Interval", val: "2.0s", sub: "Yêu cầu của TikTok/Shopee" },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.06] flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">{item.label}</span>
                    <span className="text-base font-bold text-white/90">{item.val}</span>
                    <span className="text-[9px] font-medium text-[#555] italic">{item.sub}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <EncoderCard name="NVIDIA NVENC H.264" desc="Mã hóa luồng video trực tiếp bằng bộ mã hóa phần cứng chuyên biệt trên GPU GeForce RTX. Giảm tải tối đa cho CPU." bestFor="Card đồ họa RTX 2060 trở lên (Ưu tiên)" icon="memory" />
                <EncoderCard name="Intel QuickSync" desc="Sử dụng nhân đồ họa tích hợp (iGPU) của chip xử lý Intel. Thích hợp cho laptop hoặc máy phụ không có card rời." bestFor="Intel Core i5/i7 Gen 12 trở lên" icon="bolt" />
                <EncoderCard name="x264 (Software CPU)" desc="Sử dụng sức mạnh tính toán của vi xử lý chính bằng phần mềm. Chỉ khuyên dùng nếu CPU sở hữu số nhân luồng cực khủng." bestFor="Intel Core i9 / AMD Ryzen 9" icon="developer_board" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card rounded-[40px] p-8 space-y-6">
              <h4 className="text-[10px] font-bold text-[#666] uppercase tracking-[0.2em] mb-4">Mẹo Kiểm Soát Khung Hình (OBS Diagnostics)</h4>
              {[
                { title: "Dropped Frames (Mạng yếu)", col: "red", desc: "Do băng thông upload của mạng chập chờn. Hãy cắm dây LAN trực tiếp hoặc kích hoạt Dynamic Bitrate để OBS tự động hạ chất lượng xuống thay vì rớt luồng." },
                { title: "Skipped Frames (Quá tải mã hóa)", col: "yellow", desc: "Do GPU bị quá tải khi xử lý đồ họa. Hãy đổi Preset mã hóa từ P7 xuống P5 hoặc P4, tắt tính năng Psycho Visual Tuning." },
                { title: "Render Lag (Trễ hiển thị)", col: "purple", desc: "Do Windows không phân phối đủ tài nguyên đồ họa cho OBS. Hãy luôn khởi chạy OBS Studio bằng quyền Admin (Run as Administrator)." },
              ].map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      item.col === 'red' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                      item.col === 'yellow' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' :
                      'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
                    }`}></div>
                    <h5 className="text-[10px] font-bold text-white/80 uppercase">{item.title}</h5>
                  </div>
                  <p className="text-[10px] text-white/40 leading-relaxed font-medium">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'audio' && (
        <div className="glass-card rounded-[40px] p-8 lg:p-10 animate-fade-in">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-400">graphic_eq</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Sơ đồ đấu nối tín hiệu Âm Thanh (Audio Signal Chain)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: 'mic', name: 'Micro Sony C-80', desc: 'Mic thu âm Condenser phòng thu chuyên nghiệp, bắt giọng cực ấm.', detail: 'Yêu cầu nguồn Phantom 48V' },
              { icon: 'cable', name: 'Cáp XLR cao cấp', desc: 'Dây truyền dẫn tín hiệu balanced chống nhiễu tín hiệu vật lý.', detail: 'Kết nối XLR 3-pin tiêu chuẩn' },
              { icon: 'equalizer', name: 'Soundcard Wave XLR', desc: 'Bộ tiền khuếch đại (Preamp) giải mã tín hiệu sang nhạc số USB-C.', detail: 'Gain khuyên dùng: 32dB' },
              { icon: 'computer', name: 'PC / Phần mềm OBS', desc: 'Nhận thiết bị đầu vào âm thanh, áp bộ lọc nén Compressor.', detail: 'Tần số lấy mẫu: 48kHz' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="glass-card p-6 rounded-2xl text-center h-full flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-purple-400">{item.icon}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white mb-1">{item.name}</h4>
                    <p className="text-[10px] text-white/40 font-medium leading-relaxed mb-4">{item.desc}</p>
                  </div>
                  <p className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">{item.detail}</p>
                </div>
                {i < 3 && (
                  <div className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 text-white/20">
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'tiktok' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-fade-in">
          <div className="glass-card rounded-[40px] p-8 lg:p-10">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-2xl bg-[#ff0050]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#ff0050] text-2xl">music_video</span>
              </div>
              <h3 className="text-xl font-bold text-white">Thiết lập TikTok Live Studio chuẩn Sony</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.06]">
                <h4 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-4">Video Feed Config</h4>
                <ul className="space-y-4">
                  <li className="flex justify-between border-b border-white/[0.06] pb-3">
                    <span className="text-xs text-white/60">Độ phân giải</span>
                    <span className="text-xs font-bold">1080 x 1920 (Dọc)</span>
                  </li>
                  <li className="flex justify-between border-b border-white/[0.06] pb-3">
                    <span className="text-xs text-white/60">Định dạng hình</span>
                    <span className="text-xs font-bold">Portrait (Đứng)</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-xs text-white/60">Băng thông Bitrate</span>
                    <span className="text-xs font-bold">6000 Kbps</span>
                  </li>
                </ul>
              </div>
              <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.06]">
                <h4 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-4">Audio Config</h4>
                <ul className="space-y-4">
                  <li className="flex justify-between border-b border-white/[0.06] pb-3">
                    <span className="text-xs text-white/60">Sample Rate</span>
                    <span className="text-xs font-bold">48 kHz (Khớp mic)</span>
                  </li>
                  <li className="flex justify-between border-b border-white/[0.06] pb-3">
                    <span className="text-xs text-white/60">Bitrate Audio</span>
                    <span className="text-xs font-bold">128 Kbps</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-xs text-white/60">Đầu vào kênh</span>
                    <span className="text-xs font-bold">Mono (Khuyên dùng)</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="p-6 bg-[#ff0050]/5 rounded-[32px] border border-[#ff0050]/10 flex items-start gap-4">
              <span className="material-symbols-outlined text-[#ff0050]">lightbulb</span>
              <p className="text-xs text-white/60 leading-relaxed font-medium">
                **Quy tắc:** TikTok Studio nhận tín hiệu Camera Sony tốt nhất thông qua **Capture Card (HDMI)**. Để tận dụng các bộ lọc làm đẹp và chuyển cảnh mượt mà, hãy đặt **OBS Virtual Camera** làm đầu vào video cho TikTok Studio.
              </p>
            </div>
          </div>

          <div className="glass-card rounded-[40px] p-8 lg:p-10 flex flex-col justify-center items-center text-center">
            <div className="max-w-sm">
              <div className="w-20 h-20 rounded-[32px] bg-white/[0.02] flex items-center justify-center mx-auto mb-8 border border-white/[0.06]">
                <span className="material-symbols-outlined text-4xl text-white/20">admin_panel_settings</span>
              </div>
              <h4 className="text-lg font-bold text-white mb-4 tracking-tight">Quyền Quản Trị (Administrator)</h4>
              <p className="text-xs text-white/40 leading-relaxed font-medium mb-8">
                Để tránh việc luồng phát bị giật, lag hoặc ứng dụng đột ngột treo khi chuyển cảnh livestream, nhân viên kỹ thuật phải luôn khởi chạy cả OBS và TikTok Live Studio bằng quyền Admin.
              </p>
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] inline-block">
                <code className="text-[11px] text-purple-300 font-mono">Right Click -&gt; Run as Administrator</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
