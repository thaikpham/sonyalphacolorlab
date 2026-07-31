import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
  explanation: string;
  category: 'Camera' | 'Lens' | 'Audio' | 'Setup';
  icon: string;
  source?: string;
}

const FAQCard: React.FC<{ item: FAQItem; isOpen: boolean; onToggle: () => void }> = ({ item, isOpen, onToggle }) => (
  <div className={`faq-gradient border rounded-2xl transition-all duration-300 overflow-hidden ${isOpen ? 'border-purple-500/40 ring-1 ring-purple-500/10' : 'border-white/5 hover:border-white/20'}`}>
    <button 
      onClick={onToggle}
      className="w-full text-left p-5 flex items-start gap-4 focus:outline-none"
    >
      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
        item.category === 'Camera' ? 'bg-blue-500/10 text-blue-400' :
        item.category === 'Audio' ? 'bg-orange-500/10 text-orange-400' :
        item.category === 'Lens' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-purple-500/10 text-purple-400'
      }`}>
        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-4">
          <h4 className="font-bold text-white text-xs md:text-sm leading-snug">{item.question}</h4>
          <span className={`material-symbols-outlined text-white/30 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </div>
        <div className="mt-1.5 flex gap-2">
          <span className="text-[8px] font-black uppercase tracking-widest text-white/40 bg-white/5 px-1.5 py-0.5 rounded">{item.category}</span>
          <span className="text-[8px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{item.source || 'Sony Wiki'}</span>
        </div>
      </div>
    </button>
    
    {isOpen && (
      <div className="px-5 pb-6 animate-fade">
        <div className="h-px bg-gradient-to-r from-white/5 to-transparent mb-5"></div>
        <div className="space-y-4">
          <div className="bg-white/[0.02] border-l-2 border-purple-500 p-4 rounded-r-xl">
            <p className="text-white text-xs font-bold mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-purple-400">lightbulb</span>
              Giải pháp thực chiến:
            </p>
            <p className="text-xs text-white/80 leading-relaxed">{item.answer}</p>
          </div>
          <div className="px-1">
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-wider mb-2">Giải thích kỹ thuật</p>
            <p className="text-[10px] text-white/50 leading-relaxed italic">
              "{item.explanation}"
            </p>
          </div>
        </div>
      </div>
    )}
  </div>
);

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [filter, setFilter] = useState<'All' | 'Camera' | 'Lens' | 'Audio' | 'Setup'>('All');

  const faqs: FAQItem[] = [
    {
      category: 'Camera',
      icon: 'videocam',
      question: 'Tại sao dòng máy ảnh Cinema Line Sony FX30/FX3 lại tối ưu hơn dòng Alpha cho livestream liên tục?',
      answer: 'Dòng Cinema Line sở hữu hệ thống quạt tản nhiệt chủ động tích hợp bên trong thân máy, cho phép livestream liên tục 24/7 ở độ phân giải cao mà không bao giờ gặp sự cố tự ngắt do quá nhiệt.',
      explanation: 'Các máy ảnh Hybrid thông thường (như Alpha 7 IV) được thiết kế ưu tiên chống thời tiết và không có quạt tản nhiệt vật lý. Khi hoạt động liên tục ở môi trường nhiệt độ phòng lớn, cảm biến sẽ bị nóng dần lên và tự động tắt máy để bảo vệ phần cứng sau khoảng vài tiếng.',
      source: 'Sony Cinema Guide'
    },
    {
      category: 'Setup',
      icon: 'battery_charging_full',
      question: 'Tại sao nhân viên Sony luôn khuyên dùng bộ cấp nguồn Pin ảo DC-C1 thay vì sạc trực tiếp qua cổng USB-C?',
      answer: 'Sử dụng Pin ảo DC-C1 giúp loại bỏ pin Lithium vật lý ra khỏi máy ảnh, từ đó triệt tiêu nhiệt lượng sinh ra do quá trình sạc xả pin liên tục, giúp bo mạch luôn mát mẻ và bảo vệ tuổi thọ linh kiện.',
      explanation: 'Cổng sạc Type-C của máy ảnh khi cắm sạc trực tiếp trong lúc hoạt động sẽ sinh nhiệt lượng kép (vừa chạy máy vừa sạc pin). Nhiệt độ này có thể đẩy nhanh quá trình kích hoạt bộ cảm biến tự ngắt nhiệt của máy ảnh.',
      source: 'Sony Accessories'
    },
    {
      category: 'Camera',
      icon: 'palette',
      question: 'Hệ màu S-Cinetone mang lại lợi ích gì cho các livestreamer?',
      answer: 'S-Cinetone giúp tái hiện tông màu da (Skin tone) tự nhiên, hồng hào và chuẩn điện ảnh ngay từ nguồn phát gốc mà không cần qua bất kỳ bộ lọc màu hay chỉnh màu (Color Grading) phức tạp nào trên phần mềm phát sóng.',
      explanation: 'S-Cinetone kế thừa công nghệ màu sắc từ các máy quay điện ảnh CineAlta cao cấp của Sony, tập trung tối ưu hóa vùng trung sắc (Mid-tones) của màu da người châu Á, giúp hình ảnh trông sang trọng và chân thực.',
      source: 'Sony Color Science'
    },
    {
      category: 'Lens',
      icon: 'lens',
      question: 'Khi nào nhân viên nên tư vấn ống kính zoom Sony FE 18-105mm F4 G OSS cho khách hàng?',
      answer: 'Ống kính này lý tưởng cho nhu cầu livestream đa dụng (đặc biệt là quần áo, thời trang). Thiết kế zoom điện tử (Power Zoom) cho phép nhân viên điều khiển chuyển đổi góc toàn sang góc cận zoom chất liệu vải cực kỳ mượt mà từ xa.',
      explanation: 'Đặc thù của dòng Power Zoom là hệ thấu kính chuyển động tịnh tiến bên trong thân ống kính (internal zoom), giúp tiêu cự không bị thay đổi vật lý ra bên ngoài và giữ nguyên cân bằng của chân máy/gimbal.',
      source: 'Sony G Lenses'
    },
    {
      category: 'Audio',
      icon: 'mic',
      question: 'Sự khác biệt giữa Micro Sony ECM-W3S và Micro Condenser C-80 trong không gian livestream?',
      answer: 'Mic không dây ECM-W3S phù hợp cho host cần di chuyển liên tục, tương tác sản phẩm. Mic phòng thu C-80 phù hợp cho các buổi talkshow tĩnh, review mỹ phẩm hoặc live âm thanh chất lượng cao cần giọng nói ấm áp.',
      explanation: 'Sony C-80 sở hữu màng thu lớn (large diaphragm) hướng thu Cardio cực kỳ nhạy, thu trọn giọng nói ấm, dầy và loại bỏ tạp âm nền cực tốt nhưng yêu cầu host ngồi cố định trước mic.',
      source: 'Sony Audio Division'
    },
    {
      category: 'Setup',
      icon: 'tune',
      question: 'Làm thế nào để xử lý triệt để hiện tượng vỡ tiếng (clipping) khi người nói đột ngột nói to?',
      answer: 'Sử dụng chức năng Compressor (Bộ nén) trên phần mềm OBS hoặc kích hoạt Clipguard trên soundcard Wave XLR để tự động giới hạn và giảm cường độ âm thanh khi vượt ngưỡng.',
      explanation: 'Compressor tự động giảm tỷ lệ âm thanh (vd 4:1) khi vượt qua ngưỡng ngưỡng Threshold đặt sẵn, ngăn chặn hiện tượng méo tín hiệu số (digital clipping) gây chói tai cho người nghe.',
      source: 'Audio Engineering'
    }
  ];

  const filteredFaqs = filter === 'All' ? faqs : faqs.filter(f => f.category === filter);

  return (
    <div className="space-y-8 animate-fade pb-20 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/[0.06] pb-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-purple-400 text-3xl">lightbulb</span>
            Cơ Sở Tri Thức Kỹ Thuật (FAQ)
          </h2>
          <p className="text-white/40 text-sm max-w-xl">
            Tổng hợp các tri thức kỹ thuật thực chiến chuyên sâu của Sony để hỗ trợ nhân viên tư vấn và cấu hình tối ưu.
          </p>
        </div>

        <div className="flex bg-[#121212] border border-white/5 rounded-xl p-1 gap-1 shrink-0 overflow-x-auto dark-scrollbar">
          {(['All', 'Camera', 'Lens', 'Audio', 'Setup'] as const).map((cat) => (
            <button 
              key={cat}
              onClick={() => { setFilter(cat); setOpenIndex(null); }}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${filter === cat ? 'bg-white text-black shadow-md' : 'text-[#666] hover:text-white'}`}
            >
              {cat === 'All' ? 'Tất cả' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredFaqs.map((faq, index) => (
          <FAQCard 
            key={index}
            item={faq}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
      </div>
    </div>
  );
};
