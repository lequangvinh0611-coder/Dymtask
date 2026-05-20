import React, { useState } from 'react';
import { Search, RotateCcw, Clock, Check, AlertCircle, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks, TaskFilters } from '../hooks/useTasks';
import { supabase } from '../lib/supabase';
import { Task } from '../types/database.types';

interface TaskListProps {
  title: string;
}

const TaskList: React.FC<TaskListProps> = ({ title }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actualTimes, setActualTimes] = useState<Record<string, number>>({});
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);

  // Strictly filter by is_active = true and status = 'NEW'
  const filters: TaskFilters = {
    search: search.trim() || undefined,
    status: 'NEW',
    is_active: true,
  };

  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, filters);
  const totalPages = Math.ceil(totalCount / 15) || 1;

  const handleSubmit = async (taskId: string, estTime: number) => {
    const finalMinutes = actualTimes[taskId] !== undefined ? actualTimes[taskId] : estTime;
    setSubmittingTaskId(taskId);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'DONE',
          actual_time: finalMinutes
        })
        .eq('id', taskId);

      if (error) throw error;
      refetch();
    } catch (error) {
      console.error('Error submitting task:', error);
      alert('Không thể lưu kết quả nhiệm vụ. Vui lòng thử lại.');
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const handleSkip = async (taskId: string) => {
    setSubmittingTaskId(taskId);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'SKIPPED'
        })
        .eq('id', taskId);

      if (error) throw error;
      refetch();
    } catch (error) {
      console.error('Error skipping task:', error);
      alert('Không thể bỏ qua nhiệm vụ. Vui lòng thử lại.');
    } finally {
      setSubmittingTaskId(null);
    }
  };

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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
      {/* Upper header action controls */}
      <div className="px-6 py-4 flex items-center bg-white shrink-0 border-b border-slate-100 justify-between gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-6 bg-indigo-600 rounded-full"></div>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-widest">{title}</h2>
          <span className="ml-2 bg-indigo-50 text-indigo-600 text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-widest">
            {totalCount} PENDING
          </span>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhiệm vụ..." 
              value={search}
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-56 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium text-slate-700"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {search && (
            <button 
              onClick={() => { setSearch(''); setPage(1); }} 
              className="p-2 text-indigo-600 hover:text-indigo-800 transition-colors"
              title="Đặt lại công cụ tìm kiếm"
            >
               <RotateCcw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main card grid container */}
      <div className="flex-1 overflow-auto p-6 min-h-[400px]">
        {loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-mono text-[10px] uppercase tracking-widest animate-pulse">Đang tải nhiệm vụ...</p>
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tasks.map((task) => {
              const currentInputVal = actualTimes[task.id] !== undefined ? actualTimes[task.id] : task.est_time;
              return (
                <div 
                  key={task.id} 
                  className="bg-white border border-slate-100 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-100/80 transition-all duration-300 flex flex-col justify-between gap-5 relative group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                        {task.task_type || 'ONETIME'}
                      </span>
                      <div className="flex items-center gap-1 text-slate-400 text-[11px] font-bold font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                        <span>EST: {task.est_time || 0}m</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-800 text-base leading-snug tracking-tight">
                        {task.title}
                      </h3>
                      <p className="text-slate-500 text-xs line-clamp-3 leading-relaxed" title={task.description || ''}>
                        {task.description || <span className="italic text-slate-300">Không có mô tả chi tiết</span>}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-3 border-t border-slate-100">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest font-mono">
                        Thời gian thực tế (Phút)
                      </label>
                      <input 
                        type="number"
                        min={0}
                        disabled={submittingTaskId === task.id}
                        value={currentInputVal}
                        onChange={(e) => setActualTimes({
                          ...actualTimes,
                          [task.id]: Math.max(0, parseInt(e.target.value) || 0)
                        })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white focus:ring-1 focus:ring-indigo-600/10 transition-all font-mono"
                        placeholder="Số phút thực hiện..."
                      />
                    </div>

                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        disabled={submittingTaskId === task.id}
                        onClick={() => handleSkip(task.id)}
                        className="flex-1 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:scale-102"
                      >
                        Bỏ qua
                      </button>
                      <button
                        type="button"
                        disabled={submittingTaskId === task.id}
                        onClick={() => handleSubmit(task.id, task.est_time || 0)}
                        className="flex-[1.5] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:scale-102 flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-100"
                      >
                        <Check className="w-4 h-4" />
                        <span>Xong</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 bg-white border border-slate-100 rounded-full shadow-md mb-3">
              <AlertCircle className="w-8 h-8 text-indigo-500" />
            </div>
            <h4 className="text-slate-800 font-bold text-base">Không tìm thấy nhiệm vụ khả dụng</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-sm leading-relaxed">
              Tất cả các nhiệm vụ đã được hoàn thành hoặc bỏ qua, hoặc hiện không có nhiệm vụ nào được đặt ở chế độ Kích hoạt (Active ON).
            </p>
          </div>
        )}
      </div>

      {/* Footer statistics and pagination wrapper */}
      <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100 bg-white shrink-0 shadow-sm">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
          Tổng cộng: {totalCount} nhiệm vụ
        </span>
        <div className="flex items-center justify-center gap-1">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)} 
            className="px-2.5 py-1.5 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all"
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
                  "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all",
                  page === item ? "bg-indigo-600 text-white shadow-sm" : 
                  typeof item === 'number' ? "text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-slate-100" : 
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
            className="px-2.5 py-1.5 text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="w-24"></div>
      </div>
    </div>
  );
};

export default TaskList;
