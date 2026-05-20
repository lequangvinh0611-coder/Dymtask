import React, { useEffect, useState, useMemo } from 'react';
import { 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  RotateCw,
  TrendingUp,
  TrendingDown,
  CalendarDays
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DateRangePicker } from './ui/DateRangePicker';

// Interface matching the single 'tasks' table schema
interface Task {
  id: string;
  title: string | null;
  description: string | null;
  task_type: string | null; // e.g. 'Daily', 'Weekly', 'Monthly', 'Spot'
  status: string;           // 'New', 'Done', 'Skipped'
  is_active: boolean;
  est_time: number;         // in minutes
  actual_time: number;      // in minutes
  created_at: string;
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Date range filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Fetch all tasks from the single table
  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, description, task_type, status, is_active, est_time, actual_time, created_at')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setTasks(data || []);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu tasks:', err);
      setError(err?.message || 'Không thể kết nối đến Supabase database. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Filter tasks based on Date Range
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.created_at) return true;
      const taskDate = task.created_at.split('T')[0];
      
      if (startDate && taskDate < startDate) {
        return false;
      }
      if (endDate && taskDate > endDate) {
        return false;
      }
      return true;
    });
  }, [tasks, startDate, endDate]);

  // Compute stats metrics based on filtered tasks
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'Done').length;
    const skipped = filteredTasks.filter(t => t.status === 'Skipped').length;
    const pending = filteredTasks.filter(t => t.status === 'New' || !t.status).length;
    
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const totalEst = filteredTasks.reduce((acc, t) => acc + (t.est_time || 0), 0);
    const totalAct = filteredTasks.reduce((acc, t) => acc + (t.actual_time || 0), 0);

    return {
      total,
      completed,
      skipped,
      pending,
      completionRate,
      totalEst,
      totalAct
    };
  }, [filteredTasks]);

  // Helper function to format minutes into "Xh Ym"
  const formatDuration = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  // Check if actual time exceeds est_time
  const isOvertime = stats.totalAct > stats.totalEst;
  const maxBarValue = Math.max(stats.totalEst, stats.totalAct, 1);
  const estPercent = (stats.totalEst / maxBarValue) * 100;
  const actPercent = (stats.totalAct / maxBarValue) * 100;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-auto p-4 sm:p-6 space-y-6">
      
      {/* Upper sub-header bar containing date filter and refresh button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5 bg-white p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-6 bg-indigo-600 rounded-full inline-block"></span>
            BẢNG THỐNG KÊ MVP
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
            Tổng quan hiệu suất công việc và thời gian hoạt động thực tế
          </p>
        </div>
        
        {/* Date Filter & Control Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            className="w-full sm:w-auto"
          />
          
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 h-8 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 disabled:opacity-50 text-xs font-bold rounded-lg transition-all border border-indigo-100 uppercase tracking-wider cursor-pointer active:scale-95 w-full sm:w-auto"
            title="Làm mới dữ liệu từ Supabase"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Đang cập nhật...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Error handling */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-3 shadow-md">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">Cảnh báo lỗi!</span>
            <span className="text-xs text-rose-600/90">{error}</span>
          </div>
        </div>
      )}

      {/* Main Stats Loading or Content Grid */}
      {loading && tasks.length === 0 ? (
        /* Skeletons loader */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 bg-white border border-slate-100 rounded-xl p-5" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
            <div className="h-64 bg-white border border-slate-100 rounded-xl" />
            <div className="h-64 bg-white border border-slate-100 rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          {/* Block 1 - Overview Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            
            {/* Card 1: Total Tasks */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng công việc</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">
                  {stats.total}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1.5 tracking-wider">
                  Đầu việc được lọc
                </p>
              </div>
            </div>

            {/* Card 2: Done Tasks */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hoàn thành</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-black text-emerald-600 tracking-tight leading-none">
                  {stats.completed}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1.5 tracking-wider">
                  Trạng thái 'Done'
                </p>
              </div>
            </div>

            {/* Card 3: Skipped Tasks */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã bỏ qua</span>
                <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-black text-slate-600 tracking-tight leading-none">
                  {stats.skipped}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1.5 tracking-wider">
                  Trạng thái 'Skipped'
                </p>
              </div>
            </div>

            {/* Card 4: New Tasks */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đang chờ</span>
                <div className="p-2 bg-amber-50 text-amber-500 rounded-lg">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-black text-amber-500 tracking-tight leading-none">
                  {stats.pending}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1.5 tracking-wider">
                  Trạng thái 'New'
                </p>
              </div>
            </div>

            {/* Card 5: Duration Summaries */}
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dự kiến vs Thật</span>
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded bg-slate-300" title="Dự kiến"></span>
                  <span className={`w-2 h-2 rounded ${isOvertime ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} title="Thật"></span>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Dự kiến:</span>
                    <span className="text-xs font-bold text-slate-700">{formatDuration(stats.totalEst)}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-0.5 border-t border-slate-50 pt-0.5">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Thực tế:</span>
                    <span className={`text-base font-black ${isOvertime ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatDuration(stats.totalAct)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Block 2 - Visual Progress & Analytics (Performance) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Column Left: Work Progress & Status Rates */}
            <div className="bg-white shadow rounded-lg p-6 flex flex-col justify-between border border-slate-100">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-emerald-500 rounded-full inline-block"></span>
                  Tiến độ công việc (Work Progress)
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                  Tỷ lệ hoàn thành công việc dựa trên số lượng Task đạt trạng thái 'Done'
                </p>
              </div>

              {/* Progress visual section */}
              <div className="my-6 space-y-5">
                
                {/* Visual completion display */}
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-4xl font-black text-slate-800 tracking-tight">
                      {stats.completionRate}%
                    </span>
                    <span className="text-xs font-semibold text-slate-400 uppercase ml-2 tracking-wider">
                      Hoàn thành
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">
                    {stats.completed} / {stats.total} Tasks
                  </span>
                </div>

                {/* Progress Bar built solely with Tailwind divs */}
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${stats.completionRate}%` }} 
                  />
                </div>

                {/* Status-specific breakdown tags with customized color indicators */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-50">
                  
                  {/* Done Stat */}
                  <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/40 text-center">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Hoàn thành</span>
                    <span className="block text-lg font-black text-emerald-600 mt-1">{stats.completed}</span>
                    <span className="text-[9px] font-bold text-slate-400">Tasks</span>
                  </div>

                  {/* Skipped Stat */}
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/40 text-center">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Bỏ qua</span>
                    <span className="block text-lg font-black text-slate-500 mt-1">{stats.skipped}</span>
                    <span className="text-[9px] font-bold text-slate-400">Tasks</span>
                  </div>

                  {/* New Stat */}
                  <div className="bg-indigo-50/30 p-3 rounded-lg border border-indigo-100/30 text-center">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Đang chờ</span>
                    <span className="block text-lg font-black text-amber-500 mt-1">{stats.pending}</span>
                    <span className="text-[9px] font-bold text-slate-400">Tasks</span>
                  </div>

                </div>

              </div>
              
              <div className="p-3 bg-slate-50 rounded-lg text-[11px] font-medium text-slate-600 border border-slate-100">
                💡 <span className="font-extrabold text-slate-700">Gợi ý MVP:</span> Hoàn thành lần lượt những đầu việc đang chờ để cải thiện tỷ lệ này tốt hơn. Các task bị bỏ qua (Skipped) không được đưa vào tỷ lệ hoàn thành.
              </div>
            </div>

            {/* Column Right: Time Management - Estimated vs Actual */}
            <div className="bg-white shadow rounded-lg p-6 flex flex-col justify-between border border-slate-100">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-indigo-600 rounded-full inline-block"></span>
                  Quản lý Thời gian (Time Management)
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                  So sánh thời lượng ước lượng ban đầu (Est) và thời lượng hoạt động thật sự (Act)
                </p>
              </div>

              {/* Progress bars that compare items */}
              <div className="my-6 space-y-4">
                
                {/* Estimated Time Indicator */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-slate-400"></span>
                      Thời gian dự kiến (EST)
                    </span>
                    <span className="font-extrabold text-slate-700">{formatDuration(stats.totalEst)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-slate-400 h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${estPercent}%` }}
                    />
                  </div>
                </div>

                {/* Actual Time Indicator */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded ${isOvertime ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                      Thời gian thực tế (ACT)
                    </span>
                    <span className={`font-black ${isOvertime ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatDuration(stats.totalAct)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden animate-pulse-subtle">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        isOvertime 
                          ? 'bg-gradient-to-r from-rose-500 to-red-600' 
                          : 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                      }`}
                      style={{ width: `${actPercent}%` }}
                    />
                  </div>
                </div>

                {/* Smart feedback on budget variance */}
                <div className="pt-3 border-t border-slate-50">
                  {stats.totalEst === 0 && stats.totalAct === 0 ? (
                    <div className="text-center p-2.5 text-[11px] font-bold bg-slate-50 text-slate-400 rounded-lg">
                      Không có thông tin dự kiến hay thực tế nào được cấu hình
                    </div>
                  ) : isOvertime ? (
                    <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg">
                      <div className="p-1 rounded-full bg-rose-100 text-rose-600 mt-0.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[11px]">
                        <p className="font-extrabold text-rose-900 leading-none">Vượt quá thời gian dự tính!</p>
                        <p className="text-rose-700 mt-1">
                          Tổng thực tế đang vượt mốc kế hoạch {formatDuration(stats.totalAct - stats.totalEst)}. Cần cân đối các đầu việc tiếp theo.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg">
                      <div className="p-1 rounded-full bg-emerald-100 text-emerald-600 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-[11px]">
                        <p className="font-extrabold text-emerald-950 leading-none">Năng suất được kiểm soát!</p>
                        <p className="text-emerald-700 mt-1">
                          Bạn đã tiết kiệm được khoảng {formatDuration(stats.totalEst - stats.totalAct)} so với dự tính. Quá xuất sắc!
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              <div className="text-[10px] font-bold text-slate-400 uppercase text-right tracking-widest bg-slate-50 p-2 rounded-lg">
                Độ sai lệch: {stats.totalEst > 0 ? Math.round((Math.abs(stats.totalAct - stats.totalEst) / stats.totalEst) * 100) : 0}%
              </div>
            </div>

          </div>

          {/* List layout summary table strictly based on single tables */}
          {filteredTasks.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6 border border-slate-100">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                    DANH SÁCH CÔNG VIỆC TRONG KHOẢNG LỌC ({filteredTasks.length})
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase">
                    Chi tiết công việc và trạng thái thời gian được ghi nhận
                  </p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] h-8 text-slate-400 font-black uppercase tracking-wider border-b border-slate-100">
                      <th className="px-4">Tiêu đề</th>
                      <th className="px-4">Phân loại</th>
                      <th className="px-4">Trạng thái</th>
                      <th className="px-4">Dự kiến</th>
                      <th className="px-4">Thực tế</th>
                      <th className="px-4 text-right">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 border-b border-slate-100">
                    {filteredTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors h-11">
                        <td className="px-4 font-bold text-slate-800 max-w-[220px] truncate">{t.title || 'Không có tiêu đề'}</td>
                        <td className="px-4">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                            {t.task_type || 'SPOT'}
                          </span>
                        </td>
                        <td className="px-4">
                          {t.status === 'Done' ? (
                            <span className="text-[9px] font-black tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">DONE</span>
                          ) : t.status === 'Skipped' ? (
                            <span className="text-[9px] font-black tracking-wider text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">SKIPPED</span>
                          ) : (
                            <span className="text-[9px] font-black tracking-wider text-amber-500 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">NEW</span>
                          )}
                        </td>
                        <td className="px-4 font-semibold text-slate-600 font-mono">{formatDuration(t.est_time)}</td>
                        <td className={`px-4 font-bold font-mono ${t.actual_time > t.est_time ? 'text-rose-500' : 'text-slate-700'}`}>
                          {formatDuration(t.actual_time)}
                        </td>
                        <td className="px-4 text-right text-slate-400 font-mono text-[11px]">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString('vi-VN') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
