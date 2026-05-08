import React from 'react';
import { supabase } from '../../lib/supabase';
import { motion } from 'motion/react';

const Login = () => {
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    try {
      const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const redirectUrl = baseUrl.replace(/\/$/, '');
      
      console.log('[Auth] Google Login Start');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Login error detail:', {
        message: error.message,
        code: error.code,
        status: error.status
      });
      setErrorMsg(error.message || 'Đã xảy ra lỗi khi đăng nhập.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0F172A] relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900 rounded-full blur-[120px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md p-8"
      >
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-3xl shadow-2xl flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-6 ring-4 ring-indigo-500/20">
            D
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Dym Task Tool</h1>
          <p className="text-slate-400 text-sm mb-10 leading-relaxed max-w-[280px]">
            Professional task management & project tracking system.
          </p>

          {errorMsg && (
            <div className="w-full mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold">
              Error: {errorMsg}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            className="w-full group relative flex items-center justify-center gap-3 bg-white text-slate-900 py-4 px-6 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-[0.98]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            <span>Continue with Google</span>
          </button>

          <footer className="mt-10 pt-8 border-t border-white/5 w-full flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-4">Secured by</span>
            <div className="flex items-center gap-2 grayscale opacity-40">
                <img src="https://supabase.com/dashboard/img/supabase-logo.svg" className="h-5" alt="Supabase" />
                <span className="text-white font-bold text-xs">Supabase Auth</span>
            </div>
          </footer>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-slate-600 text-[10px] uppercase tracking-widest font-bold">
            &copy; 2026 DYM Vietnam. All rights reserved.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
