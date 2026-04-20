import React, { useState, useEffect, useCallback } from 'react';
import { CreateRecordForm } from './CreateRecordForm';
import {
  FileText,
  Search,
  Bell,
  Clock,
  Share2,
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
  const [showCreateForm, setShowCreateForm] = useState(false);

  const mockDocuments: Document[] = [
    { id: 1, name: 'Contract_2024_Q3_FINAL.pdf', author: 'James Chen', fileSizeBytes: 2048000, fileType: 'PDF', updatedAt: new Date(Date.now() - 2 * 3600000).toISOString() },
    { id: 2, name: 'Financial_Q3_Audit.vlt', author: 'Alex Mercer', fileSizeBytes: 512000, fileType: 'VLT', updatedAt: new Date(Date.now() - 5 * 3600000).toISOString() },
    { id: 3, name: 'Employee_Record_Batch_07.xlsx', author: 'Sarah Miller', fileSizeBytes: 1048576, fileType: 'XLSX', updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 4, name: 'Compliance_Report_2023.docx', author: 'Maria K.', fileSizeBytes: 307200, fileType: 'DOCX', updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docsRes, statsRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/documents/stats'),
      ]);

      if (!docsRes.ok || !statsRes.ok) throw new Error('API error');

      const [docs, statsData] = await Promise.all([docsRes.json(), statsRes.json()]);

      setDocuments(Array.isArray(docs) && docs.length > 0 ? docs : mockDocuments);
      setStats(statsData);
    } catch {
      setDocuments(mockDocuments);
      setStats({ totalDocuments: mockDocuments.length, totalSizeBytes: mockDocuments.reduce((s, d) => s + d.fileSizeBytes, 0), storageLimitBytes: 10737418240 });
      setError('API unavailable — showing sample data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const storagePercent = Math.round((stats.totalSizeBytes / stats.storageLimitBytes) * 100);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            
          </div>

          <div className="flex items-center gap-4 ml-4">
            
            <div className="h-8 w-px bg-border mx-2" />
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-all">
              <Plus size={16} />
              <span>New Document</span>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {showCreateForm && (
            <CreateRecordForm
              onClose={() => setShowCreateForm(false)}
              onSuccess={() => { setShowCreateForm(false); fetchData(); }}
            />
          )}

          {error && (
            <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider">⚠ {error}</span>
            </div>
          )}

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
    </div>
  );
};


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
