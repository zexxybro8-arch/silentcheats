import { useState, useEffect, useCallback, FC, FormEvent } from 'react';
import {
  Users,
  KeyRound,
  ScrollText,
  Plus,
  Search,
  RefreshCw,
  LogOut,
  Edit3,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Ban,
  Loader2,
  X,
  Power,
  AlertCircle,
} from 'lucide-react';
import {
  adminService,
  AdminUserRecord,
  AdminCodeRecord,
  AdminLogRecord,
} from '../../services/adminService';

interface AdminDashboardProps {
  admin: { username: string; role: string };
  onLogout: () => void;
}

type AdminTab = 'users' | 'codes' | 'logs';
type UserFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'VERIFIED' | 'NOT_VERIFIED';
type CodeFilter = 'ALL' | 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';

export const AdminDashboard: FC<AdminDashboardProps> = ({ admin, onLogout }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [codes, setCodes] = useState<AdminCodeRecord[]>([]);
  const [logs, setLogs] = useState<AdminLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Filters & search
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<UserFilter>('ALL');
  const [codeSearch, setCodeSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState<CodeFilter>('ALL');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // User Modal (Create / Edit)
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingOriginalUsername, setEditingOriginalUsername] = useState<string | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTier, setFormTier] = useState('VIP CLIENT');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formPassRequired, setFormPassRequired] = useState(true);
  const [formPassVerified, setFormPassVerified] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Code Generator Modal
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeTargetUser, setCodeTargetUser] = useState('');
  const [codeCustomValue, setCodeCustomValue] = useState('');
  const [codeMaxUses, setCodeMaxUses] = useState(1);
  const [codeExpiryHours, setCodeExpiryHours] = useState<string>('24');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [newlyGeneratedCode, setNewlyGeneratedCode] = useState<AdminCodeRecord | null>(null);

  // Confirmation modal for deleting a user
  const [deleteTargetUser, setDeleteTargetUser] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const loadAllData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [usersData, codesData, logsData] = await Promise.all([
        adminService.getUsers(),
        adminService.getCodes(),
        adminService.getLogs(),
      ]);
      setUsers(usersData);
      setCodes(codesData);
      setLogs(logsData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load admin data.';
      setFeedback({ type: 'error', message: msg });
      if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('forbidden')) {
        onLogout();
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [onLogout]);

  useEffect(() => {
    loadAllData(false);
  }, [loadAllData]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
  };

  const handleCopyCode = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      showToast('error', 'Unable to copy code to clipboard.');
    }
  };

  // User Modal handlers
  const openCreateUserModal = () => {
    setUserModalMode('create');
    setEditingOriginalUsername(null);
    setFormUsername('');
    setFormPassword('');
    setFormTier('VIP CLIENT');
    setFormStatus('ACTIVE');
    setFormPassRequired(true);
    setFormPassVerified(false);
  };

  const openEditUserModal = (user: AdminUserRecord) => {
    setUserModalMode('edit');
    setEditingOriginalUsername(user.username);
    setFormUsername(user.username);
    setFormPassword('');
    setFormTier(user.tier || 'VIP CLIENT');
    setFormStatus(user.status);
    setFormPassRequired(user.passVerificationRequired);
    setFormPassVerified(user.passVerified);
  };

  const handleSaveUser = async (e: FormEvent) => {
    e.preventDefault();
    if (isSavingUser) return;

    setIsSavingUser(true);
    try {
      if (userModalMode === 'create') {
        await adminService.createUser({
          username: formUsername.trim(),
          password: formPassword,
          tier: formTier,
          status: formStatus,
          passVerificationRequired: formPassRequired,
          passVerified: formPassVerified,
        });
        showToast('success', `User ${formUsername.trim()} created successfully.`);
      } else if (userModalMode === 'edit' && editingOriginalUsername) {
        await adminService.updateUser(editingOriginalUsername, {
          newUsername: formUsername.trim(),
          password: formPassword || undefined,
          tier: formTier,
          status: formStatus,
          passVerificationRequired: formPassRequired,
          passVerified: formPassVerified,
        });
        showToast('success', `User ${formUsername.trim()} updated successfully.`);
      }
      setUserModalMode(null);
      await loadAllData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save user.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleQuickToggleStatus = async (user: AdminUserRecord) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await adminService.updateUser(user.username, { status: nextStatus });
      showToast('success', `${user.username} is now ${nextStatus}.`);
      await loadAllData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleQuickTogglePassRequirement = async (user: AdminUserRecord) => {
    const nextRequired = !user.passVerificationRequired;
    try {
      await adminService.updateUser(user.username, {
        passVerificationRequired: nextRequired,
        passVerified: nextRequired ? user.passVerified : true,
      });
      showToast(
        'success',
        `Pass verification ${nextRequired ? 'enabled' : 'disabled'} for ${user.username}.`
      );
      await loadAllData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update pass option.');
    }
  };

  const handleQuickToggleVerifiedStatus = async (user: AdminUserRecord) => {
    const nextVerified = !user.passVerified;
    try {
      await adminService.updateUser(user.username, {
        passVerified: nextVerified,
      });
      showToast(
        'success',
        `${user.username} marked as ${nextVerified ? 'VERIFIED' : 'NOT VERIFIED'}.`
      );
      await loadAllData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update verification status.');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUser || isDeletingUser) return;
    setIsDeletingUser(true);
    try {
      await adminService.deleteUser(deleteTargetUser);
      showToast('success', `User ${deleteTargetUser} deleted.`);
      setDeleteTargetUser(null);
      await loadAllData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Code Generator handlers
  const openCodeModalForUser = (preselectedUsername?: string) => {
    setCodeTargetUser(preselectedUsername || users[0]?.username || '');
    setCodeCustomValue('');
    setCodeMaxUses(1);
    setCodeExpiryHours('24');
    setNewlyGeneratedCode(null);
    setShowCodeModal(true);
  };

  const handleGenerateCode = async (e: FormEvent) => {
    e.preventDefault();
    if (isGeneratingCode) return;

    setIsGeneratingCode(true);
    try {
      const generated = await adminService.generateCode({
        targetUser: codeTargetUser,
        customCode: codeCustomValue.trim() || undefined,
        maxUses: codeMaxUses,
        expiresInHours: codeExpiryHours === '' ? null : Number(codeExpiryHours),
      });
      setNewlyGeneratedCode(generated);
      showToast('success', `Verification code generated for ${generated.targetUser}.`);
      await loadAllData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to generate code.');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleRevokeCode = async (code: AdminCodeRecord) => {
    try {
      await adminService.revokeCode(code.id);
      showToast('success', `Code ${code.code} revoked.`);
      await loadAllData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to revoke code.');
    }
  };

  const handleDeleteCode = async (code: AdminCodeRecord) => {
    try {
      await adminService.deleteCode(code.id);
      showToast('success', `Code ${code.code} deleted.`);
      await loadAllData(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete code.');
    }
  };

  // Derived metrics & filters
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'ACTIVE').length;
  const verifiedUsers = users.filter((u) => u.passVerified).length;
  const activeCodesCount = codes.filter((c) => c.status === 'ACTIVE').length;

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.username.toLowerCase().includes(userSearch.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (userFilter === 'ACTIVE') return u.status === 'ACTIVE';
    if (userFilter === 'INACTIVE') return u.status === 'INACTIVE';
    if (userFilter === 'VERIFIED') return u.passVerified;
    if (userFilter === 'NOT_VERIFIED') return !u.passVerified;
    return true;
  });

  const filteredCodes = codes.filter((c) => {
    const q = codeSearch.trim().toLowerCase();
    const matchesSearch =
      !q || c.code.toLowerCase().includes(q) || c.targetUser.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (codeFilter !== 'ALL') return c.status === codeFilter;
    return true;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 relative z-10">
      {/* Top Admin Header */}
      <header className="rounded-2xl glass-panel cyber-card-border cyber-glow-purple px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-[#0c051a] border border-purple-400/50 p-0.5 flex items-center justify-center shadow-[0_0_14px_rgba(168,85,247,0.4)] overflow-hidden shrink-0 animate-pulse-subtle">
            <img
              src="https://i.ibb.co/LXMBFV36/file-00000000b7fc8211bcf2c107760ddfb3.png"
              alt="Silent Cheats"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-cyber text-base sm:text-lg font-bold tracking-wider text-white cyber-text-glow uppercase">
                SILENT CHEATS
              </span>
              <span className="px-2 py-0.5 rounded bg-fuchsia-950/70 border border-fuchsia-400/40 text-fuchsia-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                ADMIN PANEL
              </span>
            </div>
            <p className="font-tech text-[11px] font-semibold text-purple-300/75 uppercase tracking-wider">
              COMMAND CENTER • OPERATOR: <span className="text-purple-100">{admin.username}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadAllData(true)}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 hover:text-white font-tech font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">SYNC</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-700 via-violet-700 to-fuchsia-700 hover:from-purple-600 hover:via-violet-600 hover:to-fuchsia-600 border border-purple-400/40 text-white font-tech font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_14px_rgba(168,85,247,0.3)] transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>LOGOUT</span>
          </button>
        </div>
      </header>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mb-4 p-3 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/55 border-emerald-400/45 text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.18)]'
              : 'bg-red-950/55 border-red-500/45 text-red-200 shadow-[0_0_14px_rgba(239,68,68,0.18)]'
          }`}
        >
          <div className="flex items-center gap-2 font-tech font-semibold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current/70 hover:text-white cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        <div className="rounded-xl glass-panel cyber-card-border p-3.5">
          <div className="font-tech text-[11px] font-bold text-purple-300/75 uppercase tracking-wider">
            TOTAL USERS
          </div>
          <div className="font-cyber text-xl sm:text-2xl font-bold text-white mt-1">
            {totalUsers}
          </div>
        </div>

        <div className="rounded-xl glass-panel cyber-card-border p-3.5">
          <div className="font-tech text-[11px] font-bold text-emerald-300/80 uppercase tracking-wider">
            ACTIVE ACCOUNTS
          </div>
          <div className="font-cyber text-xl sm:text-2xl font-bold text-emerald-300 mt-1">
            {activeUsers}
            <span className="text-xs font-mono text-purple-300/60 ml-1.5">/ {totalUsers}</span>
          </div>
        </div>

        <div className="rounded-xl glass-panel cyber-card-border p-3.5">
          <div className="font-tech text-[11px] font-bold text-amber-300/80 uppercase tracking-wider">
            PASS VERIFIED
          </div>
          <div className="font-cyber text-xl sm:text-2xl font-bold text-amber-300 mt-1">
            {verifiedUsers}
            <span className="text-xs font-mono text-purple-300/60 ml-1.5">
              ({totalUsers - verifiedUsers} pending)
            </span>
          </div>
        </div>

        <div className="rounded-xl glass-panel cyber-card-border p-3.5">
          <div className="font-tech text-[11px] font-bold text-fuchsia-300/80 uppercase tracking-wider">
            ACTIVE CODES
          </div>
          <div className="font-cyber text-xl sm:text-2xl font-bold text-fuchsia-300 mt-1">
            {activeCodesCount}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="rounded-xl glass-panel cyber-card-border p-1.5 mb-4 grid grid-cols-3 gap-1.5">
        {(
          [
            { id: 'users', label: 'USER MANAGEMENT', shortLabel: 'USERS', icon: Users },
            { id: 'codes', label: 'PASS VERIFICATION', shortLabel: 'CODES', icon: KeyRound },
            { id: 'logs', label: 'AUDIT LOGS', shortLabel: 'LOGS', icon: ScrollText },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative py-2.5 px-2 rounded-lg font-tech font-bold text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                active
                  ? 'text-white bg-purple-900/50 shadow-[0_0_14px_rgba(168,85,247,0.3)] border border-purple-400/30'
                  : 'text-purple-300/65 hover:text-purple-100 hover:bg-purple-950/35'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Panel */}
      <div className="rounded-2xl glass-panel cyber-card-border cyber-glow-purple p-4 sm:p-5">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-purple-300">
            <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
            <span className="font-mono text-xs uppercase tracking-widest">
              LOADING SECURE DATABASE...
            </span>
          </div>
        ) : (
          <>
            {/* ===================================== */}
            {/* TAB 1: USER MANAGEMENT                */}
            {/* ===================================== */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-4 h-4 text-purple-400/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search username..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl glass-input border border-purple-500/25 text-xs sm:text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    <select
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value as UserFilter)}
                      className="px-3 py-2 rounded-xl bg-[#090314] border border-purple-500/30 text-xs font-tech font-bold text-purple-200 uppercase focus:outline-none focus:border-purple-400"
                    >
                      <option value="ALL">ALL USERS ({users.length})</option>
                      <option value="ACTIVE">ACTIVE ONLY</option>
                      <option value="INACTIVE">INACTIVE ONLY</option>
                      <option value="VERIFIED">PASS VERIFIED</option>
                      <option value="NOT_VERIFIED">NOT VERIFIED</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={openCreateUserModal}
                    className="px-4 py-2.5 rounded-xl font-cyber font-bold text-xs tracking-wider text-white bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 border border-purple-300/40 shadow-[0_0_16px_rgba(168,85,247,0.35)] flex items-center justify-center gap-1.5 cursor-pointer uppercase"
                  >
                    <Plus className="w-4 h-4" />
                    <span>CREATE USER</span>
                  </button>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-purple-500/20">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-purple-950/60 border-b border-purple-500/20 text-[11px] font-tech font-bold text-purple-300 uppercase tracking-wider">
                        <th className="py-3 px-4">USERNAME</th>
                        <th className="py-3 px-3">ACCOUNT</th>
                        <th className="py-3 px-3">VERIFY YOUR PASS</th>
                        <th className="py-3 px-3">PASS STATUS</th>
                        <th className="py-3 px-4 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/15 text-sm">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-10 text-center font-tech text-purple-300/60 uppercase"
                          >
                            No matching users found.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr
                            key={u.username}
                            className="hover:bg-purple-950/30 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-white text-xs sm:text-sm">
                                {u.username}
                              </div>
                              <div className="font-tech text-[11px] text-purple-300/70 uppercase">
                                {u.tier}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <button
                                type="button"
                                onClick={() => handleQuickToggleStatus(u)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition-all cursor-pointer ${
                                  u.status === 'ACTIVE'
                                    ? 'bg-emerald-950/60 border-emerald-400/45 text-emerald-300 hover:bg-emerald-900/50'
                                    : 'bg-red-950/60 border-red-500/45 text-red-300 hover:bg-red-900/50'
                                }`}
                                title="Click to toggle account active state"
                              >
                                <Power className="w-3 h-3" />
                                {u.status}
                              </button>
                            </td>

                            <td className="py-3 px-3">
                              <button
                                type="button"
                                onClick={() => handleQuickTogglePassRequirement(u)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-tech font-bold text-[11px] uppercase border transition-all cursor-pointer ${
                                  u.passVerificationRequired
                                    ? 'bg-amber-950/60 border-amber-400/45 text-amber-200 hover:bg-amber-900/50'
                                    : 'bg-purple-950/50 border-purple-500/30 text-purple-300/75 hover:text-white'
                                }`}
                                title="Toggle whether VERIFY YOUR PASS option appears for this user"
                              >
                                <KeyRound className="w-3 h-3" />
                                {u.passVerificationRequired ? 'ENABLED' : 'DISABLED'}
                              </button>
                            </td>

                            <td className="py-3 px-3">
                              <button
                                type="button"
                                onClick={() => handleQuickToggleVerifiedStatus(u)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold border transition-all cursor-pointer ${
                                  u.passVerified
                                    ? 'bg-emerald-950/60 border-emerald-400/45 text-emerald-300'
                                    : 'bg-amber-950/55 border-amber-400/45 text-amber-300'
                                }`}
                                title="Click to toggle VERIFIED / NOT VERIFIED"
                              >
                                {u.passVerified ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    VERIFIED
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3" />
                                    NOT VERIFIED
                                  </>
                                )}
                              </button>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openCodeModalForUser(u.username)}
                                  className="px-2.5 py-1.5 rounded-lg bg-fuchsia-950/60 hover:bg-fuchsia-900/60 border border-fuchsia-500/35 text-fuchsia-200 font-tech font-bold text-[11px] uppercase flex items-center gap-1 cursor-pointer"
                                  title="Generate pass verification code for this user"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>CODE</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openEditUserModal(u)}
                                  className="p-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/70 border border-purple-500/35 text-purple-200 hover:text-white cursor-pointer"
                                  title="Edit username, password & pass settings"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeleteTargetUser(u.username)}
                                  className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-500/35 text-red-300 hover:text-white cursor-pointer"
                                  title="Delete user account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile User Cards */}
                <div className="md:hidden space-y-2.5">
                  {filteredUsers.length === 0 ? (
                    <div className="py-10 text-center font-tech text-purple-300/60 uppercase">
                      No matching users found.
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div
                        key={u.username}
                        className="rounded-xl bg-purple-950/30 border border-purple-500/25 p-3.5 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-mono font-bold text-white text-sm">
                              {u.username}
                            </div>
                            <div className="font-tech text-[11px] text-purple-300/75 uppercase">
                              {u.tier}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                              u.passVerified
                                ? 'bg-emerald-950/60 border-emerald-400/45 text-emerald-300'
                                : 'bg-amber-950/55 border-amber-400/45 text-amber-300'
                            }`}
                          >
                            {u.passVerified ? 'VERIFIED' : 'NOT VERIFIED'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuickToggleStatus(u)}
                            className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-950/60 border-emerald-400/45 text-emerald-300'
                                : 'bg-red-950/60 border-red-500/45 text-red-300'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{u.status}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleQuickTogglePassRequirement(u)}
                            className={`py-1.5 px-2 rounded-lg font-tech font-bold text-[11px] uppercase border flex items-center justify-center gap-1 cursor-pointer ${
                              u.passVerificationRequired
                                ? 'bg-amber-950/60 border-amber-400/45 text-amber-200'
                                : 'bg-purple-950/50 border-purple-500/30 text-purple-300/80'
                            }`}
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>PASS: {u.passVerificationRequired ? 'ON' : 'OFF'}</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-purple-500/15">
                          <button
                            type="button"
                            onClick={() => handleQuickToggleVerifiedStatus(u)}
                            className="py-1.5 px-2 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-200 font-tech font-bold text-[10px] uppercase cursor-pointer"
                          >
                            {u.passVerified ? 'UNVERIFY' : 'VERIFY'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openCodeModalForUser(u.username)}
                            className="py-1.5 px-2 rounded-lg bg-fuchsia-950/60 border border-fuchsia-500/35 text-fuchsia-200 font-tech font-bold text-[10px] uppercase cursor-pointer"
                          >
                            CODE
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditUserModal(u)}
                            className="py-1.5 px-2 rounded-lg bg-purple-950/60 border border-purple-500/35 text-purple-200 font-tech font-bold text-[10px] uppercase cursor-pointer"
                          >
                            EDIT
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetUser(u.username)}
                            className="py-1.5 px-2 rounded-lg bg-red-950/50 border border-red-500/35 text-red-300 font-tech font-bold text-[10px] uppercase cursor-pointer"
                          >
                            DELETE
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ===================================== */}
            {/* TAB 2: PASS VERIFICATION CODES        */}
            {/* ===================================== */}
            {activeTab === 'codes' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col sm:flex-row gap-2 flex-1">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-4 h-4 text-purple-400/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={codeSearch}
                        onChange={(e) => setCodeSearch(e.target.value)}
                        placeholder="Search code or user..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl glass-input border border-purple-500/25 text-xs sm:text-sm text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    <select
                      value={codeFilter}
                      onChange={(e) => setCodeFilter(e.target.value as CodeFilter)}
                      className="px-3 py-2 rounded-xl bg-[#090314] border border-purple-500/30 text-xs font-tech font-bold text-purple-200 uppercase focus:outline-none focus:border-purple-400"
                    >
                      <option value="ALL">ALL CODES ({codes.length})</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="USED">USED</option>
                      <option value="EXPIRED">EXPIRED</option>
                      <option value="REVOKED">REVOKED</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCodeModalForUser()}
                    className="px-4 py-2.5 rounded-xl font-cyber font-bold text-xs tracking-wider text-white bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 hover:from-purple-500 hover:via-violet-500 hover:to-fuchsia-500 border border-purple-300/40 shadow-[0_0_16px_rgba(168,85,247,0.35)] flex items-center justify-center gap-1.5 cursor-pointer uppercase"
                  >
                    <Plus className="w-4 h-4" />
                    <span>GENERATE CODE</span>
                  </button>
                </div>

                {/* Desktop Codes Table */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-purple-500/20">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-purple-950/60 border-b border-purple-500/20 text-[11px] font-tech font-bold text-purple-300 uppercase tracking-wider">
                        <th className="py-3 px-4">VERIFICATION CODE</th>
                        <th className="py-3 px-3">ASSIGNED USER</th>
                        <th className="py-3 px-3">USAGE</th>
                        <th className="py-3 px-3">EXPIRY</th>
                        <th className="py-3 px-3">STATUS</th>
                        <th className="py-3 px-4 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-500/15 text-sm">
                      {filteredCodes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-10 text-center font-tech text-purple-300/60 uppercase"
                          >
                            No verification codes found.
                          </td>
                        </tr>
                      ) : (
                        filteredCodes.map((c) => (
                          <tr key={c.id} className="hover:bg-purple-950/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-purple-100 tracking-wider">
                                  {c.code}
                                </span>
                                {c.isFullCodeVisible && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCode(c.id, c.code)}
                                    className="p-1 rounded bg-purple-950/60 hover:bg-purple-900/70 border border-purple-500/30 text-purple-300 hover:text-white cursor-pointer"
                                    title="Copy verification code"
                                  >
                                    {copiedCodeId === c.id ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 font-mono text-xs text-white">
                              {c.targetUser}
                            </td>

                            <td className="py-3 px-3 font-mono text-xs text-purple-200">
                              {c.usedCount} / {c.maxUses}
                            </td>

                            <td className="py-3 px-3 font-mono text-[11px] text-purple-300/80">
                              {c.expiresAt
                                ? new Date(c.expiresAt).toLocaleString()
                                : 'NO EXPIRY'}
                            </td>

                            <td className="py-3 px-3">
                              <CodeStatusBadge status={c.status} />
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex items-center justify-end gap-1.5">
                                {c.status === 'ACTIVE' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeCode(c)}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-200 font-tech font-bold text-[11px] uppercase flex items-center gap-1 cursor-pointer"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>REVOKE</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCode(c)}
                                  className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-500/35 text-red-300 hover:text-white cursor-pointer"
                                  title="Delete code record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Codes Cards */}
                <div className="md:hidden space-y-2.5">
                  {filteredCodes.length === 0 ? (
                    <div className="py-10 text-center font-tech text-purple-300/60 uppercase">
                      No verification codes found.
                    </div>
                  ) : (
                    filteredCodes.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl bg-purple-950/30 border border-purple-500/25 p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-sm">
                              {c.code}
                            </span>
                            {c.isFullCodeVisible && (
                              <button
                                type="button"
                                onClick={() => handleCopyCode(c.id, c.code)}
                                className="p-1 rounded bg-purple-950/60 border border-purple-500/30 text-purple-300 cursor-pointer"
                              >
                                {copiedCodeId === c.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                          <CodeStatusBadge status={c.status} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-purple-200">
                          <div>USER: {c.targetUser}</div>
                          <div className="text-right">
                            USES: {c.usedCount}/{c.maxUses}
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-purple-300/75">
                          EXPIRY:{' '}
                          {c.expiresAt ? new Date(c.expiresAt).toLocaleString() : 'NO EXPIRY'}
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-purple-500/15">
                          {c.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleRevokeCode(c)}
                              className="flex-1 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 font-tech font-bold text-[11px] uppercase cursor-pointer"
                            >
                              REVOKE
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteCode(c)}
                            className="py-1.5 px-3 rounded-lg bg-red-950/50 border border-red-500/35 text-red-300 font-tech font-bold text-[11px] uppercase cursor-pointer"
                          >
                            DELETE
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ===================================== */}
            {/* TAB 3: AUDIT LOGS                     */}
            {/* ===================================== */}
            {activeTab === 'logs' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-tech font-bold text-xs tracking-widest text-purple-300 uppercase">
                    SECURITY & ADMIN ACTION LOGS ({logs.length})
                  </h2>
                </div>

                {logs.length === 0 ? (
                  <div className="py-10 text-center font-tech text-purple-300/60 uppercase">
                    No audit events recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl bg-purple-950/30 border border-purple-500/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-purple-900/60 border border-purple-400/35 font-mono text-[10px] font-bold text-purple-200 uppercase">
                              {log.action}
                            </span>
                            <span className="font-mono text-xs font-bold text-white">
                              {log.actor}
                            </span>
                            {log.target && (
                              <span className="font-mono text-[11px] text-fuchsia-300">
                                → {log.target}
                              </span>
                            )}
                          </div>
                          <p className="font-tech text-xs text-purple-200/85">{log.details}</p>
                        </div>

                        <div className="font-mono text-[10px] text-purple-300/60 shrink-0">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ===================================== */}
      {/* CREATE / EDIT USER MODAL              */}
      {/* ===================================== */}
      {userModalMode && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-[440px] max-h-[92vh] overflow-y-auto rounded-2xl glass-panel cyber-card-border cyber-glow-purple p-5 sm:p-6 bg-[#0e061e]/95 my-auto">
            <button
              type="button"
              onClick={() => setUserModalMode(null)}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-cyber text-base sm:text-lg font-bold text-white cyber-text-glow uppercase mb-4">
              {userModalMode === 'create' ? 'CREATE NEW USER' : `EDIT ${editingOriginalUsername}`}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-tech font-bold text-purple-200 uppercase">
                  USERNAME
                </label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="e.g. USER-99102"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070212]/90 border border-purple-500/40 text-white font-mono text-sm focus:outline-none focus:border-fuchsia-400"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-tech font-bold text-purple-200 uppercase">
                  {userModalMode === 'create'
                    ? 'PASSWORD'
                    : 'NEW PASSWORD (LEAVE BLANK TO KEEP CURRENT)'}
                </label>
                <input
                  type="password"
                  required={userModalMode === 'create'}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={userModalMode === 'create' ? 'Minimum 4 characters' : '••••••••'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070212]/90 border border-purple-500/40 text-white text-sm focus:outline-none focus:border-fuchsia-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-tech font-bold text-purple-200 uppercase">
                    TIER
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#070212]/90 border border-purple-500/40 text-white text-xs font-tech font-bold uppercase focus:outline-none focus:border-fuchsia-400"
                  >
                    <option value="VIP CLIENT">VIP CLIENT</option>
                    <option value="VIP UNLIMITED">VIP UNLIMITED</option>
                    <option value="PRO CLIENT">PRO CLIENT</option>
                    <option value="STANDARD">STANDARD</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-tech font-bold text-purple-200 uppercase">
                    ACCOUNT STATUS
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#070212]/90 border border-purple-500/40 text-white text-xs font-tech font-bold uppercase focus:outline-none focus:border-fuchsia-400"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {/* Per-user VERIFY YOUR PASS settings */}
              <div className="rounded-xl bg-purple-950/40 border border-purple-500/25 p-3 space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-tech font-bold text-xs text-white uppercase block">
                      ENABLE "VERIFY YOUR PASS" OPTION
                    </span>
                    <span className="font-tech text-[11px] text-purple-300/75">
                      Show pass verification prompt to this user
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formPassRequired}
                    onChange={(e) => setFormPassRequired(e.target.checked)}
                    className="w-4 h-4 accent-purple-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between pt-2 border-t border-purple-500/15 cursor-pointer">
                  <div>
                    <span className="font-tech font-bold text-xs text-white uppercase block">
                      PASS VERIFIED STATUS
                    </span>
                    <span className="font-tech text-[11px] text-purple-300/75">
                      Mark user pass as VERIFIED or NOT VERIFIED
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formPassVerified}
                    onChange={(e) => setFormPassVerified(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserModalMode(null)}
                  className="flex-1 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-purple-200 font-tech font-bold text-xs uppercase cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 border border-purple-300/40 text-white font-cyber font-bold text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSavingUser ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>SAVING...</span>
                    </>
                  ) : (
                    <span>SAVE USER</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================== */}
      {/* GENERATE VERIFICATION CODE MODAL      */}
      {/* ===================================== */}
      {showCodeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-[440px] max-h-[92vh] overflow-y-auto rounded-2xl glass-panel cyber-card-border cyber-glow-purple p-5 sm:p-6 bg-[#0e061e]/95 my-auto">
            <button
              type="button"
              onClick={() => setShowCodeModal(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-cyber text-base sm:text-lg font-bold text-white cyber-text-glow uppercase mb-4">
              GENERATE PASS VERIFICATION CODE
            </h3>

            {newlyGeneratedCode ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/45 border border-emerald-400/50 text-center space-y-2">
                  <div className="font-tech text-xs font-bold text-emerald-300 uppercase">
                    CODE ASSIGNED TO {newlyGeneratedCode.targetUser}
                  </div>
                  <div className="font-mono text-xl font-bold tracking-widest text-white">
                    {newlyGeneratedCode.code}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(newlyGeneratedCode.id, newlyGeneratedCode.code)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/50 text-emerald-100 font-tech font-bold text-xs uppercase cursor-pointer"
                  >
                    {copiedCodeId === newlyGeneratedCode.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>COPY CODE</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-cyber font-bold text-xs uppercase cursor-pointer"
                >
                  DONE
                </button>
              </div>
            ) : (
              <form onSubmit={handleGenerateCode} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-tech font-bold text-purple-200 uppercase">
                    ASSIGN TO SPECIFIC USER
                  </label>
                  <select
                    required
                    value={codeTargetUser}
                    onChange={(e) => setCodeTargetUser(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#070212]/90 border border-purple-500/40 text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-fuchsia-400"
                  >
                    {users.map((u) => (
                      <option key={u.username} value={u.username}>
                        {u.username} ({u.passVerified ? 'VERIFIED' : 'NOT VERIFIED'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-tech font-bold text-purple-200 uppercase">
                    CUSTOM CODE (OPTIONAL — AUTO-GENERATED IF BLANK)
                  </label>
                  <input
                    type="text"
                    value={codeCustomValue}
                    onChange={(e) =>
                      setCodeCustomValue(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
                    }
                    maxLength={32}
                    placeholder="LEAVE BLANK FOR AUTO-GENERATED CODE"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#070212]/90 border border-purple-500/40 text-white font-mono text-xs sm:text-sm uppercase focus:outline-none focus:border-fuchsia-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-tech font-bold text-purple-200 uppercase">
                      USAGE LIMIT
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={codeMaxUses}
                      onChange={(e) => setCodeMaxUses(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#070212]/90 border border-purple-500/40 text-white font-mono text-sm focus:outline-none focus:border-fuchsia-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-tech font-bold text-purple-200 uppercase">
                      EXPIRY
                    </label>
                    <select
                      value={codeExpiryHours}
                      onChange={(e) => setCodeExpiryHours(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#070212]/90 border border-purple-500/40 text-white text-xs font-tech font-bold uppercase focus:outline-none focus:border-fuchsia-400"
                    >
                      <option value="1">1 HOUR</option>
                      <option value="6">6 HOURS</option>
                      <option value="24">24 HOURS</option>
                      <option value="168">7 DAYS</option>
                      <option value="720">30 DAYS</option>
                      <option value="">NO EXPIRY</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCodeModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-purple-200 font-tech font-bold text-xs uppercase cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingCode || !codeTargetUser}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 border border-purple-300/40 text-white font-cyber font-bold text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isGeneratingCode ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>CREATING...</span>
                      </>
                    ) : (
                      <span>GENERATE CODE</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===================================== */}
      {/* DELETE USER CONFIRMATION MODAL        */}
      {/* ===================================== */}
      {deleteTargetUser && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-[380px] rounded-2xl glass-panel cyber-card-border p-5 bg-[#0e061e]/95 space-y-4">
            <div className="flex items-center gap-2.5 text-red-300">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h3 className="font-cyber text-base font-bold uppercase">CONFIRM DELETE USER</h3>
            </div>
            <p className="font-tech text-sm text-purple-100">
              Are you sure you want to permanently delete{' '}
              <span className="font-mono font-bold text-white">{deleteTargetUser}</span>? This
              action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                disabled={isDeletingUser}
                className="flex-1 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-purple-200 font-tech font-bold text-xs uppercase cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingUser}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-cyber font-bold text-xs uppercase cursor-pointer disabled:opacity-60"
              >
                {isDeletingUser ? 'DELETING...' : 'DELETE USER'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CodeStatusBadge: FC<{ status: AdminCodeRecord['status'] }> = ({ status }) => {
  const styles: Record<AdminCodeRecord['status'], string> = {
    ACTIVE: 'bg-emerald-950/60 border-emerald-400/45 text-emerald-300',
    USED: 'bg-purple-950/70 border-purple-400/40 text-purple-300',
    EXPIRED: 'bg-amber-950/60 border-amber-400/45 text-amber-300',
    REVOKED: 'bg-red-950/60 border-red-500/45 text-red-300',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${styles[status]}`}
    >
      {status === 'ACTIVE' && <ShieldCheck className="w-3 h-3" />}
      {status}
    </span>
  );
};
