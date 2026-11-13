import crypto from 'node:crypto';
import { firebaseConfig } from './firebase.ts';

export function getServerKey(): Buffer {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return crypto.createHash('sha256').update(envSecret).digest();
  }
  return crypto
    .createHmac('sha256', 'silent-cheats-server-key-v1')
    .update(`${firebaseConfig.apiKey}:${firebaseConfig.projectId}:${firebaseConfig.firestoreDatabaseId}`)
    .digest();
}

export function isScryptHash(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!plain || !stored) return false;
  if (!isScryptHash(stored)) {
    return false;
  }
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;

  try {
    const derived = crypto.scryptSync(plain, salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function maskVerificationCode(code: string): string {
  const clean = code.trim().toUpperCase();
  if (clean.length <= 6) {
    return `${clean.slice(0, 2)}••••`;
  }
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

export function generateUniqueCode(prefix = 'SC200'): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < bytes.length; i += 1) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `${prefix}${suffix}`;
}

export function encryptVerificationCode(plainCode: string): string {
  const key = getServerKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainCode.trim().toUpperCase(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`;
}

export function decryptVerificationCode(cipherText: string): string | null {
  try {
    const parts = cipherText.split('.');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, dataHex] = parts;
    const key = getServerKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export interface SessionTokenPayload {
  username: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
}

export function signSessionToken(
  username: string,
  role: 'admin' | 'user',
  ttlSeconds: number
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    username,
    role,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getServerKey())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, sig] = parts;
  if (!encodedPayload || !sig) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', getServerKey())
      .update(encodedPayload)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionTokenPayload;

    if (!decoded || !decoded.username || !decoded.role || !decoded.exp) {
      return null;
    }
    if (decoded.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
