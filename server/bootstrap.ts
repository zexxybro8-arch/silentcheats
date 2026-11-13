import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, ensureFirestoreConnection } from './firebase.ts';
import { hashPassword, hashVerificationCode, isScryptHash } from './crypto.ts';

const INITIAL_ADMIN_ID = (process.env.ADMIN_ID || process.env.ADMIN_USERNAME || 'ADMIN551').trim();
const INITIAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ADMIN551';

const INITIAL_SPECIAL_CODES: string[] = [
  'SC200PASS81',
  'SC200VIP49K',
  'SC200KEY72M',
  'SC200PRO55X',
  'SC200ACT93Z',
];

let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap(): Promise<void> {
  await ensureFirestoreConnection();
  const nowIso = new Date().toISOString();

  // 1. Ensure initial Admin account exists in Firestore with scrypt-hashed password
  //    and mandatory first-login password change enabled.
  try {
    const adminRef = doc(db, 'admins', INITIAL_ADMIN_ID);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      await setDoc(adminRef, {
        username: INITIAL_ADMIN_ID,
        passwordHash: hashPassword(INITIAL_ADMIN_PASSWORD),
        role: 'admin',
        active: true,
        mustChangePassword: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    } else {
      const existing = adminSnap.data();
      const updates: Record<string, unknown> = {};
      if (typeof existing.passwordHash === 'string' && !isScryptHash(existing.passwordHash)) {
        updates.passwordHash = hashPassword(existing.passwordHash);
      }
      if (existing.mustChangePassword === undefined) {
        updates.mustChangePassword = false;
      }
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = nowIso;
        await setDoc(adminRef, updates, { merge: true });
      }
    }
  } catch (err) {
    console.warn('Bootstrap admin skipped:', err instanceof Error ? err.message : String(err));
  }

  // 2. Ensure default users exist and migrate any legacy plain-text passwords to scrypt hashes
  const defaultUsers = [
    {
      username: 'USER-9875',
      defaultPass: '767902',
      tier: 'VIP CLIENT',
      passVerificationRequired: false,
      passVerified: true,
      status: 'ACTIVE',
    },
    {
      username: 'USER-81455',
      defaultPass: '987566',
      tier: 'VIP CLIENT',
      passVerificationRequired: true,
      passVerified: false,
      status: 'ACTIVE',
    },
  ];

  for (const seedUser of defaultUsers) {
    try {
      const userRef = doc(db, 'users', seedUser.username);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          username: seedUser.username,
          passwordHash: hashPassword(seedUser.defaultPass),
          tier: seedUser.tier,
          status: seedUser.status,
          passVerificationRequired: seedUser.passVerificationRequired,
          passVerified: seedUser.passVerified,
          hwidMatched: true,
          protocol: 'KERNEL RING-0',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      } else {
        const data = userSnap.data();
        const updates: Record<string, unknown> = {};
        if (typeof data.passwordHash === 'string' && !isScryptHash(data.passwordHash)) {
          updates.passwordHash = hashPassword(data.passwordHash);
        }
        if (data.status === undefined) {
          updates.status = 'ACTIVE';
        }
        if (data.passVerificationRequired === undefined) {
          updates.passVerificationRequired = seedUser.passVerificationRequired;
        }
        if (data.passVerified === undefined) {
          updates.passVerified = seedUser.passVerified;
        }
        if (Object.keys(updates).length > 0) {
          updates.updatedAt = nowIso;
          await setDoc(userRef, updates, { merge: true });
        }
      }
    } catch (err) {
      console.warn(
        `Bootstrap user ${seedUser.username} skipped:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // 3. Ensure initial single-use codes for USER-81455 exist by SHA-256 hash
  const envCodes = (process.env.PASS_VERIFICATION_CODES || '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z0-9]{4,32}$/.test(c));

  const allSeedCodes = Array.from(new Set([...INITIAL_SPECIAL_CODES, ...envCodes]));

  for (const plainCode of allSeedCodes) {
    const codeHash = hashVerificationCode(plainCode);
    try {
      const codeRef = doc(db, 'verification_codes', codeHash);
      const codeSnap = await getDoc(codeRef);
      if (!codeSnap.exists()) {
        await setDoc(codeRef, {
          codeHash,
          codeLabel: `${plainCode.slice(0, 4)}****${plainCode.slice(-2)}`,
          used: false,
          usedCount: 0,
          maxUses: 1,
          usedBy: null,
          usedAt: null,
          active: true,
          amount: 200,
          targetUser: 'USER-81455',
          expiresAt: null,
          createdBy: 'SYSTEM',
          createdAt: nowIso,
        });
      }
    } catch (err) {
      console.warn('Bootstrap code skipped:', err instanceof Error ? err.message : String(err));
    }
  }
}

export function ensureBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((err) => {
      bootstrapPromise = null;
      console.error('Bootstrap error:', err);
    });
  }
  return bootstrapPromise;
}
