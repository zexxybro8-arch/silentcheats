import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface UserConfig {
  aimbot: boolean;
  aimbotRage: boolean;
  aimbotSilent: boolean;
  silentTarget: 'BODY' | 'HEAD';
  aimFov: number;
  headshotRate: number;
  safeMode: boolean;
  espState: {
    boxEsp: boolean;
    skeletonTracking: boolean;
    healthBar: boolean;
    distanceDisplay: boolean;
    snaplines: boolean;
  };
  configState: {
    smoothFactor: number;
    fovRadius: number;
    targetBone: string;
    crosshairOverlay: boolean;
    streamProof: boolean;
  };
  selectedMode: string;
}

export interface AuthUser {
  username: string;
  tier: string;
  status?: string;
  passVerificationRequired?: boolean;
  passVerified?: boolean;
}

export interface UserStatusSnapshot {
  username: string;
  tier: string;
  status: 'ACTIVE' | 'INACTIVE';
  passVerificationRequired: boolean;
  passVerified: boolean;
}

export const dbService = {
  // Validate credentials securely against the backend + global Firestore database
  async validateUserCredentials(
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      return { success: false, error: 'Invalid username or password' };
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: trimmedUser, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.user) {
        return {
          success: false,
          error: typeof data?.error === 'string' ? data.error : 'Invalid username or password',
        };
      }

      return {
        success: true,
        user: data.user as AuthUser,
      };
    } catch {
      return {
        success: false,
        error: 'Unable to connect to authentication server. Please check your connection.',
      };
    }
  },

  // Fetch live pass & account status from backend
  async getPassStatus(username: string): Promise<{
    exists: boolean;
    data?: UserStatusSnapshot;
  }> {
    const cleanUser = username.trim();
    if (!cleanUser) return { exists: false };

    try {
      const response = await fetch(
        `/api/pass-status?username=${encodeURIComponent(cleanUser)}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (response.status === 404) {
        return { exists: false };
      }

      if (!response.ok) {
        return { exists: true };
      }

      const data = (await response.json()) as UserStatusSnapshot;
      return { exists: true, data };
    } catch {
      return { exists: true };
    }
  },

  // Real-time Firestore listener for instant cross-device account & verification synchronization
  subscribeToUserStatus(
    username: string,
    onUpdate: (status: UserStatusSnapshot) => void,
    onMissing?: () => void
  ): () => void {
    const cleanUser = username.trim();
    if (!cleanUser) return () => {};

    const path = `user_status/${cleanUser}`;
    const ref = doc(db, 'user_status', cleanUser);

    return onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          onMissing?.();
          return;
        }
        const raw = snapshot.data();
        onUpdate({
          username: typeof raw.username === 'string' ? raw.username : cleanUser,
          tier: typeof raw.tier === 'string' ? raw.tier : 'VIP UNLIMITED',
          status: raw.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
          passVerificationRequired: Boolean(raw.passVerificationRequired),
          passVerified: Boolean(raw.passVerified),
        });
      },
      (error) => {
        console.warn('User status sync listener warning:', error);
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch {
          // Keep dashboard responsive if rule or transient network error occurs
        }
      }
    );
  },

  // Redeem verification code securely via backend transaction
  async verifyPassCode(
    username: string,
    rawCode: string
  ): Promise<{ success: boolean; passVerified?: boolean; message: string }> {
    const cleanUser = username.trim();
    const cleanCode = rawCode.trim().toUpperCase();

    if (!cleanUser) {
      return { success: false, message: 'Invalid account session. Please sign in again.' };
    }

    if (!cleanCode) {
      return {
        success: false,
        message: 'Please enter your verification code before submitting.',
      };
    }

    try {
      const response = await fetch('/api/verify-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: cleanUser, code: cleanCode }),
      });

      const data = await response.json().catch(() => ({}));
      return {
        success: Boolean(response.ok && data?.success),
        passVerified: Boolean(data?.passVerified),
        message:
          typeof data?.message === 'string'
            ? data.message
            : 'Unable to verify code at this moment. Please try again.',
      };
    } catch {
      return {
        success: false,
        message: 'Network error while verifying code. Please try again.',
      };
    }
  },

  // Load user configuration from Firestore
  async getUserConfig(username: string): Promise<UserConfig | null> {
    const path = `user_configs/${username}`;
    try {
      const snap = await getDoc(doc(db, 'user_configs', username));
      return snap.exists() ? (snap.data() as UserConfig) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  // Save user configuration to Firestore
  async saveUserConfig(username: string, config: UserConfig): Promise<void> {
    const path = `user_configs/${username}`;
    try {
      await setDoc(
        doc(db, 'user_configs', username),
        {
          ...config,
          username,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },
};
