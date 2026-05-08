import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import MasterDataModal from './MasterDataModal';
import UserEditModal from './UserEditModal';

type TabType = 'USERS' | 'PROJECTS' | 'TEAMS' | 'TAGS';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('USERS');
  const [loading, setLoading] = useState(true);
  
  // States chứa dữ liệu thật
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  // States cho Modal
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Hàm Fetch toàn bộ dữ liệu từ Supabase
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

  // Mở Modal Thêm mới
  const handleAdd = () => {
    if (activeTab === 'USERS') {
      alert('Để thêm User, người dùng cần tự đăng nhập qua Google Auth.');
      return;
    }
    setEditingItem(null);
    setIsMasterModalOpen(true);
  };

  // Mở Modal Chỉnh sửa
  const handleEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'USERS') {
      setIsUserModalOpen(true);
    } else {
      setIsMasterModalOpen(true);
    }
  };

  // Lưu Master Data (Projects, Teams, Tags)
  const handleSaveMasterData = async (name: string) => {
    const tableName = activeTab.toLowerCase();
    
    if (editingItem) {
      // Cập nhật
      const { error } = await supabase
        .from(tableName)
        .update({ name })
        .eq('id', editingItem.id);
      
      if (error) {
        alert(`Lỗi khi cập nhật: ${error.message}`);
        throw error;
      }
    } else {
      // Thêm mới
      const { error } = await supabase
        .from(tableName)
        .insert([{ name }]);
      
      if (error) {
        alert(`Lỗi khi thêm mới: ${error.message}`);
        throw error;
      }
    }
    
    fetchData();
  };

  // Lưu User Data
  const handleSaveUser = async (userId: string, data: { role: string; status: string; teams: string[] }) => {
    const { error } = await supabase
      .from('users')
      .update({
        role: data.role,
        status: data.status,
        teams: data.teams
      })
      .eq('id', userId);

    if (error) {
      alert(`Lỗi khi cập nhật User: ${error.message}`);
      throw error;
    }

    fetchData();
  };

  // Hàm Xóa (Chỉ áp dụng cho Master Data)
  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mục này?')) return;
    
    const tableName = activeTab.toLowerCase();
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    
    if (error) {
      alert(`Lỗi khi xóa: ${error.message}`);
    } else {
      fetchData();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/50 shrink-0">
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {(['USERS', 'PROJECTS', 'TEAMS', 'TAGS'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 text-xs font-bold rounded-md transition-all ${
                activeTab === tab
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <button 
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add {activeTab !== 'USERS' ? activeTab.slice(0, -1) : 'User'}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p className="text-sm font-medium">Loading Real Data...</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  {activeTab === 'USERS' ? 'Name / Email' : 'Name'}
                </th>
                {activeTab === 'USERS' && (
                  <>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Teams</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Role</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Status</th>
                  </>
                )}
                {activeTab !== 'USERS' && (
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">Created At</th>
                )}
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* RENDER DỮ LIỆU BẢNG USERS */}
              {activeTab === 'USERS' && users.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No users found.</td></tr>
              )}
              {activeTab === 'USERS' && users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 text-sm">{user.name}</div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {user.teams?.length > 0 ? user.teams.map((t: string) => (
                        <span key={t} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{t}</span>
                      )) : <span className="text-slate-400 text-xs italic">No team</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                      user.role === 'MASTER' ? 'bg-rose-50 text-rose-600' :
                      user.role === 'ADMIN' ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {user.role || 'USER'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      user.status === 'INACTIVE' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {user.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleEdit(user)}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-white hover:bg-indigo-50 rounded-lg shadow-sm border border-slate-100"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {/* RENDER DỮ LIỆU CÁC BẢNG MASTER DATA CÒN LẠI */}
              {activeTab !== 'USERS' && (() => {
                const list = activeTab === 'PROJECTS' ? projects : activeTab === 'TEAMS' ? teams : tags;
                if (list.length === 0) return <tr><td colSpan={3} className="p-8 text-center text-slate-500">No data found in {activeTab}. Click "Add {activeTab.slice(0, -1)}" to create one.</td></tr>;
                
                return list.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 group">
                    <td className="px-6 py-4 font-bold text-slate-700 text-sm">{item.name}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-white hover:bg-indigo-50 rounded-lg shadow-sm border border-slate-100"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)} 
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors bg-white hover:bg-rose-50 rounded-lg shadow-sm border border-slate-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        )}
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
