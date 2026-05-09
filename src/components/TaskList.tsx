import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Download, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks, TaskFilters } from '../hooks/useTasks';
import { supabase } from '../lib/supabase';
import CreateTaskModal from './CreateTaskModal';

interface TaskListProps {
  title: string;
  showCreate?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({ title, showCreate = false }) => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, filters);
  
  const [projects, setProjects] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => refetch()} className={cn("p-2 text-slate-400", loading && "animate-spin text-indigo-600")}><RotateCw className="w-4 h-4" /></button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" placeholder="Search..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-48"
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </div>

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
          {/* Bổ sung bộ lọc TEAM sau PROJECT */}
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, team_id: e.target.value || undefined})}>
            <option value="">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, status: e.target.value || undefined})}>
            <option value="">Status</option>
            <option value="NEW">New</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done</option>
          </select>

          {showCreate && (
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> <span>Create Task</span>
             </button>
          )}
        </div>
      </div>

      <CreateTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => refetch()} />

      {/* Phần table giữ nguyên cấu trúc bạn đã có nhưng đảm bảo cột Project/Team tách riêng nếu cần giống TaskManager */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full text-left border-collapse">
          {/* ... Table Content tương tự TaskManager ... */}
        </table>
      </div>
    </div>
  );
};

export default TaskList;