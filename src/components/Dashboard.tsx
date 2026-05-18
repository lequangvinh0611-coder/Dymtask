import React, { useEffect, useState } from 'react';
import { 
  ClipboardList as ClipboardListIcon, 
  Target,
  TrendingUp,
  AlertCircle,
  Loader2,
  CalendarDays as CalendarDayIcon,
  Calendar as CalendarIcon,
  RotateCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ResponsiveContainer, BarChart as RechartsBar, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalTasks: number;
  dailyCount: number;
  weeklyCount: number;
  monthlyCount: number;
  spotNewCount: number;
  newCount: number;
  doneCount: number;
  skipCount: number;
  todayCompleted: number;
  todayTotal: number;
  distribution: any[];
}

const StatCard = ({ title, value, icon: Icon, trend, color, loading }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
    {loading && (
      <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
      </div>
    )}
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-2 rounded-xl transition-colors", color)}>
        <Icon className="w-5 h-5" />
      </div>
      {trend && (
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full",
          trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">{title}</p>
    <p className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{value}</p>
  </div>
);

const FilterSelect = ({ label, value, options, onChange }: any) => (
  <select 
    value={value || ""}
    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] h-7 min-w-[100px]" 
    onChange={(e) => onChange(e.target.value || undefined)}
  >
    <option value="">{label}</option>
    {options.map((o: any) => <option key={o.id} value={o.id}>{o.name || o.email}</option>)}
  </select>
);

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState<any>({
    assignee_email: undefined,
    project_id: undefined,
    tag_id: undefined,
    startDate: today,
    endDate: today
  });

  const [meta, setMeta] = useState({
    projects: [] as any[],
    tags: [] as any[],
    users: [] as any[]
  });

  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    dailyCount: 0,
    weeklyCount: 0,
    monthlyCount: 0,
    spotNewCount: 0,
    newCount: 0,
    doneCount: 0,
    skipCount: 0,
    todayCompleted: 0,
    todayTotal: 0,
    distribution: []
  });

  useEffect(() => {
    const fetchMeta = async () => {
      const [p, t, u] = await Promise.all([
        supabase.from('projects').select('id, name'),
        supabase.from('tags').select('id, name'),
        supabase.from('users').select('id, name, email'),
      ]);
      setMeta({ projects: p.data || [], tags: t.data || [], users: u.data || [] });
    };
    fetchMeta();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      let query = supabase.from('tasks').select('*');
      
      if (filters.assignee_email) query = query.contains('assignees', [filters.assignee_email]);
      if (filters.project_id) query = query.eq('project_id', filters.project_id);
      if (filters.tag_id) query = query.eq('tag_id', filters.tag_id);

      const { data: allTasks } = await query;
      const tasks = allTasks || [];

      // Filter by date range for statistics
      const start = filters.startDate ? new Date(filters.startDate) : null;
      const end = filters.endDate ? new Date(filters.endDate) : null;
      
      const filteredByDate = tasks.filter(t => {
        if (!start || !end) return true;
        
        if (t.type === 'ONETIME') {
          const d = new Date(t.deadline_date);
          return d >= start && d <= end;
        }
        // Recurring tasks always count as "active" in their respective total if within range existence
        return true; 
      });

      const processed = filteredByDate;

      const statsUpdate = {
        totalTasks: processed.length,
        newCount: processed.filter(t => t.status === 'NEW').length,
        doneCount: processed.filter(t => t.status === 'DONE').length,
        skipCount: processed.filter(t => t.status === 'SKIPPED').length,
        dailyCount: processed.filter(t => t.type === 'DAILY').length,
        weeklyCount: processed.filter(t => t.type === 'WEEKLY').length,
        monthlyCount: processed.filter(t => t.type === 'MONTHLY').length,
        spotNewCount: processed.filter(t => t.type === 'ONETIME' && t.status === 'NEW').length,
        todayCompleted: 0,
        todayTotal: 0,
        distribution: []
      };

      setStats(statsUpdate);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  const SummarySection = ({ title, count, icon: Icon, color }: any) => (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2">
      <div className={cn("p-2 rounded-lg", color)}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <p className="text-xl font-bold text-slate-800">{count}</p>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white shadow-sm overflow-hidden">
      {/* Filter Bar consistent with TaskList */}
      <div className="px-4 py-1.5 border-b border-slate-100 flex items-center bg-white shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5">
          <FilterSelect 
            label="Assignee" 
            value={filters.assignee_email} 
            options={meta.users.map(u => ({ id: u.email, name: u.name || u.email }))} 
            onChange={(val: any) => setFilters({...filters, assignee_email: val})} 
          />
          <FilterSelect 
            label="Project" 
            value={filters.project_id} 
            options={meta.projects} 
            onChange={(val: any) => setFilters({...filters, project_id: val})} 
          />
          <FilterSelect 
            label="Tag" 
            value={filters.tag_id} 
            options={meta.tags} 
            onChange={(val: any) => setFilters({...filters, tag_id: val})} 
          />
          
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 h-7">
            <input 
              type="date" 
              value={filters.startDate || ""}
              className="bg-transparent text-[10px] focus:outline-none text-slate-600 w-24" 
              onChange={(e) => {
                const val = e.target.value;
                if (filters.endDate) {
                  const diff = Math.abs(new Date(val).getTime() - new Date(filters.endDate).getTime());
                  if (Math.ceil(diff / (1000 * 60 * 60 * 24)) > 62) {
                    alert("Khoảng cách tối đa là 62 ngày");
                    return;
                  }
                }
                setFilters({...filters, startDate: val});
              }}
            />
            <span className="text-[10px] text-slate-300">-</span>
            <input 
              type="date" 
              value={filters.endDate || ""}
              className="bg-transparent text-[10px] focus:outline-none text-slate-600 w-24" 
              onChange={(e) => {
                const val = e.target.value;
                if (filters.startDate) {
                  const diff = Math.abs(new Date(val).getTime() - new Date(filters.startDate).getTime());
                  if (Math.ceil(diff / (1000 * 60 * 60 * 24)) > 62) {
                    alert("Khoảng cách tối đa là 62 ngày");
                    return;
                  }
                }
                setFilters({...filters, endDate: val});
              }}
            />
          </div>

          <button onClick={fetchDashboardData} className="p-1 ml-1 text-slate-400 hover:text-indigo-600 transition-colors">
            <RotateCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-8 bg-slate-50/20">
        {/* Top 4 Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Tasks" value={stats.totalTasks} icon={ClipboardListIcon} color="bg-blue-50 text-blue-600" loading={loading} />
          <StatCard title="Task New" value={stats.newCount} icon={Target} color="bg-amber-50 text-amber-600" loading={loading} />
          <StatCard title="Task Done" value={stats.doneCount} icon={TrendingUp} color="bg-emerald-50 text-emerald-600" loading={loading} />
          <StatCard title="Task Skip" value={stats.skipCount} icon={AlertCircle} color="bg-rose-50 text-rose-600" loading={loading} />
        </div>

        {/* 5-Category Breakdown Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Task Breakdown Analysis</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <SummarySection title="Total Task" count={stats.totalTasks} icon={ClipboardListIcon} color="bg-slate-100 text-slate-600" />
            <SummarySection title="Daily Task" count={stats.dailyCount} icon={RotateCw} color="bg-indigo-50 text-indigo-600" />
            <SummarySection title="Weekly Task" count={stats.weeklyCount} icon={CalendarDayIcon} color="bg-sky-50 text-sky-600" />
            <SummarySection title="Monthly Task" count={stats.monthlyCount} icon={CalendarIcon} color="bg-purple-50 text-purple-600" />
            <SummarySection title="Spot (New)" count={stats.spotNewCount} icon={Target} color="bg-rose-50 text-rose-600" />
          </div>
        </div>

        {/* Detailed Analysis Frames */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[350px] flex flex-col relative overflow-hidden">
             {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>}
             <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Type Distribution</h3>
             <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Daily', value: stats.dailyCount, color: '#4F46E5' },
                        { name: 'Weekly', value: stats.weeklyCount, color: '#0EA5E9' },
                        { name: 'Monthly', value: stats.monthlyCount, color: '#A855F7' },
                        { name: 'Spot', value: stats.spotNewCount, color: '#F43F5E' },
                      ]}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { color: '#4F46E5' }, { color: '#0EA5E9' }, { color: '#A855F7' }, { color: '#F43F5E' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[350px] flex flex-col relative overflow-hidden">
             {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>}
             <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Performance Matrix</h3>
             <div className="flex-1 flex flex-col justify-center space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Task Completion Rate</span>
                    <span>{stats.totalTasks > 0 ? Math.round((stats.doneCount / stats.totalTasks) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${stats.totalTasks > 0 ? (stats.doneCount / stats.totalTasks) * 100 : 0}%` }}></div>
                   </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Task Skip Rate</span>
                    <span>{stats.totalTasks > 0 ? Math.round((stats.skipCount / stats.totalTasks) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full transition-all duration-1000" style={{ width: `${stats.totalTasks > 0 ? (stats.skipCount / stats.totalTasks) * 100 : 0}%` }}></div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
