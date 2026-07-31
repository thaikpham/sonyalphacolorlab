const IssueCard: React.FC<{
  title: string;
  icon: string;
  steps: { text: string; sub?: string }[];
  accentColor: string;
}> = ({ title, icon, steps, accentColor }) => (
  <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 animate-fade hover:border-white/10 transition-colors">
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentColor}`}>
        <span className="material-symbols-outlined text-white">{icon}</span>
      </div>
      <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
    </div>
    
    <div className="space-y-4">
      {steps.map((step, idx) => (
        <div key={idx} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-[9px] font-bold text-[#969696] shrink-0">
              {idx + 1}
            </div>
            {idx < steps.length - 1 && <div className="w-px h-full bg-white/5 my-1"></div>}
          </div>
          <div className="pb-4 flex-1">
            <p className="text-xs font-bold text-white/90">{step.text}</p>
            {step.sub && <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{step.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const TroubleshootingSection: React.FC = () => {
  return (
    <div className="space-y-8 animate-fade pb-20 w-full">
      <div className="border-b border-white/[0.06] pb-8">
        <h2 className="text-3xl font-bold mb-2">Cẩm Nang Khắc Phục Sự Cố Kỹ Thuật</h2>
        <p className="text-white/40 text-sm">Các quy trình xử lý khẩn cấp dành cho Nhân viên Sony khi gặp lỗi phần cứng hoặc tín hiệu phần mềm trong quá trình vận hành live.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <IssueCard 
          title="Sự cố 1: Khắc phục Nóng máy ảnh (Overheating)"
          icon="thermostat"
          accentColor="bg-red-500/20"
          steps={[
            { 
              text: "Chuyển sang cấp nguồn Pin ảo DC-C1", 
              sub: "Luôn dùng Pin ảo DC-C1 kết nối trực tiếp nguồn điện xoay chiều. Tránh việc cắm sạc trực tiếp qua cổng USB Type-C của máy ảnh vì quá trình sạc pin Lithium trong máy sinh ra nhiệt lượng cực lớn gây sập nguồn bảo vệ." 
            },
            { 
              text: "Điều chỉnh cài đặt Auto Power OFF Temp", 
              sub: "Vào Setup máy ảnh → [Power Save Option] → [Auto Power OFF Temp.] → Chọn 'High'. Cài đặt này cho phép máy ảnh Sony tiếp tục quay kể cả khi nhiệt độ thân máy tăng cao." 
            },
            { 
              text: "Giải phóng không gian vật lý máy ảnh", 
              sub: "Mở xoay lật màn hình LCD ra ngoài để giải phóng bề mặt tản nhiệt phía sau. Đối với Sony FX30/FX3, đảm bảo khe quạt tản nhiệt không bị che khuất và chế độ quạt [Fan Control] đặt ở mức 'Auto' hoặc 'Minimum(Mitigate)'." 
            }
          ]}
        />

        <IssueCard 
          title="Sự cố 2: Lệch hình lệch tiếng (Audio Sync Offset)"
          icon="timer"
          accentColor="bg-purple-500/20"
          steps={[
            { 
              text: "Đo độ trễ giữa hình ảnh và âm thanh", 
              sub: "Tín hiệu hình ảnh truyền qua Capture Card (Elgato) thường bị trễ từ 150ms - 250ms so với tín hiệu âm thanh thu trực tiếp qua Soundcard USB." 
            },
            { 
              text: "Cấu hình Sync Offset trong OBS Studio", 
              sub: "Vào OBS → Edit → [Advanced Audio Properties] → Tìm dòng Micro đầu vào → Nhập thông số tại cột [Sync Offset] là '200 ms' (hoặc dao động từ 150-250ms). Giá trị dương này sẽ trì hoãn âm thanh phát chậm lại để khớp chính xác với chuyển động của môi." 
            },
            { 
              text: "Kiểm tra sự đồng bộ tần số lấy mẫu (Sample Rate)", 
              sub: "Đảm bảo cả Soundcard Wave XLR, Windows Sound Control Panel và OBS đều được đặt đồng bộ ở tần số '48000 Hz (48kHz)'. Lệch tần số lấy mẫu (vd 44.1kHz vs 48kHz) sẽ gây méo tiếng hoặc lệch pha âm thanh theo thời gian." 
            }
          ]}
        />

        <IssueCard 
          title="Sự cố 3: Lỗi mất tín hiệu Capture Card (No Signal)"
          icon="cable"
          accentColor="bg-blue-500/20"
          steps={[
            { 
              text: "Kiểm tra cấu hình HDMI Output trên Camera", 
              sub: "Đảm bảo máy ảnh đang bật nguồn. Vào Menu → Setup → [External Output] → [HDMI Resolution] → Đặt ở mức '1080p' hoặc '2160p' thay vì để Auto." 
            },
            { 
              text: "Khởi động lại driver Capture Card trong OBS", 
              sub: "Double click vào source Video Capture Device trong OBS → Click nút [Deactivate] → Đợi 2 giây → Click [Activate] để kích hoạt lại luồng nhận tín hiệu HDMI." 
            },
            { 
              text: "Kiểm tra cáp vật lý và cổng kết nối USB 3.0", 
              sub: "Đảm bảo cắm thiết bị Elgato Camlink 4K vào đúng cổng USB 3.0 (cổng màu xanh dương). Rút ra cắm lại trực tiếp vào mainboard máy tính, tránh dùng qua cổng chia USB Hub kém chất lượng không đủ băng thông." 
            }
          ]}
        />

        <IssueCard 
          title="Sự cố 4: Âm thanh bị rè, méo tiếng hoặc nhiễu điện"
          icon="volume_off"
          accentColor="bg-orange-500/20"
          steps={[
            { 
              text: "Kiểm tra nút gạt suy giảm tín hiệu (Attenuator - Pad)", 
              sub: "Đối với mic Sony ECM-W3S hoặc C-80, nếu host nói quá to gây vỡ tiếng, hãy gạt nút ATT (suy giảm) sang mức -10dB hoặc -20dB để giảm độ nhạy đầu vào vật lý." 
            },
            { 
              text: "Cách ly nguồn gây nhiễu điện", 
              sub: "Tránh đi dây cáp âm thanh XLR song song sát cạnh các dây nguồn điện 220V của đèn studio. Nhiễu cảm ứng điện từ có thể đi vào mic gây tiếng rít hum/buzz." 
            },
            { 
              text: "Kích hoạt chức năng Clipguard trên Wave XLR", 
              sub: "Bật tính năng Clipguard trong ứng dụng Elgato để tự động nén âm thanh khi host nói quá lớn, ngăn chặn hiện tượng vỡ tiếng kỹ thuật số." 
            }
          ]}
        />
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 text-center">
        <span className="material-symbols-outlined text-purple-400 text-3xl mb-2">support_agent</span>
        <p className="text-xs text-white/50 leading-relaxed font-semibold">
          Trong trường hợp xảy ra sự cố phần cứng không thể tự khắc phục, vui lòng báo cáo ngay cho Kỹ thuật viên phụ trách kỹ thuật Studio Sony: <span className="text-purple-400 font-bold">1800-xxxx (Nhánh 2)</span>
        </p>
      </div>
    </div>
  );
};
