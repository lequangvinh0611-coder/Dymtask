import React, { useState, useEffect } from 'react';
import { X, Loader2, Shield, Users, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, data: { role: string; status: string; teams: string[] }) => Promise<void>;
  user: any;
  availableTeams: any[];
}

export default function UserEditModal({
  isOpen,
  onClose,
  onSave,
  user,
  availableTeams,
}: UserEditModalProps) {
  const [role, setRole] = useState('USER');
  const [status, setStatus] = useState('ACTIVE');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setRole(user.role || 'USER');
      setStatus(user.status || 'ACTIVE');
      setSelectedTeams(user.teams || []);
    }
  }, [user, isOpen]);

  const handleToggleTeam = (teamName: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamName) ? prev.filter((t) => t !== teamName) : [...prev, teamName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setLoading(true);
    try {
      await onSave(user.id, { role, status, teams: selectedTeams });
      onClose();
    } catch (error) {
      console.error('Error in UserEditModal save:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg uppercase leading-none tracking-tight">
                    Edit Permissions
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                    Adjusting access for {user?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Read Only Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    User Name
                  </label>
                  <div className="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg text-sm font-bold border border-slate-200 cursor-not-allowed">
                    {user?.name}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Email Address
                  </label>
                  <div className="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg text-sm font-bold border border-slate-200 cursor-not-allowed overflow-hidden text-ellipsis whitespace-nowrap">
                    {user?.email}
                  </div>
                </div>
              </div>

              {/* Roles & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    System Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="MASTER">MASTER</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Team Assignment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Users size={12} />
                    Assigned Teams
                  </label>
                  <span className="text-[10px] font-black text-indigo-600 uppercase">
                    {selectedTeams.length} Selected
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[100px] flex flex-wrap gap-2">
                  {availableTeams.length > 0 ? (
                    availableTeams.map((team) => {
                      const isSelected = selectedTeams.includes(team.name);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => handleToggleTeam(team.name)}
                          className={`group flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                              : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          {team.name}
                          {isSelected && <Check size={12} className="shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="m-auto text-slate-400 text-[10px] font-bold uppercase italic">
                      No teams available.
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-2 px-4 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px]"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : null}
                  Save User Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
