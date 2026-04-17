/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, CheckCircle, XCircle } from 'lucide-react';
import { Dashboard } from './components/Dashboard';

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ type: 'idle' });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<{ username: string, email: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: 'loading' });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: `Welcome, ${data.username}!` });
        setUserInfo({ username: data.username, email: data.email ?? '' });
        // Transition to dashboard after a short delay
        setTimeout(() => {
          setIsLoggedIn(true);
        }, 800);
      } else {
        setStatus({ type: 'error', message: data.message || 'Login failed' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Connection refused. Is the server running?' });
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserInfo(null);
    setStatus({ type: 'idle' });
    setUsername('');
    setPassword('');
  };

  if (isLoggedIn && userInfo) {
    return <Dashboard user={userInfo} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center font-inter p-4">
      <div className="w-full max-w-[420px] bg-white p-8 md:p-12 rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-border">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-white rounded-sm" />
          </div>
          <div className="text-xl font-bold tracking-tight text-primary uppercase">DOCULIGN</div>
        </div>

        {/* Header */}
        <div className="mb-6">
          <span className="inline-block px-2 py-0.5 bg-[#ECFDF5] text-[#065F46] rounded-full text-[10px] font-semibold uppercase mb-4">
            System Online
          </span>
          <h1 className="text-2xl font-semibold text-primary mb-2">Welcome back</h1>
          <p className="text-sm text-text-muted italic">Enter your credentials to access the document repository.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-text-main mb-1.5">Username_Ident</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[15px] border border-border rounded-md outline-none focus:border-accent focus:ring-3 focus:ring-accent/10 transition-all text-text-main"
                placeholder="admin"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-text-main mb-1.5">Auth_Secret</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-[15px] border border-border rounded-md outline-none focus:border-accent focus:ring-3 focus:ring-accent/10 transition-all text-text-main"
                placeholder="••••••••"
              />
            </div>
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
      
      {/* Hidden Info reference for developers (visible on hover or focus if needed, but here just subtle) */}
      <div className="fixed bottom-4 right-4 group">
        <div className="opacity-20 group-hover:opacity-100 transition-opacity">
          <Info size={16} className="text-text-muted" />
        </div>
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-white p-4 rounded-lg shadow-xl border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-2 group-hover:translate-y-0">
          <h4 className="text-[11px] font-bold uppercase mb-2 border-b border-border pb-1">Architecture</h4>
          <p className="text-[10px] text-text-muted leading-tight">
            ASP.NET Core 8.0 • MySQL 8.0 • Docker<br/>
            Test Creds: admin / password123
          </p>
        </div>
      </div>
    </div>
  );
}
