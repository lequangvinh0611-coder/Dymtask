import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Users, Power } from 'lucide-react';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, data: { role: string; status: string; teams: string[] }) => Promise<void>;
  user: any;
  availableTeams: any[];
}

export default function UserEditModal({ isOpen, onClose, onSave, user, availableTeams }: UserEditModalProps) {
  const [role, setRole] = useState('USER');
  const [status, setStatus] = useState('ACTIVE');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setRole(user.role?.toString().toUpperCase().trim() || 'USER');
      setStatus(user.status?.toString().toUpperCase().trim() || 'ACTIVE');
      const teams = user.team_ids || user.teams;
      setSelectedTeams(Array.isArray(teams) ? teams.map((t: any) => t.toString().toUpperCase().trim()) : []);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

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
    setSaving(true);
    try {
      const payload = {
        role: role.toString().toLowerCase().trim(),
        status: status.toString().toLowerCase().trim(),
        teams: selectedTeams.map(t => t.toString().toUpperCase().trim())
      };
      await onSave(user.id, payload);
      onClose();
    } catch (error) {
      console.error('[UserEditModal] Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden transform animate-in slide-in-from-bottom-8 duration-300">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Edit Permissions</h3>
            <p className="text-xs text-slate-500 font-bold mt-1">{user.email?.toString().toUpperCase().trim()}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Role selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                <Shield size={14} />
                System Role
              </div>
              <div className="grid grid-cols-1 gap-2">
                {['MASTER', 'ADMIN', 'USER'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all font-bold text-sm ${
                      role === r 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    <span>{r}</span>
                    {role === r && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Status selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                <Power size={14} />
                Account Status
              </div>
              <div className="grid grid-cols-1 gap-2">
                {['ACTIVE', 'INACTIVE'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all font-bold text-sm ${
                      status === s 
                        ? (s === 'ACTIVE' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-600 bg-slate-50 text-slate-700')
                        : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    <span>{s}</span>
                    {status === s && <div className={`w-2 h-2 rounded-full ${s === 'ACTIVE' ? 'bg-emerald-600' : 'bg-slate-600'}`} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Team selection (Full width) */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                <Users size={14} />
                Team Assignments
              </div>
              <div className="flex gap-2 flex-wrap min-h-[60px] p-4 bg-slate-50 border border-slate-100 rounded-xl">
                {availableTeams.length > 0 ? (
                  availableTeams.map((team) => {
                    const normalized = team.name?.toString().toUpperCase().trim();
                    const isSelected = selectedTeams.includes(normalized);
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => toggleTeam(normalized)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          isSelected 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {normalized}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 italic font-medium w-full text-center py-2">No teams created in Master Data yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl text-sm font-black hover:bg-slate-200 transition-all uppercase tracking-wider grow"
            >
              Cancel Changes
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-slate-900 text-white rounded-xl text-sm font-black hover:bg-black disabled:opacity-50 transition-all flex items-center justify-center gap-2 uppercase tracking-wider grow shadow-xl shadow-slate-200"
            >
              <Save size={18} />
              {saving ? 'Updating...' : 'Commit Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
