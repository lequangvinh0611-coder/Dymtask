import React, { useEffect, useState } from 'react';
import { Search, Trash2, Info, ChevronRight, Loader2, History, AlertCircle, RotateCw, RotateCcw, ChevronLeft, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../types';
import { AuditLog as AuditLogType } from '../types/database.types';
import { DateRangePicker } from './ui/DateRangePicker';

const AuditLog = () => {
  const { refreshKey } = useAppStore();
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({
    startDate: today,
    endDate: today
  });

  const isFilterChanged = searchTerm !== '' || dateRange.startDate !== today || dateRange.endDate !== today;

  const handleReset = () => {
    setSearchTerm('');
    setDateRange({ startDate: today, endDate: today });
    setPage(1);
  };
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

      if (dateRange.startDate) {
        query = query.gte('created_at', `${dateRange.startDate}T00:00:00`);
      }
      if (dateRange.endDate) {
        query = query.lte('created_at', `${dateRange.endDate}T23:59:59`);
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
  }, [searchTerm, page, dateRange, refreshKey]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getPaginationItems = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

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
      <div className="px-6 py-1 flex items-center justify-start bg-white shrink-0 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
           <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-10 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 focus:outline-none focus:border-indigo-600 transition-all font-medium w-64"
            />
          </div>
          <DateRangePicker 
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            onChange={(start, end) => {
              setDateRange({ startDate: start, endDate: end });
              setPage(1);
            }}
          />
          {isFilterChanged && (
            <button 
              onClick={handleReset} 
              className="p-2 ml-1 text-indigo-600 hover:text-indigo-800 transition-colors"
              title="Reset Filters"
            >
               <RotateCcw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white min-h-[500px]">
        <table className="w-full text-left border-collapse min-w-[900px] table-fixed">
          <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-2 w-[15%] text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Action</th>
              <th className="px-6 py-2 w-[35%] text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Description</th>
              <th className="px-6 py-2 w-[20%] text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">User</th>
              <th className="px-6 py-2 w-[15%] text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Time</th>
              <th className="px-6 py-2 w-[10%] text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right pr-10 bg-slate-50/50">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-all group h-[41px]">
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
      
      <div className="px-4 py-0 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[100px]">TỔNG: {totalCount} ENTITIES</span>
         <div className="flex-1 flex items-center justify-center gap-1">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)} 
              className="px-2 py-1 border border-slate-200 rounded text-xs hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="flex gap-1 mx-2">
              {getPaginationItems().map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => typeof item === 'number' && setPage(item)}
                  disabled={typeof item !== 'number'}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-all",
                    page === item ? "bg-indigo-600 text-white shadow-sm" : 
                    typeof item === 'number' ? "text-slate-400 hover:bg-slate-100" : 
                    "text-slate-300 cursor-default"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)} 
              className="px-2 py-1 border border-slate-200 rounded text-xs hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
         </div>
         <div className="min-w-[100px]"></div>
      </div>
    </div>
  );
};

export default AuditLog;
