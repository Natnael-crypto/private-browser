import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { DbKeyManager } from './dbKeyManager';
import { WipeService } from './wipeService';

const STORAGE_KEYS = {
  MASTER_HASH: 'pb_master_pwd_hash',
  SALT: 'pb_master_salt',
  DURESS_HASH: 'pb_duress_pwd_hash',
  BIOMETRIC_ENABLED: 'pb_biometric_enabled',
  AUTO_LOCK_TIMEOUT: 'pb_auto_lock_timeout', // '0' (immediately), '60' (1m), '300' (5m), '900' (15m), '-1' (never)
  MAX_FAILED_ATTEMPTS: 'pb_max_failed_attempts', // '0' (never), '5', '10'
};

export class LockManager {
  private static failedAttempts = 0;
  private static lockedUntil = 0;
  private static lastActiveTime = Date.now();

  /**
   * Check if a master password has already been configured
   */
  public static async isPasswordSet(): Promise<boolean> {
    try {
      const hash = await SecureStore.getItemAsync(STORAGE_KEYS.MASTER_HASH);
      return !!hash;
    } catch {
      return false;
    }
  }

  /**
   * Setup password for first run (SEC-2)
   */
  public static async setMasterPassword(password: string): Promise<boolean> {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    try {
      const salt = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${Date.now()}-${Math.random()}`
      );

      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${password}:${salt}`
      );

      await SecureStore.setItemAsync(STORAGE_KEYS.SALT, salt);
      await SecureStore.setItemAsync(STORAGE_KEYS.MASTER_HASH, hash);
      // Wrap database key with master password KDF (SEC-1, SEC-7)
      await DbKeyManager.wrapKeyWithPassword(password);
      this.failedAttempts = 0;
      this.lockedUntil = 0;
      return true;
    } catch (e) {
      console.error('Failed to store password', e);
      return false;
    }
  }

  /**
   * Setup duress password (LCK-3)
   * When entered on lock screen, silently executes full wipe and unlocks empty app
   */
  public static async setDuressPassword(password: string): Promise<boolean> {
    if (!password || password.length < 6) {
      throw new Error('Duress password must be at least 6 characters long.');
    }

    try {
      const salt = (await SecureStore.getItemAsync(STORAGE_KEYS.SALT)) || 'duress_salt';
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${password}:${salt}`
      );
      await SecureStore.setItemAsync(STORAGE_KEYS.DURESS_HASH, hash);
      return true;
    } catch {
      return false;
    }
  }

  public static async isDuressPasswordSet(): Promise<boolean> {
    try {
      const hash = await SecureStore.getItemAsync(STORAGE_KEYS.DURESS_HASH);
      return !!hash;
    } catch {
      return false;
    }
  }

  public static async removeDuressPassword(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.DURESS_HASH);
    } catch {}
  }

  public static async getMaxFailedAttempts(): Promise<number> {
    try {
      const val = await SecureStore.getItemAsync(STORAGE_KEYS.MAX_FAILED_ATTEMPTS);
      return val ? parseInt(val, 10) : 5;
    } catch {
      return 5;
    }
  }

  public static async setMaxFailedAttempts(max: number): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.MAX_FAILED_ATTEMPTS, String(max));
  }

  /**
   * Verify entered password with increasing backoff delay on failures and duress wipe
   */
  public static async verifyPassword(password: string): Promise<{
    success: boolean;
    backoffSec?: number;
    error?: string;
    duressTriggered?: boolean;
    wiped?: boolean;
  }> {
    const now = Date.now();
    if (this.lockedUntil > now) {
      const remainingSec = Math.ceil((this.lockedUntil - now) / 1000);
      return { success: false, backoffSec: remainingSec, error: `Too many attempts. Try again in ${remainingSec}s.` };
    }

    try {
      const storedHash = await SecureStore.getItemAsync(STORAGE_KEYS.MASTER_HASH);
      const salt = await SecureStore.getItemAsync(STORAGE_KEYS.SALT);
      const duressHash = await SecureStore.getItemAsync(STORAGE_KEYS.DURESS_HASH);

      if (!storedHash || !salt) {
        return { success: false, error: 'No master password set.' };
      }

      const inputHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${password}:${salt}`
      );

      // Check Duress Password (LCK-3)
      if (duressHash && inputHash === duressHash) {
        await this.fullDataWipe();
        return { success: true, duressTriggered: true };
      }

      if (inputHash === storedHash) {
        this.failedAttempts = 0;
        this.lockedUntil = 0;
        this.lastActiveTime = Date.now();
        return { success: true };
      } else {
        this.failedAttempts++;

        // Check Max Failed Attempts wipe (LCK-4)
        const maxAttempts = await this.getMaxFailedAttempts();
        if (maxAttempts > 0 && this.failedAttempts >= maxAttempts) {
          await this.fullDataWipe();
          return {
            success: false,
            wiped: true,
            error: `Maximum failed attempts reached (${maxAttempts}). All data has been securely erased.`,
          };
        }

        // Backoff delay: 3 attempts -> 5s, 4 -> 15s, 5+ -> 30s
        let delaySec = 0;
        if (this.failedAttempts >= 5) {
          delaySec = 30;
        } else if (this.failedAttempts >= 4) {
          delaySec = 15;
        } else if (this.failedAttempts >= 3) {
          delaySec = 5;
        }

        if (delaySec > 0) {
          this.lockedUntil = Date.now() + delaySec * 1000;
          return { success: false, backoffSec: delaySec, error: `Incorrect password. Locked for ${delaySec}s.` };
        }

        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Verification error' };
    }
  }

  /**
   * Biometric check availability
   */
  public static async canUseBiometrics(): Promise<boolean> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return compatible && enrolled;
    } catch {
      return false;
    }
  }

  /**
   * Authenticate via Biometrics (Fingerprint / Face ID)
   */
  public static async authenticateBiometrics(): Promise<boolean> {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Private Browser',
        fallbackLabel: 'Use master password',
        disableDeviceFallback: false,
      });
      if (res.success) {
        this.failedAttempts = 0;
        this.lockedUntil = 0;
        this.lastActiveTime = Date.now();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Biometric toggle state in settings
   */
  public static async isBiometricEnabled(): Promise<boolean> {
    try {
      const val = await SecureStore.getItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED);
      return val !== 'false'; // default true if enrolled
    } catch {
      return true;
    }
  }

  public static async setBiometricEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
  }

  /**
   * Auto-lock timeout in seconds
   */
  public static async getAutoLockTimeout(): Promise<string> {
    try {
      const val = await SecureStore.getItemAsync(STORAGE_KEYS.AUTO_LOCK_TIMEOUT);
      return val || '0'; // default Immediately
    } catch {
      return '0';
    }
  }

  public static async setAutoLockTimeout(timeoutSec: string): Promise<void> {