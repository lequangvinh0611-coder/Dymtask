import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: ('master' | 'admin' | 'user')[];
  fallback?: React.ReactNode;
}

/**
 * Guard Component: ProtectedRoute
 * Protects specific JSX view trees or route configurations, checking that
 * the currently logged-in user profile contains an authorized role.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles, 
  fallback 
}) => {
  const { profile, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-50/20 select-none">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400 font-medium mt-3 font-sans">Checking authorization status...</p>
      </div>
    );
  }

  const userRole = (profile?.role || 'user').toString().toLowerCase().trim() as 'master' | 'admin' | 'user';

  if (!profile || !allowedRoles.includes(userRole)) {
    if (fallback) return <>{fallback}</>;
    
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/50">
        <div className="w-full max-w-sm p-8 bg-white border border-slate-100 rounded-3xl shadow-xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200 select-none">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-5 ring-4 ring-rose-500/10">
            <ShieldAlert size={26} />
          </div>
          <h2 className="text-sm font-bold text-slate-800 mb-1.5 font-sans">Truy cập bị chặn (Access Denied)</h2>
          <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-[270px] mb-6">
            Tài khoản của bạn (<span className="text-slate-600 font-medium">{profile?.email || 'Chưa xác thực'}</span>) với chức vụ <span className="text-rose-500 font-bold uppercase">{userRole}</span> không có quyền truy cập chức năng này.
          </p>
          <button 
            type="button"
            onClick={() => {
              // Redirect back to To-do List tab or Dashboard tab
              const { setActiveTab } = (window as any).useAppStore?.getState() || {};
              if (setActiveTab) {
                setActiveTab('TO-DO LIST');
              } else {
                window.location.reload();
              }
            }}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 px-4 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]"
          >
            Quay lại trang chủ (Go Home)
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Higher-Order Component (HOC): withRoleProtection
 * Wraps individual React Page components to provide clean, declarative
 * RBAC route protection.
 */
export function withRoleProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  allowedRoles: ('master' | 'admin' | 'user')[]
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute allowedRoles={allowedRoles}>
        <WrappedComponent {...props} />
      </ProtectedRoute>
    );
  };
}
