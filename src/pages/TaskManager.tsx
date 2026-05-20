import React, { useState } from 'react';
import { Search, RotateCcw, Plus, Edit2, Trash2, Power, Clock, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks, TaskFilters } from '../hooks/useTasks';
import { supabase } from '../lib/supabase';
import CreateTaskModal from '../components/CreateTaskModal';
import { Task } from '../types/database.types';

const TaskManager: React.FC = () => {
  const [page, setPage] = useState(1);
  const defaultFilters: TaskFilters = {
    search: '',
    status: undefined,
    is_active: undefined,
  };
  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const isFilterChanged = 
    (filters.search && filters.search !== '') || 
    filters.status !== undefined || 
    filters.is_active !== undefined;

  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, filters);

  const totalPages = Math.ceil(totalCount / 15) || 1;

  const handleExportCsv = () => {
    if (!tasks || tasks.length === 0) return;
    
    const headers = ['ID', 'Title', 'Description', 'Task Type', 'Est Time', 'Actual Time', 'Status', 'Active'];
    const csvContent = [
      headers.join(','),
      ...tasks.map(task => [
        `"${task.id}"`,
        `"${(task.title || '').replace(/"/g, '""')}"`,
        `"${(task.description || '').replace(/"/g, '""')}"`,
        task.task_type || '',
        task.est_time || 0,
        task.actual_time || 0,
        task.status || '',
        task.is_active
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `task_manager_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const toggleTaskActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('tasks').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      refetch();
    } catch (error) {
       console.error('Error toggling active state:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa vĩnh viễn task này không?')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      refetch();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 flex items-center bg-white shrink-0 border-b border-slate-100 justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tiêu đề..." 
              value={filters.search || ""}
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm w-56 focus:outline-none focus:border-indigo-600 transition-all font-medium text-slate-700"
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <select 
            value={filters.status || ""}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer h-9 text-center" 
            onChange={(e) => setFilters({...filters, status: e.target.value || undefined})}
          >
            <option value="">TRẠNG THÁI</option>
            <option value="NEW">MỚI</option>
            <option value="IN_PROGRESS">ĐANG LÀM</option>
            <option value="DONE">HOÀN THÀNH</option>
            <option value="SKIPPED">BỎ QUA</option>
          </select>

          <select 
            value={filters.is_active === undefined ? "" : filters.is_active ? "ON" : "OFF"}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer h-9 text-center" 
            onChange={(e) => {
              const val = e.target.value;
              setFilters({
                ...filters, 
                is_active: val === '' ? undefined : val === 'ON'
              });
            }}
          >
            <option value="">HOẠT ĐỘNG</option>
            <option value="ON">ON (BẬT)</option>
            <option value="OFF">OFF (TẮT)</option>
          </select>

          <button 
            onClick={handleExportCsv}
            className="px-4 py-1.5 text-xs font-black text-slate-500 bg-slate-50 border border-slate-200 rounded-lg h-9 hover:bg-slate-100 transition-all flex items-center gap-2 group uppercase tracking-widest"
            title="Xuất file CSV"
          >
            <Download className="w-4 h-4 group-hover:text-indigo-600" />
            <span className="group-hover:text-indigo-600">CSV</span>
          </button>
          
          {isFilterChanged && (
            <button 
              onClick={() => setFilters(defaultFilters)} 
              className="p-2 text-indigo-600 hover:text-indigo-800 transition-colors"
              title="Đặt lại bộ lọc"
            >
               <RotateCcw className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setSelectedTask(null); setIsModalOpen(true); }} 
            className="flex items-center gap-2 h-9 px-5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200"
          >
            <Plus className="w-4 h-4" /> <span>Tạo mới</span>
          </button>
        </div>
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setSelectedTask(null); }} 
        onSuccess={refetch} 
        taskToEdit={selectedTask} 
      />

      <div className="flex-1 overflow-auto bg-white min-h-[400px]">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="w-[8%] px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">STT / ID</th>
              <th className="w-[30%] px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Tiêu đề (Title)</th>
              <th className="w-[25%] px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Mô tả (Description)</th>
              <th className="w-[12%] px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Loại (Type)</th>
              <th className="w-[10%] px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Thời gian (Time)</th>
              <th className="w-[8%] px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Trạng thái</th>
              <th className="w-[7%] px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Active</th>
              <th className="w-[10%] px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks && tasks.length > 0 ? (
              tasks.map((task, index) => (
                <tr key={task.id} className={cn("hover:bg-indigo-50/10 transition-all group", !task.is_active && "bg-slate-50/70")}>
                  <td className="px-6 py-3">
                    <span className="font-mono text-xs text-slate-400 font-bold">
                      {String((page - 1) * 15 + index + 1).padStart(3, '0')}
                    </span>
                  </td>
                  <td className="px-6 py-3 overflow-hidden">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-sm tracking-tight truncate" title={task.title}>
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3 overflow-hidden">
                    <span className="text-slate-500 text-xs truncate block" title={task.description || ''}>
                      {task.description || <span className="italic text-slate-300">Không có mô tả</span>}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-100 tracking-wider">
                      {task.task_type || 'ONETIME'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex flex-col items-center justify-center text-[11px] font-bold font-mono">
                      <span className="text-indigo-600">Ước lượng: {task.est_time || 0}m</span>
                      <span className="text-emerald-600">Thực tế: {task.actual_time || 0}m</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-widest",
                      task.status === 'DONE' && "bg-emerald-50 text-emerald-600 border-emerald-100",
                      task.status === 'NEW' && "bg-blue-50 text-blue-600 border-blue-100",
                      task.status === 'IN_PROGRESS' && "bg-amber-50 text-amber-600 border-amber-100",
                      task.status === 'SKIPPED' && "bg-slate-100 text-slate-500 border-slate-200"
                    )}>
                      {task.status || 'NEW'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-widest",
                      task.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-400 border-slate-200"
                    )}>
                      {task.is_active ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleTaskActive(task.id, task.is_active)} 
                        title={task.is_active ? "Ẩn hoạt động (OFF)" : "Kích hoạt (ON)"}
                        className={cn(
                          "p-1.5 rounded transition-all hover:scale-115", 
                          task.is_active ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
                        )}
                      >
                        <Power size={14} />
                      </button>
                      <button 
                        onClick={() => { setSelectedTask(task); setIsModalOpen(true); }} 
                        title="Sửa Task"
                        className="p-1.5 text-slate-600 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-all hover:scale-115"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(task.id)} 
                        title="Xóa vĩnh viễn"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all hover:scale-115"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 font-medium font-sans">
                  {loading ? (
                    <div className="flex flex-col items-center gap-2 justify-center">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs uppercase tracking-widest">Đang tải danh sách...</span>
                    </div>
                  ) : (
                    "Không tìm thấy nhiệm vụ nào."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 flex items-center justify-between border-t border-slate-100 bg-white shrink-0">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest"> Tổng số: {totalCount} nhiệm vụ</span>
        <div className="flex items-center justify-center gap-1">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)} 
            className="px-2.5 py-1 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all"
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
            className="px-2.5 py-1 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="w-20"></div>
      </div>
    </div>
  );
};

export default TaskManager;
