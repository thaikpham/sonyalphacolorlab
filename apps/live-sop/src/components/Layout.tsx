import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TabId } from '../App';
import { Icon, type IconName } from './Icon';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Map route path to TabId
  const path = location.pathname.substring(1);
  const activeTab = (path === 'content-ai' ? 'content_ai' : path) || 'gear';

  const onTabChange = (tab: TabId) => {
    const targetPath = tab === 'content_ai' ? 'content-ai' : tab;
    navigate(`/${targetPath}`);
  };

  interface NavItem {
    id: TabId;
    label: string;
    icon: IconName;
    sub: string;
    highlight?: boolean;
  }

  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: "Quy trình Setup Livestream (Staff Only)",
      items: [
        { id: 'gear', label: '1. Hệ Thống Combo Sony', icon: 'photo_camera', sub: 'Đề Xuất & Thiết Bị' },
        { id: 'lighting', label: '2. Thiết Lập Ánh Sáng', icon: 'flare', sub: '3-Point & WB Gray Card' },
        { id: 'software', label: '3. OBS & Âm Thanh', icon: 'terminal', sub: 'Routing & Cấu Hình Luồng' },
        { id: 'checklist', label: '4. Checklist Vận Hành', icon: 'assignment_turned_in', sub: 'Kiểm Tra Trước Khi Live' },
        { id: 'trouble', label: '5. Khắc Phục Sự Cố', icon: 'build', sub: 'Cẩm Nang Sửa Lỗi Nhanh' },
      ]
    },
    {
      title: "Trợ Lý AI & Báo Giá",
      items: [
        { id: 'advisor', label: 'Trợ Lý Wiki Sony AI', icon: 'assistant', sub: 'Tra Cứu Hình Ảnh & Âm Thanh', highlight: true },
        { id: 'content_ai', label: 'Sáng Tạo Kịch Bản AI', icon: 'psychology_alt', sub: 'Gemini Scripting', highlight: true },
        { id: 'pricing', label: 'Báo Giá Thông Minh', icon: 'receipt_long', sub: 'Smart Invoice & PDF', highlight: true },
        { id: 'faq', label: 'Góc Tri Thức FAQ', icon: 'psychology', sub: 'Kỹ Thuật Thực Chiến' },
        { id: 'showcase', label: 'Sony Showcase Tour', icon: 'auto_awesome', sub: 'Virtual Experience' },
      ]
    }
  ];

  const allItems = sections.flatMap(s => s.items);
  const currentTab = allItems.find(t => t.id === activeTab);

  return (
    <div className="flex h-screen w-screen bg-[#040406] overflow-hidden text-[var(--color-ink)] font-sans">
      {/* Sidebar */}
      <div className="w-[280px] lg:w-[320px] border-r border-white/[0.08] flex flex-col shrink-0 bg-[#040406]/90 backdrop-blur-2xl z-20">
        <div className="p-8 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-danger shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-danger animate-ping opacity-75"></div>
            </div>
            <span className="eyebrow text-[10px] text-white/50 tracking-[0.25em]">Master Console</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Sony <span className="y2k-chrome-text font-bold italic">Live SOP</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-6 overflow-y-auto dark-scrollbar pb-6">
          {sections.map((section, secIdx) => (
            <div key={secIdx} className="space-y-2">
              <span className="eyebrow text-[9px] text-white/40 tracking-[0.2em] pl-4 block">
                {section.title}
              </span>
              <div className="space-y-1.5">
                {section.items.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id as TabId)}
                    className={`w-full group flex items-center gap-4 px-4 py-3.5 rounded-[var(--radius-glass)] transition-all duration-300 relative ${
                      activeTab === tab.id 
                      ? 'glass text-white shadow-[0_4px_25px_rgba(0,0,0,0.5)] border-white/20' 
                      : 'text-white/60 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <Icon name={tab.icon} className={`text-[24px] transition-all duration-300 ${activeTab === tab.id ? 'scale-110 text-success-soft' : 'group-hover:text-white/80'} ${tab.highlight && activeTab !== tab.id ? 'text-accent-mid/70' : ''}`} />
                    <div className="flex flex-col items-start text-left">
                      <span className={`text-[13px] font-bold tracking-wide transition-colors ${activeTab === tab.id ? 'text-white' : 'group-hover:text-white/90'} ${tab.highlight && activeTab !== tab.id ? 'text-accent-soft/90' : ''}`}>{tab.label}</span>
                      <span className="eyebrow text-[9px] opacity-40 font-semibold tracking-tight">{tab.sub}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

      </div>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col min-w-0 bg-[#040406]">
        {/* Dynamic Top Header */}
        <div className="h-20 lg:h-24 px-6 lg:px-12 flex items-center justify-between border-b border-white/[0.08] bg-[#040406]/85 backdrop-blur-2xl z-10 shrink-0">
          <div className="flex items-center gap-4">
            <Icon name={currentTab?.icon ?? 'photo_camera'} className="text-success-soft text-2xl" />
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{currentTab?.label}</h2>
              <p className="eyebrow text-[10px] text-white/40 tracking-widest">{currentTab?.sub}</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="eyebrow text-[9px] text-white/40 tracking-tighter">Resolution</span>
              <span className="tabular text-[11px] font-bold text-white/80">1080x1920 @ 60FPS</span>
            </div>
            <div className="w-px h-8 bg-white/[0.08]"></div>
            <div className="flex items-center gap-2 px-4 py-2 glass-flat rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-success-soft"></div>
              <span className="eyebrow text-[10px] text-white/80">Standard Workflow</span>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

