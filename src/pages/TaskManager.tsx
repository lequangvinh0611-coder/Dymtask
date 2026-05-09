import React, { useState } from 'react';
import { Search, Filter, Plus, Edit2, Trash2, Power, Briefcase, Users, Tag as TagIcon } from 'lucide-react';
import { useTasks, TaskFilters } from '../hooks/useTasks';
import { useAuthStore } from '../store/authStore';
import CreateTaskModal from '../components/CreateTaskModal';
import { supabase } from '../lib/supabase';

const TaskManager: React.FC = () => {
  const { profile } = useAuthStore();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TaskFilters>({});
  const { tasks, loading, totalCount, refetch } = useTasks(page, 20, filters);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (profile?.role === 'user') return; // Bảo vệ nút bấm
    if (!confirm('Are you sure you want to delete this task?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) alert(error.message);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Task Manager</h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Search tasks..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select 
          className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none"
          onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
        >
          <option value="">All Status</option>
          <option value="NEW">NEW</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="DONE">DONE</option>
        </select>
        {/* Có thể thêm Project/Team select tương tự ở đây */}
      </div>

      {/* Task Table */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Task</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assignees</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project/Team</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estimate</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-4 py-4">
                  <div className="font-bold text-slate-700 text-sm">{task.task_name}</div>
                  <div className="text-[10px] text-slate-400 font-medium">{task.deadline_time} {task.deadline_days?.join(', ')}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {task.assignees?.map(email => (
                      <span key={email} className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500">{email.split('@')[0]}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-500"><Briefcase size={10}/> {task.projects?.name}</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500"><Users size={10}/> {task.teams?.name}</span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="text-xs font-black text-slate-600">{task.estimated_minutes}m</span>
                </td>
                <td className="px-4 py-4">
                   <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                    task.status === 'DONE' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {task.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Edit2 size={14}/></button>
                    {profile?.role !== 'user' && (
                      <>
                        <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"><Power size={14}/></button>
                        <button 
                          onClick={() => handleDelete(task.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={refetch} />
    </div>
  );
};

export default TaskManager;