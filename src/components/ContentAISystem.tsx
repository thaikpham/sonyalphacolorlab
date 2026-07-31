import { useState, useEffect } from 'react';
import { GEMINI_API_KEY, DEFAULT_MODEL } from '../config';

const SonyCategories = [
  { id: 'vlog', label: 'Vlogging Cameras', examples: 'ZV-1 II, ZV-E10 II, ZV-1F' },
  { id: 'alpha', label: 'Alpha Mirrorless', examples: 'A7 IV, A7S III, A6700' },
  { id: 'cinema', label: 'Cinema Line', examples: 'FX3, FX30, FX6' },
  { id: 'lens', label: 'Lenses (G Master)', examples: '24-70mm GM II, 50mm GM' },
  { id: 'audio', label: 'Audio & Mic', examples: 'ECM-M1, C-80, ECM-LV1' },
];

export const ContentAISystem: React.FC = () => {
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState(SonyCategories[0].id);
  const [purpose, setPurpose] = useState('sales');
  const [tone, setTone] = useState('professional');
  
  const [result, setResult] = useState<{ title: string; caption: string; script: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Dynamic Settings
  const [apiKey, setApiKey] = useState(() => {
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [useSearch, setUseSearch] = useState(() => {
    const saved = localStorage.getItem('gemini_use_search');
    return saved === null ? true : saved === 'true';
  });

  // Sync settings and migrate on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key') || GEMINI_API_KEY;
    let savedModel = localStorage.getItem('gemini_model') || DEFAULT_MODEL;
    const savedSearch = localStorage.getItem('gemini_use_search');
    let migrated = false;
    if (savedModel === 'gemini-1.5-flash') {
      savedModel = 'gemini-2.5-flash';
      migrated = true;
    } else if (savedModel === 'gemini-1.5-pro') {
      savedModel = 'gemini-2.5-pro';
      migrated = true;
    }
    if (migrated) {
      localStorage.setItem('gemini_model', savedModel);
    }
    setApiKey(savedKey);
    setSelectedModel(savedModel);
    setUseSearch(savedSearch === null ? true : savedSearch === 'true');
  }, []);

  const handleGenerate = async () => {
    if (!productName.trim()) return;
    
    setLoading(true);
    setResult(null);
    setErrorMsg(null);
    
    const categoryLabel = SonyCategories.find(c => c.id === category)?.label || '';
    const purposeLabel = purpose === 'sales' ? 'Chốt đơn bán hàng' : purpose === 'review' ? 'Đánh giá/Review sản phẩm' : 'Hướng dẫn sử dụng/Kỹ thuật';
    const toneLabel = tone === 'professional' ? 'Chuyên gia thuyết phục' : tone === 'energetic' ? 'Năng động, cuốn hút' : 'Thân thiện, gần gũi';

    const fallbackTitle = `🔥 ${productName} — ${purposeLabel} Livestream Đỉnh Cao!`;
    const fallbackCaption = `✨ ${productName} từ ${categoryLabel} — Giải pháp hoàn hảo cho Livestream chuyên nghiệp!\n\n🎯 Tính năng lấy nét tự động, màu sắc da tự nhiên và tối ưu hóa âm thanh vượt trội.\n📸 Chất lượng hình ảnh chuyên nghiệp giúp thu hút người xem hơn.\n\n💥 Đặt hàng ngay hôm nay để nhận ưu đãi đặc biệt từ Sony Live SOP!\n\n#Sony #${productName.replace(/\s+/g, '')} #Livestream #ContentCreator #SonyVietnam`;
    const fallbackScript = `[MỞ ĐẦU - 30 giây]\n"Xin chào các bạn! Hôm nay mình sẽ giới thiệu đến các bạn ${productName} — một sản phẩm ${categoryLabel} tuyệt vời từ Sony!"\n\n[ĐIỂM NHẤN 1 - Thiết kế & Chất lượng]\n"${productName} sở hữu thiết kế nhỏ gọn nhưng cực kỳ chắc chắn. Chất lượng build rất premium, xứng đáng với thương hiệu Sony."\n\n[ĐIỂM NHẤN 2 - Tính năng AI]\n"Điểm mình thích nhất là tính năng Eye-AF — lấy nét vào mắt cực kỳ nhạy. Kết hợp với Product Showcase, bạn có thể chuyển nét mượt mà từ mặt sang sản phẩm."\n\n[ĐIỂM NHẤN 3 - Trải nghiệm thực tế]\n"Màu da Sony cực đẹp tự nhiên, hồng hào và sắc nét từng chi tiết."\n\n[KÊU GỌI HÀNH ĐỘNG]\n"Đừng bỏ lỡ cơ hội sở hữu ${productName} với giá ưu đãi đặc biệt chỉ có trong buổi Live hôm nay! Comment ngay để được tư vấn nhé!"`;

    // Local settings fallbacks
    const activeKey = apiKey || localStorage.getItem('gemini_api_key') || GEMINI_API_KEY;
    const activeModel = selectedModel || localStorage.getItem('gemini_model') || DEFAULT_MODEL;

    // Guard: Bypassing real network request if API Key is not set
    if (!activeKey.trim()) {
      setTimeout(() => {
        setResult({
          title: fallbackTitle,
          caption: fallbackCaption,
          script: fallbackScript
        });
        setLoading(false);
      }, 1000);
      return;
    }

    try {
      const prompt = `Bạn là trợ lý AI sáng tạo kịch bản cho Sony Việt Nam. 
Hãy tạo Tiêu đề, Caption mạng xã hội và Kịch bản livestream chi tiết cho sản phẩm sau:
- Tên sản phẩm: "${productName}"
- Phân loại danh mục: "${categoryLabel}"
- Mục đích buổi livestream: "${purposeLabel}"
- Tông giọng trình bày: "${toneLabel}"

Yêu cầu xuất ra cấu hình JSON hợp lệ chứa 3 trường dữ liệu sau (và KHÔNG bao gồm bất cứ phần văn bản giải thích nào khác ngoài JSON, không bao gồm ký tự \`\`\`json ở đầu hay cuối):
{
  "title": "Tiêu đề livestream thu hút ngắn gọn kèm biểu tượng cảm xúc",
  "caption": "Mô tả chi tiết đăng mạng xã hội, có gạch đầu dòng các điểm nổi bật và các hashtag phù hợp như #Sony #Livestream #ContentCreator",
  "script": "Kịch bản chi tiết chia thành các phần cụ thể: [MỞ ĐẦU - 30 giây], [ĐIỂM NHẤN 1 - Tính năng chính], [ĐIỂM NHẤN 2 - Trải nghiệm thực tế], [KÊU GỌI HÀNH ĐỘNG - Chốt đơn]"
}`;

      const requestBody: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
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
        `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        let errText = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData?.error?.message) {
            errText = errData.error.message;
          }
        } catch (_) {}
        throw new Error(errText);
      }

      const data = await response.json();
      const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const cleanJson = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      setResult({
        title: parsed.title || fallbackTitle,
        caption: parsed.caption || fallbackCaption,
        script: parsed.script || fallbackScript
      });

    } catch (error: any) {
      console.error("AI Generation failed, falling back to local generator:", error);
      setErrorMsg(error.message || String(error));
      
      setResult({
        title: fallbackTitle,
        caption: fallbackCaption,
        script: fallbackScript
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 animate-fade pb-20">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold shimmer-text">AI Content Generator</h2>
        <p className="text-white/50 text-sm max-w-xl flex items-center gap-2 flex-wrap">
          Tự động hóa kịch bản livestream và caption chuẩn Sony.
          {apiKey.trim() ? (
            <span className="text-green-400/80 text-xs font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              (Đang kết nối qua Gemini API - {selectedModel})
            </span>
          ) : (
            <span className="text-orange-400/80 text-xs font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              (Chế độ Demo - Offline)
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-[32px] p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#969696] uppercase tracking-widest pl-1">Sản phẩm Sony</label>
              <input 
                type="text"
                placeholder="VD: Sony ZV-E10 II"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#969696] uppercase tracking-widest pl-1">Danh mục</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all appearance-none cursor-pointer"
              >
                {SonyCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#969696] uppercase tracking-widest pl-1">Mục đích</label>
                <select 
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-white/30 appearance-none"
                >
                  <option value="sales">Chốt đơn</option>
                  <option value="review">Review</option>
                  <option value="tech_tutorial">Hướng dẫn</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-[#969696] uppercase tracking-widest pl-1">Tông giọng</label>
                <select 
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-white/30 appearance-none"
                >
                  <option value="professional">Chuyên gia</option>
                  <option value="energetic">Năng động</option>
                  <option value="friendly">Gần gũi</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={loading || !productName}
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                loading ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200 active:scale-95'
              }`}
            >
              <span className={`material-symbols-outlined font-bold ${loading ? 'animate-spin' : ''}`}>
                {loading ? 'sync' : 'bolt'}
              </span>
              {loading ? 'Đang sáng tạo...' : 'Tạo Kịch Bản AI'}
            </button>
          </div>

          <div className="bg-purple-600/10 border border-purple-500/20 rounded-3xl p-6">
            <h4 className="text-xs font-bold text-purple-400 mb-2 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">info</span>
              Sony Knowledge Base
            </h4>
            <p className="text-[11px] text-purple-200/60 leading-relaxed italic">
              AI được huấn luyện để hiểu về Product Showcase, S-Cinetone, Eye-AF và các thông số chuyên biệt chỉ có trên máy ảnh Sony.
            </p>
          </div>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2 space-y-6">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400 flex items-start gap-2 animate-fade">
              <span className="material-symbols-outlined text-[16px] mt-0.5">warning</span>
              <div>
                <p className="font-bold">Lỗi kết nối Gemini API:</p>
                <p className="opacity-90">{errorMsg}</p>
                <p className="opacity-60 mt-1">Đã tự động chuyển đổi sang nội dung Demo cục bộ dưới đây. Vui lòng kiểm tra lại cấu hình API Key và Model trong tab Trợ Lý Tư Vấn.</p>
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="h-full min-h-[400px] border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center text-center p-12 opacity-40">
              <span className="material-symbols-outlined text-6xl mb-4">smart_toy</span>
              <p className="text-lg font-medium">Nhập tên sản phẩm Sony<br/>để bắt đầu sáng tạo nội dung</p>
            </div>
          )}

          {loading && (
            <div className="h-full min-h-[400px] bg-white/5 rounded-[40px] border border-white/10 p-12 space-y-8 animate-pulse">
              <div className="h-8 bg-white/10 rounded-full w-1/3"></div>
              <div className="space-y-3">
                <div className="h-4 bg-white/5 rounded-full w-full"></div>
                <div className="h-4 bg-white/5 rounded-full w-5/6"></div>
                <div className="h-4 bg-white/5 rounded-full w-4/6"></div>
              </div>
              <div className="h-32 bg-white/10 rounded-3xl w-full"></div>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-fade">
              {/* Title Section */}
              <div className="bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 group relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Tiêu đề Livestream</span>
                  <button 
                    onClick={() => copyToClipboard(result.title, 'title')}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] text-white/40">
                      {copied === 'title' ? 'done' : 'content_copy'}
                    </span>
                  </button>
                </div>
                <h3 className="text-2xl font-bold text-white">{result.title}</h3>
              </div>

              {/* Caption Section */}
              <div className="bg-[#1a1a1a] border border-white/10 rounded-[32px] p-8 group relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Caption Mạng Xã Hội</span>
                  <button 
                    onClick={() => copyToClipboard(result.caption, 'caption')}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] text-white/40">
                      {copied === 'caption' ? 'done' : 'content_copy'}
                    </span>
                  </button>
                </div>
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{result.caption}</p>
              </div>

              {/* Script Section */}
              <div className="bg-gradient-to-br from-[#1a1a1a] to-black border border-white/10 rounded-[32px] p-8 group relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Kịch bản chi tiết</span>
                    <div className="px-2 py-0.5 bg-green-500/10 rounded text-[9px] text-green-400 font-bold uppercase tracking-tighter">AI Expert View</div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(result.script, 'script')}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] text-white/40">
                      {copied === 'script' ? 'done' : 'content_copy'}
                    </span>
                  </button>
                </div>
                <div className="prose prose-invert max-w-none">
                  <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap font-medium">
                    {result.script}
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <p className="text-[10px] text-white/20 italic">
                  {apiKey.trim() && !errorMsg
                    ? `Nội dung được tạo bởi Gemini AI (${selectedModel})`
                    : `Nội dung được tạo bởi AI Demo (Offline)`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
