import React, { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useAuthStore } from '../store/authStore';
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Download, 
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';

import CreateTaskModal from '../components/CreateTaskModal';

const TaskManager = () => {
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { tasks, totalCount, loading, refetch } = useTasks(page);
  const { profile } = useAuthStore();
  const currentRole = profile?.role || 'user';
  const isUser = currentRole === 'user';
  
  const totalPages = Math.ceil(totalCount / 15) || 1;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Header / Toolbar */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800">Task Manager</h2>
          <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded-lg">
             <span className="text-[10px] font-bold text-slate-400 uppercase">Total:</span>
             <span className="text-[10px] font-bold text-indigo-600">{totalCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
          <button className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
            <RotateCw className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        )}

        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16 text-center">ID</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Task Name</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tag</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Deadline</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-center font-mono text-[10px] text-slate-400">
                    {task.id.slice(0, 6)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">{task.task_name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {task.type && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded uppercase tracking-tighter">
                            {task.type}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      task.tags?.color ? `bg-${task.tags.color}-50 text-${task.tags.color}-600` : "bg-slate-100 text-slate-500"
                    )}>
                      {task.tags?.name || 'No Tag'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-500 leading-tight block max-w-[150px] truncate">
                      {task.projects?.name || 'General'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <span className="text-xs font-medium text-slate-400">
                      {task.teams?.name || 'Internal'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-slate-700">{task.deadline?.split(' ')[0] || '--:--'}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{task.deadline?.split(' ').slice(1).join(' ') || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-black border",
                      task.status === 'NEW' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                      task.status === 'DONE' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      "bg-slate-50 text-slate-600 border-slate-100"
                    )}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {!isUser ? (
                        <button className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="p-2 text-slate-100 cursor-not-allowed opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : !loading && (
              <tr>
                <td colSpan={8} className="px-6 py-20 text-center text-slate-400 text-sm italic">
                  No tasks found. Create your first task to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between">
         <p className="text-xs text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-700">{tasks.length > 0 ? (page-1)*15 + 1 : 0}</span> to <span className="font-bold text-slate-700">{Math.min(page*15, totalCount)}</span> of <span className="font-bold text-slate-700">{totalCount}</span> tasks
         </p>
         <div className="flex items-center gap-1">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              if (totalPages > 5 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) {
                if (p === 2 || p === totalPages - 1) return <span key={p} className="px-2 text-slate-300">...</span>;
                return null;
              }
              return (
                <button 
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    page === p ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "text-slate-500 hover:bg-slate-100"
                  )}
                >
                  {p}
                </button>
              )
            })}
            <button 
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
         </div>
      </div>
    </div>
  );
};

export default TaskManager;
