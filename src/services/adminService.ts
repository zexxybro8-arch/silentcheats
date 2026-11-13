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

const ADMIN_TOKEN_KEY = 'sc_admin_token';

function getStoredAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredAdminToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function adminFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredAdminToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await response.json().catch(() => ({}))) as T & {
    success?: boolean;
    message?: string;
  };

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      setStoredAdminToken(null);
    }
    throw new Error(data.message || 'Admin request failed.');
  }

  return data;
}

export const adminService = {
  clearLocalSession(): void {
    setStoredAdminToken(null);
  },

  async login(
    username: string,
    password: string
  ): Promise<{ username: string; role: string }> {
    const data = await adminFetch<{
      success: boolean;
      admin: { username: string; role: string };
      token?: string;
    }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (data.token) {
      setStoredAdminToken(data.token);
    }
    return data.admin;
  },

  async logout(): Promise<void> {
    try {
      await adminFetch('/api/admin/logout', { method: 'POST' });
    } finally {
      setStoredAdminToken(null);
    }
  },

  async checkSession(): Promise<{ username: string; role: string } | null> {
    try {
      const data = await adminFetch<{
        authenticated: boolean;
        admin: { username: string; role: string };
      }>('/api/admin/me');
      return data.authenticated ? data.admin : null;
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
    await adminFetch(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    });
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
    await adminFetch(`/api/admin/codes/${encodeURIComponent(codeId)}/revoke`, {
      method: 'PATCH',
    });
  },

  async deleteCode(codeId: string): Promise<void> {
    await adminFetch(`/api/admin/codes/${encodeURIComponent(codeId)}`, {
      method: 'DELETE',
    });
  },

  async getLogs(): Promise<AdminLogRecord[]> {
    const data = await adminFetch<{ logs: AdminLogRecord[] }>('/api/admin/logs');
    return data.logs;
  },
};
