import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  limit,
  query,
} from 'firebase/firestore';
import { db, testFirestoreConnection } from './firebase.ts';
import {
  encryptVerificationCode,
  generateUniqueCode,
  hashPassword,
  hashVerificationCode,
  isScryptHash,
  maskVerificationCode,
} from './crypto.ts';

let bootstrapPromise: Promise<void> | null = null;

export interface UserProjectionInput {
  username: string;
  tier?: string;
  status?: string;
  passVerificationRequired?: boolean;
  passVerified?: boolean;
  updatedAt?: string;
}

export async function syncUserStatusProjection(user: UserProjectionInput): Promise<void> {
  const status = user.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const passVerificationRequired = Boolean(user.passVerificationRequired);
  const passVerified = Boolean(user.passVerified);
  await setDoc(
    doc(db, 'user_status', user.username),
    {
      username: user.username,
      tier: user.tier || 'VIP UNLIMITED',
      status,
      passVerificationRequired,
      passVerified,
      updatedAt: user.updatedAt || new Date().toISOString(),
    },
    { merge: true }
  );
}

async function runBootstrap(): Promise<void> {
  await testFirestoreConnection();

  const nowIso = new Date().toISOString();

  // 1. Seed initial Admin account if not already present
  const adminId = (process.env.ADMIN_ID || 'ADMIN551').trim();
  const initialAdminPassword = process.env.ADMIN_PASSWORD || 'ADMIN551';
  const adminRef = doc(db, 'admins', adminId);
  const adminSnap = await getDoc(adminRef);

  if (!adminSnap.exists()) {
    await setDoc(adminRef, {
      username: adminId,
      passwordHash: hashPassword(initialAdminPassword),
      role: 'admin',
      active: true,
      mustChangePassword: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  } else {
    const adminData = adminSnap.data();
    // Upgrade legacy plain-text seed if present
    if (
      typeof adminData.passwordHash === 'string' &&
      !isScryptHash(adminData.passwordHash)
    ) {
      await setDoc(
        adminRef,
        {
          passwordHash: hashPassword(adminData.passwordHash),
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }
  }

  // 2. Seed existing core user accounts without overwriting existing state
  const defaultUsers = [
    {
      username: 'USER-9875',
      defaultSecret: '767902',
      tier: 'VIP UNLIMITED',
      status: 'ACTIVE',
      passVerificationRequired: false,
      passVerified: true,
      verifiedAt: nowIso,
    },
    {
      username: 'USER-81455',
      defaultSecret: '987566',
      tier: 'VIP UNLIMITED',
      status: 'ACTIVE',
      passVerificationRequired: true,
      passVerified: false,
      verifiedAt: null as string | null,
    },
  ];

  for (const seed of defaultUsers) {
    const userRef = doc(db, 'users', seed.username);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const record = {
        username: seed.username,
        passwordHash: hashPassword(seed.defaultSecret),
        tier: seed.tier,
        status: seed.status,
        passVerificationRequired: seed.passVerificationRequired,
        passVerified: seed.passVerified,
        hwidMatched: true,
        protocol: 'KERNEL RING-0',
        verifiedAt: seed.verifiedAt,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDoc(userRef, record);
      await syncUserStatusProjection(record);
    } else {
      const data = snap.data();
      // Upgrade legacy non-scrypt passwords if any exist
      if (typeof data.passwordHash === 'string' && !isScryptHash(data.passwordHash)) {
        await setDoc(
          userRef,
          { passwordHash: hashPassword(data.passwordHash), updatedAt: nowIso },
          { merge: true }
        );
      }
      // Ensure projection doc exists for real-time cross-device sync
      const statusSnap = await getDoc(doc(db, 'user_status', seed.username));
      if (!statusSnap.exists()) {
        await syncUserStatusProjection({
          username: seed.username,
          tier: typeof data.tier === 'string' ? data.tier : seed.tier,
          status: typeof data.status === 'string' ? data.status : seed.status,
          passVerificationRequired:
            typeof data.passVerificationRequired === 'boolean'
              ? data.passVerificationRequired
              : seed.passVerificationRequired,
          passVerified:
            typeof data.passVerified === 'boolean' ? data.passVerified : seed.passVerified,
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso,
        });
      }
    }
  }

  // 3. Backfill user_status projections for any other existing users in Firestore
  const [usersSnap, statusSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'user_status')),
  ]);
  const existingProjectionIds = new Set(statusSnap.docs.map((d) => d.id));

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const uname = typeof data.username === 'string' ? data.username : userDoc.id;
    if (!existingProjectionIds.has(uname)) {
      await syncUserStatusProjection({
        username: uname,
        tier: typeof data.tier === 'string' ? data.tier : 'VIP UNLIMITED',
        status: typeof data.status === 'string' ? data.status : 'ACTIVE',
        passVerificationRequired: Boolean(data.passVerificationRequired),
        passVerified: Boolean(data.passVerified),
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : nowIso,
      });
    }
  }

  // 4. Seed initial single-use verification codes for USER-81455 if none exist yet
  const existingCodesSnap = await getDocs(query(collection(db, 'verification_codes'), limit(1)));
  if (existingCodesSnap.empty) {
    const envCodes = (process.env.PASS_VERIFICATION_CODES || '')
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z0-9]{4,32}$/.test(c));

    const codesToSeed =
      envCodes.length > 0
        ? envCodes
        : Array.from({ length: 5 }, () => generateUniqueCode('SC200'));

    for (const plainCode of codesToSeed) {
      const codeHash = hashVerificationCode(plainCode);
      await setDoc(doc(db, 'verification_codes', codeHash), {
        codeHash,
        codeCipher: encryptVerificationCode(plainCode),
        codeLabel: maskVerificationCode(plainCode),
        targetUser: 'USER-81455',
        used: false,
        usedCount: 0,
        maxUses: 1,
        usedBy: null,
        usedAt: null,
        expiresAt: null,
        active: true,
        amount: 200,
        createdBy: adminId,
        createdAt: nowIso,
        revokedAt: null,
      });
    }
  }
}

export async function ensureBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  return bootstrapPromise;
}
