import React from 'react';
import { Search, UserPlus, MoreHorizontal, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

const Settings = () => {
  const users = [
    { name: 'VINH LE QUANG', email: 'le-v@dymvietnam.jp', team: '内部', role: 'MASTER', status: 'ACTIVE' },
    { name: 'VU THANH HIEN', email: 'hien-v@dymvietnam.net', team: 'GS', role: 'ADMIN', status: 'ACTIVE' },
    { name: 'LAM THANH TRUC', email: 'truc-l@dymvietnam.net', team: 'ラボ型', role: 'ADMIN', status: 'ACTIVE' },
    { name: 'PHAM BAO THIEN VUONG', email: 'vuong-p@dymvietnam.net', team: 'ラボ型', role: 'ADMIN', status: 'ACTIVE' },
    { name: 'TRUONG THI HA', email: 'ha-t@dymvietnam.net', team: '内部', role: 'ADMIN', status: 'ACTIVE' },
    { name: 'NGUYEN VY THANH TRUC', email: 'truc-n@dymvietnam.net', team: '内部・1課', role: 'ADMIN', status: 'ACTIVE' },
    { name: 'NGUYEN TRA VY', email: 'vy-n@dymvietnam.net', team: '内部・2課A', role: 'ADMIN', status: 'ACTIVE' },
    { name: 'NGUYEN DOAN THUY THUC QUYEN', email: 'quyen-n@dymvietnam.net', team: 'GS', role: 'USER', status: 'ACTIVE' },
    { name: 'TRAN HANH DINH DINH', email: 'dinh-tran@dymvietnam.net', team: 'GS', role: 'USER', status: 'ACTIVE' },
  ];

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'MASTER': return 'bg-rose-50 text-rose-500 border-rose-100';
      case 'ADMIN': return 'bg-sky-50 text-sky-500 border-sky-100';
      default: return 'bg-amber-50 text-amber-500 border-amber-100';
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['USERS', 'PROJECTS', 'TEAMS', 'TAGS'].map((tab) => (
               <button 
                key={tab}
                className={cn(
                    "px-6 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all",
                    tab === 'USERS' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
               >
                 {tab}
               </button> 
            ))}
        </div>
        <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                type="text" 
                placeholder="Search..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                />
            </div>
            <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600">
                <option>All Teams</option>
            </select>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200">
                <PlusIcon className="w-4 h-4" />
                <span>User</span>
             </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
         <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">NAME / EMAIL</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">TEAMS</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">ROLE</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">STATUS</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{user.name}</span>
                    <span className="text-xs text-slate-400">{user.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-400 rounded text-[10px] font-bold uppercase">{user.team}</span>
                </td>
                <td className="px-6 py-4 text-center">
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold border",
                        getRoleColor(user.role)
                    )}>
                        {user.role}
                    </span>
                </td>
                <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-100">
                        {user.status}
                    </span>
                </td>
                <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

       <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-center gap-1">
         {[1, 2, 3, 4, 5].map((p, i) => (
            <button 
                key={i} 
                className={cn(
                "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold",
                p === 1 ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                )}
            >
                {p}
            </button>
        ))}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const PlusIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
)

export default Settings;
