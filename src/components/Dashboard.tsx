import React, { useEffect, useState, useMemo } from 'react';
import { 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  AlertCircle, 
  RotateCw,
  Search,
  Filter,
  Check,
  CalendarDays
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Define standard MVP Task interface corresponding to the database columns
interface Task {
  id: string;
  title: string | null;
  description: string | null;
  task_type: string | null; // e.g., 'DAILY', 'WEEKLY', 'MONTHLY', 'ONETIME'
  status: string;           // 'New', 'Done', 'Skipped'
  is_active: boolean;
  est_time: number;         // estimated time in minutes
  actual_time: number;      // actual time in minutes
  created_at: string;
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [activeFilter, setActiveFilter] = useState<string>('ALL'); // 'ALL', 'ACTIVE', 'INACTIVE'

  // Fetch all tasks from Supabase
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
      console.error('Lỗi khi tải dữ liệu thống kê:', err);
      setError(err?.message || 'Không thể lấy dữ liệu từ cơ sở dữ liệu Supabase. Vui lòng kiểm tra lại cấu hình.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Filter tasks locally based on search and type/active filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = !searchQuery || 
        (task.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (task.description?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesType = typeFilter === 'ALL' || task.task_type === typeFilter;
      
      const matchesActive = activeFilter === 'ALL' || 
        (activeFilter === 'ACTIVE' && task.is_active) || 
        (activeFilter === 'INACTIVE' && !task.is_active);

      return matchesSearch && matchesType && matchesActive;
    });
  }, [tasks, searchQuery, typeFilter, activeFilter]);

  // Calculations based on the filtered data set
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

  // Helper to format minutes to "Xh Ym" or just "Ym"
  const formatDuration = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  // Human readable feedback for the completion rate
  const getCompletionFeedback = (rate: number) => {
    if (rate === 100) return { text: 'Tuyệt hảo! Đã hoàn thành 100% tất cả mục tiêu.', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (rate >= 80) return { text: 'Xuất sắc! Bạn đang duy trì phong độ và năng suất rất cao.', color: 'text-teal-600', bg: 'bg-teal-50' };
    if (rate >= 50) return { text: 'Khá tốt! Đã hoàn thành hơn một nửa chặng đường công việc.', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (rate > 0) return { text: 'Cố gắng lên! Hãy tiếp tục hoàn thành các đầu việc còn tồn đọng.', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { text: 'Chưa có mục tiêu nào được hoàn thành trong nhóm bộ lọc này.', color: 'text-slate-500', bg: 'bg-slate-50' };
  };

  // Overtime / Savings calculation
  const timeDiff = stats.totalAct - stats.totalEst;
  const isOvertime = timeDiff > 0;
  const overtimeAbsolute = Math.abs(timeDiff);
  const timeVariancePercent = stats.totalEst > 0 ? Math.round((overtimeAbsolute / stats.totalEst) * 100) : 0;

  // Maximum value for comparative bars (ensure a minimum baseline of 1 to avoid NaN)
  const maxTimeVal = Math.max(stats.totalEst, stats.totalAct, 1);
  const estBarPercent = (stats.totalEst / maxTimeVal) * 100;
  const actBarPercent = (stats.totalAct / maxTimeVal) * 100;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5 bg-white p-4 rounded-xl shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-6 bg-indigo-600 rounded-full inline-block"></span>
            DASHBOARD THỐNG KÊ
          </h2>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
            MVP Năng suất công việc & trạng thái thời gian thực tế
          </p>
        </div>
        <button
          onClick={fetchTasks}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 disabled:opacity-50 text-xs font-bold rounded-lg transition-all shadow-sm border border-indigo-100 uppercase tracking-wider cursor-pointer active:scale-95"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Đang cập nhật...' : 'Làm mới dữ liệu'}
        </button>
      </div>

      {/* Error Message Header */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">Lỗi tải dữ liệu cơ sở dữ liệu!</span>
            <span className="text-xs text-rose-600/90">{error}</span>
          </div>
        </div>
      )}

      {/* Modern Filter controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          {/* Search Box */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm công việc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
            />
          </div>

          {/* Quick Filter Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Task Type Filters */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold text-slate-600 w-full sm:w-auto overflow-x-auto">
              {['ALL', 'DAILY', 'WEEKLY', 'MONTHLY', 'ONETIME'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-md transition-all uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer ${
                    typeFilter === type
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {type === 'ALL' ? 'Tất cả' : type}
                </button>
              ))}
            </div>

            {/* Task Active Status Filter */}
            <div className="flex items-center gap-2">
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer"
              >
                <option value="ALL">TRẠNG THÁI HOẠT ĐỘNG</option>
                <option value="ACTIVE">CHỈ TASKS HOẠT ĐỘNG</option>
                <option value="INACTIVE">CHỈ TASKS ĐÃ TẮT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Summary Status */}
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 p-2 rounded-lg">
          <span>
            Đang lọc: {filteredTasks.length} / {tasks.length} tasks
          </span>
          { (searchQuery || typeFilter !== 'ALL' || activeFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('ALL');
                setActiveFilter('ALL');
              }}
              className="text-indigo-600 hover:text-indigo-800 cursor-pointer underline hover:no-underline font-extrabold"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {loading && tasks.length === 0 ? (
        /* Skeletons/Loading State */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-100 rounded-xl p-5" />
          ))}
          <div className="md:col-span-2 h-64 bg-white border border-slate-100 rounded-xl" />
          <div className="md:col-span-2 h-64 bg-white border border-slate-100 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Main Index Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            
            {/* Card 1: Total Tasks */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng công việc</span>
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-none">
                  {stats.total}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1 tracking-wider">
                  Đầu việc được lọc
                </p>
              </div>
            </div>

            {/* Card 2: Done Tasks */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã hoàn thành</span>
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight leading-none">
                  {stats.completed}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1 tracking-wider">
                  Trạng thái 'Done'
                </p>
              </div>
            </div>

            {/* Card 3: New Tasks */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đang chờ (New)</span>
                <div className="p-1.5 bg-amber-50 text-amber-500 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl sm:text-3xl font-black text-amber-500 tracking-tight leading-none">
                  {stats.pending}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1 tracking-wider">
                  Chờ xử lý / mới tạo
                </p>
              </div>
            </div>

            {/* Card 4: Skipped Tasks */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã bỏ qua</span>
                <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-600 tracking-tight leading-none">
                  {stats.skipped}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1 tracking-wider">
                  Trạng thái 'Skipped'
                </p>
              </div>
            </div>

            {/* Card 5: Estimated Time accumulated */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dự kiến (Est)</span>
                <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">
                  {formatDuration(stats.totalEst)}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1 tracking-wider">
                  Tổng giờ dự tính ({stats.totalEst} m)
                </p>
              </div>
            </div>

            {/* Card 6: Actual Time spent */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-md col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Thực tế (Act)</span>
                <div className="p-1.5 bg-violet-50 text-violet-600 rounded-lg">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className={`text-xl sm:text-2xl font-black tracking-tight leading-none ${isOvertime ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatDuration(stats.totalAct)}
                </h3>
                <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1 tracking-wider">
                  Tổng giờ làm thật ({stats.totalAct} m)
                </p>
              </div>
            </div>

          </div>

          {/* Visual Progress & Analytics Side-by-Side Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Completion Rate Panel */}
            <div className="bg-white shadow rounded-lg p-6 flex flex-col justify-between border border-slate-100">
              <div className="mb-4">
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-emerald-500 rounded-full inline-block"></span>
                  Tỷ lệ hoàn thành (Completion Rate)
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                  Tỷ lệ phần trăm công việc đã đạt trạng thái 'Done'
                </p>
              </div>

              {/* Big Circular Metric representation in CSS and Linear Bar */}
              <div className="my-6 flex flex-col sm:flex-row items-center justify-around gap-6">
                
                {/* Circular Percentage visual using Tailwind and border radius tricks */}
                <div className="relative w-32 h-32 rounded-full flex items-center justify-center p-4 border-8 border-slate-100 shadow-inner">
                  <div 
                    className="absolute inset-[-8px] rounded-full border-8 border-transparent transition-all duration-1000"
                    style={{
                      backgroundImage: `conic-gradient(#10b981 ${stats.completionRate}%, #e2e8f0 ${stats.completionRate}%)`,
                      maskImage: 'radial-gradient(circle, transparent 58%, black 60%)',
                      WebkitMaskImage: 'radial-gradient(circle, transparent 58%, black 60%)'
                    }}
                  />
                  <div className="text-center z-10">
                    <span className="text-3xl font-black text-slate-800 tracking-tight leading-none">
                      {stats.completionRate}%
                    </span>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Hoàn thành
                    </span>
                  </div>
                </div>

                {/* Performance stats summary info */}
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Đã giải quyết:</span>
                    <span className="font-bold text-slate-800">{stats.completed} / {stats.total} tasks</span>
                  </div>
                  
                  {/* Tailwind Progress Bar container */}
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${stats.completionRate}%` }} 
                    />
                  </div>

                  {/* Feedback text */}
                  {(() => {
                    const fb = getCompletionFeedback(stats.completionRate);
                    return (
                      <div className={`p-3 rounded-xl border text-xs font-medium ${fb.bg} text-slate-700 mt-2 border-indigo-50`}>
                        <p className={`font-bold ${fb.color} mb-0.5`}>Nhận xét hiệu năng:</p>
                        <p className="text-[11px] leading-relaxed text-slate-600">{fb.text}</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Estimated vs Actual Time Comparison Panel */}
            <div className="bg-white shadow rounded-lg p-6 flex flex-col justify-between border border-slate-100">
              <div>
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-indigo-600 rounded-full inline-block"></span>
                  Thời gian: Dự kiến vs Thực tế
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                  So sánh mốc giờ đặt ra ban đầu và thời lượng thi hành thực tế
                </p>
              </div>

              {/* Graphical Comparators */}
              <div className="my-6 space-y-5">
                
                {/* Est Bar Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
                      Thời gian dự tính (EST)
                    </span>
                    <span className="text-slate-700 font-bold">{formatDuration(stats.totalEst)} ({stats.totalEst}m)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-4 rounded-lg overflow-hidden">
                    <div 
                      className="bg-slate-400 h-full transition-all duration-1000 ease-out"
                      style={{ width: `${estBarPercent}%` }}
                    />
                  </div>
                </div>

                {/* Act Bar Row */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full inline-block ${isOvertime ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`}></span>
                      Thời gian thực tế (ACT)
                    </span>
                    <span className={`font-extrabold ${isOvertime ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatDuration(stats.totalAct)} ({stats.totalAct}m)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-4 rounded-lg overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${isOvertime ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                      style={{ width: `${actBarPercent}%` }}
                    />
                  </div>
                </div>

                {/* Variance Widget Badge */}
                <div className="pt-2 border-t border-slate-100">
                  {stats.totalEst === 0 && stats.totalAct === 0 ? (
                    <div className="text-center p-3 text-xs font-semibold bg-slate-50 text-slate-500 rounded-xl">
                      Không có ghi nhận mốc thời gian để so sánh
                    </div>
                  ) : isOvertime ? (
                    <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl">
                      <div className="p-1 rounded-full bg-rose-100 text-rose-600">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <p className="font-extrabold text-rose-900 leading-tight">
                          LỐ GIỜ KẾ HOẠCH! (+{overtimeAbsolute} phút)
                        </p>
                        <p className="text-[11px] text-rose-700 mt-0.5">
                          Thời gian thực thi vượt quá {timeVariancePercent}% so với uớc tính ban đầu. Cần tối ưu thời gian.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl">
                      <div className="p-1 rounded-full bg-emerald-100 text-emerald-600">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <p className="font-extrabold text-emerald-900 leading-tight">
                          HUYỀN THOẠI NĂNG SUẤT! (Tiết kiệm {overtimeAbsolute} phút)
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Bạn đã hoàn thành sớm hơn dự kiến {timeVariancePercent}%. Chúc mừng hiệu năng làm việc xuất sắc!
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>

          {/* Detailed Task Metrics & Status Breakdown Table */}
          <div className="bg-white shadow rounded-lg p-6 border border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-indigo-600 rounded-full inline-block"></span>
                  Báo cáo công việc chi tiết
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                  Danh sách hiển thị tương ứng các tiêu chí lọc được chọn
                </p>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                Hiển thị {filteredTasks.length} hàng
              </span>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="text-center py-10 text-slate-430 text-xs font-semibold">
                Không tìm thấy dữ liệu công việc phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-4 rounded-l-lg">Tiêu đề công việc</th>
                      <th className="py-3 px-4">Định kỳ (Type)</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4">Dự kiến</th>
                      <th className="py-3 px-4">Thực tế</th>
                      <th className="py-3 px-4 text-center">Chênh lệch</th>
                      <th className="py-3 px-4 rounded-r-lg text-right">Ngày khởi tạo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-1s border-b border-slate-100">
                    {filteredTasks.map((task) => {
                      const diff = (task.actual_time || 0) - (task.est_time || 0);
                      const isOver = diff > 0;
                      const isZero = diff === 0;

                      // Format Creation Date
                      let formattedDate = '-';
                      if (task.created_at) {
                        try {
                          formattedDate = new Date(task.created_at).toLocaleDateString('vi-VN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          });
                        } catch (e) {}
                      }

                      return (
                        <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Title / Description */}
                          <td className="py-3.5 px-4 font-bold text-slate-800 max-w-[200px] sm:max-w-xs truncate">
                            <div className="flex flex-col">
                              <span>{task.title || 'Không có tiêu đề'}</span>
                              {task.description && (
                                <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 font-normal">
                                  {task.description}
                                </span>
                              )}
                            </div>
                          </td>
                          
                          {/* Task type badge */}
                          <td className="py-3.5 px-4">
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-500 tracking-wider">
                              {task.task_type || 'DAILY'}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4">
                            {task.status === 'Done' ? (
                              <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-600 inline-flex items-center gap-1 border border-emerald-100">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                                DONE
                              </span>
                            ) : task.status === 'Skipped' ? (
                              <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-slate-50 text-slate-400 inline-flex items-center gap-1 border border-slate-200">
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full inline-block"></span>
                                SKIPPED
                              </span>
                            ) : (
                              <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-50 text-amber-600 inline-flex items-center gap-1 border border-amber-100">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full inline-block animate-pulse"></span>
                                NEW
                              </span>
                            )}
                          </td>

                          {/* Est/Act Times */}
                          <td className="py-3.5 px-4 font-semibold text-slate-600 font-mono">
                            {formatDuration(task.est_time)}
                          </td>
                          <td className={`py-3.5 px-4 font-extrabold font-mono ${task.actual_time > task.est_time ? 'text-rose-600' : 'text-slate-800'}`}>
                            {formatDuration(task.actual_time)}
                          </td>

                          {/* Time difference */}
                          <td className="py-3.5 px-4 text-center font-bold font-mono">
                            {isZero ? (
                              <span className="text-slate-500 text-[10px]">-</span>
                            ) : isOver ? (
                              <span className="text-rose-600 text-xs">+{diff}m</span>
                            ) : (
                              <span className="text-emerald-600 text-xs">-{Math.abs(diff)}m</span>
                            )}
                          </td>

                          {/* Date created */}
                          <td className="py-3.5 px-4 text-right text-slate-400 font-medium">
                            {formattedDate}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
