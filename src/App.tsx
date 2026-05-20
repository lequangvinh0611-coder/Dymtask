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

  const renderContent = () => {
    const role = (profile?.role || 'master').toString().toUpperCase().trim();
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
        return <AuditLog key="audit" />;
      case 'SETTINGS':
        return <Settings key="settings" />;
      default:
        return <div>Select a tab</div>;
    }
  };

  const userRole = (profile?.role || 'master').toString().toUpperCase().trim();

  return (
    <div className="h-screen w-full flex bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full p-2 bg-slate-50/50">
        <header className="flex items-center justify-between mb-2 shrink-0 px-2">
          <div className="flex items-center gap-2">
            <h1 
              className="text-sm font-bold text-slate-700 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
              onClick={() => useAppStore.getState().triggerRefresh()}
              title="Click to refresh data"
            >
              {activeTab}
            </h1>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
