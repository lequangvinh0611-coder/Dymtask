import React, { useState, useEffect } from 'react';
import { Search, RotateCw, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckSquare, Square, MoreVertical, CheckCircle2, Clock, Download, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks, TaskFilters, TaskWithDetails } from '../hooks/useTasks';
import { supabase } from '../lib/supabase';
import CreateTaskModal from './CreateTaskModal';
import { SideDrawer } from './ui/SideDrawer';
import { logger } from '../lib/logger';
import { Task } from '../types/database.types';
import { useAuthStore } from '../store/authStore';
import { MultiSearchableSelect } from './ui/MultiSearchableSelect';
import { DateRangePicker } from './ui/DateRangePicker';

interface TaskListProps {
  title: string;
  showCreate?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({ title, showCreate = false }) => {
  const { profile } = useAuthStore();
  const [page, setPage] = useState(1);
  const today = new Date().toISOString().split('T')[0];
  
  const defaultFilters: TaskFilters = {
    assignee_email: profile?.email || undefined,
    status: 'NEW',
    startDate: today,
    endDate: today
  };

  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);

  const isFilterChanged = 
    filters.search !== undefined || 
    filters.assignee_email !== defaultFilters.assignee_email || 
    filters.project_id !== undefined || 
    filters.tag_id !== undefined || 
    filters.status !== defaultFilters.status || 
    filters.startDate !== defaultFilters.startDate ||
    filters.endDate !== defaultFilters.endDate ||
    (Array.isArray(filters.team_id) && filters.team_id.length > 0);

  useEffect(() => {
    if (profile?.email && !filters.assignee_email && filters.assignee_email !== undefined) {
      setFilters(prev => ({ ...prev, assignee_email: profile.email }));
    }
  }, [profile]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  
  const { tasks, totalCount, loading, refetch } = useTasks(page, 15, { ...filters, is_active: true });
  
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

  const handleOpenDrawer = (task: Task) => {
    setSelectedTask(task);
    setIsDrawerOpen(true);
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    setUpdatingTask(taskId);
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Logic for SPOT tasks (ONETIME)
      if (task.type === 'ONETIME' || task.type === 'ONCE') {
        const isTerminal = ['DONE', 'SKIPPED'].includes(status);
        await supabase.from('tasks').update({ 
          status, 
          is_active: !isTerminal // Backwards logic: if Done/Skipped, it becomes "Off" in Task Manager
        }).eq('id', taskId);
      } 
      // Logic for Recurring Tasks (DAILY, WEEKLY, MONTHLY)
      else if (['DAILY', 'WEEKLY', 'MONTHLY'].includes(task.type)) {
        // We create a CLONE of the template for this specific date
        const instancePayload = {
          ...task,
          id: undefined, // Let DB generate new ID
          status: status,
          deadline_date: task.deadline_date,
          type: 'ONETIME',
          is_active: true, // Instances are always active
          created_at: undefined,
          updated_at: undefined,
          // We can't add parent_id, so we'll mark it in subtasks
          subtasks: (task.subtasks || []).map(st => ({ ...st, parent_tpl_id: task.id }))
        };
        // Remove joined objects before insertion
        delete (instancePayload as any).tags;
        delete (instancePayload as any).projects;
        delete (instancePayload as any).teams;

        await supabase.from('tasks').insert(instancePayload);
      } else {
        // Fallback for other cases
        await supabase.from('tasks').update({ status }).eq('id', taskId);
      }

      await logger.log('UPDATE_TASK_STATUS', `Updated task status to ${status}`, { taskId });
      refetch();
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, status: status as any } : null);
      }
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleBatchSkip = async (taskIds: string[]) => {
    try {
      await supabase.from('tasks').update({ status: 'SKIPPED', actual_minutes: 0 }).in('id', taskIds);
      await logger.log('BATCH_SKIP_TASKS', `Skipped ${taskIds.length} tasks`, { taskIds });
      refetch();
      if (selectedTask && taskIds.includes(selectedTask.id)) {
        setSelectedTask(prev => prev ? { ...prev, status: 'SKIPPED', actual_minutes: 0 } : null);
      }
    } catch (error) {
      console.error('Error skipping tasks:', error);
    }
  };

  const handleResetTask = async (task: Task) => {
    try {
      // 1. Check if it's an instance of a recurring task
      const parentId = (task.subtasks as any[])?.find(st => st.parent_tpl_id)?.parent_tpl_id;
      
      if (parentId) {
        // Verify parent is still active
        const { data: parent } = await supabase.from('tasks').select('is_active').eq('id', parentId).single();
        if (!parent || !parent.is_active) {
          alert("Task Template đã bị Off hoặc xóa. Không thể Reset.");
          return;
        }
      }

      const resetSubtasks = task.subtasks?.map((sub: any) => ({
        ...sub,
        status: 'NEW',
        is_completed: false,
        actual_minutes: 0
      })) || [];
      
      // If it has a parentId, resetting means DELETING the instance 
      // so the virtual task appears as NEW again.
      if (parentId) {
        await supabase.from('tasks').delete().eq('id', task.id);
      } else {
        // If it's a SPOT task, reset its status and turn it back "ON" in Task Manager
        await supabase.from('tasks').update({ 
          status: 'NEW', 
          actual_minutes: 0,
          subtasks: resetSubtasks,
          is_active: true
        }).eq('id', task.id);
      }
      
      await logger.log('RESET_TASK', `Reset task and subtasks to NEW`, { taskId: task.id });
      refetch();
      setIsDrawerOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Error resetting task:', error);
    }
  };

  const handleUpdateActualTime = async (taskId: string, minutes: number) => {
    try {
      await supabase.from('tasks').update({ actual_minutes: minutes }).eq('id', taskId);
      refetch();
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, actual_minutes: minutes } : null);
      }
    } catch (error) {
      console.error('Error updating actual time:', error);
    }
  };

  const handleUpdateSubtask = async (task: Task, subtaskId: string, updates: Partial<any>) => {
    try {
      const currentSubtasks = task.subtasks || [];
      const newSubtasks = currentSubtasks.map((sub: any) => 
        sub.id === subtaskId ? { ...sub, ...updates } : sub
      );
      
      // Tự động cập nhật is_completed dựa trên status
      if (updates.status) {
        const target = newSubtasks.find((s: any) => s.id === subtaskId);
        if (target) target.is_completed = updates.status === 'DONE';
      }

      await supabase.from('tasks').update({ subtasks: newSubtasks }).eq('id', task.id);
      
      // Tính toán lại tổng actual_minutes của task chính từ các subtasks
      const totalActual = newSubtasks.reduce((sum: number, s: any) => sum + (parseInt(s.actual_minutes) || 0), 0);
      await supabase.from('tasks').update({ actual_minutes: totalActual }).eq('id', task.id);

      refetch();
      if (selectedTask?.id === task.id) {
        setSelectedTask(prev => prev ? { ...prev, subtasks: newSubtasks, actual_minutes: totalActual } : null);
      }
    } catch (error) {
      console.error('Error updating subtask:', error);
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

  const handleExportCsv = () => {
    if (!tasks || tasks.length === 0) return;
    
    const headers = ['ID', 'Task Name', 'Project', 'Tag', 'Team', 'Type', 'Deadline Date', 'Deadline Time', 'Estimated Minutes', 'Actual Minutes', 'Status'];
    const csvContent = [
      headers.join(','),
      ...tasks.map(task => [
        task.id,
        `"${task.task_name.replace(/"/g, '""')}"`,
        `"${(task.projects?.name || 'General').replace(/"/g, '""')}"`,
        `"${(task.tags?.name || 'No Tag').replace(/"/g, '""')}"`,
        `"${(task.teams?.name || 'Internal').replace(/"/g, '""')}"`,
        task.type,
        task.deadline_date || '',
        task.deadline_time || '',
        task.estimated_minutes,
        task.actual_minutes,
        task.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tasks_export_${new Date().toISOString().split('T')[0]}.csv`);
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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'NEW': 'bg-[#EBF1FF] text-[#4A7CE1] border-[#D6E4FF]',
      'IN_PROGRESS': 'bg-[#FFF9EB] text-[#D97706] border-[#FEF3C7]',
      'DONE': 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]',
      'SKIPPED': 'bg-rose-50 text-rose-600 border-rose-100'
    };
    return statusMap[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-2 flex items-center bg-white shrink-0 border-b border-slate-100 justify-between">
        <div className="flex items-center gap-1.5">
          <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" placeholder="Tìm kiếm..." 
                value={filters.search || ""}
                className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm w-44 h-8 focus:outline-none focus:border-indigo-600 transition-all"
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>

            <select 
              value={filters.assignee_email || ""}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[120px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, assignee_email: e.target.value || undefined})}
            >
              <option value="">Assignees</option>
              {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
            </select>
            <select 
              value={filters.project_id || ""}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[100px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, project_id: e.target.value || undefined})}
            >
              <option value="">Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select 
              value={filters.tag_id || ""}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[90px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, tag_id: e.target.value || undefined})}
            >
              <option value="">Tags</option>
              {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <select 
              value={filters.team_id as string || ""}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[100px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, team_id: e.target.value || undefined})}
            >
              <option value="">Teams</option>
              {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>

            <select 
              value={filters.status || ""}
              className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[100px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer" 
              onChange={(e) => setFilters({...filters, status: e.target.value || undefined})}
            >
              <option value="">Status</option>
              <option value="NEW">New</option>
              <option value="DONE">Done</option>
              <option value="SKIPPED">Skipped</option>
            </select>

            <DateRangePicker 
              startDate={filters.startDate || ""}
              endDate={filters.endDate || ""}
              onChange={(start, end) => setFilters({...filters, startDate: start, endDate: end})}
            />

            <button 
              onClick={handleExportCsv}
              className="p-1 px-4 h-8 text-xs font-black text-slate-500 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all flex items-center gap-2 group uppercase tracking-widest"
              title="Export CSV"
            >
              <Download className="w-4 h-4 group-hover:text-indigo-600" />
              <span className="group-hover:text-indigo-600">CSV</span>
            </button>
            
            <button onClick={() => refetch()} className={cn("p-2 ml-1 text-slate-400 hover:text-indigo-600 transition-colors", loading && "animate-spin text-indigo-600")}>
               <RotateCw className="w-5 h-5" />
            </button>
          </div>
        <div className="flex items-center gap-2">
          {showCreate && (
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 h-8 px-5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
                <Plus className="w-4 h-4" /> <span>Create Task</span>
             </button>
          )}
        </div>
      </div>

      <CreateTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => refetch()} />

      <SideDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        title={selectedTask ? (
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{selectedTask.task_name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                ID: {selectedTask.id.substring(0, 8).toUpperCase()}
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded text-[9px] font-black uppercase border tracking-wider",
                getStatusBadge(selectedTask.status)
              )}>
                {selectedTask.status}
              </span>
            </div>
          </div>
        ) : "Task Detail"}
      >
        {selectedTask && (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-8">
              {/* SUB-TASKS MANAGEMENT SECTION */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">SUB-TASKS</h3>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
                    {selectedTask.subtasks?.filter((s:any) => s.is_completed).length || 0}/{selectedTask.subtasks?.length || 0}
                  </span>
                </div>
                
                <div className="space-y-1 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                  {selectedTask.subtasks?.map((sub: any) => (
                    <div key={sub.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100/50 shadow-sm transition-all group">
                      <button 
                        onClick={() => handleUpdateSubtask(selectedTask, sub.id, { is_completed: !sub.is_completed, status: !sub.is_completed ? 'DONE' : 'NEW' })}
                        className="shrink-0"
                      >
                        {sub.is_completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>

                      <div className="flex-1 flex items-center gap-1.5 text-[11px] min-w-0">
                        <span className={cn(
                          "font-bold text-slate-700 truncate min-w-0 flex-1",
                          sub.is_completed && "line-through text-slate-400 font-medium"
                        )}>
                          {sub.name}
                        </span>
                        <span className="text-slate-300 font-light">-</span>
                        <span className="shrink-0 text-slate-400 font-bold uppercase tracking-tighter truncate max-w-[80px]">
                          {sub.assignee?.split('@')[0] || 'Unassigned'}
                        </span>
                        <span className="text-slate-300 font-light">-</span>
                        <div className="flex items-center gap-1 shrink-0 font-black">
                          <span className="text-slate-400">{sub.estimated_minutes || 0}m</span>
                          <span className="text-slate-300 font-light">/</span>
                          <input 
                            type="number"
                            className="w-10 bg-indigo-50 text-primary border-none rounded px-1 focus:ring-0 text-center font-black"
                            value={sub.actual_minutes || 0}
                            onChange={(e) => handleUpdateSubtask(selectedTask, sub.id, { actual_minutes: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <span className="text-slate-300 font-light">-</span>
                        <select 
                          value={sub.status || (sub.is_completed ? 'DONE' : 'NEW')}
                          onChange={(e) => handleUpdateSubtask(selectedTask, sub.id, { status: e.target.value })}
                          className="bg-transparent text-[9px] font-black text-indigo-500 uppercase tracking-tighter focus:outline-none cursor-pointer hover:text-indigo-700 transition-colors"
                        >
                          <option value="NEW">New</option>
                          <option value="DONE">Done</option>
                          <option value="SKIPPED">Skip</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && (
                    <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No subtasks defined</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex gap-3 mt-auto">
              {['DONE', 'SKIPPED'].includes(selectedTask.status) ? (
                <button 
                  onClick={() => handleResetTask(selectedTask)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-lg shadow-slate-200 uppercase tracking-widest"
                >
                  <RotateCw size={14} />
                  <span>Reset Task</span>
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => {
                      const subtasks = selectedTask.subtasks || [];
                      const hasNew = subtasks.some((s: any) => (s.status || 'NEW') === 'NEW');
                      if (hasNew) {
                        alert('Không thể submit khi còn subtask ở trạng thái New');
                        return;
                      }
                      
                      let newStatus: string = 'DONE';
                      const hasDone = subtasks.some((s: any) => s.status === 'DONE');
                      const allSkipped = subtasks.length > 0 && subtasks.every((s: any) => s.status === 'SKIPPED');
                      
                      if (hasDone) newStatus = 'DONE';
                      else if (allSkipped) newStatus = 'SKIPPED';
                      else if (subtasks.length === 0) newStatus = 'DONE';

                      handleUpdateStatus(selectedTask.id, newStatus);
                      setIsDrawerOpen(false);
                    }}
                    disabled={updatingTask === selectedTask.id || (selectedTask.subtasks || []).some((s: any) => (s.status || 'NEW') === 'NEW')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 size={14} />
                    <span>Submit</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </SideDrawer>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse min-w-[1200px] table-fixed">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="w-[5%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">ID</th>
              <th className="w-[22%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Name</th>
              <th className="w-[18%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right pr-10">Project</th>
              <th className="w-[9%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Tag</th>
              <th className="w-[9%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Team</th>
              <th className="w-[8%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Type</th>
              <th className="w-[9%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Deadline</th>
              <th className="w-[9%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">Time</th>
              <th className="w-[6%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 text-center">Status</th>
              <th className="w-[5%] px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right pr-10">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 italic-none">
            {tasks.map((task) => (
              <tr 
                key={task.id} 
                className="hover:bg-indigo-50/30 transition-all group cursor-pointer"
                onClick={() => handleOpenDrawer(task)}
              >
                <td className="px-6 py-2">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                    {String(task.display_id || 0).padStart(6, '0')}
                  </p>
                </td>
                <td className="px-6 py-2 overflow-hidden">
                  <p className="font-bold text-slate-800 truncate text-sm tracking-tight" title={task.task_name}>{task.task_name}</p>
                </td>
                <td className="px-6 py-2 text-right pr-10">
                  <div className="text-indigo-600 font-bold text-[10px] uppercase tracking-wide truncate" title={task.projects?.name || 'General'}>
                    {task.projects?.name || 'General'}
                  </div>
                </td>
                <td className="px-6 py-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 text-slate-500 border border-slate-200 tracking-wider">
                    {task.tags?.name || 'No Tag'}
                  </span>
                </td>
                <td className="px-6 py-2 overflow-hidden">
                  <div className="text-[10px] font-bold text-slate-500 truncate uppercase tracking-tight" title={(task as any).team_ids?.join(', ') || task.teams?.name || 'Internal'}>
                    {(task as any).team_ids && (task as any).team_ids.length > 0 ? (
                      (task as any).team_ids.length > 1 
                        ? `${(task as any).team_ids[0]} +${(task as any).team_ids.length - 1}`
                        : (task as any).team_ids[0]
                    ) : (task.teams?.name || 'Internal')}
                  </div>
                </td>
                <td className="px-6 py-2">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                    {task.type}
                  </span>
                </td>
                <td className="px-6 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800">{task.deadline_time || '--:--'}</span>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                      {task.deadline_date || '--/--/--'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-2 text-[9px] font-black uppercase tracking-widest">
                  <div className="text-indigo-600">Est: {task.estimated_minutes}m</div>
                  <div className="text-emerald-600">Act: {task.actual_minutes}m</div>
                </td>
                <td className="px-6 py-2 text-center">
                   <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-widest", getStatusBadge(task.status))}>
                     {task.status || 'NEW'}
                   </span>
                </td>
                <td className="px-6 py-2 text-right pr-10">
                  <div className="flex items-center justify-end">
                    {['DONE', 'SKIPPED'].includes(task.status) ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleResetTask(task); }}
                        className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
                      >
                        <RotateCw size={16} />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const subtasks = task.subtasks || [];
                          let newStatus: string = 'DONE';
                          const hasDone = subtasks.some((s: any) => s.status === 'DONE');
                          const allSkipped = subtasks.length > 0 && subtasks.every((s: any) => s.status === 'SKIPPED');
                          if (hasDone) newStatus = 'DONE';
                          else if (allSkipped) newStatus = 'SKIPPED';
                          else if (subtasks.length === 0) newStatus = 'DONE';
                          handleUpdateStatus(task.id, newStatus); 
                        }}
                        disabled={['DONE', 'SKIPPED'].includes(task.status) || updatingTask === task.id || (task.subtasks || []).some((s: any) => (s.status || 'NEW') === 'NEW')}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all disabled:opacity-30"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-0.5 border-t border-slate-100 bg-white flex items-center justify-between">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[100px]">Tổng: {totalCount} Entities</span>
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
                    typeof item === 'number' ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700" : 
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

export default TaskList;