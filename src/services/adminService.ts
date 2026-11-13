import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

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

const ADMIN_TOKEN_KEY = 'sc_admin_token_v1';
let memoryAdminToken: string | null = null;

function readAdminToken(): string | null {
  if (memoryAdminToken) return memoryAdminToken;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
      if (stored) {
        memoryAdminToken = stored;
        return stored;
      }
    }
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      if (stored) {
        memoryAdminToken = stored;
        return stored;
      }
    }
  } catch {
    // ignore storage read errors
  }
  return memoryAdminToken;
}

function writeAdminToken(token: string | null): void {
  memoryAdminToken = token;
  try {
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
      else localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // ignore localStorage errors
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
      else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // ignore sessionStorage errors
  }
}

interface AdminFetchOptions extends RequestInit {
  preserveTokenOnUnauthorized?: boolean;
}

async function adminFetch<T>(url: string, options: AdminFetchOptions = {}): Promise<T> {
  const { preserveTokenOnUnauthorized, ...fetchOptions } = options;
  const token = readAdminToken();
  const headers = new Headers(fetchOptions.headers || {});
  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorCode = typeof data?.code === 'string' ? data.code : '';
    if (
      (response.status === 401 || response.status === 403) &&
      !preserveTokenOnUnauthorized &&
      errorCode !== 'PASSWORD_CHANGE_REQUIRED'
    ) {
      writeAdminToken(null);
    }
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Unable to complete admin request.'
    );
  }

  return data as T;
}

export const adminService = {
  hasStoredToken(): boolean {
    return Boolean(readAdminToken());
  },

  clearLocalSession(): void {
    writeAdminToken(null);
  },

  async login(username: string, password: string): Promise<AdminSession> {
    const data = await adminFetch<AdminSession & { token?: string }>('/api/admin/login', {
      method: 'POST',
      preserveTokenOnUnauthorized: true,
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (data.token) {
      writeAdminToken(data.token);
    }

    return {
      username: data.username,
      role: data.role,
      mustChangePassword: Boolean(data.mustChangePassword),
    };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<AdminSession> {
    const data = await adminFetch<AdminSession & { token?: string }>(
      '/api/admin/change-password',
      {
        method: 'POST',
        preserveTokenOnUnauthorized: true,
        body: JSON.stringify({ currentPassword, newPassword }),
      }
    );

    if (data.token) {
      writeAdminToken(data.token);
    }

    return {
      username: data.username,
      role: data.role,
      mustChangePassword: Boolean(data.mustChangePassword),
    };
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore network failure on logout
    } finally {
      writeAdminToken(null);
    }
  },

  async checkSession(): Promise<AdminSession | null> {
    try {
      const data = await adminFetch<AdminSession>('/api/admin/me', {
        method: 'GET',
      });
      return {
        username: data.username,
        role: data.role,
        mustChangePassword: Boolean(data.mustChangePassword),
      };
    } catch {
      return null;
    }
  },

  async getUsers(): Promise<AdminUserRecord[]> {
    const data = await adminFetch<{ users: AdminUserRecord[] }>('/api/admin/users');
    return data.users;
  },

  async createUser(payload: {
    username: string;
    password: string;
    tier: string;
    status: 'ACTIVE' | 'INACTIVE';
    passVerificationRequired: boolean;
    passVerified: boolean;
  }): Promise<AdminUserRecord> {
    const data = await adminFetch<{ user: AdminUserRecord }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.user;
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
    const data = await adminFetch<{ user: AdminUserRecord }>(
      `/api/admin/users/${encodeURIComponent(username)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return data.user;
  },

  async deleteUser(username: string): Promise<void> {
    await adminFetch<{ success: boolean }>(
      `/api/admin/users/${encodeURIComponent(username)}`,
      {
        method: 'DELETE',
      }
    );
  },

  async getCodes(): Promise<AdminCodeRecord[]> {
    const data = await adminFetch<{ codes: AdminCodeRecord[] }>('/api/admin/codes');
    return data.codes;
  },

  async generateCode(payload: {
    targetUser: string;
    customCode?: string;
    maxUses: number;
    expiresInHours?: number | null;
  }): Promise<AdminCodeRecord> {
    const data = await adminFetch<{ code: AdminCodeRecord }>('/api/admin/codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.code;
  },

  async revokeCode(codeId: string): Promise<void> {
    await adminFetch<{ success: boolean }>(
      `/api/admin/codes/${encodeURIComponent(codeId)}/revoke`,
      {
        method: 'PATCH',
      }
    );
  },

  async deleteCode(codeId: string): Promise<void> {
    await adminFetch<{ success: boolean }>(
      `/api/admin/codes/${encodeURIComponent(codeId)}`,
      {
        method: 'DELETE',
      }
    );
  },

  async getLogs(): Promise<AdminLogRecord[]> {
    const data = await adminFetch<{ logs: AdminLogRecord[] }>('/api/admin/logs');
    return data.logs;
  },

  // Real-time Firestore listener for global sync across Admin sessions & user pass verifications
  subscribeToAdminSync(onChange: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let initialStatusEvent = true;
    let initialLogsEvent = true;

    const triggerSync = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        onChange();
      }, 300);
    };

    const unsubStatus = onSnapshot(
      collection(db, 'user_status'),
      () => {
        if (initialStatusEvent) {
          initialStatusEvent = false;
          return;
        }
        triggerSync();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'user_status');
        } catch {
          // non-fatal
        }
      }
    );

    const unsubLogs = onSnapshot(
      collection(db, 'admin_logs'),
      () => {
        if (initialLogsEvent) {
          initialLogsEvent = false;
          return;
        }
        triggerSync();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'admin_logs');
        } catch {
          // non-fatal
        }
      }
    );

    return () => {
      if (timer) clearTimeout(timer);
      unsubStatus();
      unsubLogs();
    };
  },
};
