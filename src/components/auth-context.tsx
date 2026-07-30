'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type UserProfile = {
  name: string;
  email: string;
  avatarUrl: string;
};

type AuthContextType = {
  user: UserProfile | null;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  loginWithGoogle: (email?: string, name?: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'colorlab_user_profile';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [inputEmail, setInputEmail] = useState('');
  const [inputName, setInputName] = useState('');

  // Hydrate user session from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const loginWithGoogle = (emailParam?: string, nameParam?: string) => {
    const email = (emailParam || inputEmail || 'user@gmail.com').trim().toLowerCase();
    const name = (nameParam || inputName || email.split('@')[0] || 'Sony Creator');
    
    // Generate avatar using UI-Avatars or Dicebear for reliable display
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&bold=true`;

    const profile: UserProfile = { name, email, avatarUrl };
    setUser(profile);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage errors
    }
    setIsLoginModalOpen(false);
    setInputEmail('');
    setInputName('');
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        loginWithGoogle,
        logout,
      }}
    >
      {children}

      {/* Google Login Modal Dialog */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm font-sans animate-fade-in">
          <div
            className="w-full max-w-md glass p-6 rounded-2xl border border-white/15 shadow-2xl bg-void/90 flex flex-col gap-5 text-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-login-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <h3 id="google-login-title" className="text-base font-bold text-white">
                  Đăng nhập với Google (Gmail)
                </h3>
              </div>
              <button
                type="button"
                onClick={closeLoginModal}
                className="text-white/50 hover:text-white text-lg font-bold p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Đóng modal"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Đăng nhập tài khoản Google để tham gia bình luận, đăng đề xuất công thức và vote trái tim cho cộng đồng Sony Alpha.
            </p>

            {/* Simulated Google Fast Login Button */}
            <button
              type="button"
              onClick={() => loginWithGoogle('alpha.creator@gmail.com', 'Sony Alpha Creator')}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-md cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Tiếp tục với alpha.creator@gmail.com</span>
            </button>

            <div className="relative flex items-center justify-center my-1">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-void px-3 text-[10px] text-white/40 uppercase tracking-widest absolute">
                Hoặc nhập Gmail khác
              </span>
            </div>

            {/* Custom Email Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputEmail.trim()) loginWithGoogle();
              }}
              className="flex flex-col gap-3"
            >
              <div>
                <label htmlFor="auth-email-input" className="block text-xs text-white/70 mb-1">
                  Địa chỉ Gmail
                </label>
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  placeholder="vi-du@gmail.com"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  className="w-full rounded-xl bg-black/60 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 border border-white/15 focus:outline-none focus:border-white/40 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="auth-name-input" className="block text-xs text-white/70 mb-1">
                  Tên hiển thị (Tùy chọn)
                </label>
                <input
                  id="auth-name-input"
                  type="text"
                  placeholder="Ví dụ: Hoàng Nhiếp Ảnh"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full rounded-xl bg-black/60 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 border border-white/15 focus:outline-none focus:border-white/40 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="mt-1 py-2.5 px-4 rounded-xl bg-white/15 text-white font-semibold text-xs hover:bg-white/25 transition-all cursor-pointer"
              >
                Xác nhận Đăng Nhập
              </button>
            </form>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
