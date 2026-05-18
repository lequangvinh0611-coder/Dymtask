import React, { useEffect, useState } from 'react';
import { Search, Trash2, Info, ChevronRight, Loader2, History, AlertCircle, RotateCw, ChevronLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { AuditLog as AuditLogType } from '../types/database.types';

const AuditLog = () => {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const pageSize = 15;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.or(`action.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [searchTerm, page]);

  const getActionColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE')) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (act.includes('UPDATE')) return 'bg-primary-light text-primary border-primary/20';
    if (act.includes('DELETE') || act.includes('REMOVE')) return 'bg-rose-50 text-rose-600 border-rose-100';
    if (act.includes('RESET')) return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-slate-50 text-slate-500 border-slate-200';
  }

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Delete this log entry?')) return;
    const { error } = await supabase.from('audit_logs').delete().eq('id', id);
    if (!error) fetchLogs();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 flex items-center justify-between bg-white shrink-0 border-b border-slate-100">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Audit Log</h2>
        <div className="flex items-center gap-3">
           <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search history..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-600 transition-all font-medium w-64 h-8"
            />
          </div>
          <div className="relative group">
            <input type="date" className="bg-slate-50 border border-slate-200 rounded-lg text-xs px-3 h-8 text-slate-500 font-bold" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[900px] table-fixed">
          <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-2 w-[15%] text-[9px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
              <th className="px-6 py-2 w-[35%] text-[9px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
              <th className="px-6 py-2 w-[20%] text-[9px] font-bold text-slate-400 uppercase tracking-widest">User</th>
              <th className="px-6 py-2 w-[15%] text-[9px] font-bold text-slate-400 uppercase tracking-widest">Time</th>
              <th className="px-6 py-2 w-[10%] text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right pr-10">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-6 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-widest",
                      getActionColor(log.action)
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <p className="font-bold text-slate-700 text-[11px] truncate" title={log.description}>{log.description}</p>
                  </td>
                  <td className="px-6 py-3">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{log.user_name || 'System Auto'}</span>
                  </td>
                  <td className="px-6 py-3">
                       <span className="text-[10px] font-bold text-slate-400 font-mono">
                         {new Date(log.created_at).toLocaleDateString()} - {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>
                  </td>
                  <td className="px-6 py-3 text-right pr-10">
                    <div className="flex items-center justify-end gap-2">
                      <button className="text-slate-300 hover:text-indigo-600 transition-all">
                        <Info size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-slate-200 hover:text-rose-600 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-24 text-center">
                   <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">No forensic data</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center justify-center gap-1">
          <button className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-50 rounded"><ChevronLeft size={14} /></button>
          {[1, 2, 3, 4, 5].map(p => (
            <button key={p} className={cn(
                "w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold",
                p === 1 ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-100"
            )}>{p}</button>
          ))}
          <button className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-50 rounded"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
};

export default AuditLog;
