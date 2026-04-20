/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Info, CheckCircle, XCircle } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { MainLayout } from './components/MainLayout';
import { DocumentsPage } from './components/DocumentsPage';
import { DocumentDetailPage } from './components/DocumentDetailPage';
import { CreateRecordForm } from './components/CreateRecordForm';

interface UserInfo {
  username: string;
  email: string;
}

function NewDocumentPage({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex-1 overflow-y-auto p-8">
      <CreateRecordForm
        onClose={() => navigate('/documents')}
        onSuccess={() => navigate('/documents')}
      />
    </div>
  );
}

function AuthenticatedApp({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  return (
    <Routes>
      <Route element={<MainLayout user={user} onLogout={onLogout} />}>
        <Route path="/" element={<Dashboard user={user} onLogout={onLogout} />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/new-document" element={<NewDocumentPage onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: UserInfo) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: 'loading' });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: `Welcome, ${data.username}!` });
        setTimeout(() => {
          onLogin({ username: data.username, email: data.email ?? '' });
        }, 800);
      } else {
        setStatus({ type: 'error', message: data.message || 'Login failed' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Connection refused. Is the server running?' });
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center font-inter p-4">
      <div className="w-full max-w-[420px] bg-white p-8 md:p-12 rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-border">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-white rounded-sm" />
          </div>
          <div className="text-xl font-bold tracking-tight text-primary uppercase">DOCULIGN</div>
        </div>

        <div className="mb-6">
          <span className="inline-block px-2 py-0.5 bg-[#ECFDF5] text-[#065F46] rounded-full text-[10px] font-semibold uppercase mb-4">
            System Online
          </span>
          <h1 className="text-2xl font-semibold text-primary mb-2">Welcome back</h1>
          <p className="text-sm text-text-muted italic">Enter your credentials to access the document repository.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-text-main mb-1.5">Username_Ident</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 text-[15px] border border-border rounded-md outline-none focus:border-accent focus:ring-3 focus:ring-accent/10 transition-all text-text-main"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-text-main mb-1.5">Auth_Secret</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-[15px] border border-border rounded-md outline-none focus:border-accent focus:ring-3 focus:ring-accent/10 transition-all text-text-main"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-center justify-between text-[13px]">
            <label className="flex items-center gap-2 text-text-muted cursor-pointer">
              <input type="checkbox" className="rounded border-border" />
              Remember me
            </label>
            <a href="#" className="text-accent font-medium hover:underline">Forgot password?</a>
          </div>

          <button
            type="submit"
            disabled={status.type === 'loading'}
            className="w-full py-3 bg-primary text-white rounded-md text-[15px] font-semibold hover:bg-primary-dark active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm border border-black/10"
          >
            {status.type === 'loading' ? 'Verifying...' : 'Sign In to Dashboard'}
          </button>
        </form>

        <AnimatePresence mode="wait">
          {status.type !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`mt-6 p-4 rounded-md border flex items-center gap-3 ${
                status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                status.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200'
              }`}
            >
              {status.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
              <span className="text-[13px] font-medium">{status.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[12px] text-text-muted leading-relaxed">
            &copy; 2026 DocuLign DMS &bull; v4.2.0-stable<br />
            Protected by enterprise-grade encryption
          </p>
        </div>
      </div>

      <div className="fixed bottom-4 right-4 group">
        <div className="opacity-20 group-hover:opacity-100 transition-opacity">
          <Info size={16} className="text-text-muted" />
        </div>
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-white p-4 rounded-lg shadow-xl border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-2 group-hover:translate-y-0">
          <h4 className="text-[11px] font-bold uppercase mb-2 border-b border-border pb-1">Architecture</h4>
          <p className="text-[10px] text-text-muted leading-tight">
            ASP.NET Core 8.0 • MySQL 8.0 • Docker<br />
            Test Creds: admin / password123
          </p>
        </div>
      </div>
    </div>
  );
}

const SESSION_KEY = 'doculign_user';

export default function App() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (user: UserInfo) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setUserInfo(user);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUserInfo(null);
  };

  return (
    <BrowserRouter>
      {userInfo ? (
        <AuthenticatedApp user={userInfo} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </BrowserRouter>
  );
}
