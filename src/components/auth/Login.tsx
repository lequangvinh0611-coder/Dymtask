import React, { useState, useEffect } from 'react';
import { supabase, isMockSupabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { motion } from 'motion/react';
import { ShieldCheck, Mail, ArrowRight, ShieldAlert, KeyRound, Info } from 'lucide-react';

const Login: React.FC = () => {
  const { error: authError, setError: setAuthError, initializeAuth } = useAuthStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (authError) {
      setErrorMsg(authError);
    }
  }, [authError]);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setAuthError(null);
    
    // Fallback for mock environment if they click Google Login
    if (isMockSupabase) {
      console.log('[Auth] Google Login clicked in Mock mode. Logging in with Admin.');
      await handleFastLogin('admin@dymtask.com');
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const redirectUrl = baseUrl.replace(/\/$/, '');
      
      console.log('[Auth] Google Login Start with Redirect URL:', redirectUrl);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Login error detail:', error);
      setErrorMsg(error.message || 'Đã xảy ra lỗi khi đăng nhập với Google Auth.');
    }
  };

  const handleFastLogin = async (email: string) => {
    setErrorMsg(null);
    setAuthError(null);
    setLoadingEmail(email);
    
    try {
      console.log(`[Login] Simulated fast login for whitelist email: ${email}`);
      // Using signInWithOtp in mock mode as simulated in supabase.ts
      const { error } = await (supabase.auth as any).signInWithOtp({ email });
      if (error) throw error;
    } catch (err: any) {
      console.error('Mock login exception:', err);
      setErrorMsg(err.message || 'Lỗi mô phỏng đăng nhập.');
    } finally {
      setLoadingEmail(null);
    }
  };

  const PRESET_USERS = [
    { email: 'admin@dymtask.com', label: 'Master (Full Permissions)', role: 'master', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    { email: 'a.nguyen@dymtask.com', label: 'Admin (Manage Tools, No Users)', role: 'admin', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    { email: 'b.tran@dymtask.com', label: 'User (Read Task, Disable Modifies)', role: 'user', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0F172A] relative overflow-y-auto py-12 px-4 selection:bg-indigo-500/20 select-none">
      {/* Ambient background glow dots */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900 rounded-full blur-[140px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 sm:p-10 rounded-3xl shadow-2xl flex flex-col items-center">
          
          {/* Logo Badge */}
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shadow-indigo-600/20 mb-5 relative overflow-hidden group">
            <span className="relative z-10">D</span>
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">Dym Task Tool</h1>
          <p className="text-slate-400 text-xs sm:text-sm mb-8 text-center max-w-[320px] leading-relaxed">
            Professional workflow & template task delivery network.
          </p>

          {/* Dynamic Whitelist/Access Warning Messages */}
          {errorMsg && (
            <div className="w-full mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs flex items-start gap-3 justify-start text-left shrink-0 animate-shake">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-300">Từ chối truy cập (Access Denied)</p>
                <p className="leading-relaxed opacity-90">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Core Actions Box */}
          <div className="w-full space-y-6">
            
            {/* Standard Google Sign In */}
            <div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full relative flex items-center justify-center gap-3 bg-white text-slate-900 py-3.5 px-6 rounded-2xl font-bold text-slate-800 text-xs hover:bg-slate-50 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Đăng nhập qua Google (Live Auth)</span>
              </button>
            </div>

            {/* Quick whitelist switchers for Mock evaluation */}
            {isMockSupabase && (
              <div className="pt-6 border-t border-white/10 space-y-4">
                <div className="flex items-center gap-2 justify-center text-slate-400">
                  <KeyRound size={14} className="text-indigo-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Mô phỏng Whitelist & RBAC</span>
                </div>
                
                <p className="text-[11px] text-slate-500 text-center leading-normal max-w-[340px] mx-auto">
                  Dự án đang chạy chế độ Local Mockup. Hãy click chọn Email Whitelist dưới đây để lập tức trải nghiệm các phân quyền Master, Admin, User:
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {PRESET_USERS.map((user) => (
                    <button
                      key={user.email}
                      type="button"
                      disabled={loadingEmail !== null}
                      onClick={() => handleFastLogin(user.email)}
                      className="w-full flex items-center justify-between p-3.5 bg-white/[0.03] border border-white/5 hover:border-white/15 hover:bg-white/[0.06] rounded-xl transition-all cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-indigo-500 group"
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">{user.email}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase ${user.color}`}>
                            {user.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">{user.label}</p>
                      </div>
                      <ArrowRight size={13} className="text-slate-500 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                    </button>
                  ))}
                </div>

                {/* Simulated Custom Whitelist Input */}
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl space-y-3 mt-4">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] font-semibold">
                    <Info size={12} className="text-indigo-400" />
                    <span>Thử nghiệm Custom Whitelist Email:</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="Nhập email bất kỳ..."
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!customEmail.trim()) return;
                        handleFastLogin(customEmail.trim());
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Kiểm tra
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-500 leading-normal">
                    * Nếu email không có trong danh sách Master Data (bảng users của dym_users), hệ thống sẽ từ chối truy cập và hiện thông báo lỗi.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Secure Branding Footer */}
          <footer className="mt-8 pt-8 border-t border-white/5 w-full flex flex-col items-center">
            <span className="text-[10px] text-slate-600 font-bold tracking-wider uppercase mb-3">Secured Identity System</span>
            <div className="flex items-center gap-2 grayscale brightness-75 opacity-40">
              <img src="https://supabase.com/dashboard/img/supabase-logo.svg" className="h-4.5" alt="Supabase" />
              <span className="text-white font-extrabold text-[11px]">Supabase Auth</span>
            </div>
          </footer>
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-slate-600 text-xs font-bold font-sans">
            &copy; 2026 DYM Vietnam. All rights reserved.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
