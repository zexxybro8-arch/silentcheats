import express, { Request, Response, NextFunction } from 'express';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.ts';
import {
  decryptVerificationCode,
  encryptVerificationCode,
  generateUniqueCode,
  hashPassword,
  hashVerificationCode,
  maskVerificationCode,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './crypto.ts';
import { ensureBootstrapped, syncUserStatusProjection } from './bootstrap.ts';

const ADMIN_COOKIE_NAME = 'sc_admin_token';
const USER_COOKIE_NAME = 'sc_user_token';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days persistent session
const USER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface AdminContext {
  username: string;
  role: string;
  mustChangePassword: boolean;
}

interface AuthenticatedAdminRequest extends Request {
  admin?: AdminContext;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  return req.secure || proto === 'https';
}

function setAuthCookie(
  req: Request,
  res: Response,
  name: string,
  token: string,
  maxAgeSeconds: number
): void {
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(req: Request, res: Response, name: string): void {
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function extractToken(req: Request, cookieName: string): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req);
  return cookies[cookieName] || null;
}

async function writeAdminAuditLog(
  actor: string,
  action: string,
  target: string | null,
  details: string
): Promise<void> {
  try {
    await addDoc(collection(db, 'admin_logs'), {
      actor,
      action,
      target,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to write admin audit log:', err);
  }
}

async function resolveAdminSession(req: Request): Promise<AdminContext | null> {
  const token = extractToken(req, ADMIN_COOKIE_NAME);
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'admin') return null;

  const adminSnap = await getDoc(doc(db, 'admins', payload.username));
  if (!adminSnap.exists()) return null;
  const data = adminSnap.data();
  if (data.active === false) return null;

  return {
    username: typeof data.username === 'string' ? data.username : payload.username,
    role: 'admin',
    mustChangePassword: Boolean(data.mustChangePassword),
  };
}

function requireAdmin(allowPendingPasswordChange = false) {
  return async (req: AuthenticatedAdminRequest, res: Response, next: NextFunction) => {
    try {
      const admin = await resolveAdminSession(req);
      if (!admin) {
        return res.status(401).json({ error: 'Unauthorized. Please log in as Admin.' });
      }
      if (!allowPendingPasswordChange && admin.mustChangePassword) {
        return res.status(403).json({
          code: 'PASSWORD_CHANGE_REQUIRED',
          error: 'Please change your initial admin password before accessing the dashboard.',
        });
      }
      req.admin = admin;
      return next();
    } catch (err) {
      console.error('Admin auth error:', err);
      return res.status(500).json({ error: 'Unable to verify admin session.' });
    }
  };
}

function formatCodeRecord(docId: string, data: Record<string, unknown>) {
  const usedCount = typeof data.usedCount === 'number' ? data.usedCount : 0;
  const maxUses = typeof data.maxUses === 'number' ? data.maxUses : 1;
  const active = data.active !== false;
  const used = Boolean(data.used) || usedCount >= maxUses;
  const expiresAt = typeof data.expiresAt === 'string' ? data.expiresAt : null;
  const isExpired = Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());

  let status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED' = 'ACTIVE';
  if (!active) status = 'REVOKED';
  else if (used) status = 'USED';
  else if (isExpired) status = 'EXPIRED';

  const decrypted =
    typeof data.codeCipher === 'string' ? decryptVerificationCode(data.codeCipher) : null;

  return {
    id: docId,
    code: decrypted || (typeof data.codeLabel === 'string' ? data.codeLabel : 'SC20••••'),
    isFullCodeVisible: Boolean(decrypted),
    targetUser: typeof data.targetUser === 'string' ? data.targetUser : '',
    maxUses,
    usedCount,
    usedBy: typeof data.usedBy === 'string' ? data.usedBy : null,
    usedAt: typeof data.usedAt === 'string' ? data.usedAt : null,
    expiresAt,
    active,
    status,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'ADMIN',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    revokedAt: typeof data.revokedAt === 'string' ? data.revokedAt : null,
  };
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));

  // Ensure Firestore is seeded before handling API requests
  app.use('/api', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureBootstrapped();
      return next();
    } catch (err) {
      console.error('Database bootstrap failed:', err);
      return res.status(503).json({ error: 'Database service is initializing. Please try again.' });
    }
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, status: 'online' });
  });

  // ===================================================
  // USER AUTHENTICATION & PASS VERIFICATION ROUTES
  // ===================================================

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!username || !password) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const userSnap = await getDoc(doc(db, 'users', username));
      if (!userSnap.exists()) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const data = userSnap.data();
      const status = data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      if (status === 'INACTIVE') {
        return res.status(403).json({
          error: 'Your account has been deactivated. Contact Admin Support.',
        });
      }

      if (
        typeof data.passwordHash !== 'string' ||
        !verifyPassword(password, data.passwordHash)
      ) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const userPayload = {
        username: typeof data.username === 'string' ? data.username : username,
        tier: typeof data.tier === 'string' ? data.tier : 'VIP UNLIMITED',
        status,
        passVerificationRequired: Boolean(data.passVerificationRequired),
        passVerified: Boolean(data.passVerified),
      };

      await syncUserStatusProjection({
        ...userPayload,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
      });

      const token = signSessionToken(userPayload.username, 'user', USER_SESSION_TTL_SECONDS);
      setAuthCookie(req, res, USER_COOKIE_NAME, token, USER_SESSION_TTL_SECONDS);

      addDoc(collection(db, 'session_logs'), {
        username: userPayload.username,
        node: 'NODE-01',
        timestamp: new Date().toISOString(),
        status: 'CONNECTED',
      }).catch(() => {});

      return res.json({ user: userPayload, token });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
  });

  app.get('/api/pass-status', async (req: Request, res: Response) => {
    try {
      const queryUser = typeof req.query?.username === 'string' ? req.query.username.trim() : '';
      const token = extractToken(req, USER_COOKIE_NAME);
      const tokenPayload = token ? verifySessionToken(token) : null;
      const username = queryUser || (tokenPayload?.role === 'user' ? tokenPayload.username : '');

      if (!username) {
        return res.status(400).json({ error: 'Username is required.' });
      }

      const userSnap = await getDoc(doc(db, 'users', username));
      if (!userSnap.exists()) {
        return res.status(404).json({ error: 'User account not found.' });
      }

      const data = userSnap.data();
      return res.json({
        username: typeof data.username === 'string' ? data.username : username,
        tier: typeof data.tier === 'string' ? data.tier : 'VIP UNLIMITED',
        status: data.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        passVerificationRequired: Boolean(data.passVerificationRequired),
        passVerified: Boolean(data.passVerified),
      });
    } catch (err) {
      console.error('Pass status error:', err);
      return res.status(500).json({ error: 'Failed to load pass status.' });
    }
  });

  app.post('/api/verify-pass', async (req: Request, res: Response) => {
    try {
      const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
      const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';

      if (!username) {
        return res.status(400).json({
          success: false,
          message: 'Invalid account session. Please sign in again.',
        });
      }

      if (!rawCode) {
        return res.status(400).json({
          success: false,
          message: 'Please enter your verification code before submitting.',
        });
      }

      if (!/^[A-Z0-9]{4,32}$/.test(rawCode)) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid verification code format. Only alphanumeric codes (4–32 characters) are accepted.',
        });
      }

      const codeHash = hashVerificationCode(rawCode);
      const nowIso = new Date().toISOString();

      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', username);
        const statusRef = doc(db, 'user_status', username);
        const codeRef = doc(db, 'verification_codes', codeHash);

        const [userSnap, codeSnap] = await Promise.all([tx.get(userRef), tx.get(codeRef)]);

        if (!userSnap.exists()) {
          throw new Error('USER_NOT_FOUND');
        }
        const userData = userSnap.data();
        if (userData.status === 'INACTIVE') {
          throw new Error('USER_INACTIVE');
        }
        if (!codeSnap.exists()) {
          throw new Error('INVALID_CODE');
        }

        const codeData = codeSnap.data();
        if (codeData.active === false) {
          throw new Error('CODE_REVOKED');
        }
        if (typeof codeData.expiresAt === 'string') {
          const expMs = Date.parse(codeData.expiresAt);
          if (!Number.isNaN(expMs) && expMs <= Date.now()) {
            throw new Error('CODE_EXPIRED');
          }
        }
        const usedCount = typeof codeData.usedCount === 'number' ? codeData.usedCount : 0;
        const maxUses = typeof codeData.maxUses === 'number' ? codeData.maxUses : 1;
        if (Boolean(codeData.used) || usedCount >= maxUses) {
          throw new Error('CODE_USED');
        }
        if (!codeData.targetUser || codeData.targetUser !== username) {
          throw new Error('WRONG_USER');
        }

        const nextUsedCount = usedCount + 1;
        const exhausted = nextUsedCount >= maxUses;

        tx.update(codeRef, {
          usedCount: nextUsedCount,
          used: exhausted,
          usedBy: username,
          usedAt: nowIso,
        });

        tx.update(userRef, {
          passVerified: true,
          verifiedAt: nowIso,
          updatedAt: nowIso,
        });

        tx.set(
          statusRef,
          {
            username,
            tier: typeof userData.tier === 'string' ? userData.tier : 'VIP UNLIMITED',
            status: userData.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            passVerificationRequired: Boolean(userData.passVerificationRequired),
            passVerified: true,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      });

      await writeAdminAuditLog(
        username,
        'PASS_VERIFIED',
        username,
        `User ${username} completed pass verification using assigned code.`
      );

      return res.json({
        success: true,
        passVerified: true,
        message: `Verification successful! Your Silent Cheats pass is now verified for ${username}.`,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      const errorMap: Record<string, { status: number; message: string }> = {
        USER_NOT_FOUND: { status: 404, message: 'User account not found.' },
        USER_INACTIVE: {
          status: 403,
          message: 'Your account is deactivated. Contact Admin Support.',
        },
        INVALID_CODE: {
          status: 400,
          message:
            'Invalid verification code. Please check the code from Admin Support and try again.',
        },
        CODE_REVOKED: {
          status: 400,
          message: 'This verification code has been revoked. Please contact Admin Support.',
        },
        CODE_EXPIRED: {
          status: 400,
          message: 'This verification code has expired. Please request a new code from Admin Support.',
        },
        CODE_USED: {
          status: 400,
          message:
            'This verification code has already been used. Please contact Admin Support for a fresh code.',
        },
        WRONG_USER: {
          status: 403,
          message: 'This verification code is not assigned to your account.',
        },
      };

      const mapped = errorMap[code];
      if (mapped) {
        return res.status(mapped.status).json({ success: false, message: mapped.message });
      }
      console.error('Verify pass error:', err);
      return res.status(500).json({
        success: false,
        message: 'Verification failed due to a server error. Please try again.',
      });
    }
  });

  // ===================================================
  // ADMIN AUTHENTICATION (PERSISTENT 30-DAY SESSION)
  // ===================================================

  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!username || !password) {
        return res.status(400).json({ error: 'Please enter both ADMIN ID and ADMIN PASSWORD.' });
      }

      const adminSnap = await getDoc(doc(db, 'admins', username));
      if (!adminSnap.exists()) {
        return res.status(401).json({ error: 'Invalid ADMIN ID or ADMIN PASSWORD.' });
      }

      const data = adminSnap.data();
      if (data.active === false) {
        return res.status(403).json({ error: 'Admin account is disabled.' });
      }

      if (
        typeof data.passwordHash !== 'string' ||
        !verifyPassword(password, data.passwordHash)
      ) {
        return res.status(401).json({ error: 'Invalid ADMIN ID or ADMIN PASSWORD.' });
      }

      const mustChangePassword = Boolean(data.mustChangePassword);
      const token = signSessionToken(username, 'admin', ADMIN_SESSION_TTL_SECONDS);
      setAuthCookie(req, res, ADMIN_COOKIE_NAME, token, ADMIN_SESSION_TTL_SECONDS);

      await writeAdminAuditLog(
        username,
        'ADMIN_LOGIN',
        username,
        `Admin ${username} signed into the Admin Control Panel${mustChangePassword ? ' (Password change required)' : ''}.`
      );

      return res.json({
        username,
        role: 'admin',
        mustChangePassword,
        token,
      });
    } catch (err) {
      console.error('Admin login error:', err);
      return res.status(500).json({ error: 'Admin authentication failed.' });
    }
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    clearAuthCookie(req, res, ADMIN_COOKIE_NAME);
    return res.json({ success: true });
  });

  app.get('/api/admin/me', async (req: Request, res: Response) => {
    try {
      const admin = await resolveAdminSession(req);
      if (!admin) {
        return res.status(401).json({ error: 'Admin session invalid or expired.' });
      }
      return res.json(admin);
    } catch (err) {
      console.error('Admin session check error:', err);
      return res.status(500).json({ error: 'Failed to verify admin session.' });
    }
  });

  app.post(
    '/api/admin/change-password',
    requireAdmin(true),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const admin = req.admin!;
        const currentPassword =
          typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
        const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

        if (!currentPassword || !newPassword) {
          return res.status(400).json({ error: 'Current and new passwords are required.' });
        }
        if (newPassword.length < 6 || newPassword.length > 128) {
          return res
            .status(400)
            .json({ error: 'New admin password must be between 6 and 128 characters.' });
        }
        if (newPassword === currentPassword) {
          return res
            .status(400)
            .json({ error: 'New password must be different from the current password.' });
        }

        const adminRef = doc(db, 'admins', admin.username);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          return res.status(404).json({ error: 'Admin account not found.' });
        }
        const data = adminSnap.data();
        if (
          typeof data.passwordHash !== 'string' ||
          !verifyPassword(currentPassword, data.passwordHash)
        ) {
          return res.status(401).json({ error: 'Current admin password is incorrect.' });
        }

        const nowIso = new Date().toISOString();
        await setDoc(
          adminRef,
          {
            passwordHash: hashPassword(newPassword),
            mustChangePassword: false,
            updatedAt: nowIso,
          },
          { merge: true }
        );

        const freshToken = signSessionToken(admin.username, 'admin', ADMIN_SESSION_TTL_SECONDS);
        setAuthCookie(req, res, ADMIN_COOKIE_NAME, freshToken, ADMIN_SESSION_TTL_SECONDS);

        await writeAdminAuditLog(
          admin.username,
          'ADMIN_PASSWORD_CHANGED',
          admin.username,
          `Admin ${admin.username} updated their account password.`
        );

        return res.json({
          username: admin.username,
          role: 'admin',
          mustChangePassword: false,
          token: freshToken,
        });
      } catch (err) {
        console.error('Admin change password error:', err);
        return res.status(500).json({ error: 'Failed to update admin password.' });
      }
    }
  );

  // ===================================================
  // ADMIN USER MANAGEMENT ROUTES
  // ===================================================

  app.get(
    '/api/admin/users',
    requireAdmin(false),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const users = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              username: typeof data.username === 'string' ? data.username : d.id,
              tier: typeof data.tier === 'string' ? data.tier : 'VIP UNLIMITED',
              status: data.status === 'INACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const),
              passVerificationRequired: Boolean(data.passVerificationRequired),
              passVerified: Boolean(data.passVerified),
              hwidMatched: data.hwidMatched !== false,
              protocol: typeof data.protocol === 'string' ? data.protocol : 'KERNEL RING-0',
              createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
              updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
              verifiedAt: typeof data.verifiedAt === 'string' ? data.verifiedAt : null,
            };
          })
          .sort((a, b) => {
            const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
            const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
            return bTime - aTime;
          });

        return res.json({ users });
      } catch (err) {
        console.error('Admin list users error:', err);
        return res.status(500).json({ error: 'Failed to fetch users from database.' });
      }
    }
  );

  app.post(
    '/api/admin/users',
    requireAdmin(false),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const admin = req.admin!;
        const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const tier =
          typeof req.body?.tier === 'string' && req.body.tier.trim()
            ? req.body.tier.trim()
            : 'VIP CLIENT';
        const status = req.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
        const passVerificationRequired = Boolean(req.body?.passVerificationRequired);
        const passVerified = Boolean(req.body?.passVerified);

        if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
          return res.status(400).json({
            error: 'Username must be 3–32 characters (letters, numbers, hyphen, or underscore).',
          });
        }
        if (password.length < 4 || password.length > 128) {
          return res
            .status(400)
            .json({ error: 'Password must be between 4 and 128 characters.' });
        }

        const userRef = doc(db, 'users', username);
        const existingSnap = await getDoc(userRef);
        if (existingSnap.exists()) {
          return res.status(409).json({ error: `User "${username}" already exists.` });
        }

        const nowIso = new Date().toISOString();
        const record = {
          username,
          passwordHash: hashPassword(password),
          tier,
          status,
          passVerificationRequired,
          passVerified,
          hwidMatched: true,
          protocol: 'KERNEL RING-0',
          createdAt: nowIso,
          updatedAt: nowIso,
          verifiedAt: passVerified ? nowIso : null,
        };

        await setDoc(userRef, record);
        await syncUserStatusProjection(record);

        await writeAdminAuditLog(
          admin.username,
          'USER_CREATED',
          username,
          `Created user ${username} (Status: ${status}, Pass Required: ${passVerificationRequired}, Verified: ${passVerified}).`
        );

        const { passwordHash: _ph, ...safeUser } = record;
        return res.status(201).json({ user: safeUser });
      } catch (err) {
        console.error('Admin create user error:', err);
        return res.status(500).json({ error: 'Failed to create user account.' });
      }
    }
  );

  app.patch(
    '/api/admin/users/:username',
    requireAdmin(false),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const admin = req.admin!;
        const targetUsername =
          typeof req.params.username === 'string' ? req.params.username.trim() : '';
        if (!targetUsername) {
          return res.status(400).json({ error: 'Target username is required.' });
        }

        const userRef = doc(db, 'users', targetUsername);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          return res.status(404).json({ error: `User "${targetUsername}" not found.` });
        }

        const current = snap.data();
        const requestedNewUsername =
          typeof req.body?.newUsername === 'string' ? req.body.newUsername.trim() : '';
        const nextUsername = requestedNewUsername || targetUsername;

        if (!/^[a-zA-Z0-9_-]{3,32}$/.test(nextUsername)) {
          return res.status(400).json({
            error: 'Username must be 3–32 characters (letters, numbers, hyphen, or underscore).',
          });
        }

        if (nextUsername !== targetUsername) {
          const duplicateSnap = await getDoc(doc(db, 'users', nextUsername));
          if (duplicateSnap.exists()) {
            return res
              .status(409)
              .json({ error: `Cannot rename: username "${nextUsername}" already exists.` });
          }
        }

        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        if (password && (password.length < 4 || password.length > 128)) {
          return res
            .status(400)
            .json({ error: 'New password must be between 4 and 128 characters.' });
        }

        const nowIso = new Date().toISOString();
        const currentStatus = current.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
        const nextStatus =
          req.body?.status === 'ACTIVE' || req.body?.status === 'INACTIVE'
            ? req.body.status
            : currentStatus;
        const nextTier =
          typeof req.body?.tier === 'string' && req.body.tier.trim()
            ? req.body.tier.trim()
            : typeof current.tier === 'string'
              ? current.tier
              : 'VIP UNLIMITED';
        const nextPassRequired =
          typeof req.body?.passVerificationRequired === 'boolean'
            ? req.body.passVerificationRequired
            : Boolean(current.passVerificationRequired);
        const nextPassVerified =
          typeof req.body?.passVerified === 'boolean'
            ? req.body.passVerified
            : Boolean(current.passVerified);

        const updatedRecord = {
          ...current,
          username: nextUsername,
          passwordHash: password ? hashPassword(password) : current.passwordHash,
          tier: nextTier,
          status: nextStatus,
          passVerificationRequired: nextPassRequired,
          passVerified: nextPassVerified,
          hwidMatched: current.hwidMatched !== false,
          protocol: typeof current.protocol === 'string' ? current.protocol : 'KERNEL RING-0',
          createdAt: typeof current.createdAt === 'string' ? current.createdAt : nowIso,
          verifiedAt: nextPassVerified
            ? typeof current.verifiedAt === 'string'
              ? current.verifiedAt
              : nowIso
            : null,
          updatedAt: nowIso,
        };

        if (nextUsername !== targetUsername) {
          await setDoc(doc(db, 'users', nextUsername), updatedRecord);
          await deleteDoc(userRef);
          await deleteDoc(doc(db, 'user_status', targetUsername)).catch(() => {});

          const codesSnap = await getDocs(
            query(collection(db, 'verification_codes'), where('targetUser', '==', targetUsername))
          );
          if (!codesSnap.empty) {
            const batch = writeBatch(db);
            codesSnap.docs.forEach((cDoc) => {
              batch.update(cDoc.ref, { targetUser: nextUsername });
            });
            await batch.commit();
          }
        } else {
          await setDoc(userRef, updatedRecord, { merge: true });
        }

        await syncUserStatusProjection(updatedRecord);

        const notes: string[] = [];
        if (nextUsername !== targetUsername) notes.push(`Renamed ${targetUsername} -> ${nextUsername}`);
        if (password) notes.push('Password updated');
        if (nextStatus !== currentStatus) notes.push(`Status -> ${nextStatus}`);
        if (nextPassRequired !== Boolean(current.passVerificationRequired)) {
          notes.push(`Pass Required -> ${nextPassRequired}`);
        }
        if (nextPassVerified !== Boolean(current.passVerified)) {
          notes.push(`Pass Status -> ${nextPassVerified ? 'VERIFIED' : 'NOT VERIFIED'}`);
        }

        await writeAdminAuditLog(
          admin.username,
          nextStatus !== currentStatus && notes.length === 1
            ? 'USER_STATUS_CHANGED'
            : 'USER_UPDATED',
          nextUsername,
          notes.length > 0 ? notes.join('; ') : `Updated profile for ${nextUsername}.`
        );

        const { passwordHash: _ph, ...safeUser } = updatedRecord;
        return res.json({ user: safeUser });
      } catch (err) {
        console.error('Admin update user error:', err);
        return res.status(500).json({ error: 'Failed to update user account.' });
      }
    }
  );

  app.delete(
    '/api/admin/users/:username',
    requireAdmin(false),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const admin = req.admin!;
        const targetUsername =
          typeof req.params.username === 'string' ? req.params.username.trim() : '';
        if (!targetUsername) {
          return res.status(400).json({ error: 'Target username is required.' });
        }

        const userRef = doc(db, 'users', targetUsername);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          return res.status(404).json({ error: `User "${targetUsername}" not found.` });
        }

        await deleteDoc(userRef);
        await deleteDoc(doc(db, 'user_status', targetUsername)).catch(() => {});

        await writeAdminAuditLog(
          admin.username,
          'USER_DELETED',
          targetUsername,
          `Deleted user account ${targetUsername}.`
        );

        return res.json({ success: true });
      } catch (err) {
        console.error('Admin delete user error:', err);
        return res.status(500).json({ error: 'Failed to delete user account.' });
      }
    }
  );

  // ===================================================
  // ADMIN VERIFICATION CODE MANAGEMENT ROUTES
  // ===================================================

  app.get(
    '/api/admin/codes',
    requireAdmin(false),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const snap = await getDocs(collection(db, 'verification_codes'));
        const codes = snap.docs
          .map((d) => formatCodeRecord(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => {
            const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
            const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
            return bTime - aTime;
          });

        return res.json({ codes });
      } catch (err) {
        console.error('Admin list codes error:', err);
        return res.status(500).json({ error: 'Failed to fetch verification codes.' });
      }
    }
  );

  app.post(
    '/api/admin/codes',
    requireAdmin(false),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const admin = req.admin!;
        const targetUser =
          typeof req.body?.targetUser === 'string' ? req.body.targetUser.trim() : '';
        const customCode =
          typeof req.body?.customCode === 'string' ? req.body.customCode.trim().toUpperCase() : '';
        const rawMaxUses = Number(req.body?.maxUses);
        const rawExpiryHours = req.body?.expiresInHours;

        if (!targetUser) {
          return res
            .status(400)
            .json({ error: 'Please select a target user to assign this verification code to.' });
        }

        const userSnap = await getDoc(doc(db, 'users', targetUser));
        if (!userSnap.exists()) {
          return res.status(404).json({ error: `Assigned user "${targetUser}" does not exist.` });
        }

        let plainCode = customCode || generateUniqueCode('SC200');
        if (!/^[A-Z0-9]{4,32}$/.test(plainCode)) {
          return res.status(400).json({
            error: 'Verification code must be 4–32 alphanumeric characters (A-Z, 0-9).',
          });
        }

        let codeHash = hashVerificationCode(plainCode);
        const existingSnap = await getDoc(doc(db, 'verification_codes', codeHash));
        if (existingSnap.exists()) {
          if (customCode) {
            return res
              .status(409)
              .json({ error: 'That custom code already exists. Please choose a different code.' });
          }
          plainCode = generateUniqueCode('SC200');
          codeHash = hashVerificationCode(plainCode);
        }

        const maxUses =
          Number.isFinite(rawMaxUses) && rawMaxUses >= 1 && rawMaxUses <= 1000
            ? Math.floor(rawMaxUses)
            : 1;

        let expiresAt: string | null = null;
        if (rawExpiryHours !== undefined && rawExpiryHours !== null && rawExpiryHours !== '') {
          const hours = Number(rawExpiryHours);
          if (!Number.isFinite(hours) || hours <= 0 || hours > 8760) {
            return res
              .status(400)
              .json({ error: 'Expiry hours must be between 1 and 8760 (1 year).' });
          }
          expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        }

        const nowIso = new Date().toISOString();
        const codeDocData = {
          codeHash,
          codeCipher: encryptVerificationCode(plainCode),
          codeLabel: maskVerificationCode(plainCode),
          targetUser,
          used: false,
          usedCount: 0,
          maxUses,
          usedBy: null,
          usedAt: null,
          expiresAt,
          active: true,
          amount: 200,
          createdBy: admin.username,
          createdAt: nowIso,
          revokedAt: null,
        };

        await setDoc(doc(db, 'verification_codes', codeHash), codeDocData);

        await writeAdminAuditLog(
          admin.username,
          'CODE_GENERATED',
          targetUser,
          `Generated code ${codeDocData.codeLabel} assigned to ${targetUser} (Max Uses: ${maxUses}${expiresAt ? `, Expires: ${expiresAt}` : ', No Expiry'}).`
        );

        return res.status(201).json({
          code: formatCodeRecord(codeHash, codeDocData),
        });
      } catch (err) {
        console.error('Admin generate code error:', err);
        return res.status(500).json({ error: 'Failed to generate verification code.' });
      }
    }
  );

  app.patch(
    '/api/admin/codes/:codeId/revoke',
    requireAdmin(false),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const admin = req.admin!;
        const codeId = typeof req.params.codeId === 'string' ? req.params.codeId.trim() : '';
        if (!codeId) {
          return res.status(400).json({ error: 'Code ID is required.' });
        }

        const codeRef = doc(db, 'verification_codes', codeId);
        const snap = await getDoc(codeRef);
        if (!snap.exists()) {
          return res.status(404).json({ error: 'Verification code not found.' });
        }

        const data = snap.data();
        const nowIso = new Date().toISOString();
        await setDoc(codeRef, { active: false, revokedAt: nowIso }, { merge: true });

        await writeAdminAuditLog(
          admin.username,
          'CODE_REVOKED',
          typeof data.targetUser === 'string' ? data.targetUser : null,
          `Revoked verification code ${typeof data.codeLabel === 'string' ? data.codeLabel : codeId}.`
        );

        return res.json({ success: true });
      } catch (err) {
        console.error('Admin revoke code error:', err);
        return res.status(500).json({ error: 'Failed to revoke verification code.' });
      }
    }
  );

  app.delete(
    '/api/admin/codes/:codeId',
    requireAdmin(false),
    async (req: AuthenticatedAdminRequest, res: Response) => {
      try {
        const admin = req.admin!;
        const codeId = typeof req.params.codeId === 'string' ? req.params.codeId.trim() : '';
        if (!codeId) {
          return res.status(400).json({ error: 'Code ID is required.' });
        }

        const codeRef = doc(db, 'verification_codes', codeId);
        const snap = await getDoc(codeRef);
        if (!snap.exists()) {
          return res.status(404).json({ error: 'Verification code not found.' });
        }

        const data = snap.data();
        await deleteDoc(codeRef);

        await writeAdminAuditLog(
          admin.username,
          'CODE_DELETED',
          typeof data.targetUser === 'string' ? data.targetUser : null,
          `Deleted verification code record ${typeof data.codeLabel === 'string' ? data.codeLabel : codeId}.`
        );

        return res.json({ success: true });
      } catch (err) {
        console.error('Admin delete code error:', err);
        return res.status(500).json({ error: 'Failed to delete verification code.' });
      }
    }
  );

  // ===================================================
  // ADMIN AUDIT LOGS ROUTE
  // ===================================================

  app.get(
    '/api/admin/logs',
    requireAdmin(false),
    async (_req: AuthenticatedAdminRequest, res: Response) => {
      try {
        let rows: Array<Record<string, unknown> & { id: string }> = [];
        try {
          const orderedSnap = await getDocs(
            query(collection(db, 'admin_logs'), orderBy('timestamp', 'desc'), limit(100))
          );
          rows = orderedSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Record<string, unknown>),
          }));
        } catch {
          const fallbackSnap = await getDocs(collection(db, 'admin_logs'));
          rows = fallbackSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string })
            .sort((a, b) => {
              const aTime = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
              const bTime = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
              return bTime - aTime;
            })
            .slice(0, 100);
        }

        const logs = rows.map((row) => ({
          id: row.id,
          actor: typeof row.actor === 'string' ? row.actor : 'SYSTEM',
          action: typeof row.action === 'string' ? row.action : 'EVENT',
          target: typeof row.target === 'string' ? row.target : null,
          details: typeof row.details === 'string' ? row.details : '',
          timestamp: typeof row.timestamp === 'string' ? row.timestamp : new Date().toISOString(),
        }));

        return res.json({ logs });
      } catch (err) {
        console.error('Admin logs error:', err);
        return res.status(500).json({ error: 'Failed to load audit logs.' });
      }
    }
  );

  return app;
}
