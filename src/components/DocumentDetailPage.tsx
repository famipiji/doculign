import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  Edit3, 
  MoreVertical, 
  Printer, 
  Download, 
  RotateCcw, 
  Maximize2,
  Send,
  Paperclip,
  CheckCircle,
  MessageSquare,
  History,
  Info,
  Layers,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';

interface Version {
  v: string;
  status: 'CURRENT' | 'ARCHIVED';
  updatedBy: string;
  time: string;
}

interface Comment {
  id: number;
  user: string;
  time: string;
  avatar?: string;
  message: string;
}

export const DocumentDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('View');
  const [comment, setComment] = useState('');

  const [versions] = useState<Version[]>([
    { v: 'v.2.4.1', status: 'CURRENT', updatedBy: 'James Chen', time: '2 hours ago' },
    { v: 'v.2.4.0', status: 'ARCHIVED', updatedBy: 'James Chen', time: '1 day ago' },
    { v: 'v.2.3.9', status: 'ARCHIVED', updatedBy: 'Sarah Miller', time: '5 days ago' },
  ]);

  const [comments, setComments] = useState<Comment[]>([
    { id: 1, user: 'James Chen', time: '10:24 AM', message: '@Sarah, please review the encryption clause in section 2. Is this compatible with our new vaulting spec?' },
    { id: 2, user: 'Sarah Miller', time: '10:45 AM', message: 'Checking now. The Precision Command standard usually requires higher bit-depth for the Digital Vault components.' },
  ]);

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const newComment: Comment = {
      id: Date.now(),
      user: 'Fahmi Hafizi (You)',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      message: comment
    };
    setComments([...comments, newComment]);
    setComment('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg">
      {/* Top Header Section */}
      <div className="bg-white border-b border-border px-8 py-4 shrink-0">
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-text-muted mb-3 tracking-widest">
          <span>Repository</span>
          <ChevronRight size={10} />
          <span>Legal Affairs</span>
          <ChevronRight size={10} />
          <span className="text-primary truncate">CONTRACT_2024_Q3_FINAL.PDF</span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-extrabold text-primary tracking-tight">Contract_2024_Q3_FINAL.pdf</h1>
            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-extrabold rounded-md">ACTIVE</span>
            <span className="text-[10px] font-bold text-text-muted bg-bg px-2 py-0.5 rounded border border-border">v.2.4.1</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-all">
              <Edit3 size={16} />
              <span>Edit Document</span>
            </button>
            <button className="p-2 border border-border rounded-lg text-text-muted hover:bg-bg transition-all">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-8 mt-6">
          <TabButton label="Properties" active={activeTab === 'Properties'} onClick={() => setActiveTab('Properties')} icon={<Info size={14} />} />
          <TabButton label="View" active={activeTab === 'View'} onClick={() => setActiveTab('View')} icon={<FileText size={14} />} />
          <TabButton label="Change Logs" active={activeTab === 'Change Logs'} onClick={() => setActiveTab('Change Logs')} icon={<History size={14} />} />
          <TabButton label="Versions" active={activeTab === 'Versions'} onClick={() => setActiveTab('Versions')} icon={<Layers size={14} />} />
          <TabButton label="Conversation" active={activeTab === 'Conversation'} onClick={() => setActiveTab('Conversation')} icon={<MessageSquare size={14} />} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Viewer (Center) */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center bg-gray-100/50">
          {/* Viewer Toolbar */}
          <div className="w-full max-w-4xl bg-white/80 backdrop-blur-sm border border-border rounded-lg mb-4 px-4 py-2 flex justify-between items-center text-xs font-bold text-text-muted shadow-sm">
            <div className="flex items-center gap-4">
              <Maximize2 size={14} className="cursor-pointer hover:text-primary transition-colors" />
              <span>125%</span>
              <RotateCcw size={14} className="cursor-pointer hover:text-primary transition-colors" />
            </div>
            <div className="flex items-center gap-4">
              <ChevronRight size={14} className="rotate-180 cursor-pointer" />
              <span>Page 1 / 14</span>
              <ChevronRight size={14} className="cursor-pointer" />
            </div>
            <div className="flex items-center gap-4">
              <Printer size={16} className="cursor-pointer hover:text-primary transition-colors" />
              <Download size={16} className="cursor-pointer hover:text-primary transition-colors" />
              <RotateCcw size={16} className="cursor-pointer hover:text-primary transition-colors" />
            </div>
          </div>

          {/* Paper Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl bg-white shadow-2xl rounded-sm p-16 min-h-[1200px] relative border border-border"
          >
            <div className="absolute top-8 right-8 text-[10px] font-bold text-text-muted tracking-widest uppercase">
              Confidential<br />July 15, 2024
            </div>

            <div className="mb-12">
              <h2 className="text-3xl font-black text-primary uppercase tracking-tighter mb-1">Master Service Agreement</h2>
              <p className="text-[10px] font-bold text-text-muted">Ref: IVAULT-2024-LEGAL-0091</p>
              <div className="w-full h-1 bg-primary mt-4" />
            </div>

            <div className="space-y-8 text-sm text-text-main leading-relaxed">
              <p>
                This Master Service Agreement ("Agreement") is entered into as of the date signed below ("Effective Date") and between <strong>IVAULT Enterprises</strong>, a Delaware Corporation, and <strong>Global Logistics Hub</strong>.
              </p>

              <div>
                <h3 className="font-black text-primary uppercase text-xs mb-3 tracking-widest">1. Scope of Services</h3>
                <p>
                  The Service Provider shall provide the digital vaulting and automated document repository services described in Exhibit A attached hereto. All services shall be performed in a professional manner consistent with industry standards and the Precision Command framework.
                </p>
              </div>

              <div>
                <h3 className="font-black text-primary uppercase text-xs mb-3 tracking-widest">2. Data Security & Encryption</h3>
                <p>
                  The system utilizes tonal depth and structural asymmetry to create a Digital Vault feel. Information is treated as a series of precision-milled layers—heavy where authoritative and light where functional. Encryption standards follow AES-256 with dual-token validation.
                </p>
              </div>

              <div>
                <h3 className="font-black text-primary uppercase text-xs mb-3 tracking-widest">3. Term and Termination</h3>
                <p>
                  The term of this Agreement shall commence on the Effective Date and shall continue for a period of twelve (12) months unless terminated earlier as provided herein. Either party may terminate this Agreement with thirty (30) days written notice.
                </p>
              </div>
            </div>

            {/* Floating Quick Action */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-primary/95 text-white rounded-full shadow-2xl backdrop-blur-sm border border-white/10">
               <button className="p-2 hover:bg-white/10 rounded-full transition-all"><Maximize2 size={16} /></button>
               <button className="p-2 hover:bg-white/10 rounded-full transition-all"><Download size={16} /></button>
               <button className="p-2 hover:bg-white/10 rounded-full transition-all"><Layers size={16} /></button>
               <div className="w-px h-6 bg-white/20 mx-1" />
               <button className="px-3 text-[10px] font-black uppercase tracking-widest">Command</button>
            </div>
          </motion.div>
        </div>

        {/* Right Sidebar (History & Comments) */}
        <aside className="w-[380px] bg-white border-l border-border flex flex-col shrink-0">
          {/* Version History Section */}
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-sm text-primary flex items-center gap-2">
                <History size={16} className="text-text-muted" />
                Version History
              </h3>
              <span className="text-[10px] font-bold text-text-muted uppercase px-2 py-0.5 bg-bg rounded">4 PREVIOUS</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {versions.map((v, i) => (
                <div key={v.v} className="relative pl-6">
                  {/* Timeline bar */}
                  {i !== versions.length - 1 && <div className="absolute left-1.5 top-4 bottom-0 w-px bg-border shadow-[0_0_8px_rgba(0,0,0,0.05)]" />}
                  <div className={`absolute left-0 top-1 w-3 h-3 rounded-full border-2 bg-white ${v.status === 'CURRENT' ? 'border-accent shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'border-border'}`} />
                  
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-primary">{v.v}</span>
                      {v.status === 'CURRENT' && <span className="bg-green-100 text-green-800 text-[8px] font-black px-1.5 rounded uppercase tracking-widest">CURRENT</span>}
                    </div>
                    <p className="text-[11px] text-text-main font-semibold">Updated by <span className="text-accent">{v.updatedBy}</span></p>
                    <p className="text-[10px] text-text-muted italic">{v.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conversation Section */}
          <div className="border-t border-border flex-1 flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-sm text-primary flex items-center gap-2">
                <MessageSquare size={16} className="text-text-muted" />
                Conversation
              </h3>
              <div className="flex items-center -space-x-2">
                 {[1,2,3].map(i => (
                   <div key={i} className="w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center text-[8px] font-black shadow-sm">U</div>
                 ))}
                 <span className="text-[9px] font-bold text-text-muted ml-4 uppercase">3 active</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {comments.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded bg-bg flex items-center justify-center text-[10px] font-black text-primary shrink-0 border border-border shadow-sm">
                    {msg.user.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-extrabold text-primary">{msg.user}</span>
                      <span className="text-[9px] text-text-muted font-bold uppercase">{msg.time}</span>
                    </div>
                    <p className="text-[12px] text-text-main leading-relaxed bg-bg/50 p-3 rounded-lg border border-border/30">
                      {msg.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-6 border-t border-border bg-white">
              <form onSubmit={handleSendComment} className="relative">
                <textarea 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a message..."
                  className="w-full bg-bg border border-border rounded-xl p-4 pr-12 text-xs focus:outline-none focus:border-accent min-h-[80px] resize-none transition-all shadow-inner"
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                   <button type="button" className="text-text-muted hover:text-primary transition-colors"><Paperclip size={16} /></button>
                   <button type="submit" className="text-accent hover:text-accent/80 transition-all active:scale-95"><Send size={16} /></button>
                </div>
              </form>
              <p className="text-[9px] text-text-muted mt-3 font-bold uppercase tracking-widest text-center">
                Document updated to v.2.4.1
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void; icon: React.ReactNode }> = ({ label, active, onClick, icon }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 pb-3 px-1 text-[11px] font-bold uppercase tracking-widest transition-all relative ${active ? 'text-primary' : 'text-text-muted hover:text-text-main'}`}
  >
    {icon}
    <span>{label}</span>
    {active && (
      <motion.div 
        layoutId="activeTab"
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
      />
    )}
  </button>
);
