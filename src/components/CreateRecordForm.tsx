import React, { useState } from 'react';
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
  FileCode
} from 'lucide-react';

interface CreateRecordFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

type RecordType = 'Invoice' | 'Employee' | 'Resume';

export const CreateRecordForm: React.FC<CreateRecordFormProps> = ({ onClose, onSuccess }) => {
  const [recordType, setRecordType] = useState<RecordType>('Invoice');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic fields state
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Filter relevant dynamic fields based on type
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

    const formData = new FormData();
    formData.append('Title', title || `${recordType} Record`);
    formData.append('RecordType', recordType);
    formData.append('Metadata', JSON.stringify(metadata));
    if (file) {
      formData.append('Attachment', file);
    }

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData, // Browser handles boundary for FormData
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.message || 'Error occurred during creation');
      }
    } catch (err) {
      setError('Connection refused. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

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
            <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Record Title</label>
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

        {/* File Upload */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Storage Attachment (Optional)</label>
          <div 
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${file ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'}`}
          >
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <Upload className={`mb-3 ${file ? 'text-accent' : 'text-text-muted'}`} size={32} />
              <p className="text-sm font-semibold">{file ? file.name : 'Click to browse or drag document'}</p>
              <p className="text-[10px] text-text-muted mt-1 uppercase tracking-widest">PDF, DOCX, PNG (MAX 10MB)</p>
            </label>
            {file && (
              <button 
                type="button" 
                onClick={() => setFile(null)}
                className="mt-3 text-[10px] text-red-500 hover:underline font-bold uppercase"
              >
                Remove File
              </button>
            )}
          </div>
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
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle size={18} />
                COMMIT_RECORD
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
