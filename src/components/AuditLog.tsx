import React, { useEffect, useState } from 'react';
import { Search, Trash2, Info, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { AuditLog as AuditLogType } from '../types/database.types';

const AuditLog = () => {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchTerm) {
        query = query.or(`action.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [searchTerm]);

  const getActionColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (act.includes('UPDATE')) return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    if (act.includes('DELETE') || act.includes('REMOVE')) return 'bg-rose-50 text-rose-600 border-rose-100';
    if (act.includes('RESET')) return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  }

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Delete this log entry?')) return;
    const { error } = await supabase.from('audit_logs').delete().eq('id', id);
    if (!error) fetchLogs();
  };

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">Audit Log</h2>
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-bold rounded">LIVE</span>
        </div>
        <div className="flex items-center gap-3">
           <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search history..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 shadow-sm"
            />
          </div>
          <input type="date" className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600 shadow-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p className="text-sm font-medium">Fetching history...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">ACTION</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">DESCRIPTION</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">USER</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">TIME</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black border uppercase",
                        getActionColor(log.action)
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700 text-sm whitespace-pre-wrap max-w-md">{log.description}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 uppercase font-black tracking-tight">{log.user_name || 'System'}</td>
                    <td className="px-6 py-4 text-[10px] text-slate-400 font-mono italic">
                        {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors bg-white hover:bg-slate-50 rounded border border-slate-100 shadow-sm">
                          <Info className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors bg-white hover:bg-slate-50 rounded border border-slate-100 shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400 italic text-sm">
                    No history found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-1 bg-slate-50/30">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-black shadow-lg shadow-indigo-200">1</button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 text-xs font-bold transition-colors">2</button>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AuditLog;
