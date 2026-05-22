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
  const { activeTab, setActiveTab, theme, setTheme, isSidebarOpen, setSidebarOpen } = useAppStore();
  const { profile, signOut } = useAuthStore();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  const menuItems: { id: AppState['activeTab']; icon: any; roles: string[]; label: string }[] = [
    { id: 'TO-DO LIST', icon: ClipboardList, roles: ['master', 'admin', 'user'], label: 'To-do list' },
    { id: 'TASK MANAGER', icon: ClipboardList, roles: ['master', 'admin', 'user'], label: 'Task manager' },
    { id: 'DASHBOARD', icon: LayoutDashboard, roles: ['master', 'admin', 'user'], label: 'Dashboard' },
    { id: 'AUDIT LOG', icon: History, roles: ['master', 'admin'], label: 'Audit log' },
    { id: 'SETTINGS', icon: SettingsIcon, roles: ['master', 'admin'], label: 'Settings' },
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
    <>
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity animate-in fade-in duration-200" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}
      <aside className={cn(
        "w-56 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-full shrink-0 fixed md:static inset-y-0 left-0 transition-transform duration-300 z-50 md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      <div className="p-4 flex items-center gap-2.5 border-b border-slate-800">
        <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center text-white font-semibold text-sm">
          D
        </div>
        <span className="font-semibold text-base text-white tracking-tight">Dymtask MVP</span>
      </div>

      <nav className="flex-1 px-2.5 mt-3 space-y-0.5">
        {filteredMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all group",
              activeTab === item.id 
                ? "bg-indigo-600 text-white font-semibold" 
                : "hover:bg-slate-800 hover:text-white text-slate-400"
            )}
          >
            <item.icon className={cn("w-4 h-4 shrink-0", activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
            <span>{item.label}</span>
            {activeTab === item.id && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-65" />}
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto space-y-4">
        <div className="bg-slate-800/30 rounded-md p-3 border border-slate-850">
          <p className="text-xs font-medium text-slate-500 mb-2">System theme</p>
          <div className="flex gap-1.5">
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  "w-5 h-5 rounded-full border transition-all",
                  t.color,
                  theme === t.id ? "border-white ring-2 ring-indigo-500/50" : "border-slate-700 hover:border-slate-500"
                )}
              />
            ))}
          </div>
        </div>

        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-full flex items-center gap-2.5 p-2 bg-slate-800/20 rounded-md border border-slate-805 hover:bg-slate-800/40 transition-colors group text-left"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-semibold shadow-inner text-xs">
              {profile?.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{profile?.name || 'Loading...'}</p>
              <p className="text-xs text-slate-500 font-medium truncate">{profile?.role || 'user'}</p>
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute left-full bottom-0 ml-3 w-64 bg-slate-850 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 animate-in slide-in-from-left-2 duration-200 flex flex-col space-y-3">
              {/* Basic Info */}
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-200 truncate">{profile?.name || 'Loading...'}</p>
                <p className="text-[11px] font-normal text-slate-400 truncate">{profile?.email || 'N/A'}</p>
              </div>

              {/* Details (darker background box) */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium font-sans">Chức vụ</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase",
                    (profile?.role || 'user').toString().toLowerCase().trim() === 'master' 
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                      : (profile?.role || 'user').toString().toLowerCase().trim() === 'admin' 
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  )}>
                    {profile?.role || 'user'}
                  </span>
                </div>

                {profile?.team_ids && profile.team_ids.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/60">
                    <p className="text-[10px] text-slate-500 mb-1.5 font-medium font-sans">Phòng ban tham gia:</p>
                    <div className="flex gap-1 flex-wrap">
                      {profile.team_ids.map((teamId: string) => (
                        <span key={teamId} className="px-1.5 py-0.5 rounded bg-slate-850 text-slate-300 font-bold text-[9px] border border-slate-750">
                          {teamId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Signout Button */}
              <div className="pt-2 border-t border-slate-800">
                <button 
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
