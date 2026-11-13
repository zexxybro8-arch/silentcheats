import { useState, ChangeEvent, FormEvent, FC } from 'react';
import { ShieldAlert, User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { adminService } from '../../services/adminService';

interface AdminLoginCardProps {
  onLoginSuccess: (admin: { username: string; role: string }) => void;
}

export const AdminLoginCard: FC<AdminLoginCardProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both admin username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const admin = await adminService.login(username.trim(), password);
      onLoginSuccess(admin);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid admin credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto px-4 sm:px-0 relative z-10">
      <div className="relative rounded-2xl glass-panel cyber-card-border cyber-glow-purple p-6 sm:p-8 shadow-2xl backdrop-blur-2xl transition-all duration-300">
        {/* Top Accent Lines */}
        <div className="absolute top-0 left-8 w-12 h-[1px] bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
        <div className="absolute top-0 right-8 w-12 h-[1px] bg-gradient-to-r from-transparent via-fuchsia-400/60 to-transparent" />
        <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-28 h-[1.5px] bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent shadow-[0_0_10px_#e879f9]" />

        {/* Original Circular Logo & Animations */}
        <div className="flex justify-center mb-5">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-purple-600/40 via-violet-500/30 to-fuchsia-600/40 blur-md animate-pulse-subtle" />
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#0c051a]/95 border border-purple-400/50 shadow-[0_0_22px_rgba(168,85,247,0.4)] flex items-center justify-center overflow-hidden animate-float">
              <img
                src="https://i.ibb.co/LXMBFV36/file-00000000b7fc8211bcf2c107760ddfb3.png"
                alt="SILENT CHEATS Logo"
                className="w-full h-full object-cover rounded-full select-none pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-fuchsia-950/50 border border-fuchsia-500/30 text-fuchsia-300 font-mono text-[10px] font-bold tracking-widest uppercase mb-2">
            <ShieldAlert className="w-3 h-3" />
            <span>RESTRICTED ACCESS</span>
          </div>
          <h1 className="font-cyber text-xl sm:text-2xl font-bold tracking-wider text-white cyber-text-glow uppercase">
            ADMIN COMMAND LOGIN
          </h1>
          <p className="font-tech mt-1 text-xs font-semibold tracking-widest text-purple-300/75 uppercase">
            AUTHENTICATE TO MANAGE SILENT CHEATS
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/45 border border-red-500/35 flex items-start gap-2.5 text-red-200 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase">
              ADMIN USERNAME
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="w-4 h-4 text-purple-400/60 group-focus-within:text-purple-300 transition-colors" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setUsername(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isLoading}
                placeholder="Enter Admin Username"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input border border-purple-500/25 text-white placeholder-purple-400/30 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase">
              ADMIN PASSWORD
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-purple-400/60 group-focus-within:text-purple-300 transition-colors" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isLoading}
                placeholder="Enter Admin Password"
                autoComplete="current-password"
                className="w-full pl-10 pr-11 py-3 rounded-xl glass-input border border-purple-500/25 text-white placeholder-purple-400/30 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-purple-400/50 hover:text-purple-300 cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full group overflow-hidden rounded-xl py-3.5 px-6 font-cyber font-bold text-xs sm:text-sm tracking-widest text-white bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 active:scale-[0.985] shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(192,132,252,0.55)] border border-purple-400/35 transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer uppercase"
            >
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 pointer-events-none" />
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-100" />
                  <span>VERIFYING ADMIN...</span>
                </>
              ) : (
                <>
                  <span>AUTHENTICATE ADMIN</span>
                  <ArrowRight className="w-4 h-4 text-white/90 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
