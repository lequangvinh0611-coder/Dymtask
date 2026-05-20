import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Task } from '../types/database.types';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskToEdit?: Task | null;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSuccess, taskToEdit }) => {
  const [loading, setLoading] = useState(false);
  const isEditMode = !!taskToEdit;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'ONETIME',
    est_time: 30,
    status: 'NEW',
    is_active: true
  });

  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setFormData({
          title: taskToEdit.title || '',
          description: taskToEdit.description || '',
          task_type: taskToEdit.task_type || 'ONETIME',
          est_time: taskToEdit.est_time || 0,
          status: taskToEdit.status || 'NEW',
          is_active: taskToEdit.is_active !== undefined ? taskToEdit.is_active : true
        });
      } else {
        setFormData({
          title: '',
          description: '',
          task_type: 'ONETIME',
          est_time: 30,
          status: 'NEW',
          is_active: true
        });
      }
    }
  }, [isOpen, taskToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Vui lòng nhập tiêu đề nhiệm vụ.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        task_type: formData.task_type,
        est_time: Number(formData.est_time) || 0,
        status: formData.status,
        is_active: formData.is_active,
        actual_time: isEditMode && taskToEdit ? taskToEdit.actual_time : 0
      };

      if (isEditMode && taskToEdit) {
        const { error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', taskToEdit.id);
          
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert([payload]);
        
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving task:', error);
      alert(`Không thể lưu nhiệm vụ: ${error.message || 'Lỗi kết nối database'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
            {isEditMode ? 'Cập nhật nhiệm vụ' : 'Tạo nhiệm vụ mới'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tiêu đề (Title) *</label>
            <input 
              required 
              type="text"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium text-slate-700"
              placeholder="Nhập những gì cần hoàn thành..." 
              value={formData.title} 
              onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mô tả (Description)</label>
            <textarea 
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium text-slate-700 resize-none"
              placeholder="Mô tả chi tiết nhiệm vụ..." 
              value={formData.description} 
              onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loại (Task Type)</label>
              <select 
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer text-slate-700"
                value={formData.task_type} 
                onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
              >
                <option value="ONETIME">ONETIME</option>
                <option value="DAILY">DAILY</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ước tính thời gian (Phút)</label>
              <input 
                type="number" 
                min={0}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-700"
                value={formData.est_time} 
                onChange={(e) => setFormData({ ...formData, est_time: parseInt(e.target.value) || 0 })} 
              />
            </div>
          </div>

          {isEditMode && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Trạng thái (Status)</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer text-slate-700"
                  value={formData.status} 
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="NEW">MỚI</option>
                  <option value="IN_PROGRESS">ĐANG LÀM</option>
                  <option value="DONE">HOÀN THÀNH</option>
                  <option value="SKIPPED">BỎ QUA</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hoạt động (Active)</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer text-slate-700"
                  value={formData.is_active ? "true" : "false"} 
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "true" })}
                >
                  <option value="true">BẬT (ON)</option>
                  <option value="false">TẮT (OFF)</option>
                </select>
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-3 text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all uppercase tracking-widest"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-[2] py-3 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isEditMode ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;
