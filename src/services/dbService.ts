import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
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

export const dbService = {
  // Validate credentials against Firestore database
  async validateUserCredentials(username: string, password: string): Promise<{ success: boolean; user?: { username: string; tier: string } }> {
    try {
      const trimmedUser = username.trim();

      // Check against database authorized records
      const userRef = doc(db, 'users', trimmedUser);
      let userSnap = await getDoc(userRef);

      // Bootstrap / seed primary authorized user in Firestore if not existing
      if (!userSnap.exists() && trimmedUser === 'SILENT-81455Y') {
        const initialUserData = {
          username: 'SILENT-81455Y',
          tier: 'VIP CLIENT',
          passwordHash: '987566',
          status: 'ACTIVE',
          hwidMatched: true,
          protocol: 'KERNEL RING-0',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, initialUserData);
        userSnap = await getDoc(userRef);
      }

      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.username === trimmedUser && userData.passwordHash === password) {
          // Record connection log in Firestore
          try {
            await addDoc(collection(db, 'session_logs'), {
              username: trimmedUser,
              node: 'NODE 01',
              status: 'HANDSHAKE_SUCCESS',
              timestamp: new Date().toISOString(),
              createdAt: serverTimestamp()
            });
          } catch {
            // non-blocking
          }

          return {
            success: true,
            user: {
              username: userData.username,
              tier: userData.tier || 'VIP CLIENT'
            }
          };
        }
      }

      // Hardened fallback validation if network or Firestore initialization is cold
      if (trimmedUser === 'SILENT-81455Y' && password === '987566') {
        return {
          success: true,
          user: { username: 'SILENT-81455Y', tier: 'VIP CLIENT' }
        };
      }

      return { success: false };
    } catch {
      // If Firestore connection has a network hiccup, perform strict fallback
      const trimmedUser = username.trim();
      if (trimmedUser === 'SILENT-81455Y' && password === '987566') {
        return {
          success: true,
          user: { username: 'SILENT-81455Y', tier: 'VIP CLIENT' }
        };
      }
      return { success: false };
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
      await setDoc(configRef, {
        ...config,
        username,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch {
      // silent fallback
    }
  }
};
