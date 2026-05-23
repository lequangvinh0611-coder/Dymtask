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
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Toaster } from 'sonner';
import { Menu, Loader2 } from 'lucide-react';

import { cn } from './lib/utils';

export default function App() {
  const { activeTab, theme, confirmDialog, hideConfirm } = useAppStore();
  const { session, profile, loading, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Make useAppStore globally accessible for our ProtectedRoute redirect backup action
  useEffect(() => {
    (window as any).useAppStore = useAppStore;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900 rounded-full blur-[120px]"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
          <h1 className="text-white font-bold text-sm tracking-widest uppercase animate-pulse">DYMTASK MVP</h1>
          <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase">Đang đồng bộ phiên làm việc bảo mật...</p>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <>
        <Toaster richColors position="bottom-right" />
        <Login />
      </>
    );
  }

  const renderContent = () => {
    const normalizedActiveTab = activeTab.toString().toUpperCase().trim();

    switch (normalizedActiveTab) {
      case 'TO-DO LIST':
        return <TaskList key="todo" title="To-do List" />;
      case 'TASK MANAGER':
        return <TaskManager key="manager" />;
      case 'DASHBOARD':
        return <Dashboard key="dashboard" />;
      case 'AUDIT LOG':
        return (
          <ProtectedRoute allowedRoles={['master', 'admin']}>
            <AuditLog key="audit" />
          </ProtectedRoute>
        );
      case 'SETTINGS':
        return (
          <ProtectedRoute allowedRoles={['master', 'admin']}>
            <Settings key="settings" />
          </ProtectedRoute>
        );
      default:
        return <div>Select a tab</div>;
    }
  };

  const userRole = (profile?.role || 'master').toString().toUpperCase().trim();

  return (
    <div className="h-screen w-full flex bg-slate-50 overflow-hidden font-sans">
      <Toaster 
        richColors 
        position="bottom-right" 
        theme="light" 
        closeButton 
        toastOptions={{
          className: 'border border-slate-200 shadow-lg rounded-lg',
        }}
      />
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0 h-full p-2 bg-slate-50/50">
        <header className="flex items-center justify-between mb-1.5 shrink-0 px-3 mt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => useAppStore.getState().setSidebarOpen(true)}
              className="md:hidden p-1 mr-1 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-200/60 focus:outline-none transition-colors cursor-pointer"
              aria-label="Open Sidebar"
            >
              <Menu size={18} />
            </button>
            <h1 
              className="text-sm font-semibold text-slate-800 cursor-pointer hover:text-indigo-600 transition-all"
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

      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={hideConfirm}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", duration: 0.25 }}
              className="bg-white border border-slate-100 rounded-xl shadow-2xl p-5 max-w-sm w-full relative z-10 select-none text-left"
            >
              <h3 className="text-sm font-semibold text-slate-800 mb-1.5">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDialog.onCancel) confirmDialog.onCancel();
                    hideConfirm();
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-semibold cursor-pointer transition-colors"
                >
                  {confirmDialog.cancelText || 'Hủy'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmDialog.onConfirm();
                    hideConfirm();
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold cursor-pointer transition-colors"
                >
                  {confirmDialog.confirmText || 'Xác nhận'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
