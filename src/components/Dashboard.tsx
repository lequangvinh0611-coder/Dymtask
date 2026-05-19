import React, { useEffect, useState, useMemo } from 'react';
import { 
  ClipboardList as ClipboardListIcon, 
  Target,
  TrendingUp,
  AlertCircle,
  Loader2,
  CalendarDays as CalendarDayIcon,
  Calendar as CalendarIcon,
  RotateCw,
  Clock,
  CheckCircle2,
  FastForward
} from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { DateRangePicker } from './ui/DateRangePicker';

interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  skippedTasks: number;
  estimatedTime: { h: number; m: number };
  actualTime: { h: number; m: number };
}

const StatHeaderCard = ({ title, value, icon: Icon, color, loading, subtitle }: any) => (
  <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col min-h-[100px]">
    {loading && <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="w-4 h-4 text-indigo-600 animate-spin" /></div>}
    <div className="flex items-center gap-3 mb-2">
      <div className={cn("p-1.5 rounded-lg", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
    </div>
    <div className="mt-auto">
      <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{value}</p>
      {subtitle && <p className="text-[8px] font-bold text-slate-300 uppercase mt-1 tracking-wider">{subtitle}</p>}
    </div>
  </div>
);

const RoadmapColumn = ({ day, date, tasks, isToday }: any) => {
  const stats = useMemo(() => {
    const dayTasks = tasks || [];
    const totalCount = dayTasks.length;
    const estTotal = dayTasks.reduce((acc: number, t: any) => acc + (t.estimated_minutes || 0), 0);
    const actTotal = dayTasks.reduce((acc: number, t: any) => acc + (t.actual_minutes || 0), 0);
    
    const daily = dayTasks.filter((t: any) => t.type === 'DAILY');
    const weekly = dayTasks.filter((t: any) => t.type === 'WEEKLY');
    const monthly = dayTasks.filter((t: any) => t.type === 'MONTHLY');
    const spot = dayTasks.filter((t: any) => t.type === 'ONETIME' && t.status === 'NEW');

    return {
      total: totalCount,
      est: estTotal,
      daily: daily.length,
      dailyEst: daily.reduce((acc: number, t: any) => acc + (t.estimated_minutes || 0), 0),
      weekly: weekly.length,
      weeklyEst: weekly.reduce((acc: number, t: any) => acc + (t.estimated_minutes || 0), 0),
      monthly: monthly.length,
      monthlyEst: monthly.reduce((acc: number, t: any) => acc + (t.estimated_minutes || 0), 0),
      spot: spot.length,
      spotEst: spot.reduce((acc: number, t: any) => acc + (t.estimated_minutes || 0), 0)
    };
  }, [tasks]);

  const Row = ({ label, count, time }: any) => (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-base font-black text-slate-800">{count}</span>
        <span className="text-[9px] font-bold text-slate-400 w-14 text-right">{Math.floor(time/60)}h {time%60}m</span>
      </div>
    </div>
  );

  return (
    <div className={cn(
      "flex-1 min-w-[220px] bg-white rounded-2xl border p-5 flex flex-col relative",
      isToday ? "border-indigo-600 shadow-xl shadow-indigo-100/50 ring-1 ring-indigo-600/10" : "border-slate-100"
    )}>
      {isToday && (
        <span className="absolute top-5 right-5 bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest shadow-lg shadow-indigo-200">Today</span>
      )}
      <div className="mb-8">
        <h4 className="text-[16px] font-black text-indigo-600 uppercase tracking-tighter">{day}</h4>
        <p className="text-[10px] font-bold text-slate-400 mt-1">{date}</p>
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="bg-indigo-50/50 p-4 rounded-xl mb-6 flex items-center justify-between border border-indigo-100/50">
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Total</span>
          <div className="flex items-center gap-4">
            <span className="text-xl font-black text-indigo-600 tracking-tight">{stats.total}</span>
            <span className="text-[9px] font-bold text-indigo-400 w-14 text-right">{Math.floor(stats.est/60)}h {stats.est%60}m</span>
          </div>
        </div>

        <Row label="Daily" count={stats.daily} time={stats.dailyEst} />
        <Row label="Weekly" count={stats.weekly} time={stats.weeklyEst} />
        <Row label="Monthly" count={stats.monthly} time={stats.monthlyEst} />
        <Row label="Spot(New)" count={stats.spot} time={stats.spotEst} />
      </div>

      <div className="mt-6 pt-4 border-t border-slate-50">
        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
          <div 
            className="bg-indigo-600 h-full transition-all duration-1000" 
            style={{ width: `${stats.total > 0 ? (stats.daily / stats.total) * 100 : 0}%` }} 
          />
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState<any>({
    assignee_email: undefined,
    team_ids: undefined,
    startDate: today,
    endDate: today
  });

  const [meta, setMeta] = useState({
    teams: [] as any[],
    users: [] as any[]
  });

  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    skippedTasks: 0,
    estimatedTime: { h: 0, m: 0 },
    actualTime: { h: 0, m: 0 }
  });

  const [roadmapTasks, setRoadmapTasks] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchMeta = async () => {
      const [t, u, p, tg] = await Promise.all([
        supabase.from('teams').select('id, name'),
        supabase.from('users').select('id, name, email'),
        supabase.from('projects').select('id, name'),
        supabase.from('tags').select('id, name'),
      ]);
      setMeta({ 
        teams: t.data || [], 
        users: u.data || [],
        projects: p.data || [],
        tags: tg.data || []
      } as any);
    };
    fetchMeta();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      
      let query = supabase.from('tasks').select('*');
      if (filters.assignee_email) query = query.contains('assignees', [filters.assignee_email]);
      if (filters.team_ids) query = query.contains('team_ids', [filters.team_ids.toUpperCase()]);
      if (filters.project_id) query = query.eq('project_id', filters.project_id);
      if (filters.tag_id) query = query.eq('tag_id', filters.tag_id);

      const { data: allTasks } = await query;
      const tasks = allTasks || [];

      // Stat Calculation
      const filtered = tasks.filter(t => {
        if (t.type === 'ONETIME' && t.deadline_date) {
            const d = new Date(t.deadline_date);
            return d >= start && d <= end;
        }
        return true;
      });

      const totalEst = filtered.reduce((acc, t) => acc + (t.estimated_minutes || 0), 0);
      const totalAct = filtered.reduce((acc, t) => acc + (t.actual_minutes || 0), 0);

      setStats({
        totalTasks: filtered.length,
        completedTasks: filtered.filter(t => t.status === 'DONE').length,
        skippedTasks: filtered.filter(t => t.status === 'SKIPPED').length,
        estimatedTime: { h: Math.floor(totalEst/60), m: totalEst%60 },
        actualTime: { h: Math.floor(totalAct/60), m: totalAct%60 }
      });

      // Roadmap logic (Current week Mon-Fri)
      const now = new Date();
      const currentDay = now.getDay(); // 0-6
      const roadmap: Record<string, any[]> = {};
      
      const mon = new Date(now);
      mon.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

      for (let i = 0; i < 5; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        
        roadmap[dStr] = tasks.filter(t => {
            if (t.type === 'DAILY') return true;
            if (t.type === 'ONETIME') return t.deadline_date === dStr;
            if (t.type === 'WEEKLY') {
                const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                return t.deadline_days?.includes(dayNames[d.getDay()]);
            }
            if (t.type === 'MONTHLY') return t.deadline_day_num === d.getDate();
            return false;
        });
      }
      setRoadmapTasks(roadmap);

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  const roadmapDates = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    return Array.from({ length: 5 }, (_, i) => {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        return {
            dateStr: d.toISOString().split('T')[0],
            dayName: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'][i],
            displayDate: d.toLocaleDateString('ja-JP').replace(/\//g, '-')
        };
    });
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-1 flex items-center justify-start bg-white shrink-0 border-b border-slate-100">
        <div className="flex items-center gap-1.5 flex-1">
          <select 
            value={filters.assignee_email || ""}
            className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[140px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer text-center" 
            onChange={(e) => setFilters({...filters, assignee_email: e.target.value || undefined})}
          >
            <option value="">PERSONNEL</option>
            {meta.users.map(u => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
          </select>
          <select 
            value={filters.project_id || ""}
            className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[140px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer text-center" 
            onChange={(e) => setFilters({...filters, project_id: e.target.value || undefined})}
          >
            <option value="">PROJECTS</option>
            {(meta as any).projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select 
            value={filters.tag_id || ""}
            className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[140px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer text-center" 
            onChange={(e) => setFilters({...filters, tag_id: e.target.value || undefined})}
          >
            <option value="">TAGS</option>
            {(meta as any).tags?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select 
            value={filters.team_ids || ""}
            className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs h-8 min-w-[140px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none cursor-pointer text-center" 
            onChange={(e) => setFilters({...filters, team_ids: e.target.value || undefined})}
          >
            <option value="">TEAMS</option>
            {meta.teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>

          <DateRangePicker 
            startDate={filters.startDate} 
            endDate={filters.endDate} 
            onChange={(start, end) => setFilters({...filters, startDate: start, endDate: end})} 
          />

          <button onClick={() => fetchDashboardData()} className={cn("p-2 ml-1 text-slate-400 hover:text-indigo-600 transition-colors", loading && "animate-spin text-indigo-600")}>
             <RotateCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Header Stat Area */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatHeaderCard title="Total Tasks" value={stats.totalTasks} subtitle="IN PERIOD" icon={ClipboardListIcon} color="bg-indigo-50 text-indigo-600" loading={loading} />
          <StatHeaderCard title="Completed" value={stats.completedTasks} subtitle="DONE" icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" loading={loading} />
          <StatHeaderCard title="Skipped" value={stats.skippedTasks} subtitle="SKIPPED" icon={FastForward} color="bg-slate-50 text-slate-400" loading={loading} />
          <StatHeaderCard title="Estimated" value={`${stats.estimatedTime.h}h ${stats.estimatedTime.m}m`} subtitle="EXPECTED" icon={Clock} color="bg-sky-50 text-sky-600" loading={loading} />
          <StatHeaderCard title="Actual" value={`${stats.actualTime.h}h ${stats.actualTime.m}m`} subtitle="SPENT" icon={Clock} color="bg-emerald-50 text-emerald-600" loading={loading} />
        </div>

        {/* Weekly Roadmap Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col min-h-0">
          <div className="mb-6">
            <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest">Weekly Roadmap</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Monday - Friday Visualizer</p>
          </div>

          <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {roadmapDates.map(rd => (
              <RoadmapColumn 
                key={rd.dateStr}
                day={rd.dayName}
                date={rd.dateStr}
                tasks={roadmapTasks[rd.dateStr]}
                isToday={rd.dateStr === today}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
