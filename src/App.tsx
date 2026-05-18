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
  const { activeTab, theme } = useAppStore();
  const { session, profile, loading, setSession, setProfile, fetchProfile, setLoading } = useAuthStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[App] Auth Event: ${event}`);
      if (!mounted) return;

      if (session) {
        setSession(session);
        // ✅ FIX: Bỏ qua TOKEN_REFRESHED để tránh ghi đè role từ DB bằng fallback
        if (event !== 'TOKEN_REFRESHED') {
          await fetchProfile(session.user.id);
        }
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
    const role = (profile?.role || 'USER').toString().toUpperCase().trim();
    const isUser = role === 'USER';

    const normalizedActiveTab = activeTab.toString().toUpperCase().trim();

    switch (normalizedActiveTab) {
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

  const userRole = (profile?.role || 'GUEST').toString().toUpperCase().trim();

  return (
    <div className="h-screen w-full flex bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full p-4 bg-slate-50/50">
        <header className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeTab}
            </h1>
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

        <footer className="mt-4 flex items-center justify-end text-[10px] text-slate-400 font-medium shrink-0">
          <div className="flex items-center gap-4">
            <span>DYM Task System</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
