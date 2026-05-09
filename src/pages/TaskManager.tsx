import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Plus, ChevronLeft, ChevronRight, Edit2, Trash2, Power, Download } from 'lucide-react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Metadata for filters
  const [projects, setProjects] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, filters);
  const totalPages = Math.ceil(totalCount / 15) || 1;

  useEffect(() => {
    const fetchMeta = async () => {
      const [p, t, tg, u] = await Promise.all([
        supabase.from('projects').select('id, name'),
        supabase.from('teams').select('id, name'),
        supabase.from('tags').select('id, name'),
        supabase.from('users').select('id, name, email'),
      ]);
      setProjects(p.data || []);
      setTeams(t.data || []);
      setTags(tg.data || []);
      setUsers(u.data || []);
    };
    fetchMeta();
  }, []);

  const handleOpenEdit = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const toggleTaskActive = async (id: string, currentStatus: boolean) => {
    if (profile?.role === 'user') return;
    await supabase.from('tasks').update({ is_active: !currentStatus }).eq('id', id);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (profile?.role === 'user') return;
    if (!confirm('Xóa vĩnh viễn task này?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    refetch();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden m-6">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">Task Manager</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => refetch()} className={cn("p-2 text-slate-400", loading && "animate-spin text-indigo-600")}>
            <RotateCw className="w-4 h-4" />
          </button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" placeholder="Search..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-48"
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          {/* Bộ lọc đồng bộ */}
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, assignee_email: e.target.value || undefined})}>
            <option value="">All Assignees</option>
            {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, tag_id: e.target.value || undefined})}>
            <option value="">All Tags</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, project_id: e.target.value || undefined})}>
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {/* Filter TEAM sau PROJECT */}
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, team_id: e.target.value || undefined})}>
            <option value="">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <button onClick={() => { setSelectedTask(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> <span>Create Task</span>
          </button>
        </div>
      </div>

      <CreateTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={refetch} taskToEdit={selectedTask} />

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">ID</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Tag</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Project</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Team</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Type</th>
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
                <td className="px-6 py-4"><span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500">{task.tags?.name || 'No Tag'}</span></td>
                <td className="px-6 py-4 text-sm text-indigo-600 font-medium">{task.projects?.name || '-'}</td>
                <td className="px-6 py-4 text-sm text-slate-500 font-medium">{task.teams?.name || '-'}</td>
                <td className="px-6 py-4"><span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-600">{task.type}</span></td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">{task.deadline_time || '--:--'}</span>
                    <span className="text-[10px] text-slate-400">{task.deadline_days?.join(', ') || '-'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center font-bold text-xs text-slate-600">{task.estimated_minutes}m</td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => toggleTaskActive(task.id, task.is_active)}
                    disabled={profile?.role === 'user'}
                    className={cn(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black border",
                      task.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-100 text-slate-400 border-slate-200"
                    )}
                  >
                    <Power size={10} /> {task.is_active ? 'ON' : 'OFF'}
                  </button>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenEdit(task)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl"><Edit2 size={14} /></button>
                    {profile?.role !== 'user' && <button onClick={() => handleDelete(task.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-xl"><Trash2 size={14} /></button>}
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