import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
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
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  
  // Bắt buộc chỉ lấy các task đang active (is_active: true) cho To-do List
  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, { ...filters, is_active: true });
  
  // Metadata for filters
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

  const totalPages = Math.ceil(totalCount / 15) || 1;

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // API Cập nhật trạng thái Task thành SUBMITTED (Nhiệm vụ 3)
  const handleSubmitTask = async (taskId: string) => {
    try {
      await supabase.from('tasks').update({ status: 'SUBMITTED' }).eq('id', taskId);
      refetch();
    } catch (error) {
      console.error('Error submitting task:', error);
    }
  };

  // API Tick chọn hoàn thành Subtask (Nhiệm vụ 2)
  const handleToggleSubtask = async (subtaskId: string, currentStatus: boolean) => {
    try {
      await supabase.from('subtasks').update({ is_completed: !currentStatus }).eq('id', subtaskId);
      refetch();
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };

  const renderDeadlineContext = (task: any) => {
    switch(task.type) {
      case 'DAILY': return 'Hàng ngày';
      case 'WEEKLY': return task.deadline_days?.join(', ');
      case 'MONTHLY': return `Ngày ${task.deadline_day_num}`;
      case 'ONETIME': return task.deadline_date;
      default: return task.type;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'NEW': 'bg-slate-50 text-slate-600 border-slate-200',
      'IN_PROGRESS': 'bg-blue-50 text-blue-600 border-blue-200',
      'DONE': 'bg-emerald-50 text-emerald-600 border-emerald-200',
      'SUBMITTED': 'bg-purple-50 text-purple-600 border-purple-200'
    };
    return statusMap[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold border border-indigo-100 rounded">SYNCED</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => refetch()} className={cn("p-2 text-slate-400 hover:text-indigo-600 transition-colors", loading && "animate-spin text-indigo-600")}>
            <RotateCw className="w-4 h-4" />
          </button>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" placeholder="Tìm kiếm..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-48"
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, assignee_email: e.target.value || undefined})}>
            <option value="">Tất cả Assignees</option>
            {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, tag_id: e.target.value || undefined})}>
            <option value="">Tất cả Tags</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, project_id: e.target.value || undefined})}>
            <option value="">Tất cả Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" onChange={(e) => setFilters({...filters, team_id: e.target.value || undefined})}>
            <option value="">Tất cả Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {/* Bộ lọc Date dành riêng cho To-do List */}
          <input 
            type="date" 
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600" 
            onChange={(e) => setFilters({...filters, date: e.target.value || undefined})}
          />
          
          {showCreate && (
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-sm font-medium">
                <Plus className="w-4 h-4" /> <span>Create Task</span>
             </button>
          )}
        </div>
      </div>

      <CreateTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => refetch()} />

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="px-6 py-4 w-12 text-center bg-slate-50/50"></th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Tag</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Project/Team</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Deadline</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Time</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <React.Fragment key={task.id}>
                <tr className={cn("hover:bg-slate-50/50 transition-colors group", expandedTasks[task.id] && "bg-slate-50/50")}>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => toggleExpand(task.id)} className="text-slate-400 hover:text-indigo-600">
                      {expandedTasks[task.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{task.task_name}</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500">{task.tags?.name || 'No Tag'}</span></td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    <div className="text-indigo-600 font-medium">{task.projects?.name || 'General'}</div>
                    <div className="text-[10px]">{task.teams?.name || 'Internal'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">{task.deadline_time || '--:--'}</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {renderDeadlineContext(task)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold">
                    <div className="text-indigo-600">Est: {task.estimated_minutes}m</div>
                    <div className="text-emerald-500">Act: {task.actual_minutes}m</div>
                  </td>
                  <td className="px-6 py-4">
                     <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold border", getStatusBadge(task.status))}>
                       {task.status || 'NEW'}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleSubmitTask(task.id)}
                      disabled={task.status === 'SUBMITTED'}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      Submit
                    </button>
                  </td>
                </tr>

                {/* Khu vực hiển thị Subtasks khi được Expand */}
                {expandedTasks[task.id] && (
                  <tr>
                    <td colSpan={8} className="p-0 border-b border-slate-100">
                      <div className="bg-slate-50/80 p-4 pl-20 inner-shadow">
                        <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Subtasks ({task.subtasks?.length || 0})</h4>
                        {task.subtasks?.length > 0 ? (
                          <div className="space-y-2">
                            {task.subtasks.map((sub: any) => (
                              <div key={sub.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                                <button onClick={() => handleToggleSubtask(sub.id, sub.is_completed)} className="text-slate-400 hover:text-indigo-600">
                                  {sub.is_completed ? <CheckSquare className="text-emerald-500" size={18} /> : <Square size={18} />}
                                </button>
                                <span className={cn("text-sm font-medium", sub.is_completed ? "text-slate-400 line-through" : "text-slate-700")}>
                                  {sub.name}
                                </span>
                                <span className="ml-auto text-xs font-bold text-indigo-600">{sub.estimated_minutes}m</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400 italic">Không có subtask nào.</div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
         <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng: {totalCount} Tasks</span>
         <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded-lg disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="text-xs font-bold">Trang {page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded-lg disabled:opacity-30"><ChevronRight size={16} /></button>
         </div>
      </div>
    </div>
  );
};

export default TaskList;