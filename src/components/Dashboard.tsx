import React, { useEffect, useState, useMemo } from 'react';
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RotateCw,
  FastForward
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DateRangePicker } from './ui/DateRangePicker';
import { FilterSelect } from './ui/FilterSelect';

// Interface matching the single 'tasks' table schema
interface Task {
  id: string;
  title: string | null;
  description: string | null;
  task_type: string | null; // e.g. 'Daily', 'Weekly', 'Monthly', 'Spot'
  status: string;           // 'New', 'Done', 'Skipped'
  is_active: boolean;
  est_time: number;         // in minutes
  actual_time: number;      // in minutes
  created_at: string;
}

// Fixed metadata option sets
const AVAILABLE_PROJECTS = ['【事務代行】HR TECH', 'GLOBAL OUTSOURCING', '求人媒体運用', 'RECRUITING MANAGEMENT', 'ADMIN OPERATIONS'];
const AVAILABLE_TEAMS = ['内部・2課E', '内部・1課', 'アウトソーシングG', '人事総務部', '営業サポート課'];
const AVAILABLE_TAGS = ['求人更新', '数値報告', 'メールチェック', 'レポート作成', 'データ入力', 'システム保守'];
const AVAILABLE_ASSIGNEES = ['PHAN QUANG DAT', 'LE QUANG VINH', 'LE QUANG VINH 2', 'VINH 1', 'VINH 2'];

// Helper to parse description JSON metadata safely
const parseDescriptionMeta = (descriptionStr: string | null) => {
  const defaultMeta = {
    description: '',
    project_name: '【事務代行】HR TECH',
    team_name: '内部・1課',
    tag_name: '数値報告',
    deadline_time: '09:00 AM',
    deadline_days: 'Mon - Fri',
    sub_tasks: [] as any[]
  };

  if (!descriptionStr) return defaultMeta;

  const trimmed = descriptionStr.trim();
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
      // ignore
    }
  }

  return {
    ...defaultMeta,
    description: descriptionStr
  };
};

// Check if a task maps to a specific day of the current week
const isTaskOnWeekday = (task: Task, dayShort: string, dateString: string, dayOfMonth: number): boolean => {
  const meta = parseDescriptionMeta(task.description);
  const type = (task.task_type || '').toUpperCase();
  const deadlineDays = (meta.deadline_days || '').trim();

  if (type === 'DAILY') {
    return true; // daily applies to all weekdays Mon-Fri
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
    return deadlineDays === dateString;
  }

  return false;
};

// Helper function to format minutes into "Xh Ym"
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

const formatDateToDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
};

// Get Monday to Friday days of current week dynamically
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Metadata states
  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [teamsList, setTeamsList] = useState<string[]>([]);
  const [tagsList, setTagsList] = useState<string[]>([]);
  const [assigneesList, setAssigneesList] = useState<string[]>([]);

  // Filter Bar state bindings
  const [filterPersonnel, setFilterPersonnel] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterTeam, setFilterTeam] = useState<string>('');

  // Date range filter states
  const [startDate, setStartDate] = useState<string>(() => getLocalDateString(new Date()));
  const [endDate, setEndDate] = useState<string>(() => getLocalDateString(new Date()));

  // Fetch metadata dynamically and filter only active ones
  const fetchMetadata = async () => {
    try {
      const [
        { data: usersData },
        { data: projectsData },
        { data: teamsData },
        { data: tagsData }
      ] = await Promise.all([
        supabase.from('users').select('name, status'),
        supabase.from('projects').select('name, is_active'),
        supabase.from('teams').select('name, is_active'),
        supabase.from('tags').select('name, is_active')
      ]);

      const activeUsers = (usersData || [])
        .filter((u: any) => u.status !== 'INACTIVE' && u.name)
        .map((u: any) => u.name);

      const activeProj = (projectsData || [])
        .filter((p: any) => p.is_active !== false && p.name)
        .map((p: any) => p.name);

      const activeTms = (teamsData || [])
        .filter((t: any) => t.is_active !== false && t.name)
        .map((t: any) => t.name);

      const activeTgs = (tagsData || [])
        .filter((tg: any) => tg.is_active !== false && tg.name)
        .map((tg: any) => tg.name);

      setAssigneesList(activeUsers);
      setProjectsList(activeProj);
      setTeamsList(activeTms);
      setTagsList(activeTgs);
    } catch (err) {
      console.error('Error fetching metadata in Dashboard:', err);
    }
  };

  // Fetch all tasks from the single table
  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, description, task_type, status, is_active, est_time, actual_time, created_at')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setTasks(data || []);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu tasks:', err);
      setError(err?.message || 'Không thể kết nối đến Supabase database. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchMetadata();

    const channel = supabase.channel('dashboard_sync_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => fetchMetadata())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Generate dynamic date mappings for current week
  const weekDays = useMemo(() => getWeekDays(), []);

  // Generate dynamic sample data relative to this week if Supabase returns 0 tasks
  const mockTasks = useMemo(() => {
    return [
      {
        id: 'mock-1',
        title: '【事務代行】求人更新 Daily Work',
        task_type: 'DAILY',
        status: 'Done',
        is_active: true,
        est_time: 45,
        actual_time: 40,
        created_at: new Date().toISOString(),
        description: JSON.stringify({
          project_name: '【事務代行】HR TECH',
          tag_name: '求人更新',
          team_name: '内部・2課E',
          deadline_days: 'Mon - Fri',
          deadline_time: '09:00 AM',
          sub_tasks: [
            { id: 'sub-1', content: 'Cập nhật tin tuyển dụng', assignee: 'PHAN QUANG DAT', estimated_minutes: 25 },
            { id: 'sub-2', content: 'Duyệt bài đăng', assignee: 'LE QUANG VINH', estimated_minutes: 20 }
          ]
        })
      },
      {
        id: 'mock-2',
        title: 'GLOBAL OUTSOURCING メールチェック',
        task_type: 'DAILY',
        status: 'New',
        is_active: true,
        est_time: 30,
        actual_time: 0,
        created_at: new Date().toISOString(),
        description: JSON.stringify({
          project_name: 'GLOBAL OUTSOURCING',
          tag_name: 'メールチェック',
          team_name: '内部・1課',
          deadline_days: 'Mon - Fri',
          deadline_time: '10:00 AM',
          sub_tasks: [
            { id: 'sub-3', content: 'Đọc và phân loại email khách hàng', assignee: 'LE QUANG VINH 2', estimated_minutes: 15 },
            { id: 'sub-4', content: 'Trả lời mail khẩn cấp', assignee: 'VINH 1', estimated_minutes: 15 }
          ]
        })
      },
      {
        id: 'mock-3',
        title: '求人媒体運用 KPI Numerical Report',
        task_type: 'WEEKLY',
        status: 'Done',
        is_active: true,
        est_time: 150,
        actual_time: 120,
        created_at: new Date().toISOString(),
        description: JSON.stringify({
          project_name: '求人媒体運用',
          tag_name: '数値報告',
          team_name: 'アウトソーシングG',
          deadline_days: 'Mon, Wed, Fri',
          deadline_time: '11:00 AM',
          sub_tasks: [
            { id: 'sub-5', content: 'Tổng hợp số liệu KPI', assignee: 'VINH 2', estimated_minutes: 60 },
            { id: 'sub-6', content: 'Kiểm duyệt KPI Report', assignee: 'PHAN QUANG DAT', estimated_minutes: 90 }
          ]
        })
      },
      {
        id: 'mock-4',
        title: 'RECRUITING MANAGEMENT Mid-Month Sync',
        task_type: 'MONTHLY',
        status: 'New',
        is_active: true,
        est_time: 180,
        actual_time: 0,
        created_at: new Date().toISOString(),
        description: JSON.stringify({
          project_name: 'RECRUITING MANAGEMENT',
          tag_name: 'レポート作成',
          team_name: '人事総務部',
          deadline_days: `${weekDays[1].dayOfMonth}, ${weekDays[3].dayOfMonth}`, // Tue, Thu
          deadline_time: '02:00 PM',
          sub_tasks: [
            { id: 'sub-7', content: 'Soạn báo cáo giữa tháng', assignee: 'LE QUANG VINH', estimated_minutes: 180 }
          ]
        })
      },
      {
        id: 'mock-5',
        title: 'ADMIN OPERATIONS Spot Update Task',
        task_type: 'SPOT',
        status: 'Done',
        is_active: true,
        est_time: 60,
        actual_time: 65,
        created_at: new Date().toISOString(),
        description: JSON.stringify({
          project_name: 'ADMIN OPERATIONS',
          tag_name: 'データ入力',
          team_name: '営業サポート課',
          deadline_days: weekDays[2].dateString, // Wednesday
          deadline_time: '04:00 PM',
          sub_tasks: [
            { id: 'sub-8', content: 'Nhập dữ liệu khách hàng', assignee: 'VINH 1', estimated_minutes: 60 }
          ]
        })
      }
    ];
  }, [weekDays]);

  // Bind the raw working payload (database tasks or mock if empty)
  const isDatabaseEmpty = tasks.length === 0;
  const rawList = useMemo(() => {
    return isDatabaseEmpty ? mockTasks : tasks;
  }, [isDatabaseEmpty, tasks, mockTasks]);

  // Base filtered tasks based on dropdown selections (Personnel, Project, Tag, Team)
  const baseTasks = useMemo(() => {
    return rawList.filter(task => {
      const meta = parseDescriptionMeta(task.description);

      // 1. Personnel (Assignee) Filter: check if matched in sub_tasks assignee
      if (filterPersonnel) {
        const carriesPerson = meta.sub_tasks && meta.sub_tasks.some((s: any) => s.assignee === filterPersonnel);
        if (!carriesPerson) return false;
      }

      // 2. Project Filter
      if (filterProject && meta.project_name !== filterProject) {
        return false;
      }

      // 3. Tag Filter
      if (filterTag && meta.tag_name !== filterTag) {
        return false;
      }

      // 4. Team Filter
      if (filterTeam && meta.team_name !== filterTeam) {
        return false;
      }

      return true;
    });
  }, [rawList, filterPersonnel, filterProject, filterTag, filterTeam]);

  // Stats active tasks: further filters baseTasks by Date Range for the 5 Overview cards only
  const statsActiveList = useMemo(() => {
    return baseTasks.filter(task => {
      if (!task.created_at) return true;
      const d = new Date(task.created_at);
      const taskDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (startDate && taskDate < startDate) {
        return false;
      }
      if (endDate && taskDate > endDate) {
        return false;
      }
      return true;
    });
  }, [baseTasks, startDate, endDate]);

  // Compute stats metrics based on current stats active list
  const stats = useMemo(() => {
    const total = statsActiveList.length;
    const completed = statsActiveList.filter(t => (t.status || '').toUpperCase() === 'DONE').length;
    const skipped = statsActiveList.filter(t => (t.status || '').toUpperCase() === 'SKIPPED').length;
    
    const totalEst = statsActiveList.reduce((acc, t) => acc + (t.est_time || 0), 0);
    const totalAct = statsActiveList.reduce((acc, t) => acc + (t.actual_time || 0), 0);

    return {
      total,
      completed,
      skipped,
      totalEst,
      totalAct
    };
  }, [statsActiveList]);

  const currentAssignees = assigneesList.length > 0 ? assigneesList : AVAILABLE_ASSIGNEES;
  const currentProjects = projectsList.length > 0 ? projectsList : AVAILABLE_PROJECTS;
  const currentTags = tagsList.length > 0 ? tagsList : AVAILABLE_TAGS;
  const currentTeams = teamsList.length > 0 ? teamsList : AVAILABLE_TEAMS;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-x-auto text-left font-sans">
      
      {/* FILTER BAR / OPTIMIZED HEADER BAR */}
      <div className="px-6 py-3 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between gap-4 flex-nowrap overflow-visible relative z-[40] min-w-max w-full select-none">
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {/* 1. Dropdown PERSONNEL */}
          <FilterSelect
            value={filterPersonnel}
            onChange={setFilterPersonnel}
            defaultOptionLabel="Assignees"
            options={currentAssignees.map(assignee => ({ value: assignee, label: assignee }))}
            className="h-8 min-w-[120px]"
          />

          {/* 2. Dropdown PROJECTS */}
          <FilterSelect
            value={filterProject}
            onChange={setFilterProject}
            defaultOptionLabel="Projects"
            options={currentProjects.map(project => ({ value: project, label: project }))}
            className="h-8 min-w-[120px]"
          />

          {/* 3. Dropdown TAGS */}
          <FilterSelect
            value={filterTag}
            onChange={setFilterTag}
            defaultOptionLabel="Tags"
            options={currentTags.map(tag => ({ value: tag, label: tag }))}
            className="h-8 min-w-[110px]"
          />

          {/* 4. Dropdown TEAMS */}
          <FilterSelect
            value={filterTeam}
            onChange={setFilterTeam}
            defaultOptionLabel="Teams"
            options={currentTeams.map(team => ({ value: team, label: team }))}
            className="h-8 min-w-[110px]"
          />

          {/* 5. Date Filter */}
          <DateRangePicker 
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            className="h-8"
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 overflow-hidden bg-slate-50/30">
        {/* Error handling alert block */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-md flex items-start gap-2 shadow-sm shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-left">
              <span className="font-semibold block text-xs">Database Error Occurred</span>
              <span className="text-xs text-rose-600/90 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* 1. HÀNG 1: 5 KHỐI THÈ THỐNG KÊ (OVERVIEW CARDS) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        
        {/* Card 1: TOTAL TASKS */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Total Templates</span>
            <div className="p-1 bg-slate-50 text-indigo-600 rounded">
              <ClipboardList className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 text-left">
            <h3 className="text-xl font-bold text-slate-800 leading-none">
              {stats.total}
            </h3>
            <p className="text-xs font-normal text-slate-400 mt-1">
              Active tasks
            </p>
          </div>
        </div>

        {/* Card 2: COMPLETED */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Completed</span>
            <div className="p-1 bg-slate-50 text-emerald-600 rounded">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 text-left">
            <h3 className="text-xl font-bold text-emerald-600 leading-none">
              {stats.completed}
            </h3>
            <p className="text-xs font-normal text-slate-400 mt-1">
              Done task checklist
            </p>
          </div>
        </div>

        {/* Card 3: SKIPPED */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Skipped</span>
            <div className="p-1 bg-slate-50 text-amber-500 rounded">
              <FastForward className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 text-left">
            <h3 className="text-xl font-bold text-slate-600 leading-none">
              {stats.skipped}
            </h3>
            <p className="text-xs font-normal text-slate-400 mt-1">
              Skipped task checklist
            </p>
          </div>
        </div>

        {/* Card 4: ESTIMATED */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Est. Time</span>
            <div className="p-1 bg-slate-50 text-indigo-600 rounded">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 text-left min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-indigo-650 truncate py-0.5 leading-none">
              {formatDuration(stats.totalEst)}
            </h3>
            <p className="text-xs font-normal text-slate-400 mt-1">
              Estimated effort
            </p>
          </div>
        </div>

        {/* Card 5: ACTUAL */}
        <div className="bg-white p-3.5 rounded-md border border-slate-200 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Actual Time</span>
            <div className="p-1 bg-slate-50 text-emerald-600 rounded">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1 text-left min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-emerald-600 truncate py-0.5 leading-none">
               {formatDuration(stats.totalAct)}
            </h3>
            <p className="text-xs font-normal text-slate-400 mt-1">
              Logged duration
            </p>
          </div>
        </div>

      </div>

      {/* 2. HÀNG 2: KHỐI WEEKLY ROADMAP MONDAY - FRIDAY VISUALIZER */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-md border border-slate-200 p-4 shadow-sm space-y-3 overflow-hidden">
        
        {/* Row Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Weekly Roadmap (Monday - Friday Visualizer)
            </h3>
          </div>
        </div>

        {/* Grid 5 Column of Monday to Friday */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 min-h-0">
          {weekDays.map((day) => {
            // Aggregate database or mock tasks applicable on this day of the week and is active
            const dayTasks = baseTasks.filter(t => t.is_active === true && isTaskOnWeekday(t, day.short, day.dateString, day.dayOfMonth));
            
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

            return (
              <div 
                key={day.name} 
                className={`bg-white rounded-md border flex flex-col justify-between overflow-hidden relative shadow-sm h-full ${
                  day.isToday 
                    ? 'border-indigo-500 ring-2 ring-indigo-50/50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Column header element */}
                <div className={`px-2.5 py-1.5 border-b border-slate-150 flex flex-col items-start justify-between relative shrink-0 ${
                  day.isToday ? 'bg-indigo-50/10' : 'bg-slate-50/50'
                }`}>
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-semibold ${
                      day.isToday ? 'text-indigo-600' : 'text-slate-700'
                    }`}>
                      {day.name}
                    </span>
                    
                    {day.isToday && (
                      <span className="bg-indigo-600 text-xs font-medium text-white px-1.5 py-0.5 rounded-sm">
                        Today
                      </span>
                    )}
                  </div>
                </div>

                {/* List items block */}
                <div className="flex-1 flex flex-col justify-between p-2.5 min-h-0 space-y-1.5 pb-3">
                  {dayRows.map((row) => (
                    <div 
                      key={row.label}
                      className={`flex-1 flex items-center justify-between px-2 py-1 rounded-md transition-all ${
                        row.isTotal 
                          ? 'bg-indigo-50/40 border border-indigo-100/50 font-semibold text-indigo-950' 
                          : 'border border-slate-50 hover:bg-slate-50/50 hover:border-slate-100'
                      }`}
                    >
                      {/* Left: Tên loại + Số lượng Task */}
                      <div className="flex flex-col justify-center">
                        <span className={`text-xs font-medium leading-none ${
                          row.isTotal ? 'text-indigo-600' : 'text-slate-400'
                        }`}>
                          {row.label}
                        </span>
                        <span className={`text-xs font-semibold leading-none mt-0.5 ${
                          row.isTotal ? 'text-indigo-800' : 'text-slate-700'
                        }`}>
                          {row.count}
                        </span>
                      </div>

                      {/* Right: Est Time */}
                      <div className="text-right flex flex-col justify-center">
                        <span className="text-xs text-slate-400 font-normal leading-none font-sans">Est time</span>
                        <span className={`text-xs font-medium mt-0.5 leading-none ${
                          row.isTotal ? 'text-indigo-600' : 'text-slate-500'
                        }`}>
                          {formatDuration(row.estMinutes)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            );
          })}
        </div>

      </div>

    </div>
    </div>
  );
}
