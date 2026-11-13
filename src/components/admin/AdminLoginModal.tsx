import { useState, ChangeEvent, FormEvent, FC } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
} from 'lucide-react';
import { adminService, AdminSession } from '../../services/adminService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (admin: AdminSession) => void;
}

export const AdminLoginModal: FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // First-login password change state inside modal
  const [pendingAdmin, setPendingAdmin] = useState<AdminSession | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!isOpen) return null;

  const resetAndClose = () => {
    if (isLoading) return;
    setErrorMessage(null);
    setAdminPassword('');
    setNewPassword('');
    setConfirmPassword('');
    if (pendingAdmin) {
      adminService.logout().catch(() => {});
      setPendingAdmin(null);
    }
    onClose();
  };

  const handleAdminLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const cleanId = adminId.trim();
    if (!cleanId || !adminPassword) {
      setErrorMessage('Please enter both ADMIN ID and ADMIN PASSWORD.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const session = await adminService.login(cleanId, adminPassword);
      if (session.mustChangePassword) {
        setPendingAdmin(session);
        setIsLoading(false);
        return;
      }

      setAdminId('');
      setAdminPassword('');
      setIsLoading(false);
      onLoginSuccess(session);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Invalid ADMIN ID or ADMIN PASSWORD.'
      );
      setIsLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading || !pendingAdmin) return;

    if (!newPassword || !confirmPassword) {
      setErrorMessage('Please enter and confirm your new admin password.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('New admin password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    if (newPassword === adminPassword) {
      setErrorMessage('New password must be different from the initial password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const updated = await adminService.changePassword(adminPassword, newPassword);
      setAdminId('');
      setAdminPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPendingAdmin(null);
      setIsLoading(false);
      onLoginSuccess(updated);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to update admin password.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-access-heading"
    >
      <div className="relative w-full max-w-[400px] max-h-[92vh] overflow-y-auto rounded-2xl glass-panel cyber-card-border cyber-glow-purple p-6 sm:p-7 border border-purple-400/40 shadow-[0_0_40px_rgba(147,51,234,0.35)] bg-[#0e061e]/95 my-auto transition-all duration-300">
        {/* Top Glowing Accent Lines */}
        <div className="absolute top-0 left-8 w-12 h-[1px] bg-gradient-to-r from-transparent via-purple-400/70 to-transparent" />
        <div className="absolute top-0 right-8 w-12 h-[1px] bg-gradient-to-r from-transparent via-fuchsia-400/70 to-transparent" />
        <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-28 h-[1.5px] bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_12px_#c084fc]" />

        {/* Close Modal Button */}
        <button
          type="button"
          onClick={resetAndClose}
          disabled={isLoading}
          aria-label="Close modal"
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-purple-950/60 hover:bg-purple-900/75 border border-purple-500/30 text-purple-300 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Preserved Circular SILENT CHEATS Logo & Animations */}
        <div className="flex justify-center mb-4">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-purple-600/40 via-violet-500/30 to-fuchsia-600/40 blur-md animate-pulse-subtle" />
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#0c051a]/95 border border-purple-400/50 shadow-[0_0_22px_rgba(168,85,247,0.45)] flex items-center justify-center overflow-hidden animate-float">
              <img
                src="https://i.ibb.co/LXMBFV36/file-00000000b7fc8211bcf2c107760ddfb3.png"
                alt="SILENT CHEATS Logo"
                className="w-full h-full object-cover rounded-full select-none pointer-events-none"
              />
            </div>
          </div>
        </div>

        {!pendingAdmin ? (
          <>
            {/* Heading */}
            <div className="text-center mb-5">
              <h2
                id="admin-access-heading"
                className="font-cyber text-xl sm:text-2xl font-bold tracking-wider text-white cyber-text-glow uppercase"
              >
                ADMIN ACCESS
              </h2>
              <p className="font-tech mt-1 text-xs font-semibold tracking-widest text-purple-300/75 uppercase">
                SILENT CHEATS SECURE PORTAL
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.18)] flex items-start gap-2.5 text-red-200 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4" noValidate>
              {/* Input 1: ADMIN ID */}
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-admin-id"
                  className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase"
                >
                  ADMIN ID
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="w-4 h-4 text-purple-400/60 group-focus-within:text-purple-300 transition-colors" />
                  </div>
                  <input
                    id="modal-admin-id"
                    type="text"
                    value={adminId}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setAdminId(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isLoading}
                    placeholder="ADMIN ID"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input border border-purple-500/30 text-white placeholder-purple-400/35 text-sm font-mono focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_16px_rgba(168,85,247,0.3)] transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Input 2: ADMIN PASSWORD */}
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-admin-password"
                  className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase"
                >
                  ADMIN PASSWORD
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-purple-400/60 group-focus-within:text-purple-300 transition-colors" />
                  </div>
                  <input
                    id="modal-admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setAdminPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isLoading}
                    placeholder="ADMIN PASSWORD"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl glass-input border border-purple-500/30 text-white placeholder-purple-400/35 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 focus:shadow-[0_0_16px_rgba(168,85,247,0.3)] transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-purple-400/60 hover:text-purple-200 focus:outline-none transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button: ACCESS DASHBOARD */}
              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative w-full group overflow-hidden rounded-xl py-3.5 px-6 font-cyber font-bold text-xs sm:text-sm tracking-widest text-white bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 active:scale-[0.985] shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(192,132,252,0.6)] border border-purple-400/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer uppercase"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 pointer-events-none" />
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-purple-100" />
                      <span>AUTHENTICATING...</span>
                    </>
                  ) : (
                    <>
                      <span>ACCESS DASHBOARD</span>
                      <ArrowRight className="w-4 h-4 text-white/90 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            {/* Mandatory First-Login Password Change */}
            <div className="text-center mb-5">
              <h2
                id="admin-access-heading"
                className="font-cyber text-lg sm:text-xl font-bold tracking-wider text-white cyber-text-glow uppercase"
              >
                CHANGE ADMIN PASSWORD
              </h2>
              <p className="font-tech mt-1 text-xs font-semibold tracking-wide text-amber-300/90 uppercase">
                FIRST LOGIN DETECTED FOR <span className="font-mono text-white">{pendingAdmin.username}</span> • SET A NEW PASSWORD
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-500/40 flex items-start gap-2.5 text-red-200 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-new-password"
                  className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase"
                >
                  NEW ADMIN PASSWORD
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-purple-400/60" />
                  </div>
                  <input
                    id="modal-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isLoading}
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl glass-input border border-purple-500/30 text-white placeholder-purple-400/35 text-sm focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-purple-400/60 hover:text-purple-200 cursor-pointer"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="modal-confirm-password"
                  className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase"
                >
                  CONFIRM NEW PASSWORD
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-purple-400/60" />
                  </div>
                  <input
                    id="modal-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isLoading}
                    placeholder="Re-enter New Password"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl glass-input border border-purple-500/30 text-white placeholder-purple-400/35 text-sm focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-purple-400/60 hover:text-purple-200 cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative w-full group overflow-hidden rounded-xl py-3.5 px-6 font-cyber font-bold text-xs sm:text-sm tracking-widest text-white bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 border border-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer uppercase"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>UPDATING PASSWORD...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>UPDATE & ACCESS DASHBOARD</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
