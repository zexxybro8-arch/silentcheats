// Pure client-side SHA-256 + salted hash utility (no external dependencies or backend required)
function sha256Hex(message: string): string {
  const utf8 = unescape(encodeURIComponent(message));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= utf8.charCodeAt(i) << (24 - (i % 4) * 8);
  }
  const bitLen = utf8.length * 8;
  words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
  words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen;

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  const W = new Array<number>(64);
  for (let i = 0; i < words.length; i += 16) {
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      if (t < 16) {
        W[t] = words[i + t] | 0;
      } else {
        const s0 = rotr(7, W[t - 15]) ^ rotr(18, W[t - 15]) ^ (W[t - 15] >>> 3);
        const s1 = rotr(17, W[t - 2]) ^ rotr(19, W[t - 2]) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  return H.map((val) => (val >>> 0).toString(16).padStart(8, '0')).join('');
}

function randomHex(bytes = 8): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashClientPassword(password: string): string {
  const salt = randomHex(12);
  const digest = sha256Hex(`${salt}:${password}`);
  return `sha256$${salt}$${digest}`;
}

export function verifyClientPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith('sha256$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, salt, originalDigest] = parts;
  if (!salt || !originalDigest) return false;
  return sha256Hex(`${salt}:${password}`) === originalDigest;
}

export function generateUniqueAlphanumericCode(prefix = 'SC200'): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(6);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 6; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[arr[i] % alphabet.length];
  }
  return `${prefix}${suffix}`;
}

export interface StoredAdminAccount {
  username: string;
  passwordHash: string;
  role: 'admin';
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredUserRecord {
  username: string;
  passwordHash: string;
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

export interface StoredCodeRecord {
  id: string;
  code: string;
  targetUser: string;
  maxUses: number;
  usedCount: number;
  used: boolean;
  usedBy: string | null;
  usedAt: string | null;
  redeemedByUsers: string[];
  expiresAt: string | null;
  active: boolean;
  createdBy: string;
  createdAt: string | null;
  revokedAt: string | null;
}

export interface StoredLogRecord {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  details: string;
  timestamp: string;
}

const STORAGE_KEYS = {
  ADMIN: 'sc_local_admin_v1',
  USERS: 'sc_local_users_v1',
  CODES: 'sc_local_codes_v1',
  LOGS: 'sc_local_logs_v1',
  CONFIGS: 'sc_local_configs_v1',
};

const memoryFallback: Record<string, string> = {};

function readJson<T>(key: string, fallback: T): T {
  let raw: string | null | undefined = memoryFallback[key];
  try {
    if (typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(key) ?? raw;
    }
  } catch {
    // use memoryFallback
  }
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  const serialized = JSON.stringify(value);
  memoryFallback[key] = serialized;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, serialized);
    }
  } catch {
    // fallback already saved in memoryFallback
  }
}

function ensureInitialized(): void {
  const nowIso = new Date().toISOString();

  // 1. Seed initial Admin account (ADMIN551 / ADMIN551 with mandatory password change)
  const existingAdmin = readJson<StoredAdminAccount | null>(STORAGE_KEYS.ADMIN, null);
  if (!existingAdmin) {
    writeJson<StoredAdminAccount>(STORAGE_KEYS.ADMIN, {
      username: 'ADMIN551',
      passwordHash: hashClientPassword('ADMIN551'),
      role: 'admin',
      active: true,
      mustChangePassword: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // 2. Seed initial users
  const existingUsers = readJson<StoredUserRecord[] | null>(STORAGE_KEYS.USERS, null);
  if (!existingUsers) {
    writeJson<StoredUserRecord[]>(STORAGE_KEYS.USERS, [
      {
        username: 'USER-9875',
        passwordHash: hashClientPassword('767902'),
        tier: 'VIP CLIENT',
        status: 'ACTIVE',
        passVerificationRequired: false,
        passVerified: true,
        hwidMatched: true,
        protocol: 'KERNEL RING-0',
        createdAt: nowIso,
        updatedAt: nowIso,
        verifiedAt: nowIso,
      },
      {
        username: 'USER-81455',
        passwordHash: hashClientPassword('987566'),
        tier: 'VIP CLIENT',
        status: 'ACTIVE',
        passVerificationRequired: true,
        passVerified: false,
        hwidMatched: true,
        protocol: 'KERNEL RING-0',
        createdAt: nowIso,
        updatedAt: nowIso,
        verifiedAt: null,
      },
    ]);
  }

  // 3. Seed initial verification codes for USER-81455
  const existingCodes = readJson<StoredCodeRecord[] | null>(STORAGE_KEYS.CODES, null);
  if (!existingCodes) {
    const initialCodes = ['SC200PASS81', 'SC200VIP49K', 'SC200KEY72M', 'SC200PRO55X', 'SC200ACT93Z'];
    writeJson<StoredCodeRecord[]>(
      STORAGE_KEYS.CODES,
      initialCodes.map((code) => ({
        id: sha256Hex(code),
        code,
        targetUser: 'USER-81455',
        maxUses: 1,
        usedCount: 0,
        used: false,
        usedBy: null,
        usedAt: null,
        redeemedByUsers: [],
        expiresAt: null,
        active: true,
        createdBy: 'SYSTEM',
        createdAt: nowIso,
        revokedAt: null,
      }))
    );
  }

  // 4. Seed logs array if empty
  const existingLogs = readJson<StoredLogRecord[] | null>(STORAGE_KEYS.LOGS, null);
  if (!existingLogs) {
    writeJson<StoredLogRecord[]>(STORAGE_KEYS.LOGS, []);
  }
}

export const localStore = {
  getAdminAccount(): StoredAdminAccount {
    ensureInitialized();
    return readJson<StoredAdminAccount>(STORAGE_KEYS.ADMIN, {
      username: 'ADMIN551',
      passwordHash: hashClientPassword('ADMIN551'),
      role: 'admin',
      active: true,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },

  saveAdminAccount(account: StoredAdminAccount): void {
    writeJson(STORAGE_KEYS.ADMIN, account);
  },

  getUsers(): StoredUserRecord[] {
    ensureInitialized();
    return readJson<StoredUserRecord[]>(STORAGE_KEYS.USERS, []);
  },

  saveUsers(users: StoredUserRecord[]): void {
    writeJson(STORAGE_KEYS.USERS, users);
  },

  getCodes(): StoredCodeRecord[] {
    ensureInitialized();
    return readJson<StoredCodeRecord[]>(STORAGE_KEYS.CODES, []);
  },

  saveCodes(codes: StoredCodeRecord[]): void {
    writeJson(STORAGE_KEYS.CODES, codes);
  },

  getLogs(): StoredLogRecord[] {
    ensureInitialized();
    return readJson<StoredLogRecord[]>(STORAGE_KEYS.LOGS, []);
  },

  appendLog(entry: Omit<StoredLogRecord, 'id' | 'timestamp'>): void {
    ensureInitialized();
    const logs = readJson<StoredLogRecord[]>(STORAGE_KEYS.LOGS, []);
    const newEntry: StoredLogRecord = {
      id: `${Date.now()}-${randomHex(4)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    writeJson(STORAGE_KEYS.LOGS, [newEntry, ...logs].slice(0, 150));
  },

  getConfigs(): Record<string, unknown> {
    return readJson<Record<string, unknown>>(STORAGE_KEYS.CONFIGS, {});
  },

  saveConfigs(configs: Record<string, unknown>): void {
    writeJson(STORAGE_KEYS.CONFIGS, configs);
  },
};
