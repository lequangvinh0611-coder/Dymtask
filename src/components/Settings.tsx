import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Loader2, Users, FolderKanban, ShieldCheck, Tag as TagIcon, Settings2 } from 'lucide-react';
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
    if (userToUpdate?.email === 'lequangvinh0611@gmail.com' && data.role !== 'master') {
      alert('Cannot downgrade the Master account role.');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: data.role.toLowerCase(),
          status: data.status,
          teams: data.teams
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
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden m-6">
      {/* Header & Tabs */}
      <div className="p-6 border-b border-slate-100 bg-white shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Settings2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Settings</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configuration & Access Control</p>
            </div>
          </div>

          <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all tracking-wider",
                  activeTab === tab.id
                    ? "bg-white text-primary shadow-lg shadow-primary/5"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {activeTab !== 'USERS' && (
            <button 
              onClick={handleAdd}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-lg shadow-black/10 uppercase tracking-widest"
            >
              <Plus size={16} />
              <span>Add {activeTab.slice(0, -1)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 animate-pulse">
            <Loader2 className="animate-spin mb-4 text-primary" size={32} />
            <p className="text-[10px] font-bold uppercase tracking-widest">Synchronizing Database...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {activeTab === 'USERS' ? 'Identify / Auth' : 'Label'}
                </th>
                {activeTab === 'USERS' ? (
                  <>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team Membership</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Privileges</th>
                    <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  </>
                ) : (
                  <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Index At</th>
                )}
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTab === 'USERS' ? (
                users.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-400 text-xs italic">No user entities found in database.</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 group transition-all">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-[10px] uppercase">
                            {user.name?.[0] || user.email?.[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{user.name?.toUpperCase()}</span>
                            <span className="text-[10px] font-bold text-slate-400 tracking-tighter">{user.email?.toLowerCase()}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex gap-1.5 flex-wrap">
                          {user.teams?.length > 0 ? (
                            user.teams.map((t: string) => (
                              <span key={t} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase border border-slate-200">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-300 text-[10px] font-bold uppercase italic tracking-tighter">Freelance</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                          user.role === 'master' ? "bg-rose-50 text-rose-600 border-rose-100" :
                          user.role === 'admin' ? "bg-primary-light text-primary border-primary/20" : 
                          "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          {user.role || 'USER'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <div className={cn("w-1.5 h-1.5 rounded-full", user.status === 'INACTIVE' ? "bg-slate-300" : "bg-emerald-500 animate-pulse")} />
                           <span className={cn(
                             "text-[10px] font-black uppercase tracking-widest",
                             user.status === 'INACTIVE' ? "text-slate-400" : "text-emerald-600"
                           )}>
                             {user.status || 'ACTIVE'}
                           </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => handleEdit(user)}
                          className="p-2.5 text-slate-400 hover:text-primary transition-all bg-white hover:bg-primary-light rounded-xl shadow-sm border border-slate-100"
                        >
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (() => {
                const list = activeTab === 'PROJECTS' ? projects : activeTab === 'TEAMS' ? teams : tags;
                if (list.length === 0) return (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-slate-400 text-xs italic uppercase tracking-widest">
                      Zero entries for {activeTab}. Please add to start tracking.
                    </td>
                  </tr>
                );
                
                return list.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 group transition-all">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="font-bold text-slate-900 group-hover:text-primary transition-colors uppercase tracking-widest">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <button 
                          onClick={() => handleEdit(item)}
                          className="p-2.5 text-slate-400 hover:text-primary transition-all bg-white hover:bg-primary-light rounded-xl shadow-sm border border-slate-100"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          className="p-2.5 text-slate-300 hover:text-rose-600 transition-all bg-white hover:bg-rose-50 rounded-xl shadow-sm border border-slate-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Module: System Metadata Registry</p>
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
