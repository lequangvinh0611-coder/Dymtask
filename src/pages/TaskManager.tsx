import React, { useState } from 'react';
import { Search, RotateCw, Plus, ChevronLeft, ChevronRight, Edit2, Trash2, Power } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks, TaskFilters } from '../hooks/useTasks';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import CreateTaskModal from '../components/CreateTaskModal';
import { Task } from '../types/database.types';

const TaskManager: React.FC = () => {
  const { profile } = useAuthStore();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TaskFilters>({});
  
  // State quản lý Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, filters);
  const totalPages = Math.ceil(totalCount / 15) || 1;

  // Mở modal tạo mới
  const handleOpenCreate = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  // Mở modal chỉnh sửa
  const handleOpenEdit = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const toggleTaskActive = async (id: string, currentStatus: boolean) => {
    if (profile?.role === 'user') return; 
    const { error } = await supabase.from('tasks').update({ is_active: !currentStatus }).eq('id', id);
    if (error) alert(error.message);
  };

  const handleDelete = async (id: string) => {
    if (profile?.role === 'user') return;
    if (!confirm('Hành động này sẽ xóa vĩnh viễn task. Bạn chắc chắn chứ?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) alert(error.message);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden m-6">
      {/* HEADER */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">Task Manager</h2>
          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold border border-indigo-100 rounded">MANAGEMENT MODE</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => refetch()} className={cn("p-2 text-slate-400 hover:text-slate-600 transition-colors", loading && "animate-spin text-indigo-600")}>
            <RotateCw className="w-4 h-4" />
          </button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" placeholder="Search tasks..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 lg:w-64"
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <button 
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">Create Task</span>
          </button>
        </div>
      </div>

      {/* MODAL */}
      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => refetch()} 
        taskToEdit={selectedTask} 
      />

      {/* BẢNG DỮ LIỆU */}
      <div className="flex-1 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
            <RotateCw className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        )}

        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">ID</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Tag</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Project/Team</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Deadline</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Time</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4 font-mono text-[11px] text-slate-400">{task.id.slice(0, 6)}</td>
                <td className="px-6 py-4 font-semibold text-slate-700">{task.task_name}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                    {task.tags?.name || 'No Tag'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  <div className="text-indigo-600 font-medium">{task.projects?.name || 'General'}</div>
                  <div className="text-[10px]">{task.teams?.name || 'Internal'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{task.deadline_time || '--:--'}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{task.deadline_days?.join(', ') || '-'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-xs font-black text-slate-600">{task.estimated_minutes}m</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => toggleTaskActive(task.id, task.is_active)}
                    disabled={profile?.role === 'user'}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all border",
                      task.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-400 border-slate-200"
                    )}
                  >
                    <Power size={10} />
                    {task.is_active ? 'ON' : 'OFF'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenEdit(task)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl transition-all">
                      <Edit2 size={14} />
                    </button>
                    {profile?.role !== 'user' && (
                      <button onClick={() => handleDelete(task.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-xl transition-all">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskManager;