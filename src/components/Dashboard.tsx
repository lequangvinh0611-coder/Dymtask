import React from 'react';
import { 
  BarChart, 
  Users, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Target,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ResponsiveContainer, BarChart as RechartsBar, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';

const data = [
  { name: 'Mon', completed: 45, total: 60 },
  { name: 'Tue', completed: 52, total: 60 },
  { name: 'Wed', completed: 38, total: 60 },
  { name: 'Thu', completed: 58, total: 60 },
  { name: 'Fri', completed: 48, total: 60 },
];

const pieData = [
  { name: 'Completed', value: 400, color: '#4F46E5' },
  { name: 'Pending', value: 300, color: '#E2E8F0' },
  { name: 'In Progress', value: 150, color: '#10B981' },
];

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
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
  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Tasks" value="1,284" icon={ClipboardListIcon} color="bg-indigo-50 text-indigo-600" trend="+12%" />
        <StatCard title="Active Projects" value="24" icon={Target} color="bg-emerald-50 text-emerald-600" trend="+2" />
        <StatCard title="Team Efficiency" value="94.2%" icon={TrendingUp} color="bg-sky-50 text-sky-600" trend="+4.5%" />
        <StatCard title="Audit Alerts" value="3" icon={AlertCircle} color="bg-rose-50 text-rose-600" trend="-15%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Weekly Performance</h3>
            <select className="text-xs border-none bg-slate-50 text-slate-500 rounded-lg px-3 py-1.5 font-bold uppercase tracking-wider">
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBar data={data} barGap={8}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }} />
                <YAxis hide />
                <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="completed" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="total" fill="#E2E8F0" radius={[4, 4, 0, 0]} barSize={40} />
              </RechartsBar>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[400px] flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6">Task Distribution</h3>
          <div className="flex-1">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                  <span className="text-sm font-medium text-slate-500">{d.name}</span>
                </div>
                <span className="text-sm font-bold text-slate-700">{Math.round((d.value / 850) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ClipboardListIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
)

export default Dashboard;
