import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Plus, Trash2, CalendarDays, Clock, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Task } from '../types/database.types';

interface Subtask {
  id: string;
  name: string;
  assignee: string;
  estimated_minutes: number;
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
    team_id: '',
    tag_id: '',
    type: 'ONETIME' as 'ONETIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
    deadline_time: '09:00',
    deadline_days: [] as string[],
    deadline_date: new Date().toISOString().split('T')[0],
    deadline_day_num: 1,
  });

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const totalEstimatedMinutes = subtasks.reduce((sum, st) => sum + (Number(st.estimated_minutes) || 0), 0);

  useEffect(() => {
    if (isOpen) {
      fetchMetadata();
      if (taskToEdit) {
        setFormData({
          task_name: taskToEdit.task_name,
          project_id: taskToEdit.project_id || '',
          team_id: taskToEdit.team_id || '',
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
          task_name: '', project_id: '', team_id: '', tag_id: '',
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
    
    // ✅ DIAGNOSTIC LOGGING
    const debugData = {
      'profile object': profile,
      'profile.id': profile?.id,
      'profile.id type': typeof profile?.id,
      'profile.id length': (profile?.id || '').length,
      'profile.id is null?': profile?.id === null,
      'profile.id is undefined?': profile?.id === undefined,
      'profile.id is empty string?': profile?.id === '',
    };
    
    console.group('🔍 DEBUG CREATE TASK');
    console.log('Full profile:', profile);
    console.table(debugData);
    console.groupEnd();
    
    setDebugInfo(JSON.stringify(debugData, null, 2));

    if (!profile?.id) {
      const msg = `❌ Profile ID missing!\n\nDebug:\n${JSON.stringify(debugData, null, 2)}`;
      alert(msg);
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
      const uniqueAssignees = Array.from(new Set(subtasks.map(st => st.assignee).filter(Boolean)));

      const taskPayload = {
        task_name: formData.task_name,
        project_id: formData.project_id || null,
        team_id: formData.team_id || null,
        tag_id: formData.tag_id || null,
        type: formData.type,
        deadline_time: formData.deadline_time || null,
        deadline_days: formData.type === 'WEEKLY' ? formData.deadline_days : null,
        deadline_date: formData.type === 'ONETIME' ? formData.deadline_date : null,
        deadline_day_num: formData.type === 'MONTHLY' ? formData.deadline_day_num : null,
        estimated_minutes: totalEstimatedMinutes,
        assignees: uniqueAssignees,
        user_id: profile.id,  // ✅ Guaranteed non-null due to validation above
        status: 'NEW',
        is_active: true,
        actual_minutes: 0,
      };

      console.log('📤 Sending taskPayload:', taskPayload);

      let taskId = taskToEdit?.id;

      if (isEditMode && taskToEdit) {
        const { error: updateError } = await supabase.from('tasks').update(taskPayload).eq('id', taskId);
        if (updateError) throw updateError;
        await supabase.from('subtasks').delete().eq('task_id', taskId);
      } else {
        const { data, error: insertError } = await supabase.from('tasks').insert({
          ...taskPayload
        }).select('id').single();
        
        if (insertError) {
          console.error('❌ Insert error:', insertError);
          throw insertError;
        }
        taskId = data.id;
      }

      if (taskId) {
        const subtasksPayload = subtasks.map(st => ({
          task_id: taskId,
          name: st.name,
          assignee: st.assignee,
          estimated_minutes: st.estimated_minutes,
          is_completed: false
        }));
        
        console.log('📤 Sending subtasks:', subtasksPayload);
        
        const { error: subError } = await supabase.from('subtasks').insert(subtasksPayload);
        if (subError) {
          console.error('❌ Subtask error:', subError);
          throw subError;
        }
      }

      alert('✅ Task created successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('❌ LỖI LƯU TASK:', error);
      const errorMsg = error.message || error.details || 'Unknown error';
      alert(`Error creating task:\n${errorMsg}\n\nDebug Info:\n${JSON.stringify(debugData, null, 2)}`);
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
            {isEditMode ? 'Edit Task' : 'Create New Task'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DEBUG INFO DISPLAY */}
        {debugInfo && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
            <p className="text-[10px] font-bold text-amber-700 mb-2">🔍 DEBUG INFO:</p>
            <pre className="text-[9px] text-amber-600 bg-white p-2 rounded border border-amber-200 overflow-x-auto max-h-[100px]">
              {debugInfo}
            </pre>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Main Task Info */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Task Name</label>
            <input required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              placeholder="What needs to be done?" value={formData.task_name} onChange={(e) => setFormData({ ...formData, task_name: e.target.value })} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Project</label>
              <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}>
                <option value="">Select Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Team</label>
              <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                value={formData.team_id} onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}>
                <option value="">Select Team</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Tag</label>
              <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                value={formData.tag_id} onChange={(e) => setFormData({ ...formData, tag_id: e.target.value })}>
                <option value="">Select Tag</option>
                {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Type</label>
              <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}>
                <option value="ONETIME">ONETIME</option>
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Time Deadline</label>
              <input type="time" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                value={formData.deadline_time} onChange={(e) => setFormData({ ...formData, deadline_time: e.target.value })} />
            </div>
          </div>

          <div className="h-[72px] border-t border-slate-100 pt-3 mt-2">
            {formData.type === 'WEEKLY' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">
                  <CalendarDays size={12} /> Repeat Days
                </label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        formData.deadline_days.includes(day) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:bg-indigo-50'
                      }`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.type === 'MONTHLY' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">
                  <Calendar size={12} /> Day of Month (1-31)
                </label>
                <input type="number" min="1" max="31" className="w-1/3 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500"
                  value={formData.deadline_day_num} onChange={(e) => setFormData({ ...formData, deadline_day_num: parseInt(e.target.value) || 1 })} />
              </div>
            )}

            {formData.type === 'ONETIME' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">
                  <Calendar size={12} /> Specific Date
                </label>
                <input type="date" className="w-1/2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500"
                  value={formData.deadline_date} onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })} />
              </div>
            )}
            
            {formData.type === 'DAILY' && (
               <div className="h-full flex items-center justify-center animate-in fade-in">
                  <span className="text-xs font-bold text-slate-300 italic">Repeats every day</span>
               </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Subtasks Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter">Subtasks</label>
                <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                  <Clock size={12} />
                  Total Est: {totalEstimatedMinutes}m
                </span>
              </div>
              <button type="button" onClick={handleAddSubtask} className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg hover:bg-black transition-all shadow-sm">
                <Plus size={12} /> Add Subtask
              </button>
            </div>
            
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              {subtasks.length === 0 ? (
                <div className="py-6 text-center border-2 border-dashed border-red-200 rounded-xl bg-red-50/50">
                  <p className="text-xs text-red-500 font-bold tracking-tight">At least 1 subtask is required!</p>
                </div>
              ) : (
                subtasks.map((st) => (
                  <div key={st.id} className="flex gap-2 items-start bg-slate-50 p-2 rounded-xl border border-slate-100 group">
                    <input required className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 font-medium"
                      placeholder="Subtask name..." value={st.name} onChange={(e) => updateSubtask(st.id, { name: e.target.value })} />
                    <select required className="w-32 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none focus:border-indigo-500"
                      value={st.assignee} onChange={(e) => updateSubtask(st.id, { assignee: e.target.value })}>
                      <option value="" disabled>Select User</option>
                      {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <input type="number" min="1" required className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                        value={st.estimated_minutes || ''} onChange={(e) => updateSubtask(st.id, { estimated_minutes: parseInt(e.target.value) || 0 })} />
                      <span className="text-[10px] font-bold text-slate-400">m</span>
                    </div>
                    <button type="button" onClick={() => removeSubtask(st.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all uppercase tracking-widest">
              Cancel
            </button>
            <button type="submit" disabled={loading || !profile?.id || subtasks.length === 0 || totalEstimatedMinutes <= 0} className="flex-[2] py-3 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 uppercase tracking-widest">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {!profile?.id ? 'Loading...' : (isEditMode ? 'Update Task' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;