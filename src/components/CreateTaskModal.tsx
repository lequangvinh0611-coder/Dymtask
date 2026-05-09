import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Task } from '../types/database.types';

interface Subtask {
  id: string;
  content: string;
  assignee: string;
  estimated_minutes: number;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskToEdit?: Task | null; // Truyền task vào đây để bật chế độ Edit
}

const CreateTaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSuccess, taskToEdit }) => {
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
    type: 'ONCE' as 'ONCE' | 'DAILY' | 'WEEKLY',
    deadline_time: '09:00',
    deadline_days: [] as string[],
  });

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);

  // Đổ dữ liệu cũ vào form nếu là chế độ Edit
  useEffect(() => {
    if (isOpen) {
      fetchMetadata();
      if (taskToEdit) {
        setFormData({
          task_name: taskToEdit.task_name,
          project_id: taskToEdit.project_id || '',
          team_id: taskToEdit.team_id || '',
          tag_id: taskToEdit.tag_id || '',
          type: taskToEdit.type,
          deadline_time: taskToEdit.deadline_time || '09:00',
          deadline_days: taskToEdit.deadline_days || [],
        });
        setSubtasks((taskToEdit.subtasks as any as Subtask[]) || []);
      } else {
        // Reset form cho mode Create
        setFormData({ task_name: '', project_id: '', team_id: '', tag_id: '', type: 'ONCE', deadline_time: '09:00', deadline_days: [] });
        if (profile?.email) {
          setSubtasks([{ id: crypto.randomUUID(), content: '', assignee: profile.email, estimated_minutes: 30 }]);
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

  const totalEstimatedMinutes = subtasks.reduce((sum, st) => sum + (Number(st.estimated_minutes) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subtasks.length === 0 || totalEstimatedMinutes <= 0) {
      alert('Vui lòng thêm ít nhất 1 subtask với thời gian > 0');
      return;
    }

    setLoading(true);
    const uniqueAssignees = Array.from(new Set(subtasks.map(st => st.assignee).filter(Boolean)));
    
    const payload = {
      task_name: formData.task_name,
      project_id: formData.project_id || null,
      team_id: formData.team_id || null,
      tag_id: formData.tag_id || null,
      type: formData.type,
      deadline_time: formData.deadline_time,
      deadline_days: formData.deadline_days.length > 0 ? formData.deadline_days : null,
      estimated_minutes: totalEstimatedMinutes,
      assignees: uniqueAssignees,
      subtasks: subtasks
    };

    try {
      let result;
      if (isEditMode && taskToEdit) {
        result = await supabase.from('tasks').update(payload).eq('id', taskToEdit.id);
      } else {
        result = await supabase.from('tasks').insert({ ...payload, status: 'NEW', is_active: true, actual_minutes: 0 });
      }

      if (result.error) throw result.error;
      onSuccess();
      onClose();
    } catch (error: any) {
      alert('Lỗi: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-2xl my-8 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
            {isEditMode ? 'Edit Task' : 'Create New Task'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <input 
              required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
              placeholder="Task name..." value={formData.task_name}
              onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
            />
            
            <div className="grid grid-cols-3 gap-4">
               <select className="px-3 py-2 bg-slate-50 border rounded-xl text-xs" value={formData.project_id} onChange={(e) => setFormData({...formData, project_id: e.target.value})}>
                  <option value="">Project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
               <select className="px-3 py-2 bg-slate-50 border rounded-xl text-xs" value={formData.team_id} onChange={(e) => setFormData({...formData, team_id: e.target.value})}>
                  <option value="">Team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
               <select className="px-3 py-2 bg-slate-50 border rounded-xl text-xs" value={formData.tag_id} onChange={(e) => setFormData({...formData, tag_id: e.target.value})}>
                  <option value="">Tag</option>
                  {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
               </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <select className="px-3 py-2 bg-slate-50 border rounded-xl text-xs" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value as any})}>
                  <option value="ONCE">ONCE</option>
                  <option value="DAILY">DAILY</option>
                  <option value="WEEKLY">WEEKLY</option>
               </select>
               <input type="time" className="px-3 py-2 bg-slate-50 border rounded-xl text-xs" value={formData.deadline_time} onChange={(e) => setFormData({...formData, deadline_time: e.target.value})} />
            </div>
          </div>

          <div className="space-y-3">
             <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase">Subtasks (Total: {totalEstimatedMinutes}m)</label>
                <button type="button" onClick={() => setSubtasks([...subtasks, { id: crypto.randomUUID(), content: '', assignee: profile?.email || '', estimated_minutes: 10 }])}
                   className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg">
                   <Plus size={12} /> Add
                </button>
             </div>
             <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {subtasks.length === 0 && <div className="text-xs text-red-500 py-2">Bắt buộc phải có ít nhất 1 subtask.</div>}
                {subtasks.map((st, idx) => (
                   <div key={st.id} className="flex gap-2 bg-slate-50 p-2 rounded-xl border">
                      <input required className="flex-1 px-3 py-1.5 bg-white border rounded-lg text-xs" placeholder="Content..." value={st.content} onChange={(e) => {
                         const news = [...subtasks]; news[idx].content = e.target.value; setSubtasks(news);
                      }} />
                      <select required className="w-32 px-2 py-1.5 bg-white border rounded-lg text-[10px]" value={st.assignee} onChange={(e) => {
                         const news = [...subtasks]; news[idx].assignee = e.target.value; setSubtasks(news);
                      }}>
                         <option value="" disabled>User</option>
                         {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
                      </select>
                      <input required type="number" min="1" className="w-16 px-2 py-1.5 bg-white border rounded-lg text-xs text-center" value={st.estimated_minutes || ''} onChange={(e) => {
                         const news = [...subtasks]; news[idx].estimated_minutes = parseInt(e.target.value) || 0; setSubtasks(news);
                      }} />
                      <button type="button" onClick={() => setSubtasks(subtasks.filter(s => s.id !== st.id))} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                   </div>
                ))}
             </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-xs font-black bg-slate-100 rounded-xl uppercase">Cancel</button>
            <button type="submit" disabled={loading || subtasks.length === 0} className="flex-[2] py-3 text-xs font-black text-white bg-indigo-600 rounded-xl uppercase shadow-lg">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditMode ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;