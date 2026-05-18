import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Plus, Trash2, CalendarDays, Clock, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Task } from '../types/database.types';
import { SearchableSelect } from './ui/SearchableSelect';
import { logger } from '../lib/logger';

interface Subtask {
  id: string;
  name: string;
  assignee: string;
  estimated_minutes: number;
  is_completed?: boolean;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskToEdit?: Task | null;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSuccess, taskToEdit }) => {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!taskToEdit;
  
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  const [formData, setFormData] = useState({
    task_name: '',
    project_id: '',
    tag_id: '',
    type: 'ONETIME' as 'ONETIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
    deadline_time: '09:00',
    deadline_days: [] as string[],
    deadline_date: new Date().toISOString().split('T')[0],
    deadline_day_num: 1,
  });

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const totalEstimatedMinutes = subtasks.reduce((sum, st) => sum + (Number(st.estimated_minutes) || 0), 0);

  useEffect(() => {
    if (isOpen) {
      fetchMetadata();
      if (taskToEdit) {
        setFormData({
          task_name: taskToEdit.task_name,
          project_id: taskToEdit.project_id || '',
          tag_id: taskToEdit.tag_id || '',
          type: (taskToEdit.type === 'ONCE' ? 'ONETIME' : taskToEdit.type) as any,
          deadline_time: taskToEdit.deadline_time || '09:00',
          deadline_days: taskToEdit.deadline_days || [],
          deadline_date: taskToEdit.deadline_date || new Date().toISOString().split('T')[0],
          deadline_day_num: taskToEdit.deadline_day_num || 1,
        });
        setSubtasks((taskToEdit.subtasks as any as Subtask[]) || []);
      } else {
        setFormData({
          task_name: '', project_id: '', tag_id: '',
          type: 'ONETIME', deadline_time: '09:00', deadline_days: [],
          deadline_date: new Date().toISOString().split('T')[0], deadline_day_num: 1
        });
        if (profile?.email) {
          setSubtasks([{ id: crypto.randomUUID(), name: '', assignee: profile.email, estimated_minutes: 30 }]);
        } else {
          setSubtasks([]);
        }
      }
    }
  }, [isOpen, taskToEdit, profile]);

  const fetchMetadata = async () => {
    const [projRes, teamRes, tagRes, userRes] = await Promise.all([
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('teams').select('id, name').order('name'),
      supabase.from('tags').select('id, name').order('name'),
      supabase.from('users').select('id, name, email').order('name'),
    ]);
    if (projRes.data) setProjects(projRes.data);
    if (teamRes.data) setTeams(teamRes.data);
    if (tagRes.data) setTags(tagRes.data);
    if (userRes.data) setUsers(userRes.data);
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      deadline_days: prev.deadline_days.includes(day)
        ? prev.deadline_days.filter(d => d !== day)
        : [...prev.deadline_days, day]
    }));
  };

  const handleAddSubtask = () => {
    setSubtasks([
      ...subtasks,
      { id: crypto.randomUUID(), name: '', assignee: profile?.email || '', estimated_minutes: 30 }
    ]);
  };

  const updateSubtask = (id: string, updates: Partial<Subtask>) => {
    setSubtasks(prev => prev.map(st => st.id === id ? { ...st, ...updates } : st));
  };

  const removeSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(st => st.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile?.id) {
      alert('❌ Profile ID missing!');
      return;
    }

    if (subtasks.length === 0 || totalEstimatedMinutes <= 0) {
      alert('Vui lòng thêm ít nhất 1 subtask với thời gian ước tính > 0.');
      return;
    }

    if (!formData.task_name.trim()) {
      alert('Task name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const uniqueAssigneeEmails = Array.from(new Set(subtasks.map(st => st.assignee).filter(Boolean)));
      
      // Derive teams from assignees
      const assigneeUsers = users.filter(u => uniqueAssigneeEmails.includes(u.email));
      // Each user has a 'teams' field in the DB (based on Settings update logic)
      // Since we don't have a direct join here, we'll fetch full user details if needed, 
      // but let's assume 'users' already has 'teams' from fetchMetadata if we modify it.
      
      // Fetch user team info specifically
      const { data: userDataWithTeams } = await supabase
        .from('users')
        .select('email, teams')
        .in('email', uniqueAssigneeEmails);
      
      const derivedTeams = Array.from(new Set((userDataWithTeams || []).flatMap(u => (u as any).teams || [])));
      const firstTeamName = derivedTeams[0] || null;
      
      // Get team ID for the first team name if possible, or just store names? 
      // Existing code uses team_id (UUID). Let's find the ID for the first team name.
      const { data: teamObj } = firstTeamName 
        ? await supabase.from('teams').select('id').eq('name', firstTeamName).single()
        : { data: null };

      const structuredSubtasks = subtasks.map(st => ({
        id: st.id || crypto.randomUUID(),
        name: st.name.trim(),
        assignee: st.assignee,
        estimated_minutes: Number(st.estimated_minutes) || 0,
        is_completed: st.is_completed || false
      }));

      const taskPayload: any = {
        task_name: formData.task_name.trim(),
        project_id: formData.project_id || null,
        team_id: teamObj?.id || null, // Keep for backward compatibility
        team_ids: derivedTeams, // New column to store all derived team names
        tag_id: formData.tag_id || null,
        type: formData.type,
        deadline_time: formData.deadline_time || null,
        deadline_days: formData.type === 'WEEKLY' ? formData.deadline_days : [],
        deadline_date: formData.type === 'ONETIME' ? formData.deadline_date : null,
        deadline_day_num: formData.type === 'MONTHLY' ? formData.deadline_day_num : null,
        estimated_minutes: totalEstimatedMinutes,
        assignees: uniqueAssigneeEmails,
        user_id: profile.id,  
        status: isEditMode && taskToEdit ? taskToEdit.status : ('NEW' as const),
        is_active: true,
        actual_minutes: isEditMode && taskToEdit ? taskToEdit.actual_minutes : 0,
        subtasks: structuredSubtasks
      };

      console.log('🚀 SYSTEM_DEBUG: Saving to public.tasks table...');
      console.log('📦 SYSTEM_DEBUG: Payload:', taskPayload);

      if (isEditMode && taskToEdit) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update(taskPayload)
          .eq('id', taskToEdit.id);
          
        if (updateError) throw updateError;
        await logger.log('UPDATE_TASK', `Updated task: ${formData.task_name}`, { taskId: taskToEdit.id });
      } else {
        const { error: insertError } = await supabase
          .from('tasks')
          .insert(taskPayload);
        
        if (insertError) {
          console.error('🔥 SYSTEM_DEBUG: Supabase tasks table insertion failed:', insertError);
          throw insertError;
        }
        await logger.log('CREATE_TASK', `Created new task: ${formData.task_name}`);
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('⛔ SYSTEM_DEBUG: TASK_SAVE_FAILURE:', error);
      alert(`Lỗi hệ thống: ${error.message || 'Không thể kết nối database'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl my-8 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
            {isEditMode ? 'Edit Task v1.0.1' : 'Create New Task v1.0.1'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Main Task Info */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Task Name</label>
            <input 
              required 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
              placeholder="What needs to be done?" 
              value={formData.task_name} 
              onChange={(e) => setFormData({ ...formData, task_name: e.target.value })} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Project</label>
              <SearchableSelect 
                options={projects} 
                value={formData.project_id} 
                onChange={(val) => setFormData({ ...formData, project_id: val })}
                placeholder="Select Project"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tag</label>
              <SearchableSelect 
                options={tags} 
                value={formData.tag_id} 
                onChange={(val) => setFormData({ ...formData, tag_id: val })}
                placeholder="Select Tag"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Type</label>
              <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}>
                <option value="ONETIME">ONETIME</option>
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Time Deadline</label>
              <input type="time" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={formData.deadline_time} onChange={(e) => setFormData({ ...formData, deadline_time: e.target.value })} />
            </div>
          </div>

          <div className="h-[72px] border-t border-slate-100 pt-3">
            {formData.type === 'WEEKLY' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  <CalendarDays size={12} /> Repeat Days
                </label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all border",
                        formData.deadline_days.includes(day) 
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" 
                          : "bg-white border-slate-200 text-slate-500 hover:bg-primary/5 hover:border-primary/20"
                      )}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.type === 'MONTHLY' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  <Calendar size={12} /> Day of Month (1-31)
                </label>
                <input type="number" min="1" max="31" className="w-24 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-all"
                  value={formData.deadline_day_num} onChange={(e) => setFormData({ ...formData, deadline_day_num: parseInt(e.target.value) || 1 })} />
              </div>
            )}

            {formData.type === 'ONETIME' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  <Calendar size={12} /> Specific Date
                </label>
                <input type="date" className="w-full max-w-[200px] px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-primary transition-all"
                  value={formData.deadline_date} onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })} />
              </div>
            )}
            
            {formData.type === 'DAILY' && (
               <div className="h-full flex items-center justify-center animate-in fade-in">
                  <span className="text-xs font-bold text-slate-300 italic uppercase tracking-widest">Repeats every day</span>
               </div>
            )}
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtasks</label>
                <span className="flex items-center gap-1 text-[10px] font-black text-primary bg-primary-light px-3 py-1 rounded-full border border-primary/10">
                  <Clock size={12} />
                  Est: {totalEstimatedMinutes}m
                </span>
              </div>
              <button 
                type="button" 
                onClick={handleAddSubtask} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg hover:bg-black transition-all shadow-lg shadow-black/10 uppercase tracking-widest"
              >
                <Plus size={12} /> Add Subtask
              </button>
            </div>
            
            <div className="space-y-3 max-h-[180px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              {subtasks.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">No subtasks added yet</p>
                </div>
              ) : (
                subtasks.map((st) => (
                  <div key={st.id} className="flex gap-3 items-start bg-white p-3 rounded-2xl border border-slate-100 shadow-sm group hover:border-primary/20 transition-all">
                    <input required className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary font-medium"
                      placeholder="Subtask name..." value={st.name} onChange={(e) => updateSubtask(st.id, { name: e.target.value })} />
                    
                    <div className="w-40">
                      <SearchableSelect 
                        options={users} 
                        value={users.find(u => u.email === st.assignee)?.id || ''} 
                        onChange={(val) => {
                          const user = users.find(u => u.id === val);
                          if (user) updateSubtask(st.id, { assignee: user.email });
                        }}
                        placeholder="Assignee"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input type="number" min="1" required className="w-16 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center focus:outline-none focus:border-primary"
                        value={st.estimated_minutes || ''} onChange={(e) => updateSubtask(st.id, { estimated_minutes: parseInt(e.target.value) || 0 })} />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">m</span>
                    </div>

                    <button type="button" onClick={() => removeSubtask(st.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all uppercase tracking-widest">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || !profile?.id || subtasks.length === 0 || totalEstimatedMinutes <= 0} 
              className="flex-[2] py-3.5 text-xs font-black text-white bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEditMode ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;