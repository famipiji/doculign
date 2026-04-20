import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, FileText, ShieldCheck, Briefcase, FileCode,
  Clock, Download, AlertCircle
} from 'lucide-react';

interface DocumentDetail {
  id: number;
  name: string;
  author: string;
  fileType: string;
  recordType: string;
  fileSizeBytes: number;
  filePath: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  docId: number | null;
  onClose: () => void;
}

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
const PDF_TYPE = 'pdf';

export const DocumentPreviewModal: React.FC<Props> = ({ docId, onClose }) => {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    setDoc(null);

    fetch(`/api/documents/${docId}/content`)
      .then(r => r.json())
      .then(data => setDoc(data.document))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [docId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const fileUrl = docId ? `/api/documents/${docId}/file` : null;
  const ext = doc?.fileType?.toLowerCase() ?? '';
  const hasFile = doc?.filePath && doc.filePath !== '';

  return (
    <AnimatePresence>
      {docId !== null && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-2 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-border w-full max-w-[95vw] h-[95vh] flex flex-col pointer-events-auto overflow-hidden">

              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white border border-border rounded-lg shadow-sm">
                    <TypeIcon type={doc?.recordType ?? ''} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-primary tracking-tight leading-tight">
                      {loading ? 'Loading...' : (doc?.name ?? '—')}
                    </h2>
                    {doc && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest bg-bg border border-border px-2 py-0.5 rounded">
                          .{doc.fileType || 'unknown'}
                        </span>
                        <span className="text-[10px] text-text-muted">·</span>
                        <span className="text-[10px] text-text-muted">{doc.author}</span>
                        <span className="text-[10px] text-text-muted">·</span>
                        <span className="text-[10px] text-text-muted">{formatSize(doc.fileSizeBytes)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasFile && fileUrl && (
                    <a
                      href={fileUrl}
                      download={doc?.name}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-bold text-text-muted hover:bg-bg transition-all"
                    >
                      <Download size={14} /> Download
                    </a>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-bg rounded-lg transition-all text-text-muted hover:text-primary"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* File Preview Area */}
              <div className="flex-1 overflow-hidden bg-gray-100/60 flex items-center justify-center min-h-0">
                {loading ? (
                  <div className="flex flex-col items-center gap-3 text-text-muted">
                    <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest">Loading document...</span>
                  </div>
                ) : !hasFile ? (
                  <div className="flex flex-col items-center gap-3 text-text-muted p-12">
                    <AlertCircle size={40} className="opacity-30" />
                    <p className="text-sm font-bold uppercase tracking-widest">No file attached</p>
                    <p className="text-xs opacity-60">This record was created without an uploaded file.</p>
                  </div>
                ) : ext === PDF_TYPE ? (
                  <iframe
                    src={`${fileUrl}#toolbar=1&navpanes=0`}
                    className="w-full h-full border-0"
                    title={doc?.name}
                  />
                ) : IMAGE_TYPES.includes(ext) ? (
                  <div className="flex items-center justify-center w-full h-full p-6 overflow-auto">
                    <img
                      src={fileUrl!}
                      alt={doc?.name}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                  </div>
                ) : (
                  /* Unsupported preview — show a download prompt */
                  <div className="flex flex-col items-center gap-4 text-text-muted p-12">
                    <div className="p-6 bg-white rounded-2xl border border-border shadow-sm">
                      <FileText size={48} className="text-accent mx-auto" />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest">{doc?.name}</p>
                    <p className="text-xs opacity-60">
                      .{ext.toUpperCase()} files cannot be previewed in the browser.
                    </p>
                    <a
                      href={fileUrl!}
                      download={doc?.name}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-all"
                    >
                      <Download size={16} /> Download to view
                    </a>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const p = { size: 18, className: 'text-accent' };
  if (type === 'Invoice') return <Clock {...p} />;
  if (type === 'Employee') return <Briefcase {...p} />;
  if (type === 'Resume') return <FileCode {...p} />;
  if (type === 'ComplianceAudit') return <ShieldCheck {...p} />;
  return <FileText {...p} />;
};

const formatSize = (bytes: number) => {
  if (!bytes) return '—';
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
};
