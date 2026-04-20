import React, { useEffect, useState } from 'react';
import { FileText, ShieldCheck, Briefcase, FileCode, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { SearchBehaviorService } from '../services/SearchBehaviorService';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import type { SearchResultDoc } from '../models/Search';

export const ResultTable: React.FC = () => {
  const [docs, setDocs] = useState<SearchResultDoc[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [previewId, setPreviewId] = useState<number | null>(null);

  useEffect(() => {
    const unsub = SearchBehaviorService.subscribe((slice, currentPage, total) => {
      setDocs(slice);
      setPage(currentPage);
      setTotalPages(total);
    });
    return unsub;
  }, []);

  if (docs.length === 0 && totalPages === 0) return null;

  return (
    <div className="flex flex-col">
      <DocumentPreviewModal docId={previewId} onClose={() => setPreviewId(null)} />
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white border-b border-border text-[11px] uppercase tracking-wider text-text-muted font-bold sticky top-0 z-10">
            <th className="px-8 py-4 w-12 border-r border-border/50">
              <input type="checkbox" className="rounded border-border" />
            </th>
            <th className="px-6 py-4 border-r border-border/50">Title</th>
            <th className="px-6 py-4 border-r border-border/50">Snippet</th>
            <th className="px-6 py-4 border-r border-border/50">Type</th>
            <th className="px-6 py-4 border-r border-border/50">Created By</th>
            <th className="px-6 py-4 text-right">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {docs.map(doc => (
            <tr
              key={doc.id}
              onClick={() => setPreviewId(doc.id)}
              className="hover:bg-accent/5 transition-colors group cursor-pointer"
            >
              <td className="px-8 py-4 border-r border-border/50" onClick={e => e.stopPropagation()}>
                <input type="checkbox" className="rounded border-border" />
              </td>

              {/* Title + match count badge */}
              <td className="px-6 py-4 border-r border-border/50">
                <div className="flex items-center gap-3">
                  <TypeIcon type={doc.recordType} />
                  <div>
                    <p className="text-sm font-bold text-primary group-hover:text-accent transition-colors">
                      {doc.name}
                    </p>
                    <p className="text-[10px] text-text-muted font-mono uppercase">.{doc.fileType || '—'}</p>
                  </div>
                </div>
                {(doc.matchCount ?? 0) > 0 && (
                  <span className="mt-1 inline-block px-2 py-0.5 bg-accent/10 text-accent text-[9px] font-black rounded-full uppercase tracking-widest">
                    {doc.matchCount} match{doc.matchCount !== 1 ? 'es' : ''} in content
                  </span>
                )}
              </td>

              {/* Snippet with <em> highlights */}
              <td className="px-6 py-4 border-r border-border/50 max-w-[320px]">
                {doc.snippet ? (
                  <p
                    className="text-xs text-text-muted leading-relaxed line-clamp-2 [&_em]:bg-yellow-100 [&_em]:text-yellow-800 [&_em]:not-italic [&_em]:font-bold [&_em]:px-0.5 [&_em]:rounded"
                    dangerouslySetInnerHTML={{ __html: doc.snippet }}
                  />
                ) : (
                  <span className="text-[10px] text-text-muted italic">No content preview</span>
                )}
              </td>

              <td className="px-6 py-4 border-r border-border/50">
                <span className="text-xs text-text-muted font-medium">{doc.recordType || '—'}</span>
              </td>

              <td className="px-6 py-4 border-r border-border/50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-bg border border-border flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                    {doc.author?.charAt(0).toUpperCase() || 'S'}
                  </div>
                  <span className="text-xs text-text-main font-semibold truncate max-w-[100px]">{doc.author || 'System'}</span>
                </div>
              </td>

              <td className="px-6 py-4 text-right">
                <span className="text-xs text-text-muted">{formatDate(doc.createdAt)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-white shrink-0">
          <span className="text-xs text-text-muted font-bold uppercase tracking-widest">
            Page {page + 1} of {totalPages} &bull; {SearchBehaviorService.totalDocs} results
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => SearchBehaviorService.goToPage(page - 1)}
              disabled={page === 0}
              className="p-1.5 border border-border rounded-lg text-text-muted hover:bg-bg disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => SearchBehaviorService.goToPage(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${i === page ? 'bg-primary text-white' : 'border border-border text-text-muted hover:bg-bg'}`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => SearchBehaviorService.goToPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 border border-border rounded-lg text-text-muted hover:bg-bg disabled:opacity-30 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const TypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const p = { size: 16, className: 'text-accent' };
  if (type === 'Invoice') return <Clock {...p} />;
  if (type === 'Employee') return <Briefcase {...p} />;
  if (type === 'Resume') return <FileCode {...p} />;
  if (type === 'ComplianceAudit') return <ShieldCheck {...p} />;
  return <FileText {...p} />;
};

const formatDate = (d: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
