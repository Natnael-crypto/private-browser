import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { db } from '../db/database';
import { DbKeyManager } from './dbKeyManager';
import { useBrowserStore } from '../browser/browserStore';

const SECURE_STORE_KEYS = [
  'pb_master_pwd_hash',
  'pb_master_salt',
  'pb_duress_pwd_hash',
  'pb_biometric_enabled',
  'pb_auto_lock_timeout',
  'pb_max_failed_attempts',
];

/**
 * WipeService (SEC-4)
 * Unified wipe service for "Clear everything", panic wipe, duress password entry,
 * and wipe after N failed unlock attempts.