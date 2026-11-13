import { useState, FormEvent, FC } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2, LogOut } from 'lucide-react';
import { adminService, AdminSession } from '../../services/adminService';

interface AdminPasswordChangeCardProps {
  admin: AdminSession;
  onPasswordChanged: (updatedAdmin: AdminSession) => void;
  onCancelLogout: () => void;
}

export const AdminPasswordChangeCard: FC<AdminPasswordChangeCardProps> = ({
  admin,
  onPasswordChanged,
  onCancelLogout,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Please fill in all password fields.');
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

    if (newPassword === currentPassword) {
      setErrorMessage('New password must be different from your initial password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedAdmin = await adminService.changePassword(currentPassword, newPassword);
      onPasswordChanged(updatedAdmin);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to update admin password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto px-4 sm:px-0 relative z-10">
      <div className="relative rounded-2xl glass-panel cyber-card-border cyber-glow-purple p-6 sm:p-7 shadow-2xl backdrop-blur-2xl">
        <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-28 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_10px_#f59e0b]" />

        {/* Original Circular Logo */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-purple-600/40 via-violet-500/30 to-fuchsia-600/40 blur-md animate-pulse-subtle" />
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#0c051a]/95 border border-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center overflow-hidden animate-float">
              <img
                src="https://i.ibb.co/LXMBFV36/file-00000000b7fc8211bcf2c107760ddfb3.png"
                alt="SILENT CHEATS Logo"
                className="w-full h-full object-cover rounded-full select-none pointer-events-none"
              />
            </div>
          </div>
        </div>

        <div className="text-center mb-5">
          <h2 className="font-cyber text-lg sm:text-xl font-bold tracking-wider text-white cyber-text-glow uppercase">
            SECURITY PASSWORD UPDATE
          </h2>
          <p className="font-tech mt-1 text-xs font-semibold tracking-wide text-amber-300/90 uppercase">
            ADMIN: <span className="font-mono text-white">{admin.username}</span> • CHANGE INITIAL
            PASSWORD TO CONTINUE
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-500/40 flex items-start gap-2.5 text-red-200 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div className="space-y-1">
            <label className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase">
              CURRENT PASSWORD
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-purple-400/60" />
              </div>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                placeholder="Enter Current Password"
                autoComplete="current-password"
                className="w-full pl-10 pr-11 py-2.5 rounded-xl glass-input border border-purple-500/30 text-white placeholder-purple-400/35 text-sm focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-purple-400/60 hover:text-purple-200 cursor-pointer"
                aria-label="Toggle current password visibility"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase">
              NEW ADMIN PASSWORD
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-purple-400/60" />
              </div>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                className="w-full pl-10 pr-11 py-2.5 rounded-xl glass-input border border-purple-500/30 text-white placeholder-purple-400/35 text-sm focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-purple-400/60 hover:text-purple-200 cursor-pointer"
                aria-label="Toggle new password visibility"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-tech font-bold tracking-wider text-purple-200/90 uppercase">
              CONFIRM NEW PASSWORD
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-purple-400/60" />
              </div>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                placeholder="Re-enter New Password"
                autoComplete="new-password"
                className="w-full pl-10 pr-11 py-2.5 rounded-xl glass-input border border-purple-500/30 text-white placeholder-purple-400/35 text-sm focus:outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-purple-400/60 hover:text-purple-200 cursor-pointer"
                aria-label="Toggle confirm password visibility"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl py-3 px-4 font-cyber font-bold text-xs tracking-widest text-white bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 border border-purple-300/45 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-65 cursor-pointer uppercase"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>UPDATING PASSWORD...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>SAVE & ACCESS DASHBOARD</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onCancelLogout}
              disabled={isSubmitting}
              className="w-full rounded-xl py-2.5 px-4 font-tech font-bold text-xs tracking-widest text-purple-300 hover:text-white bg-purple-950/45 border border-purple-500/30 flex items-center justify-center gap-1.5 cursor-pointer uppercase disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>CANCEL & LOGOUT</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
