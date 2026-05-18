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
    <div className="flex-1 flex flex-col min-h-0 bg-white shadow-sm overflow-hidden">
      {/* Navigation Bar inside same header area style */}
      <div className="px-4 py-1.5 border-b border-slate-100 flex items-center bg-white shrink-0 justify-between">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1 rounded-lg text-[10px] font-bold uppercase transition-all tracking-wider",
                activeTab === tab.id
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
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
            className="flex items-center gap-1.5 h-7 px-3 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white rounded-lg text-[10px] font-bold uppercase tracking-wider"
          >
            <Plus size={14} />
            <span>Add {activeTab.slice(0, -1)}</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="animate-spin mb-4 text-primary" size={32} />
            <p className="text-[10px] font-bold uppercase tracking-widest italic">Synchronizing Database...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className={cn(
                  "px-6 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest",
                  activeTab === 'USERS' ? "w-[30%]" : "w-[60%]"
                )}>
                  {activeTab === 'USERS' ? 'Identify / Auth' : 'Label'}
                </th>
                {activeTab === 'USERS' ? (
                  <>
                    <th className="px-6 py-2 w-[25%] text-[9px] font-bold text-slate-400 uppercase tracking-widest">Team Membership</th>
                    <th className="px-6 py-2 w-[15%] text-[9px] font-bold text-slate-400 uppercase tracking-widest">Privileges</th>
                    <th className="px-6 py-2 w-[15%] text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  </>
                ) : (
                  <th className="px-6 py-2 w-[25%] text-[9px] font-bold text-slate-400 uppercase tracking-widest">Index At</th>
                )}
                <th className="px-6 py-2 w-[15%] text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right pr-10">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {activeTab === 'USERS' ? (
                users.length === 0 ? (
                  <tr><td colSpan={5} className="py-24 text-center text-slate-400 text-[10px] font-black uppercase italic tracking-widest">No entries</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 group transition-all">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-[9px] uppercase shrink-0">
                            {user.name?.[0] || user.email?.[0]}
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="font-bold text-slate-900 group-hover:text-primary transition-colors truncate">{user.name?.toUpperCase()}</span>
                            <span className="text-[9px] font-bold text-slate-400 truncate">{user.email?.toLowerCase()}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {user.teams?.length > 0 ? (
                            user.teams.map((t: string) => (
                              <span key={t} className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded text-[8px] font-bold uppercase border border-slate-200">
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-300 text-[9px] font-bold uppercase italic tracking-tighter">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border",
                          user.role === 'master' ? "bg-rose-50 text-rose-600 border-rose-100" :
                          user.role === 'admin' ? "bg-indigo-50 text-indigo-600 border-indigo-100" : 
                          "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          {user.role || 'USER'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1.5">
                           <div className={cn("w-1 h-1 rounded-full", user.status === 'INACTIVE' ? "bg-slate-300" : "bg-emerald-500 animate-pulse")} />
                           <span className={cn(
                             "text-[9px] font-black uppercase tracking-widest",
                             user.status === 'INACTIVE' ? "text-slate-400" : "text-emerald-600"
                           )}>
                             {user.status || 'ACTIVE'}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right pr-10">
                        <button 
                          onClick={() => handleEdit(user)}
                          className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (() => {
                const list = activeTab === 'PROJECTS' ? projects : activeTab === 'TEAMS' ? teams : tags;
                if (list.length === 0) return (
                  <tr>
                    <td colSpan={3} className="py-24 text-center text-slate-300">
                      <p className="text-[10px] font-black uppercase tracking-widest italic">Zero entries</p>
                    </td>
                  </tr>
                );
                
                return list.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 group transition-all">
                    <td className="px-6 py-3 truncate">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-indigo-400" />
                        <span className="font-bold text-slate-900 truncate uppercase tracking-widest">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right pr-10">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)} 
                          className="p-1.5 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                        >
                          <Trash2 size={14} />
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
