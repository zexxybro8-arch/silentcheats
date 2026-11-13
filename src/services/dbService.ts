import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  token?: string;
}

export const dbService = {
  // Validate credentials securely through backend API
  async validateUserCredentials(
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        user?: AuthUser;
        message?: string;
      };

      if (!response.ok || !data.success || !data.user) {
        return {
          success: false,
          error: data.message || 'Invalid username or password',
        };
      }

      return {
        success: true,
        user: data.user,
      };
    } catch {
      return {
        success: false,
        error: 'Unable to reach authentication server. Please try again.',
      };
    }
  },

  // Load user configuration from Firestore
  async getUserConfig(username: string): Promise<UserConfig | null> {
    try {
      const configRef = doc(db, 'user_configs', username);
      const snap = await getDoc(configRef);
      if (snap.exists()) {
        return snap.data() as UserConfig;
      }
    } catch {
      // return null to use defaults
    }
    return null;
  },

  // Save user configuration to Firestore
  async saveUserConfig(username: string, config: UserConfig): Promise<void> {
    try {
      const configRef = doc(db, 'user_configs', username);
      await setDoc(
        configRef,
        {
          ...config,
          username,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      // silent fallback
    }
  },
};
