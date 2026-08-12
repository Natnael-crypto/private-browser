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