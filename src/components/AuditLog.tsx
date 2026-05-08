import React from 'react';
import { Search, Trash2, Info, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

const AuditLog = () => {
  const logs = [
    { action: 'RESET TASK', desc: 'Task Reset to New', user: 'VINH LE QUANG', time: '2026/04/29 - 11:30', detailId: '19' },
    { action: 'CREATE TEAM', desc: 'Created team: GS', user: 'VINH LE QUANG', time: '2026/04/29 - 10:53' },
    { action: 'CREATE TEAM', desc: 'Created team: 内部・3課', user: 'VINH LE QUANG', time: '2026/04/29 - 10:53' },
    { action: 'UPDATE TEAM', desc: 'Updated team: 内部・1課', user: 'VINH LE QUANG', time: '2026/04/29 - 10:53', detailId: '2' },
    { action: 'CREATE TEAM', desc: 'Created team: 内部・2課F', user: 'VINH LE QUANG', time: '2026/04/29 - 10:53' },
    { action: 'UPDATE USER', desc: 'Updated user: LE QUANG VINH 2', user: 'VINH LE QUANG', time: '2026/04/29 - 09:38', detailId: '3' },
    { action: 'CREATE TEMPLATE', desc: 'Created template: TEST1', user: 'VINH LE QUANG', time: '2026/04/29 - 08:19', detailId: '2' },
    { action: 'UPDATE TAG', desc: 'Updated tag: VIEWS to VIEW', user: 'LE QUANG VINH 2', time: '2026/04/29 - 08:18', detailId: '2' },
    { action: 'CREATE PROJECT', desc: 'Created project: ABC3', user: 'LE QUANG VINH 2', time: '2026/04/29 - 08:17' },
  ];

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (action.includes('UPDATE')) return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    if (action.includes('RESET')) return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Audit Log</h2>
        <div className="flex items-center gap-3">
           <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search history..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <input type="date" className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600" />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">ACTION</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">DESCRIPTION</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">USER</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">TIME</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">DETAIL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold border",
                    getActionColor(log.action)
                  )}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-slate-700 text-sm">{log.desc}</td>
                <td className="px-6 py-4 text-sm text-slate-500 uppercase font-medium">{log.user}</td>
                <td className="px-6 py-4 text-xs text-slate-400 font-mono italic">
                    {log.time}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {log.detailId && (
                      <span className="w-5 h-5 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold">
                        {log.detailId}
                      </span>
                    )}
                    <button className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors">
                      <Info className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-1 bg-white">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-semibold">1</button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 text-xs font-semibold">2</button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AuditLog;
