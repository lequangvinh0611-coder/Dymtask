import React, { useState, useEffect } from 'react';
import { X, Loader2, Shield, Users, Mail, User } from 'lucide-react';
import { cn } from '../lib/utils';

interface UserCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; email: string; role: string; teams: string[] }) => Promise<void>;
  availableTeams: any[];
}

export default function UserCreateModal({ isOpen, onClose, onSave, availableTeams }: UserCreateModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user'); // Default to 'user'
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Validation / Touched states for visual errors
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [isTouched, setIsTouched] = useState({ name: false, email: false });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setRole('user');
      setSelectedTeams([]);
      setIsSubmitting(false);
      setNameError(false);
      setEmailError(false);
      setIsTouched({ name: false, email: false });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Validation helper
  const validateEmail = (emailStr: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(emailStr);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (isTouched.name) {
      setNameError(!val.trim());
    }
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (isTouched.email) {
      setEmailError(!validateEmail(val));
    }
  };

  const toggleTeam = (teamName: string) => {
    const normalized = teamName.toString().toUpperCase().trim();
    setSelectedTeams(prev => 
      prev.includes(normalized) 
        ? prev.filter(t => t !== normalized) 
        : [...prev, normalized]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Trigger validation
    const isNameInvalid = !name.trim();
    const isEmailInvalid = !validateEmail(email);
    
    setNameError(isNameInvalid);
    setEmailError(isEmailInvalid);
    setIsTouched({ name: true, email: true });

    if (isNameInvalid || isEmailInvalid) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role.toLowerCase(),
        teams: selectedTeams
      });
    } catch (error) {
      console.error('[UserCreateModal] Error during submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div 
        id="user-create-modal"
        className="bg-white rounded-xl shadow-2xl border border-slate-150 w-full max-w-lg overflow-hidden transform animate-in zoom-in-95 duration-200 flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              Thêm mới nhân sự
            </h3>
            <p className="text-xs text-slate-400 font-normal mt-0.5">Nhập đầy đủ thông tin để cấp quyền và gán phòng ban cho nhân sự mới.</p>
          </div>
          <button 
            id="close-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 rounded-lg transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Input fields form */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 space-y-4">
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <User size={13} className="text-slate-400" />
              <span>Họ và tên nhân sự <span className="text-rose-500">*</span></span>
            </label>
            <input
              id="user-name-input"
              type="text"
              placeholder="Nhập họ và tên nhân sự..."
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => {
                setIsTouched(prev => ({ ...prev, name: true }));
                setNameError(!name.trim());
              }}
              className={cn(
                "w-full h-9 px-3 bg-white border rounded-lg text-sm text-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans",
                nameError ? "border-rose-500 bg-rose-50/10" : "border-slate-200"
              )}
            />
            {nameError && (
              <p className="text-[11px] font-medium text-rose-500 transition-all font-sans">
                Họ và tên nhân sự là bắt buộc.
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <Mail size={13} className="text-slate-400" />
              <span>Email làm việc <span className="text-rose-500">*</span></span>
            </label>
            <input
              id="user-email-input"
              type="text"
              placeholder="username@company.com..."
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => {
                setIsTouched(prev => ({ ...prev, email: true }));
                setEmailError(!validateEmail(email));
              }}
              className={cn(
                "w-full h-9 px-3 bg-white border rounded-lg text-sm text-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-sans",
                emailError ? "border-rose-500 bg-rose-50/10" : "border-slate-200"
              )}
            />
            {emailError && (
              <p className="text-[11px] font-medium text-rose-500 transition-all font-sans">
                Vui lòng nhập đúng định dạng email (như username@company.com).
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            {/* Role Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Shield size={13} className="text-slate-400" />
                <span>Phân quyền hệ thống <span className="text-rose-500">*</span></span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'user', label: 'User', desc: 'Thành viên thường, quản lý task được giao' },
                  { value: 'admin', label: 'Admin', desc: 'Quản trị viên, cấu hình dự án, xem báo cáo' }
                ].map((r) => (
                  <button
                    key={r.value}
                    id={`role-${r.value}-btn`}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-lg border text-left transition-all h-auto",
                      role === r.value 
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-900 shadow-sm' 
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold font-sans">{r.label}</span>
                      {role === r.value && (
                        <div className="w-2 h-2 rounded-full bg-indigo-600 animate-in zoom-in" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal mt-1 leading-normal font-sans">
                      {r.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Team/Phòng ban selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Users size={13} className="text-slate-400" />
                <span>Phòng ban phụ trách</span>
              </label>
              <div className="flex gap-2 flex-wrap max-h-[140px] overflow-y-auto p-3 bg-slate-50 border border-slate-150 rounded-lg min-h-[50px] content-start">
                {availableTeams && availableTeams.length > 0 ? (
                  availableTeams.map((team) => {
                    const normalized = team.name?.toString().toUpperCase().trim();
                    const isSelected = selectedTeams.includes(normalized);
                    return (
                      <button
                        key={team.id}
                        id={`team-select-${team.id}`}
                        type="button"
                        onClick={() => toggleTeam(normalized)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-semibold transition-all border shrink-0 cursor-pointer",
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
                        )}
                      >
                        {normalized}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 italic font-medium w-full text-center py-2 font-sans">
                    Chưa có phòng ban nào trong hệ thống. Hãy tạo dữ liệu tại tab TEAMS trước.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex gap-3">
            <button
              id="cancel-create-btn"
              type="button"
              onClick={onClose}
              className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
            >
              Hủy bỏ
            </button>
            <button
              id="submit-create-btn"
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>Lưu hệ thống</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
