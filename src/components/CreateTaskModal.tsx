import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Clock, Loader2, Plus, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';

// TS interfaces matching the schema
interface SubTask {
  id: string;
  content: string;
  assignee: string;
  estimated_minutes: number;
}

interface TaskMetadata {
  description: string;
  project_name: string;
  team_name: string;
  tag_name: string;
  deadline_time: string;
  deadline_days: string;
  sub_tasks: SubTask[];
}

interface DbTask {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string; // 'ON' / 'OFF' for template switcher
  is_active: boolean;
  est_time: number;
  actual_time: number;
  created_at: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskToEdit?: DbTask | null;
}

const DAYS_OF_WEEK = [
  { label: 'M', value: 'Mon', fullName: 'Monday' },
  { label: 'T', value: 'Tue', fullName: 'Tuesday' },
  { label: 'W', value: 'Wed', fullName: 'Wednesday' },
  { label: 'T', value: 'Thu', fullName: 'Thursday' },
  { label: 'F', value: 'Fri', fullName: 'Friday' },
  { label: 'S', value: 'Sat', fullName: 'Saturday' },
  { label: 'S', value: 'Sun', fullName: 'Sunday' }
];

// Conversions for 24h input format to AM/PM and vice versa
const convertTo24h = (timeStr: string): string => {
  if (!timeStr) return '09:00';
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;

  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  return '09:00';
};

const convertToDisplayTime = (time24: string): string => {
  if (!time24) return '09:00 AM';
  const match = time24.trim().match(/^(\d{2}):(\d{2})$/);
  if (match) {
    const hours = parseInt(match[1]);
    const minutes = match[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displHours = hours % 12 || 12;
    return `${String(displHours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
  return time24;
};

const parseTaskDescription = (rawDescription: any): TaskMetadata => {
  const defaultMeta: TaskMetadata = {
    description: '',
    project_name: '',
    team_name: '',
    tag_name: '',
    deadline_time: '09:00 AM',
    deadline_days: 'Mon - Fri',
    sub_tasks: []
  };

  if (!rawDescription) return defaultMeta;

  if (typeof rawDescription === 'object') {
    return {
      description: rawDescription.description || '',
      project_name: rawDescription.project_name || '',
      team_name: rawDescription.team_name || '',
      tag_name: rawDescription.tag_name || '',
      deadline_time: rawDescription.deadline_time || '09:00 AM',
      deadline_days: rawDescription.deadline_days || 'Mon - Fri',
      sub_tasks: Array.isArray(rawDescription.sub_tasks) ? rawDescription.sub_tasks : []
    };
  }

  if (typeof rawDescription === 'string') {
    const trimmed = rawDescription.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          description: parsed.description || '',
          project_name: parsed.project_name || '',
          team_name: parsed.team_name || '',
          tag_name: parsed.tag_name || '',
          deadline_time: parsed.deadline_time || '09:00 AM',
          deadline_days: parsed.deadline_days || 'Mon - Fri',
          sub_tasks: Array.isArray(parsed.sub_tasks) ? parsed.sub_tasks : []
        };
      } catch {
        // JSON format issue, fallback to normal values
      }
    }
  }

  return {
    ...defaultMeta,
    description: String(rawDescription)
  };
};

const serializeTaskDescription = (metadata: TaskMetadata): any => {
  return metadata;
};

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSuccess, taskToEdit }) => {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const isEditMode = !!taskToEdit;

  const [masterData, setMasterData] = useState<{
    projects: string[];
    teams: string[];
    tags: string[];
    assignees: string[];
  }>({
    projects: [],
    teams: [],
    tags: [],
    assignees: []
  });

  // Form states matching mockup & requirements
  const [taskName, setTaskName] = useState('');
  const [project, setProject] = useState('');
  const [tag, setTag] = useState('');
  const [team, setTeam] = useState('');
  const [taskType, setTaskType] = useState('');

  // Time is managed as 24h internally ("09:00" etc.)
  const [deadlineTime24h, setDeadlineTime24h] = useState('');

  // Inputs depending on selected type
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [monthlyDays, setMonthlyDays] = useState('');
  const [oneTimeDate, setOneTimeDate] = useState('');

  // Subtasks list
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);

  // Fetch Master Data on open
  useEffect(() => {
    if (isOpen) {
      const fetchMasterData = async () => {
        try {
          const [projRes, teamRes, tagRes, userRes] = await Promise.all([
            supabase.from('projects').select('name').eq('is_active', true).order('name', { ascending: true }),
            supabase.from('teams').select('name').eq('is_active', true).order('name', { ascending: true }),
            supabase.from('tags').select('name').eq('is_active', true).order('name', { ascending: true }),
            supabase.from('users').select('name').eq('status', 'ACTIVE').order('name', { ascending: true })
          ]);

          const projectsList = (projRes.data || []).map((p: any) => p.name);
          const teamsList = (teamRes.data || []).map((t: any) => t.name);
          const tagsList = (tagRes.data || []).map((t: any) => t.name);
          const assigneesList = (userRes.data || []).map((u: any) => u.name);

          setMasterData({
            projects: projectsList,
            teams: teamsList,
            tags: tagsList,
            assignees: assigneesList
          });
        } catch (err) {
          console.error('Error fetching master data for CreateTaskModal:', err);
        }
      };
      fetchMasterData();
    }
  }, [isOpen]);

  // Sync / Reset on mount / edit trigger & master data load
  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        const meta = parseTaskDescription(taskToEdit.description);
        setTaskName(taskToEdit.title || '');
        setProject(meta.project_name || '');
        setTag(meta.tag_name || '');
        setTeam(meta.team_name || '');
        setTaskType(taskToEdit.task_type || '');

        // Parse structures matching exact time elements
        const currentDeadlineTime = meta.deadline_time || '';
        if (currentDeadlineTime) {
          setDeadlineTime24h(convertTo24h(currentDeadlineTime));
        } else {
          setDeadlineTime24h('');
        }

         const daysStr = meta.deadline_days || '';
        if (taskToEdit.task_type === 'DAILY') {
          // Defaults
        } else if (taskToEdit.task_type === 'WEEKLY') {
          const parsed = daysStr.split(/[\s,]+/).map(d => d.trim()).filter(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(d));
          setSelectedDays(parsed);
        } else if (taskToEdit.task_type === 'MONTHLY') {
          setMonthlyDays(daysStr);
        } else if (taskToEdit.task_type === 'ONETIME') {
          setOneTimeDate(daysStr);
        }

        setSubTasks(meta.sub_tasks || []);
      } else {
        // Reset inputs on Create New to empty / unselected as requested
        setTaskName('');
        setProject('');
        setTag('');
        setTeam(profile?.team_ids?.[0] || 'No Team');
        setTaskType('');
        setDeadlineTime24h('');
        setSelectedDays([]);
        setMonthlyDays('');
        setOneTimeDate('');

        setSubTasks([{
          id: Math.random().toString(36).substring(2, 9),
          content: '',
          assignee: '',
          estimated_minutes: 0
        }]);
      }
    }
  }, [isOpen, taskToEdit, profile]);

  // Sync team whenever profile is available/changed if not in edit mode
  useEffect(() => {
    if (isOpen && !taskToEdit && profile) {
      setTeam(profile.team_ids?.[0] || 'No Team');
    }
  }, [isOpen, taskToEdit, profile]);

  // Handle Quick Day selection toggle for WEEKLY type
  const handleToggleDay = (dayValue: string) => {
    let nextDays = [...selectedDays];
    if (nextDays.includes(dayValue)) {
      nextDays = nextDays.filter(d => d !== dayValue);
    } else {
      nextDays.push(dayValue);
    }
    // Maintain sorted calendar order
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const sorted = order.filter(d => nextDays.includes(d));
    setSelectedDays(sorted);
  };

  // Subtask helpers
  const handleAddSubTask = () => {
    const newSub: SubTask = {
      id: Math.random().toString(36).substring(2, 9),
      content: '',
      assignee: masterData.assignees[0] || '',
      estimated_minutes: 15
    };
    setSubTasks([...subTasks, newSub]);
  };

  const handleUpdateSubTaskField = (id: string, field: keyof SubTask, value: any) => {
    setSubTasks(subTasks.map(sub => {
      if (sub.id === id) {
        return {
          ...sub,
          [field]: value
        };
      }
      return sub;
    }));
  };

  const handleDeleteSubTask = (id: string) => {
    setSubTasks(subTasks.filter(sub => sub.id !== id));
  };

  // Total estimation sum
  const totalEstMinutes = useMemo(() => {
    return subTasks.reduce((sum, s) => sum + (Number(s.estimated_minutes) || 0), 0);
  }, [subTasks]);

  // Form submit callback handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskName.trim()) {
      toast.warning('Vui lòng nhập tên công việc (Task Name).');
      return;
    }
    if (!project) {
      toast.warning('Vui lòng chọn Project.');
      return;
    }
    if (!tag) {
      toast.warning('Vui lòng chọn Tag.');
      return;
    }
    if (!taskType) {
      toast.warning('Vui lòng chọn Task Type.');
      return;
    }
    if (!deadlineTime24h) {
      toast.warning('Vui lòng chọn thời gian Deadline (Deadline time).');
      return;
    }
    if (taskType === 'WEEKLY' && selectedDays.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một ngày lặp lại (Repeat days).');
      return;
    }
    if (taskType === 'MONTHLY' && !monthlyDays.trim()) {
      toast.warning('Vui lòng nhập ngày lặp lại hàng tháng (Monthly repeat days).');
      return;
    }
    if (taskType === 'ONETIME' && !oneTimeDate) {
      toast.warning('Vui lòng chọn ngày hoàn thành (Deadline date).');
      return;
    }
    if (subTasks.length === 0) {
      toast.warning('Vui lòng thêm ít nhất một subtask.');
      return;
    }
    for (const sub of subTasks) {
      if (!sub.content.trim()) {
        toast.warning('Nội dung subtask (Sub-task content) không được để trống.');
        return;
      }
      if (!sub.assignee) {
        toast.warning('Người thực hiện của subtask không được để trống.');
        return;
      }
      if (!sub.estimated_minutes || sub.estimated_minutes < 1) {
        toast.warning('Thời gian ước tính (Est. time) của subtask phải lớn hơn hoặc bằng 1 phút.');
        return;
      }
    }

    setLoading(true);
    try {
      // Compute the deadline days string context
      let computedDeadlineDays = 'Mon - Fri';
      if (taskType === 'DAILY') {
        computedDeadlineDays = 'Mon - Fri';
      } else if (taskType === 'WEEKLY') {
        computedDeadlineDays = selectedDays.join(', ');
      } else if (taskType === 'MONTHLY') {
        computedDeadlineDays = monthlyDays || '10, 20';
      } else if (taskType === 'ONETIME') {
        computedDeadlineDays = oneTimeDate;
      }

      const formattedDeadlineTime = convertToDisplayTime(deadlineTime24h);

      const metadata: TaskMetadata = {
        description: '',
        project_name: project,
        team_name: team,
        tag_name: tag,
        deadline_time: formattedDeadlineTime,
        deadline_days: computedDeadlineDays,
        sub_tasks: subTasks
      };

      const payload = {
        title: taskName.trim(),
        description: serializeTaskDescription(metadata),
        task_type: taskType,
        est_time: totalEstMinutes,
        status: 'ON',
        is_active: true,
        actual_time: isEditMode && taskToEdit ? taskToEdit.actual_time : 0
      };

      if (isEditMode && taskToEdit) {
        const { error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', taskToEdit.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert([payload]);

        if (error) throw error;
      }

      toast.success(isEditMode ? 'Cập nhật template thành công!' : 'Tạo template thành công!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving task template:', err);
      toast.error(`Error context: ${err.message || 'Unknown database issue'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* 1. HEADER SECTION */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-slate-800">
              {isEditMode ? 'Edit template' : 'Create new template'}
            </h3>
          </div>

          <button onClick={onClose} className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. FORM BODY COVER */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-left">
          
          {/* HÀNG 1: Task Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Task name</label>
            <input 
              required 
              type="text"
              className="w-full h-8 px-3 bg-white border border-slate-200 focus:border-indigo-500 rounded-md text-xs font-medium focus:outline-none transition-all text-slate-800 shadow-sm"
              placeholder="Nhập tên task..." 
              value={taskName} 
              onChange={(e) => setTaskName(e.target.value)} 
            />
          </div>

          {/* HÀNG 2: Grid Dropdowns - Project, Tag, Task Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
              <select 
                required
                className="w-full h-8 px-2 bg-white border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-700"
                value={project} 
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">-- Choose Project --</option>
                {masterData.projects.map(proj => (
                  <option key={proj} value={proj}>{proj}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tag</label>
              <select 
                required
                className="w-full h-8 px-2 bg-white border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-700"
                value={tag} 
                onChange={(e) => setTag(e.target.value)}
              >
                <option value="">-- Choose Tag --</option>
                {masterData.tags.map(tg => (
                  <option key={tg} value={tg}>{tg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Task type</label>
              <select 
                required
                className="w-full h-8 px-2 bg-white border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:border-indigo-500 cursor-pointer text-slate-700"
                value={taskType} 
                onChange={(e) => setTaskType(e.target.value)}
              >
                <option value="">-- Choose Task type --</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ONETIME">Onetime</option>
              </select>
            </div>
          </div>

          {/* HÀNG 3: Dynamic Conditional Settings Panel (Always full sizing layout for unified UX) */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end min-h-[58px]">
              {/* Left Column: Deadline Time is always visible */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Deadline time</label>
                <input 
                  required 
                  disabled={!taskType}
                  type="time"
                  className="w-full h-8 px-3 bg-white border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 rounded-md text-xs font-mono font-medium focus:outline-none focus:border-indigo-500 text-slate-700 shadow-sm"
                  value={deadlineTime24h} 
                  onChange={(e) => setDeadlineTime24h(e.target.value)} 
                />
              </div>

              {/* Right Column: Contextual Deadline Setting */}
              <div className="min-h-[48px] flex flex-col justify-end">
                {taskType === '' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Deadline detail</label>
                    <div className="w-full h-8 px-3 bg-slate-100/60 border border-slate-200/50 rounded-md text-xs flex items-center gap-1.5 text-slate-400 font-normal italic">
                      <Calendar size={12} className="shrink-0" />
                      <span>Choose Task type to configure</span>
                    </div>
                  </div>
                )}

                {taskType === 'DAILY' && (
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Deadline days</span>
                    <div className="w-full h-8 flex items-center">
                      <p className="text-xs font-normal text-slate-500 italic">
                        Triggered everyday Mon - Fri (Sat & Sun optional)
                      </p>
                    </div>
                  </div>
                )}

                {taskType === 'WEEKLY' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Repeat days</label>
                    <div className="flex items-center gap-1 h-8">
                      {DAYS_OF_WEEK.map((day) => {
                        const isActive = selectedDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            title={day.fullName}
                            onClick={() => handleToggleDay(day.value)}
                            className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium tracking-tighter transition-all cursor-pointer border ${
                              isActive 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {taskType === 'MONTHLY' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Monthly repeat days</label>
                    <input 
                      required 
                      type="text"
                      className="w-full h-8 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:border-indigo-500 text-slate-800 shadow-sm"
                      placeholder="e.g. 10, 15, 20" 
                      value={monthlyDays} 
                      onChange={(e) => setMonthlyDays(e.target.value)} 
                    />
                  </div>
                )}

                {taskType === 'ONETIME' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Deadline date</label>
                    <input 
                      required 
                      type="date"
                      className="w-full h-8 px-3 bg-white border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:border-indigo-500 text-slate-700 shadow-sm"
                      value={oneTimeDate} 
                      onChange={(e) => setOneTimeDate(e.target.value)} 
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* HÀNG 4: Sub-tasks management (FLEXBOX HORIZONTAL ONE-ROW) */}
          <div className="border border-slate-200 bg-slate-50/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Sub-tasks management</span>
              <button 
                type="button" 
                onClick={handleAddSubTask}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2.5 h-7 rounded border border-blue-100 transition-colors"
              >
                <Plus size={12} />
                <span>Add row</span>
              </button>
            </div>

            {/* Sub-task List Area with Header */}
            {subTasks.length > 0 && (
              <div className="hidden md:flex flex-row items-center gap-4 px-2 text-xs font-medium text-slate-400">
                <div className="flex-1">Sub-task content</div>
                <div className="w-48">Personnel</div>
                <div className="w-24 text-center">Est. min</div>
                <div className="w-10"></div>
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {subTasks.length > 0 ? (
                subTasks.map((sub, index) => (
                  <div 
                    key={sub.id} 
                    className="flex flex-col md:flex-row md:items-center gap-2 w-full bg-white border border-slate-100 rounded-md p-2 hover:border-blue-100/80 hover:shadow-sm transition-all animate-in fade-in"
                  >
                    {/* Content */}
                    <div className="flex-1">
                      <input 
                        required
                        type="text" 
                        value={sub.content}
                        className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-400 transition-all"
                        placeholder="Content"
                        onChange={(e) => handleUpdateSubTaskField(sub.id, 'content', e.target.value)}
                      />
                    </div>

                    {/* Assignee / Personnel Selection dropdown */}
                    <div className="w-full md:w-48">
                      <select 
                        className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-600 focus:outline-none cursor-pointer"
                        value={sub.assignee}
                        onChange={(e) => handleUpdateSubTaskField(sub.id, 'assignee', e.target.value)}
                      >
                        <option value="">-- Assignee --</option>
                        {masterData.assignees.map(person => (
                          <option key={person} value={person}>{person}</option>
                        ))}
                      </select>
                    </div>

                    {/* Estimated minutes standard count */}
                    <div className="w-full md:w-24">
                      <input 
                        required
                        type="number" 
                        min={1}
                        value={sub.estimated_minutes === 0 ? '' : sub.estimated_minutes}
                        className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-400 font-mono text-center"
                        placeholder="Min"
                        onChange={(e) => handleUpdateSubTaskField(sub.id, 'estimated_minutes', Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>

                    {/* Action delete bin */}
                    <div className="w-full md:w-10 flex items-center justify-end md:justify-center">
                      <button 
                        type="button"
                        onClick={() => handleDeleteSubTask(sub.id)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors border border-transparent hover:border-red-100"
                        title="Remove row"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs italic font-medium bg-slate-50/50 rounded-md border border-dashed border-slate-200 select-none">
                  Bấm "+ Add Row" để thêm subtask của bạn.
                </div>
              )}
            </div>

            {/* Total Minutes display */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-mono">
              <span className="text-xs text-slate-400 font-medium">Sub-tasks total value</span>
              <span className="text-xs font-semibold text-slate-700">
                Total est: <span className="text-blue-600 font-bold">{totalEstMinutes}</span> min
              </span>
            </div>
          </div>

          {/* 5. BOTTOM COMMAND TRIGGERS */}
          <div className="pt-2 flex gap-3 shrink-0">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 h-8 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-all text-center cursor-pointer border border-slate-200"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-1 h-8 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : null}
              <span>{isEditMode ? 'Save changes' : 'Create task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
