import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Plus, Trash2, UserPlus, CalendarDays } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface Subtask {
  id: string;
  content: string;
  assignee: string;
  estimated_minutes: number;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  
  // Metadata States
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  // Task Form States - Updated according to Phase 2 Migration
  const [formData, setFormData] = useState({
    task_name: '',
    project_id: '',
    team_id: '',
    tag_id: '',
    type: 'ONCE',
    deadline_time: '09:00',
    deadline_days: [] as string[],
    estimated_minutes: 30,
  });

  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchMetadata();
      // Reset to current user email as default assignee if profile exists
      if (profile?.email) {
        setSelectedAssignees([profile.email]);
      }
    }
  }, [isOpen, profile]);

  const fetchMetadata = async () => {
    try {
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
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  const handleAddSubtask = () => {
    const newSubtask: Subtask = {
      id: crypto.randomUUID(),
      content: '',
      assignee: profile?.email || '',
      estimated_minutes: 10,
    };
    setSubtasks([...subtasks, newSubtask]);
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const updateSubtask = (id: string, updates: Partial<Subtask>) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const toggleAssignee = (email: string) => {
    setSelectedAssignees(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      deadline_days: prev.deadline_days.includes(day)
        ? prev.deadline_days.filter(d => d !== day)
        : [...prev.deadline_days, day]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !profile?.email) return;

    setLoading(true);
    try {
      // Updated payload to match new Supabase Schema
      const { error } = await supabase.from('tasks').insert({
        task_name: formData.task_name,
        project_id: formData.project_id || null,
        team_id: formData.team_id || null,
        tag_id: formData.tag_id || null,
        type: formData.type,
        deadline_time: formData.deadline_time || null,
        deadline_days: formData.deadline_days.length > 0 ? formData.deadline_days : null,
        estimated_minutes: formData.estimated_minutes,
        actual_minutes: 0, // Mặc định 0 khi mới tạo
        status: 'NEW',
        assignees: selectedAssignees,
        subtasks: subtasks.map(({ content, assignee, estimated_minutes }) => ({
          content,
          assignee,
          estimated_minutes,
          completed: false
        })),
      });

      if (error) throw error;
      
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        task_name: '',
        project_id: '',
        team_id: '',
        tag_id: '',
        type: 'ONCE',
        deadline_time: '09:00',
        deadline_days: [],
        estimated_minutes: 30,
      });
      setSelectedAssignees([profile.email]);
      setSubtasks([]);
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl my-8 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Create New Task</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Main Task Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Task Name</label>
              <input 
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                placeholder="What needs to be done?"
                value={formData.task_name}
                onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Project</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                >
                  <option value="">Select Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Team</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                >
                  <option value="">Select Team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Tag</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  value={formData.tag_id}
                  onChange={(e) => setFormData({ ...formData, tag_id: e.target.value })}
                >
                  <option value="">Select Tag</option>
                  {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Type</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="DAILY">DAILY</option>
                  <option value="WEEKLY">WEEKLY</option>
                  <option value="ONCE">ONCE</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Time Deadline</label>
                <input 
                  type="time"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  value={formData.deadline_time}
                  onChange={(e) => setFormData({ ...formData, deadline_time: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">Est. Minutes</label>
                <input 
                  type="number"
                  min="1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  value={formData.estimated_minutes}
                  onChange={(e) => setFormData({ ...formData, estimated_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Render Day Picker conditionally if type is WEEKLY */}
            {formData.type === 'WEEKLY' && (
              <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-2">
                  <CalendarDays size={12} />
                  Repeat Days
                </label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        formData.deadline_days.includes(day)
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Assignees Selection */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
              <UserPlus size={12} />
              Assignees (Multi-select)
            </label>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 min-h-[50px]">
              {users.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleAssignee(u.email)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                    selectedAssignees.includes(u.email)
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50'
                  }`}
                >
                  {u.name || u.email}
                </button>
              ))}
            </div>
          </div>

          {/* Subtasks Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter">Subtasks</label>
              <button 
                type="button"
                onClick={handleAddSubtask}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg hover:bg-black transition-all shadow-sm"
              >
                <Plus size={12} />
                Add Subtask
              </button>
            </div>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              {subtasks.length === 0 ? (
                <div className="py-4 text-center border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                  <p className="text-[10px] text-slate-400 font-bold italic uppercase tracking-widest">No subtasks yet</p>
                </div>
              ) : (
                subtasks.map((st) => (
                  <div key={st.id} className="flex gap-2 items-start bg-slate-50 p-2 rounded-xl border border-slate-100 group">
                    <input 
                      required
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium transition-all"
                      placeholder="Subtask content..."
                      value={st.content}
                      onChange={(e) => updateSubtask(st.id, { content: e.target.value })}
                    />
                    <select 
                      className="w-32 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none focus:border-indigo-500 transition-all"
                      value={st.assignee}
                      onChange={(e) => updateSubtask(st.id, { assignee: e.target.value })}
                    >
                      {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <input 
                        type="number"
                        min="1"
                        className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:border-indigo-500 transition-all"
                        value={st.estimated_minutes}
                        onChange={(e) => updateSubtask(st.id, { estimated_minutes: parseInt(e.target.value) || 0 })}
                      />
                      <span className="text-[10px] font-bold text-slate-400">m</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeSubtask(st.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading || selectedAssignees.length === 0}
              className="flex-[2] py-3.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;