import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from './types';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';
import Sidebar from './components/Sidebar';
import TaskList from './components/TaskList';
import AuditLog from './components/AuditLog';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import Login from './components/auth/Login';
import TaskManager from './pages/TaskManager';

import { cn } from './lib/utils';

export default function App() {
  const { activeTab } = useAppStore();
  const { session, profile, loading, setSession, setProfile, fetchProfile, setLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mounted) return;
        
        if (currentSession) {
          setSession(currentSession);
          await fetchProfile(currentSession.user.id);
        } else {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('[App] Auth Init Error:', err);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[App] Auth Event: ${event}`);
      
      if (!mounted) return;

      if (session) {
        setSession(session);
        await fetchProfile(session.user.id);
      } else {
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const renderContent = () => {
    const role = profile?.role || 'user';
    const isUser = role === 'user';

    switch (activeTab) {
      case 'TO-DO LIST':
        return <TaskList key="todo" title="To-do List" />;
      case 'TASK MANAGER':
        return <TaskManager key="manager" />;
      case 'DASHBOARD':
        return <Dashboard key="dashboard" />;
      case 'AUDIT LOG':
        if (isUser) return <TaskList key="todo" title="To-do List" />;
        return <AuditLog key="audit" />;
      case 'SETTINGS':
        if (isUser) return <TaskList key="todo" title="To-do List" />;
        return <Settings key="settings" />;
      default:
        return <div>Select a tab</div>;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0F172A]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-mono text-[10px] uppercase tracking-widest animate-pulse">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="h-screen w-full flex bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full p-6 bg-slate-50/50">
        <header className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {activeTab}
            </h1>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 text-[10px] font-bold uppercase tracking-widest">
              Live Preview
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Role:</span>
               <span className={cn(
                 "text-[10px] font-black uppercase px-2 py-0.5 rounded border",
                 profile?.role === 'master' ? "text-rose-600 bg-rose-50 border-rose-100" : 
                 profile?.role === 'admin' ? "text-sky-600 bg-sky-50 border-sky-100" :
                 "text-amber-600 bg-amber-50 border-amber-100"
               )}>
                 {profile?.role || 'Guest'}
               </span>
            </div>
            <div className="h-8 w-px bg-slate-200 mx-2"></div>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
              Schema: Supabase V1.2
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-6 flex items-center justify-between text-[11px] text-slate-400 font-medium shrink-0">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Supabase Instance: Active (asia-southeast1)
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Type-Safe Enums Generated
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Server Time: {new Date().toLocaleTimeString()}</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">v1.2.5-prod</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
