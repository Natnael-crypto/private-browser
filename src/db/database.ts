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

        CREATE TABLE IF NOT EXISTS custom_lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT,
          source TEXT,
          content BLOB,
          updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          source_page_url TEXT NOT NULL,
          frame_url TEXT,
          media_url TEXT NOT NULL,
          title TEXT,
          format TEXT,
          resolution TEXT,
          size_bytes INTEGER,
          protected INTEGER DEFAULT 0,
          thumbnail TEXT,
          detected_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS downloads (
          id TEXT PRIMARY KEY,
          video_id TEXT REFERENCES videos(id) ON DELETE CASCADE,
          state TEXT NOT NULL,
          bytes_done INTEGER DEFAULT 0,
          segments_done INTEGER DEFAULT 0,
          segments_total INTEGER DEFAULT 0,
          temp_name TEXT NOT NULL,
          headers_json TEXT,
          file_uri TEXT,
          final_name TEXT,
          error TEXT,
          started_at INTEGER NOT NULL,
          completed_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS proxy_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          host TEXT NOT NULL,
          port INTEGER NOT NULL,
          username TEXT,
          password TEXT,
          active INTEGER DEFAULT 0,
          fail_closed INTEGER DEFAULT 0,
          bypass_list TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS vpn_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          kind TEXT NOT NULL,
          config TEXT NOT NULL,
          username TEXT,
          password TEXT,
          kill_switch INTEGER DEFAULT 0,
          auto_connect INTEGER DEFAULT 0,
          active INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL,
          last_used INTEGER
        );

        CREATE TABLE IF NOT EXISTS site_settings (
          host TEXT PRIMARY KEY,
          js INTEGER,
          ua_mode TEXT,
          ua_value TEXT,
          images INTEGER,
          third_party_scripts INTEGER,
          fp_protection INTEGER,
          blocker INTEGER,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS site_permissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          host TEXT NOT NULL,
          permission TEXT NOT NULL,
          decision TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          UNIQUE(host, permission)
        );
      `);

      this.initialized = true;
    } catch (e) {
      console.warn('Database init fallback for non-native web/mock environments:', e);
    }
  }

  // --- Settings ---
  public async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    await this.init();
    if (!this.db) return defaultValue;
    try {
      const row = await this.db.getFirstAsync<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?;',
        [key]
      );
      return row ? row.value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  public async setSetting(key: string, value: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);',
      [key, value]
    );
  }

  // --- Allowlist ---
  public async isHostAllowed(host: string): Promise<boolean> {
    await this.init();
    if (!this.db) return false;
    const row = await this.db.getFirstAsync<{ host: string }>(
      'SELECT host FROM allowlist WHERE host = ?;',
      [host.toLowerCase()]
    );
    return !!row;
  }

  public async addHostToAllowlist(host: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      'INSERT OR IGNORE INTO allowlist (host, added_at) VALUES (?, ?);',
      [host.toLowerCase(), Date.now()]
    );
  }

  public async removeHostFromAllowlist(host: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      'DELETE FROM allowlist WHERE host = ?;',
      [host.toLowerCase()]
    );
  }

  // --- Bookmarks (WEB-15) ---
  public async getBookmarks(): Promise<BookmarkRecord[]> {
    await this.init();
    if (!this.db) return [];
    return await this.db.getAllAsync<BookmarkRecord>(
      'SELECT * FROM bookmarks ORDER BY added_at DESC;'
    );
  }

  public async addBookmark(url: string, title: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      'INSERT INTO bookmarks (url, title, added_at) VALUES (?, ?, ?);',
      [url, title, Date.now()]
    );
  }

  public async deleteBookmark(id: number): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync('DELETE FROM bookmarks WHERE id = ?;', [id]);
  }

  // --- Videos (VID-1 to VID-9, SEC-4, SEC-5) ---
  public async saveVideo(video: VideoRecord): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO videos (
        id, source_page_url, frame_url, media_url, title,
        format, resolution, size_bytes, protected, thumbnail, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        video.id,
        video.source_page_url,
        video.frame_url ?? null,
        video.media_url,
        video.title,
        video.format ?? null,
        video.resolution ?? null,
        video.size_bytes ?? 0,
        video.protected,
        video.thumbnail ?? null,
        video.detected_at,
      ]
    );
  }

  public async getVideo(id: string): Promise<VideoRecord | null> {
    await this.init();
    if (!this.db) return null;
    return await this.db.getFirstAsync<VideoRecord>(
      'SELECT * FROM videos WHERE id = ?;',
      [id]
    );
  }

  public async updateVideoThumbnail(videoId: string, thumbnailUri: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      'UPDATE videos SET thumbnail = ? WHERE id = ?;',
      [thumbnailUri, videoId]
    );
  }

  // --- Downloads (DL-1 to DL-11, SEC-3, SEC-5) ---
  public async saveDownload(dl: DownloadRecord): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO downloads (
        id, video_id, state, bytes_done, segments_done, segments_total,
        temp_name, headers_json, file_uri, final_name, error, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        dl.id,
        dl.video_id,
        dl.state,
        dl.bytes_done,
        dl.segments_done,
        dl.segments_total,
        dl.temp_name,
        dl.headers_json ?? null,
        dl.file_uri ?? null,
        dl.final_name ?? null,
        dl.error ?? null,
        dl.started_at,
        dl.completed_at ?? null,
      ]
    );
  }

  public async createDownload(dl: DownloadRecord): Promise<void> {
    return this.saveDownload(dl);
  }

  public async updateDownloadProgress(
    id: string,
    bytesDone: number,
    segmentsDone: number,
    segmentsTotal: number
  ): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.runAsync(
      'UPDATE downloads SET bytes_done = ?, segments_done = ?, segments_total = ? WHERE id = ?;',