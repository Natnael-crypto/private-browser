import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';
import { db } from '../db/database';
import { DetectedVideoItem } from '../video/videoRegistry';
import { M3U8Parser } from '../video/m3u8Parser';
import { SpeedMeter } from './engine/SpeedMeter';
import { SegmentPool } from './engine/SegmentPool';
import { Fetcher } from './engine/Fetcher';
import { Decryptor } from './engine/Decryptor';
import { SegmentWriter } from './engine/SegmentWriter';
import { DownloadQueue } from './engine/DownloadQueue';

export interface ActiveDownloadItem {
  id: string;
  videoId: string;
  title: string;
  sourceHost: string;
  sourcePageUrl: string;
  progress: number; // 0.0 - 1.0
  statusText: string; // e.g. "92 of 148 MB"
  state: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'canceled';
  totalBytes: number;
  bytesDone: number;
  fileUri?: string;
  thumbnail?: string | null;
  error?: string;
  speedBytesPerSec: number;
  speedText: string;
  etaText: string;
  resolution: string;
  format: string;
  startTime: number;
  videoItem?: DetectedVideoItem;
}

export interface SavedVideoItem {
  id: string;
  videoId: string;
  title: string;
  meta: string; // e.g. "720p · 96 MB · Today"
  source: string; // e.g. "northfield.example"
  sourcePageUrl: string;
  fileUri: string;
  thumbnail?: string | null;
  resolution?: string;
  format?: string;
  sizeBytes?: number;
  completedAt?: number;
}

export class DownloadManager {
  private static activeDownloads: Map<string, ActiveDownloadItem> = new Map();
  private static downloadResumables: Map<string, FileSystem.DownloadResumable> = new Map();
  private static activeAbortControllers: Map<string, AbortController> = new Map();
  private static listeners: Set<() => void> = new Set();
  private static saveDestination: 'downloads' | 'app_private' = 'downloads';
  private static autoRemoveDetails: boolean = false;
  private static MAX_RETRIES = 6;
  private static RETRY_DELAY_MS = 800;

  /**
   * Build proper download headers matching what the reference extension (Video Download Helper) sends.
   */
  private static buildDownloadHeaders(sourcePageUrl: string, video?: DetectedVideoItem): Record<string, string> {
    let origin = '';
    let referer = sourcePageUrl;
    try {
      const u = new URL(sourcePageUrl);
      origin = u.origin;
      referer = sourcePageUrl;
    } catch {}

    const defaultUA =
      Platform.OS === 'android'
        ? 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

    const userAgent = video?.userAgent || defaultUA;

    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
    };

    if (referer) headers['Referer'] = referer;
    if (origin) headers['Origin'] = origin;

    if (video?.cookies && video.cookies.trim()) {
      headers['Cookie'] = video.cookies.trim();
    }

    if (video?.headers) {
      Object.assign(headers, video.headers);
    }

    return headers;
  }

  public static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    listener();
    return () => this.listeners.delete(listener);
  }

  public static async initSettings(): Promise<void> {
    const dest = await db.getSetting('pb_save_destination', 'downloads');
    this.saveDestination = dest === 'app_private' ? 'app_private' : 'downloads';
    const autoRemove = await db.getSetting('pb_auto_remove_details', 'false');
    this.autoRemoveDetails = autoRemove === 'true';
  }

  public static setSaveDestination(dest: 'downloads' | 'app_private'): void {
    this.saveDestination = dest;
    db.setSetting('pb_save_destination', dest);
  }

  public static setAutoRemoveDetails(val: boolean): void {
    this.autoRemoveDetails = val;
    db.setSetting('pb_auto_remove_details', val ? 'true' : 'false');
  }

  public static getSaveDestination(): 'downloads' | 'app_private' {
    return this.saveDestination;
  }

  public static formatSpeed(bytesPerSec: number): string {
    if (!bytesPerSec || bytesPerSec <= 0 || !isFinite(bytesPerSec)) return '0 KB/s';
    const kbps = bytesPerSec / 1024;
    const mbps = (bytesPerSec * 8) / (1024 * 1024);
    if (kbps < 1000) {
      return `${kbps.toFixed(1)} KB/s (${mbps.toFixed(1)} Mbps)`;
    }
    const mb = kbps / 1024;
    return `${mb.toFixed(2)} MB/s (${mbps.toFixed(1)} Mbps)`;
  }

  public static formatEta(seconds: number): string {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '';
    if (seconds < 5) return '< 5s left';
    if (seconds < 60) return `${Math.round(seconds)}s left`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins < 60) {
      return `${mins}m ${secs}s left`;
    }
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m left`;
  }

  public static getActiveDownloads(): ActiveDownloadItem[] {
    return Array.from(this.activeDownloads.values()).filter(
      (d) => d.state === 'downloading' || d.state === 'paused' || d.state === 'queued' || d.state === 'failed'
    );
  }

  public static getTotalSpeed(): number {
    let sum = 0;
    for (const d of this.activeDownloads.values()) {
      if (d.state === 'downloading') {
        sum += d.speedBytesPerSec || 0;