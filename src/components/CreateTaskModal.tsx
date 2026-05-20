import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Clock, Loader2, Plus, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

const AVAILABLE_PROJECTS = ['【事務代行】HR TECH', 'GLOBAL OUTSOURCING', '求人媒体運用', 'RECRUITING MANAGEMENT', 'ADMIN OPERATIONS'];
const AVAILABLE_TEAMS = ['内部・2課E', '内部・1課', 'アウトソーシングG', '人事総務部', '営業サポート課'];
const AVAILABLE_TAGS = ['求人更新', '数値報告', 'メールチェック', 'レポート作成', 'データ入力', 'システム保守'];
const AVAILABLE_ASSIGNEES = ['PHAN QUANG DAT', 'LE QUANG VINH', 'LE QUANG VINH 2', 'VINH 1', 'VINH 2'];

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

const parseTaskDescription = (rawDescription: string | null): TaskMetadata => {
  const defaultMeta: TaskMetadata = {
    description: '',
    project_name: '【事務代行】HR TECH',
    team_name: '内部・1課',
    tag_name: '数値報告',
    deadline_time: '09:00 AM',
    deadline_days: 'Mon - Fri',
    sub_tasks: []
  };

  if (!rawDescription) return defaultMeta;

  const trimmed = rawDescription.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        description: parsed.description || '',
        project_name: parsed.project_name || '【事務代行】HR TECH',
        team_name: parsed.team_name || '内部・1課',
        tag_name: parsed.tag_name || '数値報告',
        deadline_time: parsed.deadline_time || '09:00 AM',
        deadline_days: parsed.deadline_days || 'Mon - Fri',
        sub_tasks: Array.isArray(parsed.sub_tasks) ? parsed.sub_tasks : []
      };
    } catch {
      // JSON format issue, fallback to normal values
    }
  }

  return {
    ...defaultMeta,
    description: rawDescription
  };
};

const serializeTaskDescription = (metadata: TaskMetadata): string => {
  return JSON.stringify(metadata);
};

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSuccess, taskToEdit }) => {
  const [loading, setLoading] = useState(false);
  const isEditMode = !!taskToEdit;

  // Form states matching mockup & requirements
  const [taskName, setTaskName] = useState('');
  const [project, setProject] = useState('【事務代行】HR TECH');
  const [tag, setTag] = useState('求人更新');
  const [team, setTeam] = useState('内部・2課E');
  const [taskType, setTaskType] = useState('DAILY');

  // Time is managed as 24h internally ("09:00" etc.)
  const [deadlineTime24h, setDeadlineTime24h] = useState('09:00');

  // Inputs depending on selected type
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [monthlyDays, setMonthlyDays] = useState('10, 20');
  const [oneTimeDate, setOneTimeDate] = useState('2026-05-20');

  // Subtasks list
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);

  // Sync / Reset on mount / edit trigger
  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        const meta = parseTaskDescription(taskToEdit.description);
        setTaskName(taskToEdit.title || '');
        setProject(meta.project_name || AVAILABLE_PROJECTS[0]);
        setTag(meta.tag_name || AVAILABLE_TAGS[0]);
        setTeam(meta.team_name || AVAILABLE_TEAMS[0]);
        setTaskType(taskToEdit.task_type || 'DAILY');

        // Parse structures matching exact time elements
        const currentDeadlineTime = meta.deadline_time || '09:00 AM';
        setDeadlineTime24h(convertTo24h(currentDeadlineTime));

        const daysStr = meta.deadline_days || 'Mon - Fri';
        if (taskToEdit.task_type === 'DAILY') {
          // Defaults
        } else if (taskToEdit.task_type === 'WEEKLY') {
          const parsed = daysStr.split(/[\s,]+/).map(d => d.trim()).filter(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(d));
          setSelectedDays(parsed.length > 0 ? parsed : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
        } else if (taskToEdit.task_type === 'MONTHLY') {
          setMonthlyDays(daysStr);
        } else if (taskToEdit.task_type === 'ONETIME') {
          setOneTimeDate(daysStr);
        }

        setSubTasks(meta.sub_tasks || []);
      } else {
        // Reset inputs on Create New
        setTaskName('');
        setProject(AVAILABLE_PROJECTS[0]);
        setTag(AVAILABLE_TAGS[0]);
        setTeam(AVAILABLE_TEAMS[0]);
        setTaskType('DAILY');
        setDeadlineTime24h('09:00');
        setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
        setMonthlyDays('10, 20');
        
        // Default to current date mapping
        const currentDate = new Date().toISOString().split('T')[0];
        setOneTimeDate(currentDate);

        setSubTasks([{
          id: Math.random().toString(36).substring(2, 9),
          content: '',
          assignee: AVAILABLE_ASSIGNEES[0],
          estimated_minutes: 15
        }]);
      }
    }
  }, [isOpen, taskToEdit]);

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
      assignee: AVAILABLE_ASSIGNEES[0],
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
      alert('Please enter a Task Name.');
      return;
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
        computedDeadlineDays = oneTimeDate || '2026-05-20';
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

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving task template:', err);
      alert(`Error context: ${err.message || 'Unknown database issue'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* 1. HEADER SECTION */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest font-mono">
              {isEditMode ? 'Edit Template' : 'Create New Template'}
            </h3>
          </div>

          <button onClick={onClose} className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. FORM BODY COVER */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-left">
          
          {/* HÀNG 1: Task Name */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">TASK NAME</label>
            <input 
              required 
              type="text"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-xl text-xs font-semibold focus:outline-none transition-all text-slate-800"
              placeholder="Nhập tên Task..." 
              value={taskName} 
              onChange={(e) => setTaskName(e.target.value)} 
            />
          </div>

          {/* HÀNG 2: Grid Dropdowns - Project, Tag, Task Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">PROJECT</label>
              <select 
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer text-slate-700 font-sans"
                value={project} 
                onChange={(e) => setProject(e.target.value)}
              >
                {AVAILABLE_PROJECTS.map(proj => (
                  <option key={proj} value={proj}>{proj}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">TAG</label>
              <select 
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer text-slate-700 font-sans"
                value={tag} 
                onChange={(e) => setTag(e.target.value)}
              >
                {AVAILABLE_TAGS.map(tg => (
                  <option key={tg} value={tg}>{tg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">TASK TYPE</label>
              <select 
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer text-slate-700 font-sans"
                value={taskType} 
                onChange={(e) => setTaskType(e.target.value)}
              >
                <option value="DAILY">DAILY TIME</option>
                <option value="WEEKLY">WEEKLY TIME</option>
                <option value="MONTHLY">MONTHLY TIME</option>
                <option value="ONETIME">ONETIME TIME</option>
              </select>
            </div>
          </div>

          {/* HÀNG 3: Dynamic Conditional Settings Panel */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5">
            {taskType === 'DAILY' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">DEADLINE TIME</label>
                  <div className="relative">
                    <input 
                      required 
                      type="time"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500 text-slate-700"
                      value={deadlineTime24h} 
                      onChange={(e) => setDeadlineTime24h(e.target.value)} 
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 font-mono">DEADLINE DAYS</span>
                  <p className="text-xs font-semibold text-slate-500 italic mt-2.5">
                    Triggered everyday Mon - Fri (Saturday and Sunday optional)
                  </p>
                </div>
              </div>
            )}

            {taskType === 'WEEKLY' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">DEADLINE TIME</label>
                  <input 
                    required 
                    type="time"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500 text-slate-700"
                    value={deadlineTime24h} 
                    onChange={(e) => setDeadlineTime24h(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">REPEAT DAYS</label>
                  <div className="flex items-center gap-1.5 pt-1.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const isActive = selectedDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          title={day.fullName}
                          onClick={() => handleToggleDay(day.value)}
                          className={`w-8 h-8 flex items-center justify-center rounded-full text-[10px] font-black tracking-tighter transition-all cursor-pointer border ${
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
              </div>
            )}

            {taskType === 'MONTHLY' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">DEADLINE TIME</label>
                  <input 
                    required 
                    type="time"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500 text-slate-700"
                    value={deadlineTime24h} 
                    onChange={(e) => setDeadlineTime24h(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">MONTHLY REPEAT DAYS</label>
                  <input 
                    required 
                    type="text"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800"
                    placeholder="e.g. 10, 15, 20" 
                    value={monthlyDays} 
                    onChange={(e) => setMonthlyDays(e.target.value)} 
                  />
                </div>
              </div>
            )}

            {taskType === 'ONETIME' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">DEADLINE TIME</label>
                  <input 
                    required 
                    type="time"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500 text-slate-700"
                    value={deadlineTime24h} 
                    onChange={(e) => setDeadlineTime24h(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 font-mono">DEADLINE DATE</label>
                  <div className="relative">
                    <input 
                      required 
                      type="date"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-blue-500 text-slate-700"
                      value={oneTimeDate} 
                      onChange={(e) => setOneTimeDate(e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* HÀNG 4: Sub-tasks management (FLEXBOX HORIZONTAL ONE-ROW) */}
          <div className="border border-slate-200/60 bg-slate-50/25 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider font-mono">Sub-tasks management</span>
              <button 
                type="button" 
                onClick={handleAddSubTask}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors"
              >
                <Plus size={13} />
                <span>+ Add Row</span>
              </button>
            </div>

            {/* Sub-task List Area with Header */}
            {subTasks.length > 0 && (
              <div className="hidden md:flex flex-row items-center gap-4 px-2 text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                <div className="flex-1">Sub-task Content</div>
                <div className="w-48">Personnel</div>
                <div className="w-24 text-center">Est. Min</div>
                <div className="w-10"></div>
              </div>
            )}

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {subTasks.length > 0 ? (
                subTasks.map((sub, index) => (
                  <div 
                    key={sub.id} 
                    className="flex flex-col md:flex-row md:items-center gap-3 w-full bg-white border border-slate-100 rounded-xl p-3 md:p-2.5 hover:border-blue-100/80 hover:shadow-sm transition-all animate-in fade-in duration-100"
                  >
                    {/* Content */}
                    <div className="flex-1">
                      <input 
                        required
                        type="text" 
                        value={sub.content}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-400 transition-all font-sans"
                        placeholder="Content"
                        onChange={(e) => handleUpdateSubTaskField(sub.id, 'content', e.target.value)}
                      />
                    </div>

                    {/* Assignee / Personnel Selection dropdown */}
                    <div className="w-full md:w-48">
                      <select 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 focus:outline-none cursor-pointer font-sans h-[34px] md:h-9"
                        value={sub.assignee}
                        onChange={(e) => handleUpdateSubTaskField(sub.id, 'assignee', e.target.value)}
                      >
                        {AVAILABLE_ASSIGNEES.map(person => (
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
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-blue-400 font-mono text-center h-[34px] md:h-9"
                        placeholder="Min"
                        onChange={(e) => handleUpdateSubTaskField(sub.id, 'estimated_minutes', Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>

                    {/* Action delete bin */}
                    <div className="w-full md:w-10 flex items-center justify-end md:justify-center">
                      <button 
                        type="button"
                        onClick={() => handleDeleteSubTask(sub.id)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Remove Row"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs italic font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-200 select-none">
                  Bấm "+ Add Row" để thêm subtask của bạn.
                </div>
              )}
            </div>

            {/* Total Minutes display */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100 font-mono">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">SUB-TASKS TOTAL VALUE</span>
              <span className="text-xs font-black text-slate-700">
                Total Est: <span className="text-blue-600 text-sm font-black">{totalEstMinutes}</span> min
              </span>
            </div>
          </div>

          {/* 5. BOTTOM COMMAND TRIGGERS */}
          <div className="pt-3 flex gap-3.5 shrink-0">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-3 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all uppercase tracking-widest text-center cursor-pointer border border-slate-200/40 font-mono"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-1 py-1 px-4 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 uppercase tracking-widest font-mono cursor-pointer"
            >
              {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin text-white" /> : null}
              <span>{isEditMode ? 'Save Changes' : 'Create Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
