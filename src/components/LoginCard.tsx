import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2, Check } from 'lucide-react';

interface LoginCardProps {
  onLoginSuccess: (user: { username: string; tier: string }) => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    // Validation for empty fields
    if (!username.trim() && !password.trim()) {
      setErrorMessage('Please enter your username and password.');
      return;
    }

    if (!username.trim()) {
      setErrorMessage('Username cannot be empty.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Password cannot be empty.');
      return;
    }

    // High-tech authentication sequence
    setIsLoading(true);
    setErrorMessage(null);

    setLoadingStep('INITIALIZING HANDSHAKE...');
    await new Promise((res) => setTimeout(res, 600));

    setLoadingStep('AUTHENTICATING TOKEN...');
    await new Promise((res) => setTimeout(res, 650));

    setLoadingStep('SECURE NODE CONNECTED');
    await new Promise((res) => setTimeout(res, 450));

    if (password.length < 4) {
      setIsLoading(false);
      setErrorMessage('Invalid credentials. Access key must be at least 4 characters.');
      return;
    }

    setIsLoading(false);
    onLoginSuccess({
      username: username.trim(),
      tier: 'VIP CLIENT',
    });
  };

  return (
    <div className="w-full max-w-[420px] mx-auto px-4 sm:px-0 relative z-10">
      {/* Main Glassmorphism Card */}
      <div className="relative rounded-2xl glass-panel cyber-card-border cyber-glow-purple p-6 sm:p-8 md:p-9 shadow-2xl backdrop-blur-2xl transition-all duration-300">
        
        {/* Subtle Decorative Top Corner Accents */}
        <div className="absolute top-0 left-8 w-12 h-[1px] bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
        <div className="absolute top-0 right-8 w-12 h-[1px] bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />
        <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-24 h-[1.5px] bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_10px_#a855f7]" />

        {/* 1. Perfect Circular Glassmorphic Logo Frame with subtle purple neon glow */}
        <div className="flex justify-center mb-5">
          <div className="relative group">
            {/* Soft breathing halo behind circle */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-purple-600/40 via-violet-500/30 to-fuchsia-600/40 blur-md group-hover:blur-lg transition-all duration-500 animate-pulse-subtle" />
            
            {/* Circular Glass Container */}
            <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#0c051a]/90 border border-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.35)] flex items-center justify-center p-2.5 overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
              {/* Internal subtle gradient overlay */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-purple-500/10 via-transparent to-purple-950/40 pointer-events-none" />
              
              {/* Logo Image */}
              <img
                src="https://i.ibb.co/LXMBFV36/file-00000000b7fc8211bcf2c107760ddfb3.png"
                alt="Silent Cheats Logo"
                className="relative z-10 w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(192,132,252,0.6)] select-none pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* 2. Heading & Subtitle */}
        <div className="text-center mb-7">
          <h1 className="font-cyber text-2xl sm:text-[26px] font-bold tracking-wider text-white cyber-text-glow uppercase">
            SILENT CHEATS LOGIN
          </h1>
          <p className="font-tech mt-1.5 text-xs font-semibold tracking-widest text-purple-300/75 uppercase">
            ENTER YOUR CREDENTIALS TO CONTINUE
          </p>
        </div>

        {/* Error Alert Box if validation fails */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-2.5 text-red-200 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          
          {/* Username Field */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase">
              USERNAME
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="w-4 h-4 text-purple-400/60 group-focus-within:text-purple-300 transition-colors" />
              </div>
              <input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                disabled={isLoading}
                placeholder="Enter Username"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-input border border-purple-500/20 text-white placeholder-purple-400/30 text-sm font-sans focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all duration-200 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase">
              PASSWORD
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-purple-400/60 group-focus-within:text-purple-300 transition-colors" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                disabled={isLoading}
                placeholder="Enter Password"
                autoComplete="current-password"
                className="w-full pl-10 pr-11 py-3 rounded-xl glass-input border border-purple-500/20 text-white placeholder-purple-400/30 text-sm font-sans focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 focus:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all duration-200 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                disabled={isLoading}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-purple-400/50 hover:text-purple-300 focus:outline-none transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Device & Online Status */}
          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-purple-500/40 bg-purple-950/40 text-purple-600 focus:ring-purple-500/40 focus:ring-offset-0 transition-colors cursor-pointer"
              />
              <span className="text-xs text-purple-300/70 font-tech tracking-wide hover:text-purple-200">
                REMEMBER DEVICE
              </span>
            </label>

            <span className="text-[11px] font-mono text-purple-300/60 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] inline-block" />
              NODE 01 ONLINE
            </span>
          </div>

          {/* Large Premium LOGIN Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full group overflow-hidden rounded-xl py-3.5 px-6 font-cyber font-bold text-sm sm:text-base tracking-wider text-white bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 active:scale-[0.985] shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(192,132,252,0.55)] border border-purple-400/35 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {/* Shimmer sweep effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 pointer-events-none" />

              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                  <span className="font-mono text-xs tracking-wider uppercase">{loadingStep}</span>
                </>
              ) : (
                <>
                  <span className="uppercase tracking-widest drop-shadow-sm">LOGIN</span>
                  <ArrowRight className="w-4 h-4 text-white/90 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* 4. Elegant SAFE ANTIBAN Verification Badge */}
        <div className="mt-7 pt-4 border-t border-purple-500/15 flex items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/35 border border-purple-500/25 shadow-[0_0_15px_rgba(168,85,247,0.18)] backdrop-blur-md">
            <span className="font-tech font-bold text-xs tracking-wider text-purple-200 uppercase">
              SAFE ANTIBAN
            </span>
            <div className="relative flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400/60 shadow-[0_0_8px_rgba(52,211,153,0.55)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-2.5 h-2.5 text-emerald-300 drop-shadow-[0_0_3px_#34d399]"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
