import { localStore, verifyClientPassword } from './localStore';

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

export const dbService = {
  // Validate credentials purely on the client side
  async validateUserCredentials(
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      return { success: false, error: 'Invalid username or password' };
    }

    const users = localStore.getUsers();
    const matched = users.find((u) => u.username === trimmedUser);

    if (!matched) {
      return { success: false, error: 'Invalid username or password' };
    }

    if (matched.status === 'INACTIVE') {
      return {
        success: false,
        error: 'Your account has been deactivated. Contact Admin Support.',
      };
    }

    if (!verifyClientPassword(password, matched.passwordHash)) {
      return { success: false, error: 'Invalid username or password' };
    }

    return {
      success: true,
      user: {
        username: matched.username,
        tier: matched.tier,
        status: matched.status,
        passVerificationRequired: matched.passVerificationRequired,
        passVerified: matched.passVerified,
      },
    };
  },

  // Read live pass & account status from localStore
  getPassStatus(username: string): {
    username: string;
    status: 'ACTIVE' | 'INACTIVE';
    passVerificationRequired: boolean;
    passVerified: boolean;
  } | null {
    const users = localStore.getUsers();
    const found = users.find((u) => u.username === username.trim());
    if (!found) return null;
    return {
      username: found.username,
      status: found.status,
      passVerificationRequired: found.passVerificationRequired,
      passVerified: found.passVerified,
    };
  },

  // Validate and redeem verification code purely on the client side
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

    if (!/^[A-Z0-9]{4,32}$/.test(cleanCode)) {
      return {
        success: false,
        message:
          'Invalid verification code format. Only alphanumeric codes (4–32 characters) are accepted.',
      };
    }

    const users = localStore.getUsers();
    const userIndex = users.findIndex((u) => u.username === cleanUser);
    if (userIndex === -1) {
      return { success: false, message: 'User account not found.' };
    }

    if (users[userIndex].status === 'INACTIVE') {
      return {
        success: false,
        message: 'Your account is deactivated. Contact Admin Support.',
      };
    }

    const codes = localStore.getCodes();
    const codeIndex = codes.findIndex((c) => c.code.toUpperCase() === cleanCode);
    if (codeIndex === -1) {
      return {
        success: false,
        message:
          'Invalid verification code. Please check the code from Admin Support and try again.',
      };
    }

    const codeRecord = codes[codeIndex];

    if (!codeRecord.active) {
      return {
        success: false,
        message: 'This verification code has been revoked. Please contact Admin Support.',
      };
    }

    if (codeRecord.expiresAt) {
      const expiryMs = Date.parse(codeRecord.expiresAt);
      if (!Number.isNaN(expiryMs) && expiryMs <= Date.now()) {
        return {
          success: false,
          message:
            'This verification code has expired. Please request a new code from Admin Support.',
        };
      }
    }

    if (codeRecord.usedCount >= codeRecord.maxUses || codeRecord.used) {
      return {
        success: false,
        message:
          'This verification code has already been used. Please contact Admin Support for a fresh code.',
      };
    }

    if (!codeRecord.targetUser || codeRecord.targetUser !== cleanUser) {
      return {
        success: false,
        message: 'This verification code is not assigned to your account.',
      };
    }

    const nowIso = new Date().toISOString();
    const nextUsedCount = codeRecord.usedCount + 1;
    const exhausted = nextUsedCount >= codeRecord.maxUses;

    codes[codeIndex] = {
      ...codeRecord,
      usedCount: nextUsedCount,
      used: exhausted,
      usedBy: cleanUser,
      usedAt: nowIso,
      redeemedByUsers: [...codeRecord.redeemedByUsers, cleanUser],
    };
    localStore.saveCodes(codes);

    users[userIndex] = {
      ...users[userIndex],
      passVerified: true,
      verifiedAt: nowIso,
      updatedAt: nowIso,
    };
    localStore.saveUsers(users);

    localStore.appendLog({
      actor: cleanUser,
      action: 'PASS_VERIFIED',
      target: cleanUser,
      details: `User ${cleanUser} completed pass verification using assigned code.`,
    });

    return {
      success: true,
      passVerified: true,
      message: `Verification successful! Your Silent Cheats pass is now verified for ${cleanUser}.`,
    };
  },

  // Load user configuration from localStore
  async getUserConfig(username: string): Promise<UserConfig | null> {
    const configs = localStore.getConfigs();
    const cfg = configs[username];
    return cfg ? (cfg as UserConfig) : null;
  },

  // Save user configuration to localStore
  async saveUserConfig(username: string, config: UserConfig): Promise<void> {
    const configs = localStore.getConfigs();
    configs[username] = {
      ...config,
      username,
      updatedAt: new Date().toISOString(),
    };
    localStore.saveConfigs(configs);
  },
};
