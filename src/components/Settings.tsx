import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Loader2, Users, FolderKanban, ShieldCheck, Tag as TagIcon, Settings2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import MasterDataModal from './MasterDataModal';
import UserEditModal from './UserEditModal';
import { cn } from '../lib/utils';
import { logger } from '../lib/logger';
import { useAuthStore } from '../store/authStore';

type TabType = 'USERS' | 'PROJECTS' | 'TEAMS' | 'TAGS';

export default function Settings() {
  const { profile: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('USERS');
  const [loading, setLoading] = useState(true);
  
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: usersData },
        { data: projectsData },
        { data: teamsData },
        { data: tagsData }
      ] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('teams').select('*').order('created_at', { ascending: false }),
        supabase.from('tags').select('*').order('created_at', { ascending: false })
      ]);

      setUsers(usersData || []);
      setProjects(projectsData || []);
      setTeams(teamsData || []);
      setTags(tagsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = () => {
    setEditingItem(null);
    setIsMasterModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'USERS') {
      setIsUserModalOpen(true);
    } else {
      setIsMasterModalOpen(true);
    }
  };

  const handleSaveMasterData = async (name: string) => {
    const tableName = activeTab.toLowerCase();
    const formattedName = name.trim().toUpperCase();
    
    try {
      if (editingItem) {
        await supabase.from(tableName).update({ name: formattedName }).eq('id', editingItem.id);
        await logger.log('UPDATE_MASTER_DATA', `Updated item in ${tableName} to ${formattedName}`, { id: editingItem.id });
      } else {
        await supabase.from(tableName).insert([{ name: formattedName }]);
        await logger.log('CREATE_MASTER_DATA', `Created item in ${tableName} named ${formattedName}`);
      }
      fetchData();
    } catch (error: any) {
      alert(`Error saving ${tableName}: ${error.message}`);
    }
  };

  const handleSaveUser = async (userId: string, data: { role: string; status: string; teams: string[] }) => {
    const userToUpdate = users.find(u => u.id === userId);
    
    // Safety check for Master email
    if (userToUpdate?.email === 'lequangvinh0611@gmail.com' && data.role !== 'MASTER') {
      alert('Cannot downgrade the Master account role.');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: data.role.toUpperCase(),
          status: data.status.toUpperCase(),
          team_ids: data.teams
        })
        .eq('id', userId);

      if (error) throw error;
      await logger.log('UPDATE_USER', `Updated user settings for ${userToUpdate?.email}`, { userId, updates: data });
      await fetchData();
    } catch (err: any) {
      alert(`Error updating user: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, itemEmail?: string) => {
    // Safety checks
    if (activeTab === 'USERS' && itemEmail === 'lequangvinh0611@gmail.com') {
      alert('Master account cannot be deleted.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    const tableName = activeTab.toLowerCase();
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      await logger.log('DELETE_MASTER_DATA', `Deleted item from ${tableName}`, { id });
      fetchData();
    } catch (error: any) {
      alert(`Error deleting: ${error.message}`);
    }
  };

  const tabs = [
    { id: 'USERS', label: 'Users', icon: Users },
    { id: 'PROJECTS', label: 'Projects', icon: FolderKanban },
    { id: 'TEAMS', label: 'Teams', icon: ShieldCheck },
    { id: 'TAGS', label: 'Tags', icon: TagIcon },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-4 flex items-center justify-between bg-white shrink-0 border-b border-slate-100">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Settings</h2>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-1.5 px-6 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider",
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 h-8 focus:outline-none focus:border-indigo-600"
            />
          </div>
          {activeTab === 'USERS' && (
            <select className="px-3 h-8 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 min-w-[120px]">
              <option value="">All Teams</option>
              {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          )}
          <button 
            onClick={handleAdd}
            className="flex items-center gap-1.5 h-8 px-4 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
          >
            <Plus size={14} />
            <span>Add {activeTab !== 'USERS' ? activeTab.slice(0, -1) : 'User'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="px-8 py-2 w-[25%] text-[9px] font-black text-slate-400 uppercase tracking-widest">Name / Email</th>
              {activeTab === 'USERS' ? (
                <>
                  <th className="px-8 py-2 w-[25%] text-[9px] font-black text-slate-400 uppercase tracking-widest">Teams</th>
                  <th className="px-8 py-2 w-[15%] text-[9px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                  <th className="px-8 py-2 w-[15%] text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                </>
              ) : (
                <th className="px-8 py-2 w-[55%] text-[9px] font-black text-slate-400 uppercase tracking-widest">Date Created</th>
              )}
              <th className="px-8 py-2 w-[15%] text-[9px] font-black text-slate-400 uppercase tracking-widest text-right pr-12">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px]">
            {activeTab === 'USERS' ? (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 group transition-all">
                  <td className="px-8 py-3">
                    <div className="flex flex-col truncate">
                      <span className="font-black text-slate-800 uppercase tracking-tight truncate">{user.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 tracking-tighter truncate">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-8 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(user.team_ids || user.teams || []).map((t: string) => (
                        <span key={t} className="px-1.5 py-0.5 bg-white border border-slate-200 text-slate-400 rounded text-[8px] font-bold uppercase">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-3">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      user.role === 'MASTER' ? "bg-rose-50 text-rose-500 border-rose-100" :
                      user.role === 'ADMIN' ? "bg-indigo-50 text-indigo-500 border-indigo-100" : 
                      "bg-amber-50 text-amber-600 border-amber-100"
                    )}>{user.role || 'USER'}</span>
                  </td>
                  <td className="px-8 py-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                      user.status === 'ACTIVE' ? "bg-emerald-50 text-emerald-500 border-emerald-100" : "bg-slate-100 text-slate-400 border-slate-200"
                    )}>{user.status || 'ACTIVE'}</span>
                  </td>
                  <td className="px-8 py-3 text-right pr-12">
                    <button onClick={() => handleEdit(user)} className="text-slate-300 hover:text-indigo-600 transition-all"><Edit2 size={14} /></button>
                  </td>
                </tr>
              ))
            ) : (
                (() => {
                    const list = activeTab === 'PROJECTS' ? projects : activeTab === 'TEAMS' ? teams : tags;
                    return list.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 group transition-all">
                          <td className="px-8 py-3 font-black text-slate-800 uppercase tracking-widest">{item.name}</td>
                          <td className="px-8 py-3 text-slate-400 font-bold uppercase text-[9px]">{new Date(item.created_at).toLocaleDateString()}</td>
                          <td className="px-8 py-3 text-right pr-12 flex items-center justify-end gap-3 h-full">
                            <button onClick={() => handleEdit(item)} className="text-slate-300 hover:text-indigo-600 transition-all"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(item.id)} className="text-slate-200 hover:text-rose-600 transition-all"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                    ));
                })()
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-slate-100 bg-white flex items-center justify-center gap-1.5">
          <button className="px-2 py-1 text-slate-300"><ChevronLeft size={16} /></button>
          {[1, 2, 3, 4, 5].map(p => (
            <button key={p} className={cn(
                "w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all",
                p === 1 ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-400 hover:bg-slate-50"
            )}>{p}</button>
          ))}
          <button className="px-2 py-1 text-slate-300"><ChevronRight size={16} /></button>
      </div>

      <div className="px-4 py-2 border-t border-slate-100 bg-white">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Metadata Registry Module</p>
      </div>

      {/* Modals */}
      <MasterDataModal
        isOpen={isMasterModalOpen}
        onClose={() => setIsMasterModalOpen(false)}
        onSave={handleSaveMasterData}
        initialData={editingItem}
        title={activeTab !== 'USERS' ? activeTab.slice(0, -1) : ''}
      />

      <UserEditModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        user={editingItem}
        availableTeams={teams}
      />
    </div>
  );
}
