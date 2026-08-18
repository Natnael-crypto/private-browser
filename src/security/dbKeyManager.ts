import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY_STORAGE = 'pb_db_encryption_key_v1';
const DB_WRAPPED_KEY_STORAGE = 'pb_db_wrapped_key_v1';
const DB_KDF_SALT_STORAGE = 'pb_db_kdf_salt_v1';

/**
 * DB Key Manager (SEC-1, SEC-7)
 * Generates and stores a cryptographically secure 256-bit database encryption key
 * in hardware-backed SecureStore, optionally wrapped with user master password KDF.
 */
export class DbKeyManager {
  private static cachedKey: string | null = null;

  /**
   * Derive a 256-bit hex key from a password using repeated SHA-256 hashing (KDF)
   */
  public static async deriveKeyFromPassword(password: string, salt: string, iterations = 10000): Promise<string> {
    let current = `${password}:${salt}`;
    for (let i = 0; i < iterations; i++) {
      current = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, current);
    }
    return current;
  }

  /**
   * Get or create the database encryption key as a 64-char (256-bit) hexadecimal string
   */
  public static async getOrCreateDbKey(): Promise<string> {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    try {
      const stored = await SecureStore.getItemAsync(DB_KEY_STORAGE);
      if (stored && stored.length === 64) {
        this.cachedKey = stored;
        return stored;
      }
    } catch {
      // SecureStore may fail in test environments
    }

    // Generate random 256-bit key (32 bytes)
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    let hex = '';
    for (let i = 0; i < randomBytes.length; i++) {
      hex += randomBytes[i].toString(16).padStart(2, '0');
    }

    try {
      await SecureStore.setItemAsync(DB_KEY_STORAGE, hex);
    } catch {
      // Best-effort in non-native or mocked environments
    }

    this.cachedKey = hex;
    return hex;
  }

  /**
   * Wrap database key with master password on password setup / change
   */
  public static async wrapKeyWithPassword(password: string): Promise<void> {
    const rawKey = await this.getOrCreateDbKey();
    const salt = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `db-salt-${Date.now()}-${Math.random()}`
    );
    const derived = await this.deriveKeyFromPassword(password, salt, 10000);

    // XOR rawKey with derived key to produce wrapped ciphertext
    let wrapped = '';
    for (let i = 0; i < 64; i += 2) {
      const b1 = parseInt(rawKey.substring(i, i + 2), 16);
      const b2 = parseInt(derived.substring(i, i + 2), 16);
      wrapped += (b1 ^ b2).toString(16).padStart(2, '0');
    }

    try {
      await SecureStore.setItemAsync(DB_KDF_SALT_STORAGE, salt);
      await SecureStore.setItemAsync(DB_WRAPPED_KEY_STORAGE, wrapped);
    } catch {}
  }

  /**
   * Reset / clear cached key on wipe
   */
  public static async clearKey(): Promise<void> {
    this.cachedKey = null;
    try {
      await SecureStore.deleteItemAsync(DB_KEY_STORAGE);
      await SecureStore.deleteItemAsync(DB_WRAPPED_KEY_STORAGE);
      await SecureStore.deleteItemAsync(DB_KDF_SALT_STORAGE);
    } catch {}
  }
}
