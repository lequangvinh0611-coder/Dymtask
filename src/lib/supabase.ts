/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

let rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
if (rawUrl.endsWith('/rest/v1/')) {
  rawUrl = rawUrl.replace('/rest/v1/', '');
} else if (rawUrl.endsWith('/rest/v1')) {
  rawUrl = rawUrl.replace('/rest/v1', '');
}
const supabaseUrl = rawUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// A check to see if the environment contains a valid Supabase credentials
const isValidSupabaseConfig = 
  supabaseUrl && 
  !supabaseUrl.includes('your-project-id') && 
  supabaseUrl.startsWith('http') && 
  supabaseAnonKey && 
  !supabaseAnonKey.includes('your-anon-key');

// Helper to manage storage keys
const STORAGE_KEYS = {
  tasks: 'dym_tasks',
  users: 'dym_users',
  projects: 'dym_projects',
  teams: 'dym_teams',
  tags: 'dym_tags',
  audit_logs: 'dym_audit_logs',
};

// Initial mock data to seed local storage on first load
const INITIAL_DATA = {
  tasks: [
    {
      id: 'task-1',
      title: 'Thiết kế giao diện High-Density',
      description: 'Cải tiến tables với chiều cao h-9 cố định và hỗ trợ hiển thị 15 dòng.',
      status: 'Đang xử lý',
      priority: 'High',
      project_id: 'proj-1',
      assignee_id: 'mock-user-id',
      team_ids: ['team-1'],
      tag_ids: ['tag-1'],
      est_minutes: 180,
      act_minutes: 60,
      is_active: true,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'task-2',
      title: 'Đồng bộ thanh công cụ inline h-8',
      description: 'Zàn ngang toàn bộ bộ lọc và nút hành động trên cùng 1 hàng ngang.',
      status: 'Mới',
      priority: 'Medium',
      project_id: 'proj-1',
      assignee_id: 'user-2',
      team_ids: ['team-1'],
      tag_ids: ['tag-3'],
      est_minutes: 120,
      act_minutes: 0,
      is_active: true,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'task-3',
      title: 'Kiểm thử responsive mobile',
      description: 'Đảm bảo touch target 44px trên giao diện cảm ứng.',
      status: 'Hoàn thành',
      priority: 'Low',
      project_id: 'proj-2',
      assignee_id: 'user-3',
      team_ids: ['team-2'],
      tag_ids: ['tag-2'],
      est_minutes: 60,
      act_minutes: 60,
      is_active: true,
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    }
  ],
  users: [
    {
      id: 'mock-user-id',
      name: 'Admin Dymtask',
      email: 'admin@dymtask.com',
      role: 'master',
      team_ids: ['team-1'],
      status: 'ACTIVE',
      created_at: '2026-05-21T02:03:03Z',
    },
    {
      id: 'user-2',
      name: 'Nguyễn Văn A',
      email: 'a.nguyen@dymtask.com',
      role: 'admin',
      team_ids: ['team-1'],
      status: 'ACTIVE',
      created_at: '2026-05-21T02:03:03Z',
    },
    {
      id: 'user-3',
      name: 'Trần Thị B',
      email: 'b.tran@dymtask.com',
      role: 'user',
      team_ids: ['team-2'],
      status: 'ACTIVE',
      created_at: '2026-05-21T02:03:03Z',
    }
  ],
  projects: [
    { id: 'proj-1', name: 'Dym Task Tool Upgrade', code: 'DTT', is_active: true, created_at: '2026-05-21T02:03:03Z' },
    { id: 'proj-2', name: 'UI/UX Redesign 2026', code: 'UX26', is_active: true, created_at: '2026-05-21T02:03:03Z' },
    { id: 'proj-3', name: 'Sales Hub', code: 'SH', is_active: true, created_at: '2026-05-21T02:03:03Z' },
  ],
  teams: [
    { id: 'team-1', name: 'Hanoi Tech Team', is_active: true, created_at: '2026-05-21T02:03:03Z' },
    { id: 'team-2', name: 'Saigon Creative Team', is_active: true, created_at: '2026-05-21T02:03:03Z' },
  ],
  tags: [
    { id: 'tag-1', name: 'UI/UX', is_active: true, created_at: '2026-05-21T02:03:03Z' },
    { id: 'tag-2', name: 'Bug', is_active: true, created_at: '2026-05-21T02:03:03Z' },
    { id: 'tag-3', name: 'Feature', is_active: true, created_at: '2026-05-21T02:03:03Z' },
  ],
  audit_logs: [
    {
      id: 'log-1',
      action: 'USER_LOGIN',
      description: 'Admin đăng nhập hệ thống ở chế độ Local Storage MVP',
      user_id: 'mock-user-id',
      user_name: 'Admin Dymtask',
      created_at: '2026-05-21T02:03:03Z',
    }
  ],
};

// Seed storage helper
const getLocalData = (table: keyof typeof STORAGE_KEYS) => {
  const key = STORAGE_KEYS[table];
  let data = localStorage.getItem(key);
  if (!data) {
    const initial = INITIAL_DATA[table];
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_DATA[table];
  }
};

const saveLocalData = (table: keyof typeof STORAGE_KEYS, data: any) => {
  localStorage.setItem(STORAGE_KEYS[table], JSON.stringify(data));
};

// Create the dynamic mock Supabase client
const createMockSupabase = () => {
  console.log('[MockSupabase] Initializing local-storage client mock...');

  return {
    auth: {
      onAuthStateChange: (cb: any) => {
        const storedEmail = localStorage.getItem('dym_mock_session_email');
        setTimeout(() => {
          if (storedEmail) {
            cb('SIGNED_IN', {
              access_token: 'mock-token',
              user: { id: 'mock-user-id', email: storedEmail },
            });
          } else {
            cb('SIGNED_OUT', null);
          }
        }, 50);

        // Keep track of active subscription callbacks so we can trigger them on login/logout
        if (!(window as any)._mock_auth_callbacks) {
          (window as any)._mock_auth_callbacks = [];
        }
        (window as any)._mock_auth_callbacks.push(cb);

        return { data: { subscription: { unsubscribe: () => {
          const callbacks = (window as any)._mock_auth_callbacks || [];
          const idx = callbacks.indexOf(cb);
          if (idx !== -1) callbacks.splice(idx, 1);
        } } } };
      },
      getSession: async () => {
        const storedEmail = localStorage.getItem('dym_mock_session_email');
        if (!storedEmail) {
          return { data: { session: null }, error: null };
        }
        return {
          data: {
            session: {
              access_token: 'mock-token',
              user: { id: 'mock-user-id', email: storedEmail },
            },
          },
          error: null,
        };
      },
      getUser: async () => {
        const storedEmail = localStorage.getItem('dym_mock_session_email');
        if (!storedEmail) {
          return { data: { user: null }, error: null };
        }
        return {
          data: {
            user: { id: 'mock-user-id', email: storedEmail },
          },
          error: null,
        };
      },
      signInWithOtp: async ({ email }: { email: string }) => {
        localStorage.setItem('dym_mock_session_email', email);
        const callbacks = (window as any)._mock_auth_callbacks || [];
        const session = {
          access_token: 'mock-token',
          user: { id: 'mock-user-id', email },
        };
        for (const cb of callbacks) {
          try { cb('SIGNED_IN', session); } catch (e) {}
        }
        return { data: { user: { id: 'mock-user-id', email } }, error: null };
      },
      signOut: async () => {
        localStorage.removeItem('dym_mock_session_email');
        const callbacks = (window as any)._mock_auth_callbacks || [];
        for (const cb of callbacks) {
          try { cb('SIGNED_OUT', null); } catch (e) {}
        }
        return { error: null };
      },
    },

    from: (table: keyof typeof STORAGE_KEYS) => {
      let currentData = [...getLocalData(table)];
      let activeFilters: Array<(item: any) => boolean> = [];
      let sortColumn: string | null = null;
      let sortAscending = false;
      let rangeFrom: number | null = null;
      let rangeTo: number | null = null;

      const chain = {
        select: (columns?: string, options?: { count?: string }) => {
          // select is a no-op filters builder
          return chain;
        },
        eq: (column: string, value: any) => {
          activeFilters.push((item: any) => {
            // handle simple matches
            const val = item[column];
            if (Array.isArray(val)) {
              return val.includes(value);
            }
            return String(val).toUpperCase() === String(value).toUpperCase();
          });
          return chain;
        },
        ilike: (column: string, pattern: string) => {
          const cleanPattern = pattern.replace(/%/g, '').toLowerCase();
          activeFilters.push((item: any) => {
            const val = item[column] ? String(item[column]).toLowerCase() : '';
            return val.includes(cleanPattern);
          });
          return chain;
        },
        order: async (column: string, opts?: { ascending?: boolean }) => {
          sortColumn = column;
          sortAscending = opts?.ascending ?? false;
          return executeQuery();
        },
        range: (fromNum: number, toNum: number) => {
          rangeFrom = fromNum;
          rangeTo = toNum;
          return chain;
        },
        single: async () => {
          const resultList = filterAndSort();
          return { data: resultList[0] || null, error: null };
        },

        // Mutators
        insert: async (input: any) => {
          const rowsToInsert = Array.isArray(input) ? input : [input];
          const freshData = [...getLocalData(table)];
          const newRows = rowsToInsert.map((row) => ({
            id: row.id || `${table}-${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString(),
            ...row,
          }));

          const updated = [...newRows, ...freshData]; // prepend newly inserted elements
          saveLocalData(table, updated);

          // Trigger custom event to mock realtime subscription
          window.dispatchEvent(new CustomEvent('mock_realtime_sync'));

          return { data: newRows, error: null };
        },
        update: (updates: any) => {
          // Needs a following .eq() filter to run
          const updateChain = {
            eq: async (column: string, value: any) => {
              const freshData = [...getLocalData(table)];
              let matchedCount = 0;
              const updated = freshData.map((row) => {
                const itemVal = row[column];
                if (String(itemVal).toUpperCase() === String(value).toUpperCase()) {
                  matchedCount++;
                  return { ...row, ...updates };
                }
                return row;
              });

              if (matchedCount > 0) {
                saveLocalData(table, updated);
                window.dispatchEvent(new CustomEvent('mock_realtime_sync'));
              }
              return { data: null, error: null };
            }
          };
          return updateChain;
        },
        delete: () => {
          const deleteChain = {
            eq: async (column: string, value: any) => {
              const freshData = [...getLocalData(table)];
              const filtered = freshData.filter((row) => {
                const itemVal = row[column];
                return String(itemVal).toUpperCase() !== String(value).toUpperCase();
              });

              saveLocalData(table, filtered);
              window.dispatchEvent(new CustomEvent('mock_realtime_sync'));
              return { data: null, error: null };
            }
          };
          return deleteChain;
        },

        // Fallback standard executor when followed by await/then
        then: (onfulfilled?: (value: any) => any) => {
          return executeQuery().then(onfulfilled);
        },
      };

      const filterAndSort = () => {
        let list = [...currentData];
        for (const filterFn of activeFilters) {
          list = list.filter(filterFn);
        }

        if (sortColumn) {
          list.sort((a: any, b: any) => {
            const valA = a[sortColumn!];
            const valB = b[sortColumn!];
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;
            if (valA < valB) return sortAscending ? -1 : 1;
            if (valA > valB) return sortAscending ? 1 : -1;
            return 0;
          });
        }
        return list;
      };

      const executeQuery = async () => {
        const sortedAndFiltered = filterAndSort();
        const totalCount = sortedAndFiltered.length;

        let sliced = sortedAndFiltered;
        if (rangeFrom !== null && rangeTo !== null) {
          sliced = sortedAndFiltered.slice(rangeFrom, rangeTo + 1);
        }

        return { data: sliced, error: null, count: totalCount };
      };

      return chain;
    },

    channel: (chanName: string) => {
      let listener: () => void;
      return {
        on: (eventStr: string, filterObj: any, callback: () => void) => {
          listener = () => {
            callback();
          };
          window.addEventListener('mock_realtime_sync', listener);
          return {
            subscribe: () => ({})
          };
        },
        // Support custom unsubscribe/clean up if called
        unsubscribe: () => {
          if (listener) {
            window.removeEventListener('mock_realtime_sync', listener);
          }
        }
      };
    },

    removeChannel: (channelObj: any) => {
      if (channelObj && typeof channelObj.unsubscribe === 'function') {
        channelObj.unsubscribe();
      }
    },
  } as any;
};

let supabaseInstance: ReturnType<typeof createClient>;

if (isValidSupabaseConfig) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('[Supabase] Failed to initialize live client, using mock fallback.', err);
    supabaseInstance = createMockSupabase();
  }
} else {
  supabaseInstance = createMockSupabase();
}

export const supabase = supabaseInstance;
export const isMockSupabase = !isValidSupabaseConfig;
