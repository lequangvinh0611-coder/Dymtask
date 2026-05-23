import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FastForward,
  RotateCw
} from 'lucide-react';
import { DateRangePicker } from './ui/DateRangePicker';
import { FilterSelect } from './ui/FilterSelect';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAuthStore } from '../store/authStore';

// Interface definitions aligned with Single Table design
interface SubTask {
  id: string;
  name: string;
  assignee?: string;
  estimated_minutes?: number;
  actual_minutes?: number;
  sub_status?: 'New' | 'Done' | 'Skipped';
}

interface TaskMetadata {
  description: string;
  project_name: string;
  team_name: string;
  tag_name: string;
  deadline_time: string;
  deadline_days: string;
  sub_tasks: SubTask[];
  todo_status?: 'NEW' | 'DONE' | 'SKIPPED';
  todo_date?: string;
  completions?: Record<string, { todo_status: 'NEW' | 'DONE' | 'SKIPPED', actual_time: number, sub_tasks?: SubTask[] }>;
}

const parseDescriptionMeta = (descriptionStr: any): TaskMetadata => {
  const defaultMeta: TaskMetadata = {
    description: '',
    project_name: '【事務代行】HR TECH',
    team_name: '内部・1課',
    tag_name: '数値報告',
    deadline_time: '17:00',
    deadline_days: 'Mon - Fri',
    sub_tasks: []
  };

  if (!descriptionStr) return defaultMeta;

  if (typeof descriptionStr === 'object') {
    return {
      description: descriptionStr.description || '',
      project_name: descriptionStr.project_name || '【事務代行】HR TECH',
      team_name: descriptionStr.team_name || '内部・1課',
      tag_name: descriptionStr.tag_name || '数値報告',
      deadline_time: descriptionStr.deadline_time || '17:00',
      deadline_days: descriptionStr.deadline_days || 'Mon - Fri',
      sub_tasks: Array.isArray(descriptionStr.sub_tasks) ? descriptionStr.sub_tasks : [],
      todo_status: descriptionStr.todo_status,
      todo_date: descriptionStr.todo_date,
      completions: descriptionStr.completions
    };
  }

  if (typeof descriptionStr === 'string') {
    const trimmed = descriptionStr.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          description: parsed.description || '',
          project_name: parsed.project_name || '【事務代行】HR TECH',
          team_name: parsed.team_name || '内部・1課',
          tag_name: parsed.tag_name || '数値報告',
          deadline_time: parsed.deadline_time || '17:00',
          deadline_days: parsed.deadline_days || 'Mon - Fri',
          sub_tasks: Array.isArray(parsed.sub_tasks) ? parsed.sub_tasks : [],
          todo_status: parsed.todo_status,
          todo_date: parsed.todo_date,
          completions: parsed.completions
        };
      } catch {
        // ignore JSON error
      }
    }
  }

  return {
    ...defaultMeta,
    description: String(descriptionStr)
  };
};

const isTaskOnWeekday = (task: any, dayShort: string, dateString: string, dayOfMonth: number): boolean => {
  const meta = parseDescriptionMeta(task.description);
  const type = (task.task_type || '').toUpperCase();
  const deadlineDays = (meta.deadline_days || '').trim();

  if (type === 'DAILY') {
    return true; // applies to Mon - Fri
  }
  
  if (type === 'WEEKLY') {
    if (deadlineDays === 'Mon - Fri' || deadlineDays === 'Daily') {
      return true;
    }
    const parts = deadlineDays.split(/[\s,]+/).map(d => d.trim().toLowerCase());
    return parts.includes(dayShort.toLowerCase());
  }

  if (type === 'MONTHLY') {
    const parts = deadlineDays.split(/[\s,]+/).map(d => parseInt(d.trim())).filter(d => !isNaN(d));
    return parts.includes(dayOfMonth);
  }

  if (type === 'ONETIME' || type === 'SPOT') {
    return deadlineDays === dateString || meta.todo_date === dateString;
  }

  return false;
};

const formatDuration = (minutes: number) => {
  if (!minutes || minutes <= 0) return '0h 00m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDatesBetween = (startStr: string, endStr: string): string[] => {
  const dates: string[] = [];
  try {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const cursor = new Date(start);
    while (cursor <= end) {
      dates.push(getLocalDateString(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } catch (e) {
    console.error('Lỗi tính khoảng ngày:', e);
  }
  return dates;
};

const getWeekDays = () => {
  const current = new Date();
  const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...
  
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);
  
  const weekdays = [];
  const names = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
  const mapShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekdays.push({
      name: names[i],
      short: mapShort[i],
      dateString: getLocalDateString(d),
      dayOfMonth: d.getDate(),
      isToday: d.toDateString() === current.toDateString(),
    });
  }
  return weekdays;
};

export default function Dashboard() {
  const { profile } = useAuthStore();
  const {
    tasks,
    loading,
    error,
    projectsList,
    teamsList,
    tagsList,
    assigneesList,
    refetch
  } = useDashboardData();

  // Filter Personnel - Default is current logged in user name
  const [filterPersonnel, setFilterPersonnel] = useState<string>('');
  
  // Set default Assignee whenever profile becomes available
  useEffect(() => {
    if (profile?.name && !filterPersonnel) {
      setFilterPersonnel(profile.name);
    }
  }, [profile]);

  // Rest of dropdown parameters
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterTeam, setFilterTeam] = useState<string>('');

  // Date Range filter states - Default is TODAY's date
  const [startDate, setStartDate] = useState<string>(() => getLocalDateString(new Date()));
  const [endDate, setEndDate] = useState<string>(() => getLocalDateString(new Date()));

  // Active dates
  const weekDays = useMemo(() => getWeekDays(), []);

  // Compute robust dropdown filter personnel list
  const currentAssignees = useMemo(() => {
    const list = [...assigneesList];
    if (profile?.name && !list.includes(profile.name)) {
      list.push(profile.name);
    }
    return list.length > 0 ? list : ['PHAN QUANG DAT', 'LE QUANG VINH', 'LE QUANG VINH 2', 'VINH 1', 'VINH 2'];
  }, [assigneesList, profile?.name]);

  const currentProjects = useMemo(() => {
    return projectsList.length > 0 ? projectsList : ['【事務代行】HR TECH', 'GLOBAL OUTSOURCING', '求人媒体運用', 'RECRUITING MANAGEMENT', 'ADMIN OPERATIONS'];
  }, [projectsList]);

  const currentTags = useMemo(() => {
    return tagsList.length > 0 ? tagsList : ['求人更新', '数値報告', 'メールチェック', 'レポート作成', 'データ入力', 'システム保守'];
  }, [tagsList]);

  const currentTeams = useMemo(() => {
    return teamsList.length > 0 ? teamsList : ['内部・2課E', '内部・1課', 'アウトソーシングG', '人事総務部', '営業サポート課'];
  }, [teamsList]);

  // Solve 5 metrics state WITH filters AND Date filter (Default Today)
  const statsVirtualTasks = useMemo(() => {
    const dates = getDatesBetween(startDate, endDate);
    const list: any[] = [];

    tasks.forEach(task => {
      const meta = parseDescriptionMeta(task.description);
      const isRecurring = ['DAILY', 'WEEKLY', 'MONTHLY'].includes((task.task_type || '').toUpperCase());

      // Filter check side dropdowns
      if (filterProject && meta.project_name !== filterProject) return;
      if (filterTag && meta.tag_name !== filterTag) return;
      if (filterTeam && meta.team_name !== filterTeam) return;

      // Filter check dynamic Assignee (Sub-tasks or Main assignees)
      if (filterPersonnel) {
        const hasInSubTask = meta.sub_tasks && meta.sub_tasks.some((s: any) => s.assignee === filterPersonnel);
        const hasInMain = Array.isArray((task as any).assignees) && (task as any).assignees.includes(filterPersonnel);
        if (!hasInSubTask && !hasInMain) return;
      }

      if (isRecurring) {
        dates.forEach(date => {
          const d = new Date(date);
          const weekdaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayShort = weekdaysShort[d.getDay()];
          const dayOfMonth = d.getDate();

          if (isTaskOnWeekday(task, dayShort, date, dayOfMonth)) {
            const completions = meta.completions || {};
            const completion = completions[date];
            const todo_status = completion?.todo_status || 'NEW';
            
            // Map sub-tasks dynamically
            const subTasksResolved = completion?.sub_tasks || meta.sub_tasks.map(s => ({
              ...s,
              sub_status: 'New' as const,
              actual_minutes: 0
            }));

            // If subtasks mapped, sync status
            const hasSub = subTasksResolved.length > 0;
            const anyDone = hasSub && subTasksResolved.some(s => s.sub_status === 'Done');
            const allSkipped = hasSub && subTasksResolved.every(s => s.sub_status === 'Skipped');
            const resolvedStatus = todo_status !== 'NEW' ? todo_status : (allSkipped ? 'SKIPPED' : (anyDone ? 'DONE' : 'NEW'));

            // Calc duration
            const actual_time = completion?.actual_time || subTasksResolved.reduce((sum, s) => sum + (s.actual_minutes || 0), 0) || 0;
            const est_time = subTasksResolved.reduce((sum, s) => sum + (s.estimated_minutes || s.estimated_minutes || 0), 0) || task.est_time || 0;

            list.push({
              ...task,
              todo_date: date,
              todo_status: resolvedStatus,
              est_time,
              actual_time
            });
          }
        });
      } else {
        // OneTime task date matching
        const todo_date = meta.todo_date || task.created_at?.split('T')[0] || getLocalDateString(new Date());
        if (todo_date >= startDate && todo_date <= endDate) {
          const subTasksResolved = meta.sub_tasks || [];
          const hasSub = subTasksResolved.length > 0;
          const anyDone = hasSub && subTasksResolved.some(s => s.sub_status === 'Done');
          const allSkipped = hasSub && subTasksResolved.every(s => s.sub_status === 'Skipped');
          const resolvedStatus = meta.todo_status || task.status || 'NEW';
          const finalStatus = resolvedStatus !== 'NEW' ? resolvedStatus : (allSkipped ? 'SKIPPED' : (anyDone ? 'DONE' : 'NEW'));

          const actual_time = task.actual_time || subTasksResolved.reduce((sum, s) => sum + (s.actual_minutes || 0), 0) || 0;
          const est_time = subTasksResolved.reduce((sum, s) => sum + (s.estimated_minutes || 0), 0) || task.est_time || 0;

          list.push({
            ...task,
            todo_date,
            todo_status: finalStatus,
            est_time,
            actual_time
          });
        }
      }
    });

    return list;
  }, [tasks, startDate, endDate, filterPersonnel, filterProject, filterTag, filterTeam]);

  // Compute stat metrics for the 5 Overview cards from the stats list
  const stats = useMemo(() => {
    const total = statsVirtualTasks.length;
    const completed = statsVirtualTasks.filter(t => t.todo_status === 'DONE').length;
    const skipped = statsVirtualTasks.filter(t => t.todo_status === 'SKIPPED').length;
    
    const totalEst = statsVirtualTasks.reduce((acc, t) => acc + (t.est_time || 0), 0);
    const totalAct = statsVirtualTasks.reduce((acc, t) => acc + (t.actual_time || 0), 0);

    return {
      total,
      completed,
      skipped,
      totalEst,
      totalAct
    };
  }, [statsVirtualTasks]);

  // Solve Roadmap - EXCLUDES Date Filter range but strictly honors the Assignee, Project, Tag, Team filters
  const roadmapDaysData = useMemo(() => {
    return weekDays.map(day => {
      const dayTasks = tasks.filter(task => {
        // Must be active task setting
        if (task.is_active !== true) return false;

        const meta = parseDescriptionMeta(task.description);

        // Filter check side indicators
        if (filterProject && meta.project_name !== filterProject) return false;
        if (filterTag && meta.tag_name !== filterTag) return false;
        if (filterTeam && meta.team_name !== filterTeam) return false;

        // Filter check Assignee (subtasks or main)
        if (filterPersonnel) {
          const hasInSubTask = meta.sub_tasks && meta.sub_tasks.some((s: any) => s.assignee === filterPersonnel);
          const hasInMain = Array.isArray((task as any).assignees) && (task as any).assignees.includes(filterPersonnel);
          if (!hasInSubTask && !hasInMain) return false;
        }

        // Must apply to this day of the week
        return isTaskOnWeekday(task, day.short, day.dateString, day.dayOfMonth);
      });

      const dailyTypeTasks = dayTasks.filter(t => (t.task_type || '').toUpperCase() === 'DAILY');
      const weeklyTypeTasks = dayTasks.filter(t => (t.task_type || '').toUpperCase() === 'WEEKLY');
      const monthlyTypeTasks = dayTasks.filter(t => (t.task_type || '').toUpperCase() === 'MONTHLY');
      const spotTypeTasks = dayTasks.filter(t => ['ONETIME', 'SPOT'].includes((t.task_type || '').toUpperCase()));

      const dayRows = [
        {
          label: 'Total',
          count: dayTasks.length,
          estMinutes: dayTasks.reduce((sum, t) => sum + (t.est_time || 0), 0),
          isTotal: true
        },
        {
          label: 'Daily',
          count: dailyTypeTasks.length,
          estMinutes: dailyTypeTasks.reduce((sum, t) => sum + (t.est_time || 0), 0)
        },
        {
          label: 'Weekly',
          count: weeklyTypeTasks.length,
          estMinutes: weeklyTypeTasks.reduce((sum, t) => sum + (t.est_time || 0), 0)
        },
        {
          label: 'Monthly',
          count: monthlyTypeTasks.length,
          estMinutes: monthlyTypeTasks.reduce((sum, t) => sum + (t.est_time || 0), 0)
        },
        {
          label: 'Spot',
          count: spotTypeTasks.length,
          estMinutes: spotTypeTasks.reduce((sum, t) => sum + (t.est_time || 0), 0)
        }
      ];

      return {
        day,
        dayRows
      };
    });
  }, [tasks, weekDays, filterPersonnel, filterProject, filterTag, filterTeam]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-x-auto text-left font-sans">
      
      {/* FILTER HEADER BAR */}
      <div className="px-6 py-3 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between gap-4 flex-nowrap overflow-visible relative z-[40] min-w-max w-full select-none">
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {/* PERSONNEL SELECT dropdown */}
          <FilterSelect
            value={filterPersonnel}
            onChange={setFilterPersonnel}
            defaultOptionLabel="All Assignees"
            options={currentAssignees.map(assignee => ({ 
              value: assignee, 
              label: assignee === profile?.name ? `${assignee} (Tôi)` : assignee 
            }))}
            className="h-8 min-w-[150px]"
            id="assignee-select"
          />

          {/* PROJECTS SELECT dropdown */}
          <FilterSelect
            value={filterProject}
            onChange={setFilterProject}
            defaultOptionLabel="All Projects"
            options={currentProjects.map(project => ({ value: project, label: project }))}
            className="h-8 min-w-[140px]"
            id="projects-select"
          />

          {/* TAGS SELECT dropdown */}
          <FilterSelect
            value={filterTag}
            onChange={setFilterTag}
            defaultOptionLabel="All Tags"
            options={currentTags.map(tag => ({ value: tag, label: tag }))}
            className="h-8 min-w-[120px]"
            id="tags-select"
          />

          {/* TEAMS SELECT dropdown */}
          <FilterSelect
            value={filterTeam}
            onChange={setFilterTeam}
            defaultOptionLabel="All Teams"
            options={currentTeams.map(team => ({ value: team, label: team }))}
            className="h-8 min-w-[120px]"
            id="teams-select"
          />

          {/* DATE RANGE FILTER PICKER */}
          <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            className="h-8 shadow-sm"
            id="date-picker"
          />
        </div>
        
        {/* Reset filter trigger */}
        {(filterPersonnel !== (profile?.name || '') || filterProject || filterTag || filterTeam || startDate !== getLocalDateString(new Date()) || endDate !== getLocalDateString(new Date())) && (
          <button
            onClick={() => {
              setFilterPersonnel(profile?.name || '');
              setFilterProject('');
              setFilterTag('');
              setFilterTeam('');
              setStartDate(getLocalDateString(new Date()));
              setEndDate(getLocalDateString(new Date()));
            }}
            className="text-xs text-indigo-650 font-semibold hover:text-indigo-800 transition-colors pointer-events-auto shrink-0 bg-slate-50 px-2.5 py-1 border border-slate-200 rounded"
            id="reset-dashboard-filters"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* DASHBOARD GRID CONTENT */}
      <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-y-auto bg-slate-50/40">
        
        {/* DATABASE CONNECTION OR QUERY ERROR BOX */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-750 p-3 rounded-md flex items-start gap-2 shadow-sm shrink-0" id="db-error-box">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-left">
              <span className="font-semibold block text-xs">Lỗi kết nối bộ dữ liệu</span>
              <span className="text-xs text-rose-600/90 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* 1. SECTION 1: 5 OVERVIEW CARDS WITH SKELETON LOAD SUPPORT */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0" id="metrics-loading-skeletons">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div 
                key={idx} 
                className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between h-[106px] animate-pulse"
              >
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                <div className="h-9 bg-slate-200 rounded w-2/3 mt-2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0" id="metrics-cards-grid">
            
            {/* CARD 1: TOTAL TASKS */}
            <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-all hover:border-slate-300" id="card-total-tasks">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500">Tổng công việc</span>
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                  <ClipboardList className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-1 text-left">
                <h3 className="text-xl font-bold text-slate-800 leading-none">
                  {stats.total}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 mt-1.5 truncate">
                  Tổng checklist trong ngày
                </p>
              </div>
            </div>

            {/* CARD 2: COMPLETED */}
            <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-all hover:border-slate-300" id="card-completed-tasks">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-emerald-700">Đã hoàn thành</span>
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-1 text-left">
                <h3 className="text-xl font-bold text-emerald-600 leading-none">
                  {stats.completed}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 mt-1.5 truncate">
                  Nhiệm vụ Done thành công
                </p>
              </div>
            </div>

            {/* CARD 3: SKIPPED */}
            <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-all hover:border-slate-300" id="card-skipped-tasks">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-amber-700">Đã bỏ qua (Skipped)</span>
                <div className="p-1.5 bg-amber-50 text-amber-500 rounded">
                  <FastForward className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-1 text-left">
                <h3 className="text-xl font-bold text-slate-700 leading-none">
                  {stats.skipped}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 mt-1.5 truncate">
                  Nhiệm vụ skipped bỏ qua
                </p>
              </div>
            </div>

            {/* CARD 4: ESTIMATED TIME */}
            <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-all hover:border-slate-300" id="card-est-time">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500">Giờ ước tính</span>
                <div className="p-1.5 bg-slate-50 text-indigo-600 rounded">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-1 text-left min-w-0">
                <h3 className="text-sm font-bold text-indigo-950 truncate leading-none">
                  {formatDuration(stats.totalEst)}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 mt-1.5 truncate">
                  Tổng số giờ được phân bổ
                </p>
              </div>
            </div>

            {/* CARD 5: ACTUAL TIME */}
            <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-all hover:border-slate-300" id="card-actual-time">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500">Giờ thực tế</span>
                <div className="p-1.5 bg-slate-50 text-emerald-600 rounded">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-1 text-left min-w-0">
                <h3 className="text-sm font-bold text-emerald-600 truncate leading-none">
                  {formatDuration(stats.totalAct)}
                </h3>
                <p className="text-[11px] font-medium text-slate-400 mt-1.5 truncate">
                  Thời lượng công việc thực tế
                </p>
              </div>
            </div>

          </div>
        )}

        {/* 2. SECTION 2: WEEKLY ROADMAP BREAKDOWN */}
        <div className="flex-1 flex flex-col min-h-0 bg-white rounded-md border border-slate-200 p-4 shadow-sm space-y-3 overflow-hidden" id="weekly-roadmap-section">
          
          {/* Section Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0 select-none">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Weekly Roadmap (Lộ trình phân bổ tuần dài hạn)
              </h3>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                Bỏ qua bộ lọc ngày để hiển thị các công việc tuần hoàn, tuân thủ đúng Assignment nhân sự lựa chọn.
              </p>
            </div>
          </div>

          {/* SKELETON LOAD IN THE ROADMAP GRID */}
          {loading ? (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 min-h-0" id="roadmap-loading-skeletons">
              {weekDays.map((day) => (
                <div 
                  key={day.name} 
                  className="bg-white rounded-md border border-slate-200 flex flex-col justify-between overflow-hidden shadow-sm h-full p-3 space-y-3 animate-pulse"
                >
                  <div className="h-5 bg-slate-200 rounded w-1/3 mb-1"></div>
                  <div className="flex-1 flex flex-col gap-2">
                    {[1, 2, 3, 4, 5].map((rowIdx) => (
                      <div key={rowIdx} className="h-9 bg-slate-200 rounded-md w-full"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 min-h-0" id="roadmap-grid">
              {roadmapDaysData.map(({ day, dayRows }) => (
                <div 
                  key={day.name} 
                  className={`bg-white rounded-md border flex flex-col justify-between overflow-hidden relative shadow-sm h-full transition-all ${
                    day.isToday 
                      ? 'border-indigo-500 ring-2 ring-indigo-50/50 bg-indigo-50/5' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Column element header */}
                  <div className={`px-2.5 py-1.5 border-b flex flex-col items-start justify-between relative shrink-0 ${
                    day.isToday ? 'bg-indigo-50/20 border-indigo-250' : 'bg-slate-50/50 border-slate-150'
                  }`}>
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-semibold ${
                        day.isToday ? 'text-indigo-600' : 'text-slate-700'
                      }`}>
                        {day.name}
                      </span>
                      
                      {day.isToday && (
                        <span className="bg-indigo-600 text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-sm shadow-sm scale-90">
                          Hôm nay
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Columns data cells (Total, Daily, Weekly, Monthly, Spot) */}
                  <div className="flex-1 flex flex-col justify-between p-2 min-h-0 gap-1 pb-3">
                    {dayRows.map((row) => (
                      <div 
                        key={row.label}
                        className={`flex-1 flex items-center justify-between px-2.5 py-1 rounded-md transition-all ${
                          row.isTotal 
                            ? 'bg-indigo-50/40 border border-indigo-100 font-semibold text-indigo-950 shadow-sm' 
                            : 'border border-slate-50 hover:bg-slate-50/50 hover:border-slate-100'
                        }`}
                      >
                        {/* Title of Category */}
                        <div className="flex flex-col justify-center">
                          <span className={`text-[10px] font-semibold leading-none uppercase tracking-wider ${
                            row.isTotal ? 'text-indigo-600' : 'text-slate-400'
                          }`}>
                            {row.label}
                          </span>
                          <span className={`text-xs font-bold leading-none mt-1.5 ${
                            row.isTotal ? 'text-indigo-850' : 'text-slate-700'
                          }`}>
                            {row.count} task{row.count !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Estimated duration right side */}
                        <div className="text-right flex flex-col justify-center">
                          <span className="text-[9px] text-slate-400 font-semibold uppercase leading-none">Est</span>
                          <span className={`text-xs font-bold mt-1.5 leading-none ${
                            row.isTotal ? 'text-indigo-600' : 'text-slate-500'
                          }`}>
                            {formatDuration(row.estMinutes)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
