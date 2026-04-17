import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Bell,
  LayoutDashboard,
  Files,
  Clock,
  Share2,
  Trash2,
  Settings,
  LogOut,
  MoreVertical,
  Download,
  Eye,
  Plus,
  Database,
  Loader2
} from 'lucide-react';

interface DashboardProps {
  user: { username: string; email: string };
  onLogout: () => void;
}

interface Document {
  id: number;
  name: string;
  author: string;
  fileSizeBytes: number;
  fileType: string;
  updatedAt: string;
}

interface Stats {
  totalDocuments: number;
  totalSizeBytes: number;
  storageLimitBytes: number;
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats>({ totalDocuments: 0, totalSizeBytes: 0, storageLimitBytes: 10737418240 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/documents').then(r => r.json()),
      fetch('/api/documents/stats').then(r => r.json()),
    ])
      .then(([docs, statsData]) => {
        setDocuments(docs);
        setStats(statsData);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load data from server.');
        setLoading(false);
      });
  }, []);

  const storagePercent = Math.round((stats.totalSizeBytes / stats.storageLimitBytes) * 100);

  return (
    <div className="flex h-screen bg-bg font-inter overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-primary text-white flex-col hidden md:flex">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-white rounded-sm" />
          </div>
          <span className="text-xl font-bold tracking-tight uppercase">DOCULIGN</span>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <SidebarLink icon={<LayoutDashboard size={18} />} label="Dashboard" active />
          <SidebarLink icon={<Files size={18} />} label="All Documents" />
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input
                type="text"
                placeholder="Search documents, folders, tags..."
                className="w-full bg-bg border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 ml-4">
            <button className="p-2 rounded-full hover:bg-bg text-text-muted transition-all relative">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-px bg-border mx-2" />
            <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-all">
              <Plus size={16} />
              <span>New Document</span>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mb-8 flex justify-between items-end">
            <div>
              <h2 className="text-2xl font-bold text-primary">Overview</h2>
              <p className="text-sm text-text-muted mt-1">Manage your document repository from here.</p>
            </div>
            <div className="text-sm font-medium text-text-muted">
              Last Synced: <span className="text-text-main">{loading ? '...' : 'Just now'}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            <StatCard
              label="Total Documents"
              value={loading ? '—' : stats.totalDocuments.toLocaleString()}
              icon={<FileText className="text-accent" />}
            />
            <StatCard
              label="Storage Used"
              value={loading ? '—' : `${formatSize(stats.totalSizeBytes)} / ${formatSize(stats.storageLimitBytes)}`}
              icon={<Database className="text-orange-500" />}
              progress={loading ? 0 : storagePercent}
            />
            <StatCard
              label="Total Size"
              value={loading ? '—' : formatSize(stats.totalSizeBytes)}
              icon={<Share2 className="text-green-500" />}
            />
          </div>

          {/* Recent Documents Table */}
          <section className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <Clock size={18} className="text-text-muted" />
                Recent Records
              </h3>
              <button className="text-xs font-semibold text-accent hover:underline">View All Files</button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-text-muted gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading documents...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
            ) : documents.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-text-muted text-sm">No documents found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-text-muted border-b border-border">
                      <th className="px-6 py-4 font-bold">Document Name</th>
                      <th className="px-6 py-4 font-bold">Owner</th>
                      <th className="px-6 py-4 font-bold">Modified</th>
                      <th className="px-6 py-4 font-bold">Size</th>
                      <th className="px-6 py-4 font-bold text-right text-transparent">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-bg/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/10 rounded text-accent">
                              <FileText size={16} />
                            </div>
                            <span className="text-sm font-semibold text-primary truncate max-w-[200px]">{doc.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-text-main flex items-center gap-1.5 uppercase font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-border" />
                            {doc.author}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-text-muted">{formatRelativeTime(doc.updatedAt)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-text-muted">{formatSize(doc.fileSizeBytes)}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-all">
                              <Eye size={16} />
                            </button>
                            <button className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-all">
                              <Download size={16} />
                            </button>
                            <button className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition-all">
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

const SidebarLink: React.FC<{ icon: React.ReactNode; label: string; active?: boolean }> = ({ icon, label, active }) => (
  <button className={`flex items-center gap-3 w-full p-2.5 rounded-md text-sm transition-all ${active ? 'bg-accent text-white font-bold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
    {icon}
    <span>{label}</span>
  </button>
);

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; change?: string; progress?: number }> = ({ label, value, icon, change, progress }) => (
  <div className="bg-white p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-bg rounded-lg">
        {icon}
      </div>
      {change && (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${change.startsWith('+') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {change}
        </span>
      )}
    </div>
    <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">{label}</p>
    <p className="text-2xl font-bold text-primary">{value}</p>
    {progress !== undefined && (
      <div className="mt-4">
        <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
        </div>
      </div>
    )}
  </div>
);
