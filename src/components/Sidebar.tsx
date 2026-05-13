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
  const { activeTab, setActiveTab, theme, setTheme } = useAppStore();
  const { profile, signOut } = useAuthStore();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

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

  const themes: { id: AppState['theme']; color: string }[] = [
    { id: 'indigo', color: 'bg-indigo-600' },
    { id: 'emerald', color: 'bg-emerald-600' },
    { id: 'slate', color: 'bg-slate-800' },
    { id: 'rose', color: 'bg-rose-600' },
  ];

  return (
    <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col h-full shrink-0 relative z-20 shadow-2xl shadow-indigo-900/20">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
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
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
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
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">SYSTEM THEME</p>
          <div className="flex gap-2">
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-all",
                  t.color,
                  theme === t.id ? "border-white ring-2 ring-primary ring-offset-2 ring-offset-[#0F172A]" : "border-slate-700 hover:border-slate-500"
                )}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-full flex items-center gap-3 p-2.5 bg-slate-800/30 rounded-xl border border-white/5 hover:bg-slate-800/50 transition-colors group text-left"
          >
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold shadow-inner">
              {profile?.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{profile?.name || 'Loading...'}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide truncate">{profile?.role || 'user'}</p>
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
              <div className="p-4 border-b border-slate-700/50">
                <p className="text-xs font-bold text-slate-400 truncate">{profile?.email}</p>
              </div>
              <div className="p-1">
                <button 
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
