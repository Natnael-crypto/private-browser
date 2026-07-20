import * as SQLite from 'expo-sqlite';
import { DbKeyManager } from '../security/dbKeyManager';

export interface VideoRecord {
  id: string;
  source_page_url: string;
  frame_url?: string | null;
  media_url: string;
  title: string;
  format?: string | null;
  resolution?: string | null;
  size_bytes?: number | null;
  protected: number; // 0 or 1
  thumbnail?: string | null; // base64 or blob URI
  detected_at: number;
}

export interface DownloadRecord {
  id: string;
  video_id: string;
  state: 'queued' | 'probing' | 'downloading' | 'paused' | 'merging' | 'completed' | 'failed' | 'canceled';
  bytes_done: number;
  segments_done: number;
  segments_total: number;
  temp_name: string; // UUID
  headers_json?: string | null;
  file_uri?: string | null;
  final_name?: string | null;
  error?: string | null;
  started_at: number;
  completed_at?: number | null;
}

export interface BookmarkRecord {
  id: number;
  url: string;
  title: string;
  added_at: number;
}

export interface ProxyProfileRecord {
  id: string;
  name: string;
  type: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  active: number; // 0 or 1
  fail_closed: number; // 0 or 1
  bypass_list?: string | null;
  created_at: number;
}

export interface VpnProfileRecord {
  id: string;
  name: string;
  kind: 'openvpn' | 'wireguard';
  config: string;
  username?: string | null;
  password?: string | null;
  kill_switch: number;
  auto_connect: number;
  active: number;
  created_at: number;
  last_used?: number | null;
}

export interface SiteSettingsRecord {
  host: string;
  js: number | null; // 1 = allow, 0 = block, null = default
  ua_mode: string | null;
  ua_value: string | null;
  images: number | null;
  third_party_scripts: number | null;
  fp_protection: number | null;
  blocker: number | null;
  updated_at: number;
}

export interface SitePermissionRecord {
  id: number;
  host: string;
  permission: string; // 'camera' | 'microphone' | 'geolocation' | 'clipboard'
  decision: 'allow' | 'deny';
  created_at: number;
}

class AppDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized && this.db) return;

    try {
      this.db = await SQLite.openDatabaseAsync('private_browser.db');

      // Set SQLCipher encryption key (SEC-1)
      try {
        const encryptionKey = await DbKeyManager.getOrCreateDbKey();
        await this.db.execAsync(`PRAGMA key = "x'${encryptionKey}'";`);
      } catch (keyErr) {
        // Fallback for non-SQLCipher environments (e.g. standard SQLite in Expo Go / mock)
        console.warn('SQLCipher PRAGMA key not applied or running in standard SQLite:', keyErr);
      }

      // Enable foreign keys and secure delete (SEC-1, Section 6)
      await this.db.execAsync(`
        PRAGMA foreign_keys = ON;
        PRAGMA secure_delete = ON;
        
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS allowlist (
          host TEXT PRIMARY KEY,
          added_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          title TEXT NOT NULL,
          added_at INTEGER NOT NULL
        );