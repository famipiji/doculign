import React from 'react';
import { 
  LayoutDashboard, 
  Files, 
  Clock, 
  Share2, 
  Trash2, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

interface MainLayoutProps {
  user: { username: string; email: string };
  onLogout: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-bg font-inter overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-white flex flex-col hidden md:flex shrink-0">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-white rounded-sm" />
          </div>
          <span className="text-xl font-bold tracking-tight uppercase">DOCULIGN</span>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <SidebarLink 
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard" 
            active={location.pathname === '/'} 
            onClick={() => navigate('/')}
          />
          <SidebarLink 
            icon={<Files size={18} />} 
            label="All Documents" 
            active={location.pathname === '/documents'} 
            onClick={() => navigate('/documents')}
          />
          <SidebarLink icon={<Clock size={18} />} label="Recent" />
          <SidebarLink icon={<Share2 size={18} />} label="Shared with me" />
          <SidebarLink icon={<Trash2 size={18} />} label="Trash" />
          <div className="pt-4 mt-4 border-t border-white/10">
            <SidebarLink icon={<Settings size={18} />} label="Settings" />
            <button 
              onClick={onLogout}
              className="flex items-center gap-3 w-full p-2.5 rounded-md text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all mt-1"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </nav>

        <div className="p-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold">
              {user.username.substring(0, 1).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user.username}</p>
              <p className="text-[10px] text-white/50 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
};

const SidebarLink: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 w-full p-2.5 rounded-md text-sm transition-all ${active ? 'bg-accent text-white font-bold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
  >
    {icon}
    <span>{label}</span>
  </button>
);
