import React, { useState } from 'react';
import { Search, RotateCw, Download, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTasks } from '../hooks/useTasks';
import CreateTaskModal from './CreateTaskModal';

interface TaskListProps {
    title: string;
    showCreate?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({ title, showCreate = false }) => {
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { tasks, totalCount, loading, refetch } = useTasks(page);
  
  const totalPages = Math.ceil(totalCount / 15) || 1;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold border border-indigo-100 rounded">SYNCED</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => refetch()}
            className={cn(
              "p-2 text-slate-400 hover:text-slate-600 transition-colors",
              loading && "animate-spin text-indigo-600"
            )}
            title="Refresh"
          >
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
             <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm shadow-indigo-200"
             >
                <Plus className="w-4 h-4" />
                <span>Create Task</span>
             </button>
          )}
        </div>
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <div className="flex-1 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <RotateCw className="w-6 h-6 text-indigo-600 animate-spin" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading Tasks...</span>
            </div>
          </div>
        )}

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
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <input type="checkbox" className="rounded" />
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                    {task.id.slice(0, 6)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">
                    {task.task_name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      task.tags?.color ? `bg-${task.tags.color}-50 text-${task.tags.color}-600` : "bg-slate-100 text-slate-500"
                    )}>
                      {task.tags?.name || 'No Tag'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {task.projects?.name || 'General'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {task.teams?.name || 'Internal'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      task.type === 'WEEKLY' ? "bg-emerald-50 text-emerald-600" : 
                      task.type === 'DAILY' ? "bg-indigo-50 text-indigo-600" : 
                      "bg-amber-50 text-amber-600"
                    )}>
                      {task.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">{task.deadline?.split(' ')[0] || '--:--'}</span>
                      <span className="text-[10px] text-slate-400 font-medium tracking-tight">{task.deadline?.split(' ').slice(1).join(' ') || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-[10px] font-bold">
                      <span className="text-indigo-600">E: {task.estimated_time || '0m'}</span>
                      <span className="text-emerald-500">A: {task.actual_time || '0m'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold border",
                      task.status === 'NEW' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                      task.status === 'DONE' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      "bg-slate-50 text-slate-600 border-slate-100"
                    )}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-colors">Submit</button>
                  </td>
                </tr>
              ))
            ) : !loading && (
              <tr>
                <td colSpan={11} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                      <RotateCw className="w-6 h-6 text-slate-200" />
                    </div>
                    <p className="text-slate-400 text-sm font-medium italic">No tasks found.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between">
         <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Showing <span className="font-bold text-slate-700">{tasks.length > 0 ? (page-1)*15 + 1 : 0}</span> to <span className="font-bold text-slate-700">{Math.min(page*15, totalCount)}</span> of <span className="font-bold text-slate-700">{totalCount}</span> tasks
         </div>
         <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              if (totalPages > 5 && Math.abs(p - page) > 1 && p !== 1 && p !== totalPages) {
                if (p === 2 || p === totalPages - 1) return <span key={p} className="px-1 text-slate-300">...</span>;
                return null;
              }
              return (
                <button 
                  key={p} 
                  onClick={() => setPage(p)}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all shrink-0",
                    p === page ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button 
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
         </div>
      </div>
    </div>
  );
};

export default TaskList;
