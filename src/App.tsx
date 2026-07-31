import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';

// Lazy loading section components
const GearSection = lazy(() => import('./components/GearSection').then(m => ({ default: m.GearSection })));
const LightingSection = lazy(() => import('./components/LightingSection').then(m => ({ default: m.LightingSection })));
const SoftwareSection = lazy(() => import('./components/SoftwareSection').then(m => ({ default: m.SoftwareSection })));
const ChecklistSection = lazy(() => import('./components/ChecklistSection').then(m => ({ default: m.ChecklistSection })));
const TroubleshootingSection = lazy(() => import('./components/TroubleshootingSection').then(m => ({ default: m.TroubleshootingSection })));
const FAQSection = lazy(() => import('./components/FAQSection').then(m => ({ default: m.FAQSection })));
const ContentAISystem = lazy(() => import('./components/ContentAISystem').then(m => ({ default: m.ContentAISystem })));
const SmartPricingSystem = lazy(() => import('./components/SmartPricingSystem').then(m => ({ default: m.SmartPricingSystem })));
const ProductAdvisor = lazy(() => import('./components/ProductAdvisor').then(m => ({ default: m.ProductAdvisor })));
const LivestreamShowcasePage = lazy(() => import('./pages/LivestreamShowcasePage').then(m => ({ default: m.LivestreamShowcasePage })));

export type TabId = 'gear' | 'lighting' | 'software' | 'checklist' | 'trouble' | 'showcase' | 'faq' | 'content_ai' | 'pricing' | 'advisor';

// Loading fallback spinner matching ColorLab 2.0 OLED aesthetic
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full bg-[#040406]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin"></div>
      <span className="eyebrow text-[10px] text-white/40 tracking-[0.2em]">Đang tải hệ thống SOP...</span>
    </div>
  </div>
);

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <div className="analog-film-grain" />
      <Layout>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Showcase page rendered directly inside layout container without scrolling wrapper */}
            <Route path="/showcase" element={
              <LivestreamShowcasePage onExit={() => navigate('/gear')} />
            } />
            
            {/* All other sections wrapped inside the standard scrollable view with fade-in animations */}
            <Route path="*" element={
              <div className="w-full h-full overflow-y-auto dark-scrollbar px-6 py-8 lg:px-12 lg:py-10">
                <div className="animate-fade-in w-full" key={location.pathname}>
                  <Routes>
                    <Route path="/gear" element={<GearSection />} />
                    <Route path="/lighting" element={<LightingSection />} />
                    <Route path="/software" element={<SoftwareSection />} />
                    <Route path="/checklist" element={<ChecklistSection />} />
                    <Route path="/trouble" element={<TroubleshootingSection />} />
                    <Route path="/faq" element={<FAQSection />} />
                    <Route path="/content-ai" element={<ContentAISystem />} />
                    <Route path="/pricing" element={<SmartPricingSystem />} />
                    <Route path="/advisor" element={<ProductAdvisor />} />
                    <Route path="/" element={<Navigate to="/gear" replace />} />
                    <Route path="*" element={<Navigate to="/gear" replace />} />
                  </Routes>
                </div>
              </div>
            } />
          </Routes>
        </Suspense>
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

