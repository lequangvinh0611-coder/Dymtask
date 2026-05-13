import React, { useEffect, useState } from 'react';
import { Search, Trash2, Info, ChevronRight, Loader2, History, AlertCircle, RotateCw } from 'lucide-react';
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
        .limit(50);

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
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden m-6 font-sans">
      <div className="p-6 border-b border-slate-100 bg-white shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-2xl">
            <History className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Security Audit Logs</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Stream Protected</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search event history..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium w-72"
            />
          </div>
          <button onClick={fetchLogs} className="p-2.5 text-slate-400 hover:text-primary transition-all rounded-xl hover:bg-primary-light">
            <RotateCw size={18} className={cn(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
            <Loader2 className="animate-spin mb-4 text-primary" size={32} />
            <p className="text-[10px] font-black uppercase tracking-widest">Synchronizing Events...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Action Sequence</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Event Context</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Initiator</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Timestamp</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest",
                        getActionColor(log.action)
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-bold text-slate-700 text-sm whitespace-pre-wrap max-w-lg leading-relaxed">{log.description}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">
                          {log.user_name?.[0] || 'S'}
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{log.user_name || 'System Auto'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-600 font-mono italic">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <button className="p-2.5 text-slate-400 hover:text-primary transition-all bg-white hover:bg-primary-light rounded-xl shadow-sm border border-slate-100">
                          <Info className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-2.5 text-slate-300 hover:text-rose-600 transition-all bg-white hover:bg-rose-50 rounded-xl shadow-sm border border-slate-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                      <AlertCircle size={48} className="opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">No forensic data found in registry</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historical Event Persistence Module</p>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-900 text-white text-[10px] font-black shadow-lg shadow-black/10">1</button>
          <button className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 text-[10px] font-black transition-colors">2</button>
          <button className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-300 hover:text-primary hover:bg-primary-light transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLog;
