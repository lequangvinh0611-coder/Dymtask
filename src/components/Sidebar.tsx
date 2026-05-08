import React from 'react';
import { useAppStore, AppState } from '../types';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';
import { 
  ClipboardList, 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  History, 
  User as UserIcon,
  LogOut,
  ChevronRight
} from 'lucide-react';

const Sidebar = () => {
  const { activeTab, setActiveTab } = useAppStore();
  const { profile, signOut } = useAuthStore();

  const menuItems: { id: AppState['activeTab']; icon: any; roles: string[] }[] = [
    { id: 'TO-DO LIST', icon: ClipboardList, roles: ['master', 'admin', 'user'] },
    { id: 'TASK MANAGER', icon: ClipboardList, roles: ['master', 'admin', 'user'] },
    { id: 'DASHBOARD', icon: LayoutDashboard, roles: ['master', 'admin', 'user'] },
    { id: 'AUDIT LOG', icon: History, roles: ['master', 'admin'] },
    { id: 'SETTINGS', icon: SettingsIcon, roles: ['master', 'admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(profile?.role || 'user')
  );

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col h-full shrink-0 relative z-20 shadow-2xl shadow-indigo-900/20">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
          D
        </div>
        <span className="font-bold text-xl text-white tracking-tight">Dym Task Tool</span>
      </div>

      <nav className="flex-1 px-4 mt-4 space-y-1">
        {filteredMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
              activeTab === item.id 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                : "hover:bg-slate-800 hover:text-white"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-white")} />
            <span>{item.id}</span>
            {activeTab === item.id && <ChevronRight className="ml-auto w-4 h-4 opacity-50" />}
          </button>
        ))}
      </nav>

      <div className="p-6 mt-auto">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 backdrop-blur-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">APPEARANCE</p>
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white ring-2 ring-indigo-600 ring-offset-2 ring-offset-[#0F172A]"></div>
            <div className="w-6 h-6 rounded-full bg-emerald-600 border-2 border-slate-700"></div>
            <div className="w-6 h-6 rounded-full bg-indigo-900 border-2 border-slate-700"></div>
            <div className="w-6 h-6 rounded-full bg-rose-600 border-2 border-slate-700"></div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 p-2.5 bg-slate-800/30 rounded-xl border border-white/5">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-inner">
            {profile?.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{profile?.name || 'Loading...'}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide truncate">{profile?.role || 'user'}</p>
          </div>
          <button 
            onClick={() => signOut()}
            className="text-slate-500 hover:text-rose-500 transition-colors px-2 py-2"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
