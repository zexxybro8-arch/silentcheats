import {
  localStore,
  hashClientPassword,
  verifyClientPassword,
  generateUniqueAlphanumericCode,
  StoredCodeRecord,
} from './localStore';

export interface AdminUserRecord {
  username: string;
  tier: string;
  status: 'ACTIVE' | 'INACTIVE';
  passVerificationRequired: boolean;
  passVerified: boolean;
  hwidMatched: boolean;
  protocol: string;
  createdAt: string | null;
  updatedAt: string | null;
  verifiedAt: string | null;
}

export interface AdminCodeRecord {
  id: string;
  code: string;
  isFullCodeVisible: boolean;
  targetUser: string;
  maxUses: number;
  usedCount: number;
  usedBy: string | null;
  usedAt: string | null;
  expiresAt: string | null;
  active: boolean;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
  createdBy: string;
  createdAt: string | null;
  revokedAt: string | null;
}

export interface AdminLogRecord {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  details: string;
  timestamp: string;
}

export interface AdminSession {
  username: string;
  role: string;
  mustChangePassword?: boolean;
}

const ADMIN_SESSION_KEY = 'sc_admin_session_v1';
let memoryAdminSession: AdminSession | null = null;

function readAdminSession(): AdminSession | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminSession;
        if (parsed && parsed.role === 'admin') {
          memoryAdminSession = parsed;
          return parsed;
        }
      }
    }
  } catch {
    // fallback to memory
  }
  return memoryAdminSession;
}

function writeAdminSession(session: AdminSession | null): void {
  memoryAdminSession = session;
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (session) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
      }
    }
  } catch {
    // fallback already stored in memoryAdminSession
  }
}

function requireActiveAdmin(): AdminSession {
  const session = readAdminSession();
  if (!session || session.role !== 'admin') {
    throw new Error('Admin authentication is required.');
  }
  if (session.mustChangePassword) {
    throw new Error('Please change your initial admin password before continuing.');
  }
  return session;
}

function mapCodeToAdminRecord(c: StoredCodeRecord): AdminCodeRecord {
  const now = Date.now();
  const isExpired = Boolean(c.expiresAt && Date.parse(c.expiresAt) <= now);
  const isRevoked = !c.active;
  const isUsed = c.usedCount >= c.maxUses || c.used;

  let status: AdminCodeRecord['status'] = 'ACTIVE';
  if (isRevoked) status = 'REVOKED';
  else if (isUsed) status = 'USED';
  else if (isExpired) status = 'EXPIRED';

  return {
    id: c.id,
    code: c.code,
    isFullCodeVisible: true,
    targetUser: c.targetUser,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    usedBy: c.usedBy,
    usedAt: c.usedAt,
    expiresAt: c.expiresAt,
    active: c.active,
    status,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    revokedAt: c.revokedAt,
  };
}

export const adminService = {
  hasStoredToken(): boolean {
    return Boolean(readAdminSession());
  },

  clearLocalSession(): void {
    writeAdminSession(null);
  },

  async login(username: string, password: string): Promise<AdminSession> {
    const cleanId = username.trim();
    const account = localStore.getAdminAccount();

    if (!cleanId || !password) {
      throw new Error('Please enter both ADMIN ID and ADMIN PASSWORD.');
    }

    if (cleanId !== account.username || !verifyClientPassword(password, account.passwordHash)) {
      throw new Error('Invalid ADMIN ID or ADMIN PASSWORD.');
    }

    if (!account.active) {
      throw new Error('Admin account is disabled.');
    }

    const session: AdminSession = {
      username: account.username,
      role: 'admin',
      mustChangePassword: account.mustChangePassword,
    };
    writeAdminSession(session);

    localStore.appendLog({
      actor: account.username,
      action: 'ADMIN_LOGIN',
      target: account.username,
      details: `Admin ${account.username} signed into the Admin Control Panel${account.mustChangePassword ? ' (Password change required)' : ''}.`,
    });

    return session;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<AdminSession> {
    const session = readAdminSession();
    if (!session) {
      throw new Error('Admin session expired. Please sign in again.');
    }

    const account = localStore.getAdminAccount();
    if (!verifyClientPassword(currentPassword, account.passwordHash)) {
      throw new Error('Current admin password is incorrect.');
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
      throw new Error('New admin password must be between 6 and 128 characters.');
    }

    if (newPassword === currentPassword) {
      throw new Error('New password must be different from the current password.');
    }

    const nowIso = new Date().toISOString();
    localStore.saveAdminAccount({
      ...account,
      passwordHash: hashClientPassword(newPassword),
      mustChangePassword: false,
      updatedAt: nowIso,
    });

    const updatedSession: AdminSession = {
      username: account.username,
      role: 'admin',
      mustChangePassword: false,
    };
    writeAdminSession(updatedSession);

    localStore.appendLog({
      actor: account.username,
      action: 'ADMIN_PASSWORD_CHANGED',
      target: account.username,
      details: `Admin ${account.username} updated their account password.`,
    });

    return updatedSession;
  },

  async logout(): Promise<void> {
    writeAdminSession(null);
  },

  async checkSession(): Promise<AdminSession | null> {
    const session = readAdminSession();
    if (!session) return null;
    const account = localStore.getAdminAccount();
    if (!account.active || account.username !== session.username) {
      writeAdminSession(null);
      return null;
    }
    const synced: AdminSession = {
      username: account.username,
      role: 'admin',
      mustChangePassword: account.mustChangePassword,
    };
    writeAdminSession(synced);
    return synced;
  },

  async getUsers(): Promise<AdminUserRecord[]> {
    requireActiveAdmin();
    return localStore
      .getUsers()
      .map(({ passwordHash: _ph, ...safe }) => safe)
      .sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime;
      });
  },

  async createUser(payload: {
    username: string;
    password: string;
    tier: string;
    status: 'ACTIVE' | 'INACTIVE';
    passVerificationRequired: boolean;
    passVerified: boolean;
  }): Promise<AdminUserRecord> {
    const admin = requireActiveAdmin();
    const username = payload.username.trim();

    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
      throw new Error('Username must be 3–32 characters (letters, numbers, hyphen, or underscore).');
    }

    if (payload.password.length < 4 || payload.password.length > 128) {
      throw new Error('Password must be between 4 and 128 characters.');
    }

    const users = localStore.getUsers();
    if (users.some((u) => u.username === username)) {
      throw new Error(`User "${username}" already exists.`);
    }

    const nowIso = new Date().toISOString();
    const newRecord = {
      username,
      passwordHash: hashClientPassword(payload.password),
      tier: payload.tier.trim() || 'VIP CLIENT',
      status: payload.status === 'INACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const),
      passVerificationRequired: Boolean(payload.passVerificationRequired),
      passVerified: Boolean(payload.passVerified),
      hwidMatched: true,
      protocol: 'KERNEL RING-0',
      createdAt: nowIso,
      updatedAt: nowIso,
      verifiedAt: payload.passVerified ? nowIso : null,
    };

    localStore.saveUsers([newRecord, ...users]);

    localStore.appendLog({
      actor: admin.username,
      action: 'USER_CREATED',
      target: username,
      details: `Created user ${username} (Status: ${newRecord.status}, Pass Required: ${newRecord.passVerificationRequired}, Verified: ${newRecord.passVerified}).`,
    });

    const { passwordHash: _ph, ...safe } = newRecord;
    return safe;
  },

  async updateUser(
    username: string,
    payload: {
      newUsername?: string;
      password?: string;
      tier?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      passVerificationRequired?: boolean;
      passVerified?: boolean;
    }
  ): Promise<AdminUserRecord> {
    const admin = requireActiveAdmin();
    const users = localStore.getUsers();
    const index = users.findIndex((u) => u.username === username);
    if (index === -1) {
      throw new Error(`User "${username}" not found.`);
    }

    const current = users[index];
    const nextUsername = payload.newUsername?.trim() || current.username;

    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(nextUsername)) {
      throw new Error('Username must be 3–32 characters (letters, numbers, hyphen, or underscore).');
    }

    if (nextUsername !== current.username && users.some((u) => u.username === nextUsername)) {
      throw new Error(`Cannot rename: username "${nextUsername}" already exists.`);
    }

    if (payload.password && (payload.password.length < 4 || payload.password.length > 128)) {
      throw new Error('New password must be between 4 and 128 characters.');
    }

    const nowIso = new Date().toISOString();
    const nextStatus = payload.status ?? current.status;
    const nextPassRequired =
      payload.passVerificationRequired !== undefined
        ? payload.passVerificationRequired
        : current.passVerificationRequired;
    const nextPassVerified =
      payload.passVerified !== undefined ? payload.passVerified : current.passVerified;

    const updated = {
      ...current,
      username: nextUsername,
      passwordHash: payload.password
        ? hashClientPassword(payload.password)
        : current.passwordHash,
      tier: payload.tier?.trim() || current.tier,
      status: nextStatus,
      passVerificationRequired: nextPassRequired,
      passVerified: nextPassVerified,
      verifiedAt: nextPassVerified ? current.verifiedAt || nowIso : null,
      updatedAt: nowIso,
    };

    users[index] = updated;
    localStore.saveUsers(users);

    if (nextUsername !== current.username) {
      const codes = localStore.getCodes();
      localStore.saveCodes(
        codes.map((c) => (c.targetUser === current.username ? { ...c, targetUser: nextUsername } : c))
      );
    }

    const notes: string[] = [];
    if (nextUsername !== current.username) notes.push(`Renamed ${current.username} -> ${nextUsername}`);
    if (payload.password) notes.push('Password updated');
    if (nextStatus !== current.status) notes.push(`Status -> ${nextStatus}`);
    if (nextPassRequired !== current.passVerificationRequired) {
      notes.push(`Pass Required -> ${nextPassRequired}`);
    }
    if (nextPassVerified !== current.passVerified) {
      notes.push(`Pass Status -> ${nextPassVerified ? 'VERIFIED' : 'NOT VERIFIED'}`);
    }

    localStore.appendLog({
      actor: admin.username,
      action:
        nextStatus !== current.status && notes.length === 1
          ? 'USER_STATUS_CHANGED'
          : 'USER_UPDATED',
      target: nextUsername,
      details: notes.length > 0 ? notes.join('; ') : `Updated profile for ${nextUsername}.`,
    });

    const { passwordHash: _ph, ...safe } = updated;
    return safe;
  },

  async deleteUser(username: string): Promise<void> {
    const admin = requireActiveAdmin();
    const users = localStore.getUsers();
    const exists = users.some((u) => u.username === username);
    if (!exists) {
      throw new Error(`User "${username}" not found.`);
    }

    localStore.saveUsers(users.filter((u) => u.username !== username));

    localStore.appendLog({
      actor: admin.username,
      action: 'USER_DELETED',
      target: username,
      details: `Deleted user account ${username}.`,
    });
  },

  async getCodes(): Promise<AdminCodeRecord[]> {
    requireActiveAdmin();
    return localStore
      .getCodes()
      .map(mapCodeToAdminRecord)
      .sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime;
      });
  },

  async generateCode(payload: {
    targetUser: string;
    customCode?: string;
    maxUses: number;
    expiresInHours?: number | null;
  }): Promise<AdminCodeRecord> {
    const admin = requireActiveAdmin();
    const targetUser = payload.targetUser.trim();

    if (!targetUser) {
      throw new Error('Please select a target user to assign this verification code to.');
    }

    const users = localStore.getUsers();
    if (!users.some((u) => u.username === targetUser)) {
      throw new Error(`Assigned user "${targetUser}" does not exist.`);
    }

    const codes = localStore.getCodes();
    let plainCode = payload.customCode?.trim().toUpperCase() || generateUniqueAlphanumericCode('SC200');

    if (!/^[A-Z0-9]{4,32}$/.test(plainCode)) {
      throw new Error('Verification code must be 4–32 alphanumeric characters (A-Z, 0-9).');
    }

    if (codes.some((c) => c.code.toUpperCase() === plainCode)) {
      if (payload.customCode?.trim()) {
        throw new Error('That custom code already exists. Please choose a different code.');
      }
      plainCode = generateUniqueAlphanumericCode('SC200');
    }

    const maxUses =
      Number.isFinite(payload.maxUses) && payload.maxUses >= 1 && payload.maxUses <= 1000
        ? Math.floor(payload.maxUses)
        : 1;

    let expiresAt: string | null = null;
    if (payload.expiresInHours !== undefined && payload.expiresInHours !== null) {
      if (!Number.isFinite(payload.expiresInHours) || payload.expiresInHours <= 0 || payload.expiresInHours > 8760) {
        throw new Error('Expiry hours must be between 1 and 8760 (1 year).');
      }
      expiresAt = new Date(Date.now() + payload.expiresInHours * 60 * 60 * 1000).toISOString();
    }

    const nowIso = new Date().toISOString();
    const newRecord: StoredCodeRecord = {
      id: `${Date.now()}-${plainCode}`,
      code: plainCode,
      targetUser,
      maxUses,
      usedCount: 0,
      used: false,
      usedBy: null,
      usedAt: null,
      redeemedByUsers: [],
      expiresAt,
      active: true,
      createdBy: admin.username,
      createdAt: nowIso,
      revokedAt: null,
    };

    localStore.saveCodes([newRecord, ...codes]);

    localStore.appendLog({
      actor: admin.username,
      action: 'CODE_GENERATED',
      target: targetUser,
      details: `Generated code ${plainCode} assigned to ${targetUser} (Max Uses: ${maxUses}${expiresAt ? `, Expires: ${expiresAt}` : ', No Expiry'}).`,
    });

    return mapCodeToAdminRecord(newRecord);
  },

  async revokeCode(codeId: string): Promise<void> {
    const admin = requireActiveAdmin();
    const codes = localStore.getCodes();
    const idx = codes.findIndex((c) => c.id === codeId);
    if (idx === -1) {
      throw new Error('Verification code not found.');
    }

    const target = codes[idx];
    codes[idx] = {
      ...target,
      active: false,
      revokedAt: new Date().toISOString(),
    };
    localStore.saveCodes(codes);

    localStore.appendLog({
      actor: admin.username,
      action: 'CODE_REVOKED',
      target: target.targetUser,
      details: `Revoked verification code ${target.code} (assigned to ${target.targetUser}).`,
    });
  },

  async deleteCode(codeId: string): Promise<void> {
    const admin = requireActiveAdmin();
    const codes = localStore.getCodes();
    const target = codes.find((c) => c.id === codeId);
    if (!target) {
      throw new Error('Verification code not found.');
    }

    localStore.saveCodes(codes.filter((c) => c.id !== codeId));

    localStore.appendLog({
      actor: admin.username,
      action: 'CODE_DELETED',
      target: target.targetUser,
      details: `Deleted verification code record ${target.code}.`,
    });
  },

  async getLogs(): Promise<AdminLogRecord[]> {
    requireActiveAdmin();
    return localStore.getLogs();
  },
};
