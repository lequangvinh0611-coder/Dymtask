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
  const names = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
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
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden text-left">
      
      {/* FILTER BAR / OPTIMIZED HEADER BAR - Height h-10/h-12 & thin padding */}
      <div className="flex items-center justify-start gap-1.5 bg-white px-6 py-1 border-b border-slate-100 shrink-0 select-none">
        {/* 1. Dropdown PERSONNEL */}
        <FilterSelect
          value={filterPersonnel}
          onChange={setFilterPersonnel}
          defaultOptionLabel="PERSONNEL"
          options={currentAssignees.map(assignee => ({ value: assignee, label: assignee }))}
        />

        {/* 2. Dropdown PROJECTS */}
        <FilterSelect
          value={filterProject}
          onChange={setFilterProject}
          defaultOptionLabel="PROJECTS"
          options={currentProjects.map(project => ({ value: project, label: project }))}
        />

        {/* 3. Dropdown TAGS */}
        <FilterSelect
          value={filterTag}
          onChange={setFilterTag}
          defaultOptionLabel="TAGS"
          options={currentTags.map(tag => ({ value: tag, label: tag }))}
        />

        {/* 4. Dropdown TEAMS */}
        <FilterSelect
          value={filterTeam}
          onChange={setFilterTeam}
          defaultOptionLabel="TEAMS"
          options={currentTeams.map(team => ({ value: team, label: team }))}
        />

        {/* 5. Date Filter */}
        <DateRangePicker 
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
          className="h-8 text-xs font-bold"
        />
      </div>

      <div className="flex-1 flex flex-col p-6 gap-6 min-h-0 overflow-hidden">
        {/* Error handling alert block */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl flex items-start gap-2.5 shadow-sm shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-left">
              <span className="font-bold block text-xs uppercase tracking-wider font-mono">Database Error Occurred</span>
              <span className="text-[10px] text-rose-600/90 font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* 1. HÀNG 1: 5 KHỐI THÈ THỐNG KÊ (OVERVIEW CARDS) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 shrink-0">
        
        {/* Card 1: TOTAL TASKS */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">TOTAL TASKS</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-left">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none font-mono">
              {stats.total}
            </h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider font-mono">
              Total Tasks
            </p>
          </div>
        </div>

        {/* Card 2: COMPLETED */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">COMPLETED</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-left">
            <h3 className="text-2xl font-black text-emerald-600 tracking-tight leading-none font-mono">
              {stats.completed}
            </h3>
            <p className="text-[9px] font-bold text-emerald-500 mt-1 uppercase tracking-wider font-mono">
              Done Tasks
            </p>
          </div>
        </div>

        {/* Card 3: SKIPPED */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between transition-all duration-350 hover:shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">SKIPPED</span>
            <div className="p-1.5 bg-slate-50 text-slate-500 rounded-lg">
              <FastForward className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-left">
            <h3 className="text-2xl font-black text-slate-500 tracking-tight leading-none font-mono">
              {stats.skipped}
            </h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider font-mono">
              Skipped Tasks
            </p>
          </div>
        </div>

        {/* Card 4: ESTIMATED */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">ESTIMATED</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-left min-w-0">
            <h3 className="text-sm md:text-base font-black text-blue-600 tracking-tight leading-none font-mono truncate py-1">
              {formatDuration(stats.totalEst)}
            </h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider font-mono">
              Est. Time
            </p>
          </div>
        </div>

        {/* Card 5: ACTUAL */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">ACTUAL</span>
            <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 text-left min-w-0">
            <h3 className="text-sm md:text-base font-black text-teal-600 tracking-tight leading-none font-mono truncate py-1">
              {formatDuration(stats.totalAct)}
            </h3>
            <p className="text-[9px] font-bold text-teal-500 mt-1 uppercase tracking-wider font-mono">
              Actual Time
            </p>
          </div>
        </div>

      </div>

      {/* 2. HÀNG 2: KHỐI WEEKLY ROADMAP MONDAY - FRIDAY VISUALIZER */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-slate-100 p-5 shadow-sm space-y-4 overflow-hidden">
        
        {/* Row Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150/40 shrink-0">
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-widest font-mono">
              Weekly Roadmap (Monday - Friday Visualizer)
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">
              Bản đồ lịch trình phân bổ chu kỳ công việc và tỷ lệ đạt mục tiêu hàng ngày
            </p>
          </div>

          <div className="text-[10px] text-slate-500 font-bold font-mono bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
            📊 ACTIVE WORKDAYS: 5 DAYS
          </div>
        </div>

        {/* Grid 5 Column of Monday to Friday */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 min-h-0">
          {weekDays.map((day) => {
            // Aggregate database or mock tasks applicable on this day of the week
            const dayTasks = baseTasks.filter(t => isTaskOnWeekday(t, day.short, day.dateString, day.dayOfMonth));
            
            // Calculate completed progress
            const completedCount = dayTasks.filter(t => (t.status || '').toUpperCase() === 'DONE').length;
            const progressPercent = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;

            const dailyTypeTasks = dayTasks.filter(t => (t.task_type || '').toUpperCase() === 'DAILY');
            const weeklyTypeTasks = dayTasks.filter(t => (t.task_type || '').toUpperCase() === 'WEEKLY');
            const monthlyTypeTasks = dayTasks.filter(t => (t.task_type || '').toUpperCase() === 'MONTHLY');
            const spotTypeTasks = dayTasks.filter(t => ['ONETIME', 'SPOT'].includes((t.task_type || '').toUpperCase()));

            const dayRows = [
              {
                label: 'TOTAL',
                count: dayTasks.length,
                estMinutes: dayTasks.reduce((sum, t) => sum + (t.est_time || 0), 0),
                isTotal: true
              },
              {
                label: 'DAILY',
                count: dailyTypeTasks.length,
                estMinutes: dailyTypeTasks.reduce((sum, t) => sum + (t.est_time || 0), 0)
              },
              {
                label: 'WEEKLY',
                count: weeklyTypeTasks.length,
                estMinutes: weeklyTypeTasks.reduce((sum, t) => sum + (t.est_time || 0), 0)
              },
              {
                label: 'MONTHLY',
                count: monthlyTypeTasks.length,
                estMinutes: monthlyTypeTasks.reduce((sum, t) => sum + (t.est_time || 0), 0)
              },
              {
                label: 'SPOT(NEW)',
                count: spotTypeTasks.length,
                estMinutes: spotTypeTasks.reduce((sum, t) => sum + (t.est_time || 0), 0)
              }
            ];

            return (
              <div 
                key={day.name} 
                className={`bg-white rounded-xl border flex flex-col justify-between overflow-hidden relative shadow-xs transition-all duration-300 h-full ${
                  day.isToday 
                    ? 'border-blue-400 ring-2 ring-blue-50' 
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                {/* Column header element */}
                <div className={`px-3 py-2 border-b border-slate-100 flex flex-col items-start justify-between relative shrink-0 ${
                  day.isToday ? 'bg-blue-50/10' : 'bg-slate-50/30'
                }`}>
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-black tracking-widest font-mono ${
                      day.isToday ? 'text-blue-600' : 'text-slate-700'
                    }`}>
                      {day.name}
                    </span>
                    
                    {day.isToday && (
                      <span className="bg-blue-600 text-[8px] font-black text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono scale-90">
                        TODAY
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold text-slate-400 mt-0.5 font-mono tracking-wider">
                    {formatDateToDisplay(day.dateString)}
                  </span>
                </div>

                {/* List items block */}
                <div className="flex-1 flex flex-col justify-between p-3 min-h-0 space-y-2">
                  {dayRows.map((row) => (
                    <div 
                      key={row.label}
                      className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${
                        row.isTotal 
                          ? 'bg-blue-50/50 border border-blue-100/40 font-black' 
                          : 'border border-slate-50 hover:bg-slate-50/50 hover:border-slate-100'
                      }`}
                    >
                      {/* Left: Tên loại + Số lượng Task */}
                      <div className="flex flex-col justify-center">
                        <span className={`text-[8px] font-black tracking-wider uppercase font-mono leading-none ${
                          row.isTotal ? 'text-blue-600' : 'text-slate-400'
                        }`}>
                          {row.label}
                        </span>
                        <span className={`text-sm font-black leading-none mt-0.5 ${
                          row.isTotal ? 'text-indigo-700' : 'text-slate-800'
                        }`}>
                          {row.count}
                        </span>
                      </div>

                      {/* Right: Est Time */}
                      <div className="text-right flex flex-col justify-center">
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider font-mono leading-none">Est Time</span>
                        <span className={`text-[10px] font-bold font-mono mt-0.5 leading-none ${
                          row.isTotal ? 'text-blue-600' : 'text-slate-500'
                        }`}>
                          {formatDuration(row.estMinutes)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress completed label percentage */}
                <div className="px-3 pb-2 pt-0.5 text-right font-mono shrink-0">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Done: <span className="text-blue-600 font-extrabold">{progressPercent}%</span>
                  </span>
                </div>

                {/* Horizontal custom extra thin progress bar */}
                <div className="w-full bg-slate-100 h-1 mt-auto shrink-0">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300" 
                    style={{ width: `${progressPercent}%` }}
                  />
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
