import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  FilePlus,
  ChevronDown,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Briefcase,
  FileCode,
  File as FileIcon,
  Loader2
} from 'lucide-react';

interface CreateRecordFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

type RecordType = 'Invoice' | 'Employee' | 'Resume';
type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

interface FileEntry {
  file: File;
  status: FileStatus;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CreateRecordForm: React.FC<CreateRecordFormProps> = ({ onClose, onSuccess }) => {
  const [recordType, setRecordType] = useState<RecordType>('Invoice');
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounterRef = useRef(0);

  const [dynamicFields, setDynamicFields] = useState<any>({
    invoiceNumber: '',
    date: '',
    amount: '',
    fullName: '',
    department: '',
    hireDate: '',
    candidateName: '',
    position: ''
  });

  const handleFieldChange = (key: string, value: string) => {
    setDynamicFields((prev: any) => ({ ...prev, [key]: value }));
  };

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles(prev => {
      const existing = new Set(prev.map(e => e.file.name + e.file.size));
      const newEntries: FileEntry[] = arr
        .filter(f => !existing.has(f.name + f.size))
        .map(f => ({ file: f, status: 'pending' }));
      return [...prev, ...newEntries];
    });
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.items?.length) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const buildMetadata = () => {
    const metadata: any = {};
    if (recordType === 'Invoice') {
      metadata.invoiceNumber = dynamicFields.invoiceNumber;
      metadata.date = dynamicFields.date;
      metadata.amount = dynamicFields.amount;
    } else if (recordType === 'Employee') {
      metadata.fullName = dynamicFields.fullName;
      metadata.department = dynamicFields.department;
      metadata.hireDate = dynamicFields.hireDate;
    } else if (recordType === 'Resume') {
      metadata.candidateName = dynamicFields.candidateName;
      metadata.position = dynamicFields.position;
    }
    return metadata;
  };

  const uploadFile = async (entry: FileEntry, docTitle: string): Promise<{ ok: boolean; error?: string }> => {
    const metadata = buildMetadata();
    const formData = new FormData();
    formData.append('Title', docTitle);
    formData.append('RecordType', recordType);
    formData.append('Metadata', JSON.stringify(metadata));
    formData.append('Attachment', entry.file);

    try {
      const response = await fetch('/api/documents', { method: 'POST', body: formData });
      if (response.ok) return { ok: true };
      const data = await response.json().catch(() => ({}));
      return { ok: false, error: data.message || `HTTP ${response.status}` };
    } catch {
      return { ok: false, error: 'Connection refused. Is the API running?' };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (files.length === 0) {
      setError('Please attach at least one file.');
      return;
    }

    setLoading(true);

    // Mark all as uploading
    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as FileStatus })));

    const results = await Promise.all(
      files.map(async (entry, i) => {
        const docTitle = files.length === 1
          ? (title || entry.file.name.replace(/\.[^.]+$/, ''))
          : (title ? `${title} (${i + 1})` : entry.file.name.replace(/\.[^.]+$/, ''));

        const result = await uploadFile(entry, docTitle);

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: result.ok ? 'done' : 'error', error: result.error } : f
        ));

        return result;
      })
    );

    setLoading(false);

    const allOk = results.every(r => r.ok);
    const anyOk = results.some(r => r.ok);

    if (allOk) {
      onSuccess();
    } else if (!anyOk) {
      setError('All uploads failed. Check API connection.');
    } else {
      setError('Some files failed to upload. Successful ones were saved.');
    }
  };

  const hasFiles = files.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-border mt-2 overflow-hidden"
    >
      <div className="p-6 border-b border-border bg-gray-50/50 flex justify-between items-center">
        <h3 className="font-bold text-primary flex items-center gap-2">
          <FilePlus size={18} className="text-accent" />
          NEW_{recordType.toUpperCase()}_ENTRY
        </h3>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-text-muted hover:text-primary transition-colors border border-border rounded-lg bg-white"
        >
          <X size={14} />
          <span>EXIT_ENTRY</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Record Type Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Record Type</label>
            <div className="relative">
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as RecordType)}
                className="w-full bg-bg border border-border p-3 rounded-lg text-sm appearance-none focus:outline-none focus:border-accent"
              >
                <option value="Invoice">Invoice</option>
                <option value="Employee">Employee Record</option>
                <option value="Resume">Candidate Resume</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" size={16} />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider">
              Record Title {files.length > 1 && <span className="normal-case text-accent">(shared — files numbered automatically)</span>}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. INV-2026-001"
              className="w-full bg-bg border border-border p-3 rounded-lg text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Dynamic Fields Section */}
        <div className="bg-bg/50 p-6 rounded-xl border border-dashed border-border">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase text-text-muted">
            {recordType === 'Invoice' && <Clock size={14} />}
            {recordType === 'Employee' && <Briefcase size={14} />}
            {recordType === 'Resume' && <FileCode size={14} />}
            Dynamic Details: {recordType}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recordType === 'Invoice' && (
              <>
                <FormField label="Invoice Number" type="text" value={dynamicFields.invoiceNumber} onChange={(v) => handleFieldChange('invoiceNumber', v)} />
                <FormField label="Invoice Date" type="date" value={dynamicFields.date} onChange={(v) => handleFieldChange('date', v)} />
                <FormField label="Amount ($)" type="number" value={dynamicFields.amount} onChange={(v) => handleFieldChange('amount', v)} />
              </>
            )}

            {recordType === 'Employee' && (
              <>
                <FormField label="Full Name" type="text" value={dynamicFields.fullName} onChange={(v) => handleFieldChange('fullName', v)} />
                <FormField label="Department" type="text" value={dynamicFields.department} onChange={(v) => handleFieldChange('department', v)} />
                <FormField label="Hire Date" type="date" value={dynamicFields.hireDate} onChange={(v) => handleFieldChange('hireDate', v)} />
              </>
            )}

            {recordType === 'Resume' && (
              <>
                <FormField label="Candidate Name" type="text" value={dynamicFields.candidateName} onChange={(v) => handleFieldChange('candidateName', v)} />
                <FormField label="Position" type="text" value={dynamicFields.position} onChange={(v) => handleFieldChange('position', v)} />
              </>
            )}
          </div>
        </div>

        {/* File Upload — Drop Zone */}
        <div className="space-y-3">
          <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider">
            Storage Attachments <span className="normal-case text-text-muted">(multiple files supported)</span>
          </label>

          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all
              ${isDragging
                ? 'border-accent bg-accent/10 scale-[1.01]'
                : hasFiles
                  ? 'border-accent/50 bg-accent/5'
                  : 'border-border hover:border-accent/50'
              }`}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              onChange={handleFileInput}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center select-none">
              <Upload className={`mb-3 ${isDragging ? 'text-accent' : hasFiles ? 'text-accent/70' : 'text-text-muted'}`} size={32} />
              <p className="text-sm font-semibold">
                {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
              </p>
              <p className="text-[10px] text-text-muted mt-1 uppercase tracking-widest">
                PDF, DOCX, PNG — multiple files allowed
              </p>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((entry, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-colors
                    ${entry.status === 'done' ? 'border-green-200 bg-green-50' :
                      entry.status === 'error' ? 'border-red-200 bg-red-50' :
                      entry.status === 'uploading' ? 'border-accent/30 bg-accent/5' :
                      'border-border bg-bg/50'}`}
                >
                  {entry.status === 'uploading' && <Loader2 size={14} className="text-accent animate-spin shrink-0" />}
                  {entry.status === 'done'      && <CheckCircle size={14} className="text-green-500 shrink-0" />}
                  {entry.status === 'error'     && <AlertCircle size={14} className="text-red-500 shrink-0" />}
                  {entry.status === 'pending'   && <FileIcon size={14} className="text-text-muted shrink-0" />}

                  <span className="flex-1 truncate font-medium">{entry.file.name}</span>
                  <span className="text-[10px] text-text-muted shrink-0">{formatBytes(entry.file.size)}</span>

                  {entry.status === 'error' && entry.error && (
                    <span className="text-[10px] text-red-500 shrink-0 max-w-[140px] truncate">{entry.error}</span>
                  )}

                  {!loading && entry.status !== 'done' && (
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="shrink-0 text-text-muted hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-border rounded-lg text-sm font-semibold hover:bg-gray-100 transition-all text-text-muted"
          >
            BACK_TO_DASHBOARD
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] px-4 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                UPLOADING {files.filter(f => f.status === 'done').length}/{files.length}...
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                COMMIT_RECORD{files.length > 1 ? `S (${files.length})` : ''}
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

const FormField: React.FC<{ label: string; type: string; value: string; onChange: (v: string) => void }> = ({ label, type, value, onChange }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-bold uppercase text-text-main opacity-80">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-white border border-border p-2.5 rounded-md text-sm focus:outline-none focus:border-accent"
    />
  </div>
);
