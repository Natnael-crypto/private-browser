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