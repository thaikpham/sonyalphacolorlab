import React, { useState, useEffect, useRef } from 'react';
import { GEMINI_API_KEY, DEFAULT_MODEL } from '../config';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  groundingMetadata?: any;
}

const DEFAULT_SYSTEM_INSTRUCTION = `Bạn là một chuyên gia tư vấn thiết bị Sony Live SOP chuyên nghiệp, am hiểu sâu sắc về máy ảnh Sony Alpha, dòng Cinema Line (FX3, FX30), các loại ống kính (G Master, G Lens) và Ngành hàng âm thanh gồm loa, tai nghe và các giải pháp vận hành Livestream chuyên nghiệp.

HÃY TUÂN THỦ CÁC QUY TẮC SAU KHI PHẢN HỒI:
- Tư vấn theo mô hình Good-Better-Best để khách hàng thấy được những options giá trị của line-up sản phẩm.
- Liệt kê ngắn gọn và đưa ra 5 key selling points cho từng lựa chọn sản phẩm. No yapping
- Luôn thân thiện, chuyên nghiệp, xưng hô là "Sony Live SOP" hoặc "Trợ lý AI".
- Trả lời bằng Tiếng Việt rõ ràng. Sử dụng Markdown (in đậm, danh sách gạch đầu dòng, bảng so sánh) để câu trả lời dễ đọc.
- Khi người dùng hỏi tư vấn combo livestream, hãy đề xuất combo dựa trên: Lĩnh vực kinh doanh (Thời trang, F&B, Review), Ngân sách, và Số lượng góc máy.
- Đưa ra những phân tích cụ thể vì sao họ nên chọn thiết bị đó (Ví dụ: livestream quần áo nên chọn FX30 vì có màu da S-Cinetone đẹp và có quạt làm mát hoạt động cả ngày không bị ngắt).
- Nếu câu hỏi không liên quan đến thiết bị Sony hoặc livestream, hãy lịch sự nhắc nhở họ rằng bạn là trợ lý chuyên biệt của Sony Live SOP.
- Khi được hỏi về các thông số kỹ thuật mới nhất, các sản phẩm mới ra mắt hoặc giá cả hiện hành, hãy chủ động sử dụng công cụ Tìm kiếm Google để truy cập trang web chính thức của Sony Việt Nam và Sony Alpha Vietnam tại đường dẫn chiến dịch chính thức sau để lấy thông tin, cào dữ liệu chính xác và đầy đủ nhất: https://www.sony.com.vn/?cid=sem-apac-203941&utm_source=Google&utm_campaign=FY26_Local_VN_TV_Hakuhodo_GG_Gross_SEM&utm_term=Gross&gad_source=1&gad_campaignid=23759861923&gclid=CjwKCAjwrNrQBhBjEiwAoR4VO3ZoO9G42dH9Y5Yg6h4-doT0iyHim9J9_82wJBIoQH3OHLHhrTdbAxoCd-0QAvD_BwE`;

const SUGGESTIONS = [
  { text: 'So sánh Sony FX30 và Alpha 7 IV', icon: 'compare' },
  { text: 'Mic Condenser Sony C-80 hoạt động thế nào?', icon: 'mic' },
  { text: 'Ống kính FE 24-70mm GM II có gì nổi bật?', icon: 'photo_camera' },
  { text: 'Các combo livestream chính hãng của Sony', icon: 'shopping_bag' }
];

export const ProductAdvisor: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    return [
      {
        role: 'model',
        text: 'Xin chào! Tôi là Trợ Lý Wiki Sony AI. Tôi chuyên giải đáp kiến thức kỹ thuật, tư vấn thông số và khả năng kết nối của các dòng máy ảnh Alpha, Cinema Line (FX3, FX30), ống kính Sony G Master và microphone chính hãng. Ngoài ra, tôi có thể tư vấn cấu hình livestream tối ưu dựa trên 4 combo sản phẩm tiêu chuẩn của Sony Live SOP. Bạn muốn bắt đầu tìm hiểu sản phẩm nào?',
        timestamp: new Date()
      }
    ];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings State
  const [apiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || GEMINI_API_KEY;
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    let savedModel = localStorage.getItem('gemini_model') || DEFAULT_MODEL;
    if (savedModel === 'gemini-1.5-flash') {
      savedModel = 'gemini-2.5-flash';
    } else if (savedModel === 'gemini-1.5-pro') {
      savedModel = 'gemini-2.5-pro';
    }
    return savedModel;
  });
  const [systemInstruction, setSystemInstruction] = useState(() => {
    return localStorage.getItem('gemini_system_instruction') || DEFAULT_SYSTEM_INSTRUCTION;
  });
  const [useSearch, setUseSearch] = useState(() => {
    const saved = localStorage.getItem('gemini_use_search');
    return saved === null ? true : saved === 'true';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load settings and migrate if necessary on mount
  useEffect(() => {
    let savedModel = localStorage.getItem('gemini_model');
    let migrated = false;
    if (savedModel === 'gemini-1.5-flash') {
      savedModel = 'gemini-2.5-flash';
      migrated = true;
    } else if (savedModel === 'gemini-1.5-pro') {
      savedModel = 'gemini-2.5-pro';
      migrated = true;
    }
    if (migrated && savedModel) {
      localStorage.setItem('gemini_model', savedModel);
      setSelectedModel(savedModel);
    }

    // Sync localStorage prompt with the new default custom prompt
    const savedInstruction = localStorage.getItem('gemini_system_instruction');
    if (savedInstruction !== DEFAULT_SYSTEM_INSTRUCTION) {
      localStorage.setItem('gemini_system_instruction', DEFAULT_SYSTEM_INSTRUCTION);
      setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model', selectedModel);
    localStorage.setItem('gemini_system_instruction', systemInstruction);
    localStorage.setItem('gemini_use_search', String(useSearch));
    setShowSettings(false);
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // If API Key is configured, make real Gemini API call
    if (apiKey.trim()) {
      try {
        const conversationHistory = messages.concat(userMessage).map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        }));

        const requestBody: any = {
          contents: conversationHistory,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          }
        };

        if (useSearch) {
          requestBody.tools = [
            {
              google_search: {}
            }
          ];
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          let errorMsg = `HTTP ${response.status} ${response.statusText}`;
          try {
            const errData = await response.json();
            if (errData?.error?.message) {
              errorMsg = errData.error.message;
            }
          } catch (_) {}
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Không nhận được câu trả lời từ AI.';
        const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
        
        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            text: responseText,
            timestamp: new Date(),
            groundingMetadata
          }
        ]);
      } catch (err: any) {
        console.error(err);
        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            text: `⚠️ **Lỗi kết nối API:** Không thể kết nối tới máy chủ Gemini. Chi tiết: ${err.message}. Vui lòng kiểm tra lại API Key hoặc kết nối mạng của bạn.`,
            timestamp: new Date()
          }
        ]);
      } finally {
        setLoading(false);
      }
    } else {
      // Mock offline advisor replies
      setTimeout(() => {
        let reply = '';
        const lowercaseInput = textToSend.toLowerCase();

        if (lowercaseInput.includes('quần áo') || lowercaseInput.includes('thời trang') || lowercaseInput.includes('bán hàng')) {
          reply = `Chào bạn! Để livestream bán hàng quần áo / thời trang chuyên nghiệp, Sony Live SOP khuyên bạn nên sử dụng cấu hình **Combo 2: Sony FX30 Pro**.
          
### Tại sao cấu hình này tối ưu cho bạn?
1. **Sony FX30 (Camera Cinema):** Cảm biến Super35 cực nét, tích hợp sẵn hệ màu da **S-Cinetone** hồng hào, tự nhiên mà không cần chỉnh màu hay bộ lọc phức tạp. Thiết bị có **quạt tản nhiệt chủ động**, hỗ trợ livestream 24/7 liên tục mà không bao giờ lo quá nhiệt sập nguồn.
2. **Ống kính FE 18-105mm f/4 G OSS:** Khả năng zoom điện tử cực kỳ êm ái, cho phép bạn chuyển đổi linh hoạt từ góc rộng (quay toàn cảnh mẫu thử đồ) sang góc cận (zoom sát chất liệu vải, đường chỉ).
3. **Phụ kiện đi kèm:** Gồm Pin ảo **DC-C1** bảo đảm nguồn điện ổn định cả ngày, capture card **Camlink 4K** xuất hình ảnh không trễ và **ASUS TUF Laptop** vận hành mượt mà qua phần mềm OBS Studio.

*Mẹo: Bạn có thể chuyển sang tab **Báo Giá Thông Minh** để xem chi tiết đơn giá của từng thiết bị này.*

*(Lưu ý: Đây là câu trả lời tự động ở chế độ Demo Offline của Sony Live SOP).*`;
        } else if (lowercaseInput.includes('fx30') && (lowercaseInput.includes('a7 iv') || lowercaseInput.includes('alpha 7'))) {
          reply = `So sánh giữa **Sony FX30** và **Sony Alpha 7 IV (A7M4)** cho nhu cầu livestream chuyên nghiệp:

| Tiêu chí | Sony FX30 | Sony Alpha 7 IV |
| :--- | :--- | :--- |
| **Loại cảm biến** | APS-C (Crop 1.5x) | Full Frame (Khổ đầy đủ) |
| **Thiết kế thân máy** | Nhỏ gọn, phong cách Cinema Line, có sẵn các lỗ ốc gắn phụ kiện trực tiếp | Dạng máy ảnh Hybrid truyền thống |
| **Hệ thống tản nhiệt** | **Có quạt làm mát chủ động** (Livestream cả ngày không lo nóng máy) | Không có quạt (Có thể quá nhiệt nếu live lâu ở môi trường nóng) |
| **Chất lượng hình ảnh** | Rất tốt, màu da S-Cinetone chuẩn điện ảnh | Xuất sắc, dải động rộng hơn, khử nhiễu thiếu sáng tốt hơn |
| **Giá thành (Body)** | ~46.990.000đ (Tiết kiệm hơn) | ~59.990.000đ (Cao cấp hơn) |

### Lời khuyên lựa chọn:
- Nên chọn **FX30** nếu mục tiêu chính là livestream liên tục thời gian dài (bán hàng, sự kiện), cần độ tin cậy tuyệt đối về nhiệt độ và muốn tiết kiệm chi phí ống kính.
- Nên chọn **Alpha 7 IV** nếu bạn muốn kết hợp chụp ảnh chuyên nghiệp chất lượng cao (33MP) và livestream ở môi trường thiếu sáng, cần hiệu ứng xóa phông mượt mà của cảm biến Full Frame.

*(Lưu ý: Đây là câu trả lời tự động ở chế độ Demo Offline của Sony Live SOP).*`;
        } else if (lowercaseInput.includes('1 góc') || lowercaseInput.includes('tiết kiệm') || lowercaseInput.includes('rẻ nhất')) {
          reply = `Nếu bạn đang tìm kiếm giải pháp livestream 1 góc máy đơn giản, cơ động và tiết kiệm nhất, **Combo 1: Sony ZV-E10 II Lite** là sự lựa chọn hoàn hảo:

- **Thiết bị chính:** Máy ảnh **Sony ZV-E10 II** đi kèm ống kính Kit 16-50mm hoặc nâng cấp lên ống zoom đa dụng **18-105mm G OSS** để lấy nét tự động vào mắt cực nhanh, có chế độ Product Showcase tự động chuyển nét từ mặt sang sản phẩm khi bạn đưa đồ vật gần camera.
- **Giá tham khảo cả combo:** Khoảng ~76.000.000đ (Đã bao gồm Laptop gaming ASUS, Capture card Elgato Camlink 4K, tripod video Benro, Pin ảo DC-C1 cấp nguồn cả ngày và L-Plate để quay dọc màn hình điện thoại).
- **Phù hợp với:** Các vloggers cá nhân làm review, talkshow nhỏ, hoặc các chủ shop tự livestream một mình tại nhà.

*(Lưu ý: Đây là câu trả lời tự động ở chế độ Demo Offline của Sony Live SOP).*`;
        } else if (lowercaseInput.includes('âm thanh') || lowercaseInput.includes('mic') || lowercaseInput.includes('vang')) {
          reply = `Giải pháp xử lý âm thanh livestream từ chuyên gia Sony Live SOP:

1. **Vấn đề phòng bị vang:**
   - Dán mút tiêu âm hoặc rèm vải dày tại các mảng tường trống đối diện người nói để triệt tiêu sóng âm phản xạ.
   - Tránh kê bàn livestream sát tường gạch phẳng.
2. **Lựa chọn Microphone:**
   - **Sony ECM-W3S (Không dây):** Cực kỳ tiện lợi cho livestream bán hàng hoặc di chuyển nhiều. Kẹp trực tiếp lên cổ áo giúp thu giọng nói rõ ràng, hạn chế tối đa tiếng ồn xung quanh.
   - **Micro Shotgun Sony ECM-B1M:** Gắn trực tiếp lên hotshoe máy ảnh, lọc âm hướng định hướng phía trước cực tốt mà không cần dây nhợ rườm rà.
   - **Micro Condenser Sony C-80 (Studio):** Chất lượng âm thanh ấm áp, dày dặn chuyên nghiệp. Thích hợp cho phòng live ASMR hoặc talkshow tĩnh ít di chuyển.

*(Lưu ý: Đây là câu trả lời tự động ở chế độ Demo Offline của Sony Live SOP).*`;
        } else {
          reply = `Chào bạn! Tôi là Trợ lý AI của Sony Live SOP.
          
Hiện tại tôi đang hoạt động ở **Chế độ Demo (Offline)**. 

Trong chế độ Demo, tôi có thể trả lời tốt các chủ đề về:
- *Cấu hình livestream bán hàng quần áo / thời trang.*
- *So sánh máy ảnh Sony FX30 và Alpha 7 IV.*
- *Setup livestream 1 góc máy tiết kiệm.*
- *Tư vấn cách chọn mic thu âm livestream.*`;
        }

        setMessages(prev => [
          ...prev,
          {
            role: 'model',
            text: reply,
            timestamp: new Date()
          }
        ]);
        setLoading(false);
      }, 1200);
    }
  };

  // Helper to render simple markdown locally (zero dependencies)
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, lineIdx) => {

      // Handle Headers
      if (line.startsWith('### ')) {
        return <h4 key={lineIdx} className="text-sm font-bold text-white mt-4 mb-2">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={lineIdx} className="text-md font-bold text-white mt-4 mb-2">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={lineIdx} className="text-lg font-bold text-white mt-5 mb-3">{line.replace('# ', '')}</h2>;
      }

      // Handle Lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const listContent = line.substring(2);
        return (
          <li key={lineIdx} className="ml-4 list-disc text-white/80 text-xs leading-relaxed my-1">
            {parseInlineStyle(listContent)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        const listContent = line.replace(/^\d+\.\s/, '');
        return (
          <li key={lineIdx} className="ml-4 list-decimal text-white/80 text-xs leading-relaxed my-1">
            {parseInlineStyle(listContent)}
          </li>
        );
      }

      // Handle Table Rows (simple markdown tables)
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.includes('---')) return null; // skip divider
        const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        const isHeader = lineIdx === 0 || (messages[messages.length - 1]?.text.split('\n')[lineIdx - 1]?.includes('---') ?? false);
        
        return (
          <div key={lineIdx} className={`flex border-b border-white/5 text-xs ${isHeader ? 'font-bold bg-white/5 py-2' : 'py-1.5'}`}>
            {cells.map((cell, cellIdx) => (
              <span key={cellIdx} className="flex-1 px-2 truncate text-white/90">
                {parseInlineStyle(cell)}
              </span>
            ))}
          </div>
        );
      }

      return (
        <p key={lineIdx} className="text-white/80 text-xs leading-relaxed min-h-[1em]">
          {parseInlineStyle(line)}
        </p>
      );
    });
  };

  // Helper to parse bold (**text**) and code (\`text\`) inline
  const parseInlineStyle = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldIdx = remaining.indexOf('**');
      const codeIdx = remaining.indexOf('`');

      if (boldIdx === -1 && codeIdx === -1) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }

      // Determine which tag comes first
      if (boldIdx !== -1 && (codeIdx === -1 || boldIdx < codeIdx)) {
        // Text before bold
        if (boldIdx > 0) {
          parts.push(<span key={key++}>{remaining.substring(0, boldIdx)}</span>);
        }
        const closingBoldIdx = remaining.indexOf('**', boldIdx + 2);
        if (closingBoldIdx !== -1) {
          const boldText = remaining.substring(boldIdx + 2, closingBoldIdx);
          parts.push(<strong key={key++} className="font-bold text-white">{boldText}</strong>);
          remaining = remaining.substring(closingBoldIdx + 2);
        } else {
          parts.push(<span key={key++}>{remaining.substring(boldIdx)}</span>);
          break;
        }
      } else {
        // Text before code
        if (codeIdx > 0) {
          parts.push(<span key={key++}>{remaining.substring(0, codeIdx)}</span>);
        }
        const closingCodeIdx = remaining.indexOf('`', codeIdx + 1);
        if (closingCodeIdx !== -1) {
          const codeText = remaining.substring(codeIdx + 1, closingCodeIdx);
          parts.push(
            <code key={key++} className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-[10px] text-purple-300">
              {codeText}
            </code>
          );
          remaining = remaining.substring(closingCodeIdx + 1);
        } else {
          parts.push(<span key={key++}>{remaining.substring(codeIdx)}</span>);
          break;
        }
      }
    }
    return parts;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] lg:h-[calc(100vh-7rem)] -m-6 lg:-m-12 relative overflow-hidden bg-[#080808]">
      
      {/* Dynamic glow decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[150px] bg-gradient-to-b from-purple-500/10 to-transparent blur-[100px] pointer-events-none"></div>

      {/* Top Header of Chat */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="material-symbols-outlined text-[20px] text-white">assistant</span>
            </div>
            {apiKey.trim() && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#080808]"></div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Trợ Lý Tư Vấn Sản Phẩm</h3>
            <p className="text-[9px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1">
              {apiKey.trim() ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Gemini Online ({selectedModel})
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                  Chế độ Demo (Offline)
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://drive.google.com/drive/project/1TRo0XIKx39IaW_RxVqTwsG_6dZGsv8uj?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 hover:text-purple-300 border border-purple-500/20 hover:border-purple-500/40 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-md shadow-purple-500/5 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            Tài liệu của Sony Trainers
          </a>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white flex items-center gap-1 text-xs font-semibold border border-white/5 bg-white/[0.02]"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Cài đặt AI
          </button>
        </div>
      </div>

      {/* Main Layout: Conversation area + quick suggestions */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 dark-scrollbar relative">
        
        {messages.length === 1 && (
          <div className="max-w-xl mx-auto text-center pt-8 pb-4 space-y-6">
            <span className="material-symbols-outlined text-5xl bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent animate-pulse">
              spatial_tracking
            </span>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Hỏi đáp kỹ thuật & Chọn thiết bị</h2>
              <p className="text-xs text-white/50 leading-relaxed max-w-sm mx-auto">
                Nhập câu hỏi của bạn hoặc sử dụng một trong các chủ đề gợi ý nhanh dưới đây để bắt đầu tư vấn.
              </p>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto pt-2">
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(s.text)}
                  className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-purple-500/20 text-left hover:bg-white/[0.04] transition-all duration-300 group flex items-start gap-3 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px] text-purple-400/80 group-hover:text-purple-400 transition-colors">
                    {s.icon}
                  </span>
                  <span className="text-xs text-white/70 group-hover:text-white font-medium leading-normal">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 1 && (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade`}>
                  <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold ${
                      isUser
                        ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                        : 'bg-gradient-to-tr from-purple-600 to-blue-500 text-white'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {isUser ? 'person' : 'assistant'}
                      </span>
                    </div>

                    {/* Chat Bubble Container */}
                    <div className="space-y-1">
                      <div className={`rounded-2xl px-4 py-3 border transition-all duration-300 ${
                        isUser
                          ? 'bg-blue-500/10 border-blue-500/20 text-white/90 shadow-[0_4px_15px_rgba(59,130,246,0.05)]'
                          : 'bg-[#121212]/90 border-white/5 text-white/95 shadow-md hover:border-purple-500/10'
                      }`}>
                        <div className="space-y-2">
                          {isUser ? <p className="text-xs leading-relaxed">{msg.text}</p> : renderMarkdown(msg.text)}
                        </div>
                      </div>

                      {/* Grounding Citations */}
                      {!isUser && msg.groundingMetadata?.groundingChunks?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 px-1">
                          <span className="text-[9px] text-white/40 flex items-center gap-1 w-full">
                            <span className="material-symbols-outlined text-[12px]">link</span>
                            Nguồn tham khảo:
                          </span>
                          {msg.groundingMetadata.groundingChunks.map((chunk: any, chunkIdx: number) => {
                            if (chunk?.web?.uri) {
                              return (
                                <a
                                  key={chunkIdx}
                                  href={chunk.web.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/5 text-[9px] text-purple-400 hover:text-purple-300 hover:bg-white/[0.06] transition-all"
                                >
                                  <span className="truncate max-w-[150px]">{chunk.web.title || chunk.web.uri}</span>
                                </a>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                      
                      {/* Timestamp */}
                      <p className={`text-[8px] text-white/20 px-1 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start animate-fade">
                <div className="flex gap-3 max-w-[85%] items-start">
                  <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-tr from-purple-600 to-blue-500 text-white animate-spin">
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                  </div>
                  <div className="bg-[#121212] border border-white/5 rounded-2xl px-4 py-3.5 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}

      </div>

      {/* Bottom Message Input Box */}
      <div className="px-6 py-4 border-t border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl shrink-0 z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(input);
          }}
          className="max-w-3xl mx-auto flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={loading ? 'Vui lòng chờ AI phản hồi...' : 'Hỏi trợ lý Sony Live SOP về sản phẩm...'}
            disabled={loading}
            className="flex-1 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 rounded-2xl px-5 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500/40 transition-all"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              loading || !input.trim()
                ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                : 'bg-gradient-to-tr from-purple-600 to-blue-500 hover:from-purple-700 hover:to-blue-600 text-white shadow-lg shadow-purple-500/10 active:scale-95'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] font-bold">send</span>
          </button>
        </form>
      </div>

      {/* Settings Modal overlay */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade">
          <div className="bg-[#121212] border border-white/10 rounded-[32px] p-6 max-w-lg w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] dark-scrollbar">
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h4 className="text-md font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-purple-400">smart_toy</span>
                Cấu hình Kết nối Gemini AI
              </h4>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">


              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Model / Phiên bản AI</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Nhanh & Tối ưu - Mặc định)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Thông minh & Chuyên sâu)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Tốc độ cao)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#181818] border border-white/5">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer" htmlFor="toggle-search">
                    <span className="material-symbols-outlined text-[16px] text-purple-400">travel_explore</span>
                    Tìm kiếm Google thời gian thực
                  </label>
                  <p className="text-[9px] text-white/40">Cho phép AI tìm thông tin trực tiếp từ website Sony Alpha Vietnam</p>
                </div>
                <input
                  type="checkbox"
                  id="toggle-search"
                  checked={useSearch}
                  onChange={(e) => setUseSearch(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-[#181818] text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center pl-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Chỉ dẫn hệ thống (System Prompt)</label>
                  <button
                    type="button"
                    onClick={() => setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION)}
                    className="text-[9px] text-purple-400 hover:underline"
                  >
                    Khôi phục mặc định
                  </button>
                </div>
                <textarea
                  rows={8}
                  placeholder="Nhập vai trò của AI, thông tin sản phẩm và quy tắc tư vấn..."
                  value={systemInstruction}
                  onChange={(e) => setSystemInstruction(e.target.value)}
                  className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-3 text-[11px] leading-relaxed text-white focus:outline-none focus:border-purple-500/40 dark-scrollbar"
                />
                <p className="text-[9px] text-white/30 pl-1">
                  Bạn có thể dán toàn bộ quy định hoặc cấu hình dự án Gemini từ Google Drive của bạn vào khung này để AI hoạt động đúng ý bạn.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-tr from-purple-600 to-blue-500 text-white font-bold text-xs rounded-xl hover:from-purple-700 hover:to-blue-600 active:scale-95 transition-all shadow-lg shadow-purple-500/10"
                >
                  Lưu thiết lập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
