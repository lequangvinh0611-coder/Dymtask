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
  teamEfficiency: string;
  auditAlerts: number;
  weeklyPerformance: any[];
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
      const [
        { count: taskCount },
        { count: projCount },
        { count: alertCount },
        { data: tasks }
      ] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('status, created_at')
      ]);

      // Calculate Task Distribution
      const statusCounts = (tasks || []).reduce((acc: any, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});

      const total = tasks?.length || 1;
      const distribution = [
        { name: 'Completed', value: statusCounts['DONE'] || 0, color: '#4F46E5' },
        { name: 'In Progress', value: statusCounts['IN_PROGRESS'] || 0, color: '#10B981' },
        { name: 'New', value: statusCounts['NEW'] || 0, color: '#E2E8F0' },
      ];

      // Calculate real weekly performance if possible, or stay at 0
      const weeklyData = [
        { name: 'Mon', completed: 0, total: 0 },
        { name: 'Tue', completed: 0, total: 0 },
        { name: 'Wed', completed: 0, total: 0 },
        { name: 'Thu', completed: 0, total: 0 },
        { name: 'Fri', completed: 0, total: 0 },
      ];

      // Calculate real efficiency
      const doneCount = statusCounts['DONE'] || 0;
      const efficiency = taskCount ? Math.round((doneCount / taskCount) * 100) : 0;

      setStats({
        totalTasks: taskCount || 0,
        activeProjects: projCount || 0,
        teamEfficiency: `${efficiency}%`, 
        auditAlerts: alertCount || 0,
        weeklyPerformance: weeklyData,
        distribution: distribution
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

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-50/30">
      <div className="flex items-center justify-between mb-2">
         <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
           Real-time Analytics
         </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Tasks" value={stats.totalTasks.toLocaleString()} icon={ClipboardListIcon} color="bg-indigo-50 text-indigo-600" trend="+0%" loading={loading} />
        <StatCard title="Active Projects" value={stats.activeProjects.toLocaleString()} icon={Target} color="bg-emerald-50 text-emerald-600" trend="+0" loading={loading} />
        <StatCard title="Team Efficiency" value={stats.teamEfficiency} icon={TrendingUp} color="bg-sky-50 text-sky-600" trend="+0%" loading={loading} />
        <StatCard title="Audit Alerts" value={stats.auditAlerts.toLocaleString()} icon={AlertCircle} color="bg-rose-50 text-rose-600" trend="0" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[400px] flex flex-col relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          )}
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Weekly Performance</h3>
            <select className="text-xs border-none bg-slate-50 text-slate-500 rounded-lg px-3 py-1.5 font-bold uppercase tracking-wider">
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBar data={stats.weeklyPerformance} barGap={8}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} />
                <YAxis hide />
                <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="completed" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="total" fill="#E2E8F0" radius={[4, 4, 0, 0]} barSize={40} />
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
