import React, { useEffect, useState } from 'react';
import { 
  ClipboardList as ClipboardListIcon, 
  Target,
  TrendingUp,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ResponsiveContainer, BarChart as RechartsBar, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalTasks: number;
  activeProjects: number;
  todayCompleted: number;
  todayTotal: number;
  auditAlerts: number;
  dailyRecap: any[];
  distribution: any[];
}

const StatCard = ({ title, value, icon: Icon, trend, color, loading }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
    {loading && (
      <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
      </div>
    )}
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-2 rounded-lg", color)}>
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
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
    <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
  </div>
);

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    activeProjects: 0,
    teamEfficiency: '0%',
    auditAlerts: 0,
    weeklyPerformance: [],
    distribution: []
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDayName = dayNames[today.getDay()];

      const [
        { count: taskCount },
        { count: projCount },
        { count: alertCount },
        { data: allTasks }
      ] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('status, type, deadline_days, is_active')
      ]);

      const tasks = allTasks || [];
      const activeTasks = tasks.filter(t => t.is_active);

      const statusCounts = tasks.reduce((acc: any, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});

      const distribution = [
        { name: 'Completed', value: (statusCounts['DONE'] || 0) + (statusCounts['SUBMITTED'] || 0), color: '#4F46E5' },
        { name: 'In Progress', value: statusCounts['IN_PROGRESS'] || 0, color: '#10B981' },
        { name: 'New', value: statusCounts['NEW'] || 0, color: '#E2E8F0' },
      ];

      const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const dailyRecap = daysOfWeek.map(day => {
        const count = activeTasks.filter(t => 
          (t.type === 'DAILY') || (t.type === 'WEEKLY' && t.deadline_days?.includes(day))
        ).length;
        return { name: day, count };
      });

      const todayTasks = activeTasks.filter(t => 
        (t.type === 'DAILY') || (t.type === 'WEEKLY' && t.deadline_days?.includes(currentDayName))
      );
      const todayCompleted = todayTasks.filter(t => t.status === 'DONE' || t.status === 'SUBMITTED').length;

      setStats({
        totalTasks: taskCount || 0,
        activeProjects: projCount || 0,
        todayCompleted,
        todayTotal: todayTasks.length,
        auditAlerts: alertCount || 0,
        dailyRecap,
        distribution
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const todayProgress = stats.todayTotal > 0 ? Math.round((stats.todayCompleted / stats.todayTotal) * 100) : 0;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-50/30">
      <div className="flex items-center justify-between mb-2">
         <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
           Real-time Analytics
         </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Today's Progress" value={`${todayProgress}%`} icon={TrendingUp} color="bg-indigo-50 text-indigo-600" trend={todayProgress > 0 ? `+${todayProgress}%` : undefined} loading={loading} />
        <StatCard title="Total Tasks" value={stats.totalTasks.toLocaleString()} icon={ClipboardListIcon} color="bg-emerald-50 text-emerald-600" loading={loading} />
        <StatCard title="Active Projects" value={stats.activeProjects.toLocaleString()} icon={Target} color="bg-sky-50 text-sky-600" loading={loading} />
        <StatCard title="Audit Logs" value={stats.auditAlerts.toLocaleString()} icon={AlertCircle} color="bg-rose-50 text-rose-600" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[400px] flex flex-col relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Recurring Tasks Recap (Mon-Fri)</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Schedule</span>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBar data={stats.dailyRecap}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" fill="var(--theme-color, #4F46E5)" radius={[4, 4, 0, 0]} barSize={50} />
              </RechartsBar>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[400px] flex flex-col relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          )}
          <h3 className="font-bold text-slate-800 mb-6">Task Distribution</h3>
          <div className="flex-1">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.distribution}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {stats.distribution.map((d) => (
              <div key={d.name} className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{d.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-700">{Math.round((d.value / (stats.totalTasks || 1)) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
