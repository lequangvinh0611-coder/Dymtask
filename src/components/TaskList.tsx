import React from 'react';
import { Search, Filter, RotateCw, ExternalLink, Download, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

interface TaskListProps {
    title: string;
    showCreate?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({ title, showCreate = false }) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
            <RotateCw className="w-4 h-4" />
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600">
            <option>All Assignees</option>
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600">
            <option>All Tags</option>
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600 md:hidden lg:block">
            <option>All Projects</option>
          </select>
          <select className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600">
            <option>New</option>
          </select>
          <input type="date" className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none text-slate-600" />
          
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>

          {showCreate && (
             <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200">
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
             </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 w-12">
                <input type="checkbox" className="rounded" />
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">ID</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Task Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Tag</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Project</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Team</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Type</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Deadline</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Time</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...Array(15)].map((_, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <input type="checkbox" className="rounded" />
                </td>
                <td className="px-6 py-4 font-mono text-[11px] text-slate-400">000{308 + i}</td>
                <td className="px-6 py-4 font-semibold text-slate-700">株式会社TOMIYO JOB {i % 3 === 0 ? '人材事業部' : ''}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">数値報告</span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">【事務代行】HR TECH</td>
                <td className="px-6 py-4 text-sm text-slate-500">内部-1課</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                    i % 4 === 0 ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                  )}>
                    {i % 4 === 0 ? 'WEEKLY' : 'DAILY'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">08:30</span>
                    <span className="text-[10px] text-slate-400 font-medium tracking-tight">Mon - Fri</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col text-[10px] font-bold">
                    <span className="text-indigo-600">E: 5m</span>
                    <span className="text-emerald-500">A: 0m</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100">NEW</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors">Submit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between">
         <div className="text-sm text-slate-500">Showing 1 to 15 of 268 tasks</div>
         <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, '...', 18].map((p, i) => (
              <button 
                key={i} 
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold",
                  p === 1 ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                )}
              >
                {p}
              </button>
            ))}
         </div>
      </div>
    </div>
  );
};

export default TaskList;
