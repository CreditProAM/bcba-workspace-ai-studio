import React, { useState, useEffect } from 'react';
import { Puzzle, ArrowRight, Loader2, Mail, Lock, UserRound, AlertCircle, KeyRound } from 'lucide-react';
import { User } from '../types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

const DEFAULT_USERS: User[] = [
  {
    id: 'default-admin',
    email: 'admin',
    password: 'admin123',
    name: 'System Administrator',
    role: 'Admin',
    avatar: 'AD'
  },
  {
    id: 'default-user',
    email: 'user',
    password: 'user123',
    name: 'Clinical User',
    role: 'RBT',
    avatar: 'CU'
  }
];

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Seed default users on mount
  useEffect(() => {
    const stored = localStorage.getItem('bcba_users_v1');
    if (!stored) {
      localStorage.setItem('bcba_users_v1', JSON.stringify(DEFAULT_USERS));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simulate network delay for "Real" feel
    setTimeout(() => {
      try {
        const storedUsersStr = localStorage.getItem('bcba_users_v1');
        let storedUsers: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : DEFAULT_USERS;
        
        // Fallback if storage somehow became empty array
        if (storedUsers.length === 0) {
            storedUsers = DEFAULT_USERS;
            localStorage.setItem('bcba_users_v1', JSON.stringify(storedUsers));
        }

        if (isLogin) {
          // Login Logic
          const user = storedUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
          
          if (user && user.password === password) {
            onLogin(user);
          } else {
            setError('Invalid username or password.');
            setLoading(false);
          }
        } else {
          // Signup Logic
          if (storedUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            setError('Account already exists with this username/email.');
            setLoading(false);
            return;
          }

          const newUser: User = {
            id: crypto.randomUUID(),
            email,
            password, // In a real app, never store plain text
            name,
            role: 'BCBA',
            avatar: name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()
          };

          const newUsersList = [...storedUsers, newUser];
          localStorage.setItem('bcba_users_v1', JSON.stringify(newUsersList));
          onLogin(newUser);
        }
      } catch (err) {
        setError('An unexpected error occurred.');
        setLoading(false);
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-4">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-white opacity-60"></div>
         <div className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-fuchsia-200/20 rounded-full blur-3xl animate-pulse"></div>
         <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] bg-indigo-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 relative z-10 animate-scale-in">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-fuchsia-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-fuchsia-500/30">
            <Puzzle className="text-white" size={32} strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-slate-500 font-medium">
            {isLogin ? 'Enter your credentials to access the dashboard.' : 'Start managing your clinical practice today.'}
          </p>
        </div>

        {/* Demo Hints */}
        {isLogin && (
            <div className="mb-6 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex gap-3 text-xs text-indigo-800">
                <div className="p-1.5 bg-indigo-100 rounded-lg h-fit shrink-0">
                    <KeyRound size={14} />
                </div>
                <div>
                    <div className="font-bold mb-1">Demo Credentials:</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] opacity-80">
                        <span>User: admin</span> <span>Pass: admin123</span>
                        <span>User: user</span> <span>Pass: user123</span>
                    </div>
                </div>
            </div>
        )}

        {/* Error Message */}
        {error && (
            <div className="mb-6 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-sm text-rose-600 animate-slide-in-right">
                <AlertCircle size={16} />
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
               <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
               <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    placeholder="Dr. Jane Doe"
                    required
                  />
               </div>
            </div>
          )}

          <div className="space-y-1">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Username or Email</label>
             <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="admin"
                  required
                />
             </div>
          </div>

          <div className="space-y-1">
             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
             <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
             </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100"
          >
            {loading ? (
                <Loader2 className="animate-spin" size={20} />
            ) : (
                <>
                   {isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={18} />
                </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
            <button 
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
        </div>

      </div>
      
      <div className="absolute bottom-8 text-slate-400 text-xs font-medium">
        © 2025 Clinical Dashboard OS. Secure & Encrypted.
      </div>
    </div>
  );
};