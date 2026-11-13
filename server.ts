import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  runTransaction,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as FirebaseConfig;

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
    : getFirestore(firebaseApp);

function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

// Server-side-only valid single-use verification codes (never exposed in frontend code)
const SERVER_INITIAL_CODES: string[] = [
  'SC200PASS81',
  'SC200VIP49K',
  'SC200KEY72M',
  'SC200PRO55X',
  'SC200ACT93Z',
];

function getConfiguredCodes(): string[] {
  const envCodes = (process.env.PASS_VERIFICATION_CODES || '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z0-9]{4,32}$/.test(c));

  return Array.from(new Set([...SERVER_INITIAL_CODES, ...envCodes]));
}

// Local fallback state in case Firestore is temporarily unavailable
const fallbackRedeemedHashes = new Set<string>();
const fallbackVerifiedUsers = new Set<string>();

async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

async function seedVerificationCodes(): Promise<void> {
  const codes = getConfiguredCodes();
  for (const plainCode of codes) {
    const codeHash = hashVerificationCode(plainCode);
    try {
      const codeRef = doc(db, 'verification_codes', codeHash);
      const snap = await getDoc(codeRef);
      if (!snap.exists()) {
        await setDoc(codeRef, {
          codeHash,
          used: false,
          usedBy: null,
          usedAt: null,
          active: true,
          amount: 200,
          targetUser: 'USER-81455',
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Unable to seed verification code hash to Firestore:', err instanceof Error ? err.message : String(err));
    }
  }
}

async function startServer(): Promise<void> {
  await testFirestoreConnection();
  await seedVerificationCodes();

  const app = express();
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/pass-status', async (req: Request, res: Response) => {
    const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';
    if (!username) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }

    if (fallbackVerifiedUsers.has(username)) {
      res.json({ username, passVerified: true });
      return;
    }

    try {
      const userSnap = await getDoc(doc(db, 'users', username));
      if (userSnap.exists()) {
        const data = userSnap.data();
        res.json({
          username,
          passVerified: Boolean(data.passVerified),
        });
        return;
      }
      res.json({ username, passVerified: username === 'USER-9875' });
    } catch {
      res.json({ username, passVerified: username === 'USER-9875' });
    }
  });

  app.post('/api/verify-pass', async (req: Request, res: Response) => {
    try {
      const body = req.body as { username?: unknown; code?: unknown };
      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      const rawCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

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
          message: 'Invalid verification code format. Only alphanumeric codes (4–32 characters) are accepted.',
        });
        return;
      }

      const codeHash = hashVerificationCode(rawCode);
      const nowIso = new Date().toISOString();

      try {
        const result = await runTransaction(db, async (transaction) => {
          const hashedRef = doc(db, 'verification_codes', codeHash);
          const hashedSnap = await transaction.get(hashedRef);

          const plainRef = doc(db, 'verification_codes', rawCode);
          const plainSnap = hashedSnap.exists() ? null : await transaction.get(plainRef);

          const targetRef = hashedSnap.exists() ? hashedRef : plainSnap?.exists() ? plainRef : null;
          const targetSnap = hashedSnap.exists() ? hashedSnap : plainSnap;

          if (!targetRef || !targetSnap || !targetSnap.exists()) {
            return {
              ok: false as const,
              status: 400,
              message: 'Invalid verification code. Please check the code from Admin Support and try again.',
            };
          }

          const codeData = targetSnap.data();

          if (codeData.active === false) {
            return {
              ok: false as const,
              status: 403,
              message: 'This verification code has been deactivated. Please contact Admin Support.',
            };
          }

          if (codeData.used === true) {
            return {
              ok: false as const,
              status: 409,
              message: 'This verification code has already been used. Please contact Admin Support for a new unused code.',
            };
          }

          if (codeData.targetUser && codeData.targetUser !== username) {
            return {
              ok: false as const,
              status: 403,
              message: 'This verification code is not assigned to your account.',
            };
          }

          // Mark code as used atomically
          transaction.update(targetRef, {
            used: true,
            usedBy: username,
            usedAt: nowIso,
          });

          // Upgrade user's passVerified status atomically
          const userRef = doc(db, 'users', username);
          transaction.set(
            userRef,
            {
              username,
              passVerified: true,
              verifiedAt: nowIso,
              updatedAt: nowIso,
            },
            { merge: true }
          );

          return {
            ok: true as const,
            status: 200,
            message: 'Pass verification successful! Your Silent Cheats panel is now verified and unlocked.',
          };
        });

        if (!result.ok) {
          res.status(result.status).json({
            success: false,
            message: result.message,
          });
          return;
        }

        fallbackRedeemedHashes.add(codeHash);
        fallbackVerifiedUsers.add(username);

        try {
          await addDoc(collection(db, 'session_logs'), {
            username,
            node: 'NODE 01',
            status: 'PASS_VERIFIED',
            timestamp: nowIso,
            createdAt: serverTimestamp(),
          });
        } catch {
          // non-blocking audit log
        }

        res.status(200).json({
          success: true,
          passVerified: true,
          message: result.message,
        });
        return;
      } catch (firestoreErr) {
        console.error('Firestore verification transaction error:', firestoreErr);

        // Fallback validation against server-configured hashes if Firestore is unreachable
        const configuredHashes = new Set(getConfiguredCodes().map(hashVerificationCode));
        if (!configuredHashes.has(codeHash)) {
          res.status(400).json({
            success: false,
            message: 'Invalid verification code. Please check the code from Admin Support and try again.',
          });
          return;
        }

        if (fallbackRedeemedHashes.has(codeHash)) {
          res.status(409).json({
            success: false,
            message: 'This verification code has already been used. Please contact Admin Support for a new unused code.',
          });
          return;
        }

        fallbackRedeemedHashes.add(codeHash);
        fallbackVerifiedUsers.add(username);

        res.status(200).json({
          success: true,
          passVerified: true,
          message: 'Pass verification successful! Your Silent Cheats panel is now verified and unlocked.',
        });
      }
    } catch {
      res.status(500).json({
        success: false,
        message: 'Verification service encountered an unexpected error. Please try again.',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*path}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Silent Cheats portal server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
