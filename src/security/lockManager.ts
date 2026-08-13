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
