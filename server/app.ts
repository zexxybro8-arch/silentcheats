import express, { type Express, type NextFunction, type Request, type Response } from 'express';
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
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase.ts';
import {
  generateUniqueCode,
  hashPassword,
  hashVerificationCode,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './crypto.ts';
import { ensureBootstrapped } from './bootstrap.ts';

interface AuthenticatedRequest extends Request {
  adminUser?: string;
  authUser?: string;
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
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function extractToken(req: Request, cookieName: string): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req);
  return cookies[cookieName] || null;
}

function setSessionCookie(res: Response, name: string, token: string, maxAgeSeconds: number): void {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
    isProd ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.append('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response, name: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isProd ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.append('Set-Cookie', parts.join('; '));
}

async function logAdminAction(params: {
  actor: string;
  action: string;
  target?: string;
  details: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'admin_logs'), {
      actor: params.actor,
      action: params.action,
      target: params.target || null,
      details: params.details,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to write admin log:', err instanceof Error ? err.message : String(err));
  }
}

async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req, 'sc_admin_token');
  const payload = verifySessionToken(token, 'admin');

  if (!payload) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized. Admin authentication is required.',
    });
    return;
  }

  try {
    const adminSnap = await getDoc(doc(db, 'admins', payload.sub));
    if (!adminSnap.exists() || adminSnap.data().active === false || adminSnap.data().role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden. Admin privileges revoked or invalid.',
      });
      return;
    }

    req.adminUser = payload.sub;
    next();
  } catch {
    res.status(500).json({
      success: false,
      message: 'Failed to verify admin session.',
    });
  }
}

function sanitizeUserRecord(id: string, data: Record<string, unknown>) {
  const username = typeof data.username === 'string' ? data.username : id;
  const passVerificationRequired =
    data.passVerificationRequired !== undefined
      ? Boolean(data.passVerificationRequired)
      : username === 'USER-81455';
  const passVerified =
    data.passVerified !== undefined ? Boolean(data.passVerified) : username === 'USER-9875';

  return {
    username,
    tier: typeof data.tier === 'string' ? data.tier : 'VIP CLIENT',
    status: typeof data.status === 'string' ? data.status : 'ACTIVE',
    passVerificationRequired,
    passVerified,
    hwidMatched: data.hwidMatched !== undefined ? Boolean(data.hwidMatched) : true,
    protocol: typeof data.protocol === 'string' ? data.protocol : 'KERNEL RING-0',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    verifiedAt: typeof data.verifiedAt === 'string' ? data.verifiedAt : null,
  };
}

export function createApiApp(): Express {
  const app = express();
  app.use(express.json({ limit: '32kb' }));

  // Ensure Firestore bootstrap completes before API routes run
  app.use('/api', async (_req: Request, _res: Response, next: NextFunction) => {
    await ensureBootstrapped();
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // ==========================================
  // USER AUTHENTICATION & PASS VERIFICATION
  // ==========================================

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const body = req.body as { username?: unknown; password?: unknown };
      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';

      if (!username || !password || username.length > 64 || password.length > 128) {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
        return;
      }

      const userRef = doc(db, 'users', username);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
        return;
      }

      const userData = userSnap.data();

      if (userData.status === 'INACTIVE') {
        res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Contact Admin Support.',
        });
        return;
      }

      const storedHash = typeof userData.passwordHash === 'string' ? userData.passwordHash : '';
      if (!verifyPassword(password, storedHash)) {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
        return;
      }

      const token = signSessionToken(username, 'user', 60 * 60 * 24);
      setSessionCookie(res, 'sc_user_token', token, 60 * 60 * 24);

      try {
        await addDoc(collection(db, 'session_logs'), {
          username,
          node: 'NODE 01',
          status: 'HANDSHAKE_SUCCESS',
          timestamp: new Date().toISOString(),
          createdAt: serverTimestamp(),
        });
      } catch {
        // non-blocking
      }

      const safeUser = sanitizeUserRecord(username, userData);

      res.json({
        success: true,
        user: {
          ...safeUser,
          token,
        },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({
        success: false,
        message: 'Authentication service temporarily unavailable.',
      });
    }
  });

  app.get('/api/pass-status', async (req: Request, res: Response) => {
    const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';
    if (!username || username.length > 64) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }

    const token = extractToken(req, 'sc_user_token');
    if (token) {
      const payload = verifySessionToken(token, 'user');
      if (!payload || payload.sub !== username) {
        res.status(401).json({ error: 'Invalid user session.' });
        return;
      }
    }

    try {
      const userSnap = await getDoc(doc(db, 'users', username));
      if (!userSnap.exists()) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      const safeUser = sanitizeUserRecord(username, userSnap.data());
      res.json({
        username: safeUser.username,
        status: safeUser.status,
        passVerificationRequired: safeUser.passVerificationRequired,
        passVerified: safeUser.passVerified,
      });
    } catch {
      res.status(500).json({ error: 'Unable to check pass status.' });
    }
  });

  app.post('/api/verify-pass', async (req: Request, res: Response) => {
    try {
      const body = req.body as { username?: unknown; code?: unknown };
      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      const rawCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

      const userToken = extractToken(req, 'sc_user_token');
      if (userToken) {
        const tokenPayload = verifySessionToken(userToken, 'user');
        if (!tokenPayload || tokenPayload.sub !== username) {
          res.status(401).json({
            success: false,
            message: 'Session mismatch. Please log in again.',
          });
          return;
        }
      }

      if (!username || username.length > 64) {
        res.status(400).json({
          success: false,
          message: 'Invalid account session. Please sign in again.',
        });
        return;
      }

      if (!rawCode) {
        res.status(400).json({
          success: false,
          message: 'Please enter your verification code before submitting.',
        });
        return;
      }

      if (!/^[A-Z0-9]{4,32}$/.test(rawCode)) {
        res.status(400).json({
          success: false,
          message:
            'Invalid verification code format. Only alphanumeric codes (4–32 characters) are accepted.',
        });
        return;
      }

      const codeHash = hashVerificationCode(rawCode);
      const nowIso = new Date().toISOString();

      const result = await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', username);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          return {
            ok: false as const,
            status: 404,
            message: 'User account not found.',
          };
        }

        const userData = userSnap.data();
        if (userData.status === 'INACTIVE') {
          return {
            ok: false as const,
            status: 403,
            message: 'Your account is deactivated. Contact Admin Support.',
          };
        }

        const hashedRef = doc(db, 'verification_codes', codeHash);
        const hashedSnap = await transaction.get(hashedRef);

        const plainRef = doc(db, 'verification_codes', rawCode);
        const plainSnap = hashedSnap.exists() ? null : await transaction.get(plainRef);

        const targetRef = hashedSnap.exists()
          ? hashedRef
          : plainSnap?.exists()
            ? plainRef
            : null;
        const targetSnap = hashedSnap.exists() ? hashedSnap : plainSnap;

        if (!targetRef || !targetSnap || !targetSnap.exists()) {
          return {
            ok: false as const,
            status: 400,
            message:
              'Invalid verification code. Please check the code from Admin Support and try again.',
          };
        }

        const codeData = targetSnap.data();

        if (codeData.active === false) {
          return {
            ok: false as const,
            status: 403,
            message: 'This verification code has been revoked. Please contact Admin Support.',
          };
        }

        if (typeof codeData.expiresAt === 'string' && codeData.expiresAt) {
          const expiryTime = Date.parse(codeData.expiresAt);
          if (!Number.isNaN(expiryTime) && expiryTime <= Date.now()) {
            return {
              ok: false as const,
              status: 410,
              message:
                'This verification code has expired. Please request a new code from Admin Support.',
            };
          }
        }

        const maxUses =
          typeof codeData.maxUses === 'number' && codeData.maxUses > 0 ? codeData.maxUses : 1;
        const currentUsedCount =
          typeof codeData.usedCount === 'number'
            ? codeData.usedCount
            : codeData.used === true
              ? 1
              : 0;

        if (currentUsedCount >= maxUses || codeData.used === true) {
          return {
            ok: false as const,
            status: 409,
            message:
              'This verification code has already been used. Please contact Admin Support for a fresh code.',
          };
        }

        if (!codeData.targetUser || codeData.targetUser !== username) {
          return {
            ok: false as const,
            status: 403,
            message: 'This verification code is not assigned to your account.',
          };
        }

        const redeemedByUsers = Array.isArray(codeData.redeemedByUsers)
          ? (codeData.redeemedByUsers as string[])
          : [];

        const nextUsedCount = currentUsedCount + 1;
        const fullyExhausted = nextUsedCount >= maxUses;

        transaction.update(targetRef, {
          usedCount: nextUsedCount,
          used: fullyExhausted,
          usedBy: username,
          usedAt: nowIso,
          redeemedByUsers: [...redeemedByUsers, username],
        });

        transaction.set(
          userRef,
          {
            passVerified: true,
            verifiedAt: nowIso,
            updatedAt: nowIso,
          },
          { merge: true }
        );

        return {
          ok: true as const,
          status: 200,
          message: `Verification successful! Your Silent Cheats pass is now verified for ${username}.`,
        };
      });

      if (!result.ok) {
        res.status(result.status).json({
          success: false,
          message: result.message,
        });
        return;
      }

      try {
        await addDoc(collection(db, 'session_logs'), {
          username,
          node: 'NODE 01',
          status: 'PASS_VERIFIED',
          timestamp: nowIso,
          createdAt: serverTimestamp(),
        });
      } catch {
        // non-blocking
      }

      await logAdminAction({
        actor: username,
        action: 'PASS_VERIFIED',
        target: username,
        details: `User ${username} completed pass verification via backend code redemption.`,
      });

      res.status(200).json({
        success: true,
        passVerified: true,
        message: result.message,
      });
    } catch (err) {
      console.error('Verification error:', err);
      res.status(500).json({
        success: false,
        message: 'Verification service encountered an unexpected error. Please try again.',
      });
    }
  });

  // ==========================================
  // ADMIN AUTHENTICATION
  // ==========================================

  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const body = req.body as { username?: unknown; password?: unknown };
      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';

      if (!username || !password || username.length > 64 || password.length > 128) {
        res.status(401).json({
          success: false,
          message: 'Invalid admin credentials.',
        });
        return;
      }

      const adminSnap = await getDoc(doc(db, 'admins', username));
      if (!adminSnap.exists()) {
        res.status(401).json({
          success: false,
          message: 'Invalid admin credentials.',
        });
        return;
      }

      const adminData = adminSnap.data();
      if (adminData.active === false || adminData.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Admin account is disabled.',
        });
        return;
      }

      const storedHash = typeof adminData.passwordHash === 'string' ? adminData.passwordHash : '';
      if (!verifyPassword(password, storedHash)) {
        res.status(401).json({
          success: false,
          message: 'Invalid admin credentials.',
        });
        return;
      }

      const token = signSessionToken(username, 'admin', 60 * 60 * 12);
      setSessionCookie(res, 'sc_admin_token', token, 60 * 60 * 12);

      await logAdminAction({
        actor: username,
        action: 'ADMIN_LOGIN',
        target: username,
        details: `Admin ${username} authenticated into the Admin Control Panel.`,
      });

      res.json({
        success: true,
        admin: {
          username,
          role: 'admin',
        },
        token,
      });
    } catch (err) {
      console.error('Admin login error:', err);
      res.status(500).json({
        success: false,
        message: 'Admin authentication service error.',
      });
    }
  });

  app.post('/api/admin/logout', (_req: Request, res: Response) => {
    clearSessionCookie(res, 'sc_admin_token');
    res.json({ success: true });
  });

  app.get('/api/admin/me', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    res.json({
      authenticated: true,
      admin: {
        username: req.adminUser,
        role: 'admin',
      },
    });
  });

  // ==========================================
  // ADMIN: USER MANAGEMENT
  // ==========================================

  app.get('/api/admin/users', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const users = snapshot.docs
        .map((d) => sanitizeUserRecord(d.id, d.data()))
        .sort((a, b) => {
          const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
          const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
          return bTime - aTime;
        });

      res.json({ success: true, users });
    } catch (err) {
      console.error('Fetch users error:', err);
      res.status(500).json({ success: false, message: 'Failed to load users from database.' });
    }
  });

  app.post('/api/admin/users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body as {
        username?: unknown;
        password?: unknown;
        tier?: unknown;
        status?: unknown;
        passVerificationRequired?: unknown;
        passVerified?: unknown;
      };

      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      const tier = typeof body?.tier === 'string' && body.tier.trim() ? body.tier.trim() : 'VIP CLIENT';
      const status = body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const passVerificationRequired =
        body?.passVerificationRequired !== undefined ? Boolean(body.passVerificationRequired) : true;
      const passVerified =
        body?.passVerified !== undefined ? Boolean(body.passVerified) : !passVerificationRequired;

      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
        res.status(400).json({
          success: false,
          message: 'Username must be 3–32 characters (letters, numbers, hyphen, or underscore).',
        });
        return;
      }

      if (password.length < 4 || password.length > 128) {
        res.status(400).json({
          success: false,
          message: 'Password must be between 4 and 128 characters.',
        });
        return;
      }

      const userRef = doc(db, 'users', username);
      const existingSnap = await getDoc(userRef);
      if (existingSnap.exists()) {
        res.status(409).json({
          success: false,
          message: `User "${username}" already exists.`,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const newUserDoc = {
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

      await setDoc(userRef, newUserDoc);

      await logAdminAction({
        actor: req.adminUser || 'ADMIN',
        action: 'USER_CREATED',
        target: username,
        details: `Created user ${username} (Status: ${status}, Pass Required: ${passVerificationRequired}, Verified: ${passVerified}).`,
      });

      res.status(201).json({
        success: true,
        user: sanitizeUserRecord(username, newUserDoc),
      });
    } catch (err) {
      console.error('Create user error:', err);
      res.status(500).json({ success: false, message: 'Failed to create user.' });
    }
  });

  app.patch(
    '/api/admin/users/:username',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const rawParam = req.params.username;
        const currentUsername = (typeof rawParam === 'string' ? rawParam : '').trim();
        if (!currentUsername) {
          res.status(400).json({ success: false, message: 'Target username is required.' });
          return;
        }

        const currentRef = doc(db, 'users', currentUsername);
        const currentSnap = await getDoc(currentRef);
        if (!currentSnap.exists()) {
          res.status(404).json({ success: false, message: `User "${currentUsername}" not found.` });
          return;
        }

        const currentData = currentSnap.data();
        const body = req.body as {
          newUsername?: unknown;
          password?: unknown;
          tier?: unknown;
          status?: unknown;
          passVerificationRequired?: unknown;
          passVerified?: unknown;
        };

        const nextUsername =
          typeof body?.newUsername === 'string' && body.newUsername.trim()
            ? body.newUsername.trim()
            : currentUsername;

        if (!/^[a-zA-Z0-9_-]{3,32}$/.test(nextUsername)) {
          res.status(400).json({
            success: false,
            message:
              'Username must be 3–32 characters (letters, numbers, hyphen, or underscore).',
          });
          return;
        }

        const newPassword = typeof body?.password === 'string' ? body.password : '';
        if (newPassword && (newPassword.length < 4 || newPassword.length > 128)) {
          res.status(400).json({
            success: false,
            message: 'New password must be between 4 and 128 characters.',
          });
          return;
        }

        if (nextUsername !== currentUsername) {
          const targetCheck = await getDoc(doc(db, 'users', nextUsername));
          if (targetCheck.exists()) {
            res.status(409).json({
              success: false,
              message: `Cannot rename: username "${nextUsername}" already exists.`,
            });
            return;
          }
        }

        const nowIso = new Date().toISOString();
        const nextStatus =
          body?.status === 'ACTIVE' || body?.status === 'INACTIVE'
            ? body.status
            : currentData.status || 'ACTIVE';
        const nextTier =
          typeof body?.tier === 'string' && body.tier.trim()
            ? body.tier.trim()
            : currentData.tier || 'VIP CLIENT';
        const nextPassRequired =
          body?.passVerificationRequired !== undefined
            ? Boolean(body.passVerificationRequired)
            : Boolean(currentData.passVerificationRequired);
        const nextPassVerified =
          body?.passVerified !== undefined
            ? Boolean(body.passVerified)
            : Boolean(currentData.passVerified);

        const updatedDocData = {
          ...currentData,
          username: nextUsername,
          passwordHash: newPassword ? hashPassword(newPassword) : currentData.passwordHash,
          tier: nextTier,
          status: nextStatus,
          passVerificationRequired: nextPassRequired,
          passVerified: nextPassVerified,
          verifiedAt: nextPassVerified ? currentData.verifiedAt || nowIso : null,
          updatedAt: nowIso,
        };

        if (nextUsername !== currentUsername) {
          await setDoc(doc(db, 'users', nextUsername), updatedDocData);
          await deleteDoc(currentRef);

          // Update any verification codes assigned to old username
          try {
            const assignedCodes = await getDocs(
              query(collection(db, 'verification_codes'), where('targetUser', '==', currentUsername))
            );
            for (const codeDoc of assignedCodes.docs) {
              await updateDoc(codeDoc.ref, { targetUser: nextUsername });
            }
          } catch {
            // best-effort code migration
          }
        } else {
          await setDoc(currentRef, updatedDocData, { merge: true });
        }

        const changeNotes: string[] = [];
        if (nextUsername !== currentUsername) changeNotes.push(`Renamed ${currentUsername} -> ${nextUsername}`);
        if (newPassword) changeNotes.push('Password updated');
        if (nextStatus !== currentData.status) changeNotes.push(`Status -> ${nextStatus}`);
        if (nextPassRequired !== currentData.passVerificationRequired) {
          changeNotes.push(`Pass Required -> ${nextPassRequired}`);
        }
        if (nextPassVerified !== currentData.passVerified) {
          changeNotes.push(`Pass Status -> ${nextPassVerified ? 'VERIFIED' : 'NOT VERIFIED'}`);
        }

        await logAdminAction({
          actor: req.adminUser || 'ADMIN',
          action:
            nextStatus !== currentData.status && changeNotes.length === 1
              ? 'USER_STATUS_CHANGED'
              : 'USER_UPDATED',
          target: nextUsername,
          details: changeNotes.length > 0 ? changeNotes.join('; ') : `Updated profile for ${nextUsername}.`,
        });

        res.json({
          success: true,
          user: sanitizeUserRecord(nextUsername, updatedDocData),
        });
      } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ success: false, message: 'Failed to update user.' });
      }
    }
  );

  app.delete(
    '/api/admin/users/:username',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const rawParam = req.params.username;
        const username = (typeof rawParam === 'string' ? rawParam : '').trim();
        if (!username) {
          res.status(400).json({ success: false, message: 'Username is required.' });
          return;
        }

        const userRef = doc(db, 'users', username);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          res.status(404).json({ success: false, message: `User "${username}" not found.` });
          return;
        }

        await deleteDoc(userRef);

        await logAdminAction({
          actor: req.adminUser || 'ADMIN',
          action: 'USER_DELETED',
          target: username,
          details: `Deleted user account ${username}.`,
        });

        res.json({ success: true });
      } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete user.' });
      }
    }
  );

  // ==========================================
  // ADMIN: PASS VERIFICATION CODE MANAGEMENT
  // ==========================================

  app.get('/api/admin/codes', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const snapshot = await getDocs(collection(db, 'verification_codes'));
      const now = Date.now();

      const codes = snapshot.docs
        .map((d) => {
          const data = d.data();
          const maxUses = typeof data.maxUses === 'number' && data.maxUses > 0 ? data.maxUses : 1;
          const usedCount =
            typeof data.usedCount === 'number'
              ? data.usedCount
              : data.used === true
                ? 1
                : 0;
          const expiresAt = typeof data.expiresAt === 'string' ? data.expiresAt : null;
          const isExpired = Boolean(expiresAt && Date.parse(expiresAt) <= now);
          const isRevoked = data.active === false;
          const isUsed = usedCount >= maxUses || data.used === true;

          let codeStatus: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED' = 'ACTIVE';
          if (isRevoked) codeStatus = 'REVOKED';
          else if (isUsed) codeStatus = 'USED';
          else if (isExpired) codeStatus = 'EXPIRED';

          return {
            id: d.id,
            code:
              typeof data.codeValue === 'string'
                ? data.codeValue
                : typeof data.codeLabel === 'string'
                  ? data.codeLabel
                  : d.id.slice(0, 12),
            isFullCodeVisible: typeof data.codeValue === 'string',
            targetUser: typeof data.targetUser === 'string' ? data.targetUser : 'UNASSIGNED',
            maxUses,
            usedCount,
            usedBy: typeof data.usedBy === 'string' ? data.usedBy : null,
            usedAt: typeof data.usedAt === 'string' ? data.usedAt : null,
            expiresAt,
            active: !isRevoked,
            status: codeStatus,
            createdBy: typeof data.createdBy === 'string' ? data.createdBy : 'ADMIN',
            createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
            revokedAt: typeof data.revokedAt === 'string' ? data.revokedAt : null,
          };
        })
        .sort((a, b) => {
          const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
          const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
          return bTime - aTime;
        });

      res.json({ success: true, codes });
    } catch (err) {
      console.error('Fetch codes error:', err);
      res.status(500).json({ success: false, message: 'Failed to load verification codes.' });
    }
  });

  app.post('/api/admin/codes', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body as {
        targetUser?: unknown;
        customCode?: unknown;
        maxUses?: unknown;
        expiresInHours?: unknown;
      };

      const targetUser = typeof body?.targetUser === 'string' ? body.targetUser.trim() : '';
      if (!targetUser) {
        res.status(400).json({
          success: false,
          message: 'Please select a target user to assign this verification code to.',
        });
        return;
      }

      const userSnap = await getDoc(doc(db, 'users', targetUser));
      if (!userSnap.exists()) {
        res.status(404).json({
          success: false,
          message: `Assigned user "${targetUser}" does not exist.`,
        });
        return;
      }

      let plainCode =
        typeof body?.customCode === 'string' && body.customCode.trim()
          ? body.customCode.trim().toUpperCase()
          : generateUniqueCode('SC200');

      if (!/^[A-Z0-9]{4,32}$/.test(plainCode)) {
        res.status(400).json({
          success: false,
          message: 'Verification code must be 4–32 alphanumeric characters (A-Z, 0-9).',
        });
        return;
      }

      const maxUsesNum = Number(body?.maxUses ?? 1);
      const maxUses =
        Number.isFinite(maxUsesNum) && maxUsesNum >= 1 && maxUsesNum <= 1000
          ? Math.floor(maxUsesNum)
          : 1;

      let expiresAt: string | null = null;
      if (body?.expiresInHours !== undefined && body.expiresInHours !== null && body.expiresInHours !== '') {
        const hours = Number(body.expiresInHours);
        if (!Number.isFinite(hours) || hours <= 0 || hours > 8760) {
          res.status(400).json({
            success: false,
            message: 'Expiry hours must be between 1 and 8760 (1 year).',
          });
          return;
        }
        expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      }

      const codeHash = hashVerificationCode(plainCode);
      const codeRef = doc(db, 'verification_codes', codeHash);
      const existingCode = await getDoc(codeRef);

      if (existingCode.exists()) {
        if (typeof body?.customCode === 'string' && body.customCode.trim()) {
          res.status(409).json({
            success: false,
            message: 'That custom code already exists. Please choose a different code.',
          });
          return;
        }
        plainCode = generateUniqueCode('SC200');
      }

      const finalHash = hashVerificationCode(plainCode);
      const nowIso = new Date().toISOString();
      const docPayload = {
        codeHash: finalHash,
        codeValue: plainCode,
        codeLabel: plainCode,
        targetUser,
        maxUses,
        usedCount: 0,
        used: false,
        usedBy: null,
        usedAt: null,
        redeemedByUsers: [],
        active: true,
        amount: 200,
        expiresAt,
        createdBy: req.adminUser || 'ADMIN',
        createdAt: nowIso,
      };

      await setDoc(doc(db, 'verification_codes', finalHash), docPayload);

      await logAdminAction({
        actor: req.adminUser || 'ADMIN',
        action: 'CODE_GENERATED',
        target: targetUser,
        details: `Generated code ${plainCode.slice(0, 4)}*** assigned to ${targetUser} (Max Uses: ${maxUses}${expiresAt ? `, Expires: ${expiresAt}` : ', No Expiry'}).`,
      });

      res.status(201).json({
        success: true,
        code: {
          id: finalHash,
          code: plainCode,
          isFullCodeVisible: true,
          targetUser,
          maxUses,
          usedCount: 0,
          usedBy: null,
          usedAt: null,
          expiresAt,
          active: true,
          status: 'ACTIVE',
          createdBy: docPayload.createdBy,
          createdAt: nowIso,
          revokedAt: null,
        },
      });
    } catch (err) {
      console.error('Generate code error:', err);
      res.status(500).json({ success: false, message: 'Failed to generate verification code.' });
    }
  });

  app.patch(
    '/api/admin/codes/:codeId/revoke',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const rawParam = req.params.codeId;
        const codeId = (typeof rawParam === 'string' ? rawParam : '').trim();
        if (!codeId) {
          res.status(400).json({ success: false, message: 'Code ID is required.' });
          return;
        }

        const codeRef = doc(db, 'verification_codes', codeId);
        const snap = await getDoc(codeRef);
        if (!snap.exists()) {
          res.status(404).json({ success: false, message: 'Verification code not found.' });
          return;
        }

        const data = snap.data();
        const nowIso = new Date().toISOString();
        await updateDoc(codeRef, {
          active: false,
          revokedAt: nowIso,
          revokedBy: req.adminUser || 'ADMIN',
        });

        await logAdminAction({
          actor: req.adminUser || 'ADMIN',
          action: 'CODE_REVOKED',
          target: typeof data.targetUser === 'string' ? data.targetUser : codeId,
          details: `Revoked verification code ${typeof data.codeLabel === 'string' ? data.codeLabel : codeId.slice(0, 8)} (assigned to ${data.targetUser || 'N/A'}).`,
        });

        res.json({ success: true });
      } catch (err) {
        console.error('Revoke code error:', err);
        res.status(500).json({ success: false, message: 'Failed to revoke verification code.' });
      }
    }
  );

  app.delete(
    '/api/admin/codes/:codeId',
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const rawParam = req.params.codeId;
        const codeId = (typeof rawParam === 'string' ? rawParam : '').trim();
        if (!codeId) {
          res.status(400).json({ success: false, message: 'Code ID is required.' });
          return;
        }

        const codeRef = doc(db, 'verification_codes', codeId);
        const snap = await getDoc(codeRef);
        if (!snap.exists()) {
          res.status(404).json({ success: false, message: 'Verification code not found.' });
          return;
        }

        const data = snap.data();
        await deleteDoc(codeRef);

        await logAdminAction({
          actor: req.adminUser || 'ADMIN',
          action: 'CODE_DELETED',
          target: typeof data.targetUser === 'string' ? data.targetUser : codeId,
          details: `Deleted verification code record ${typeof data.codeLabel === 'string' ? data.codeLabel : codeId.slice(0, 8)}.`,
        });

        res.json({ success: true });
      } catch (err) {
        console.error('Delete code error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete verification code.' });
      }
    }
  );

  // ==========================================
  // ADMIN: AUDIT LOGS
  // ==========================================

  app.get('/api/admin/logs', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const logsQuery = query(
        collection(db, 'admin_logs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(logsQuery);
      const logs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      res.json({ success: true, logs });
    } catch {
      // Fallback if index/orderBy fails on empty collection
      try {
        const snapshot = await getDocs(collection(db, 'admin_logs'));
        const logs = snapshot.docs
          .map((d): Record<string, unknown> & { id: string } => ({
            id: d.id,
            ...(d.data() as Record<string, unknown>),
          }))
          .sort((a, b) => {
            const aTime = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
            const bTime = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
            return bTime - aTime;
          })
          .slice(0, 100);
        res.json({ success: true, logs });
      } catch (err) {
        console.error('Fetch logs error:', err);
        res.status(500).json({ success: false, message: 'Failed to load audit logs.' });
      }
    }
  });

  return app;
}
