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
      }
    }
    return sum;
  }

  public static async retryDownload(id: string): Promise<void> {
    const item = this.activeDownloads.get(id);
    if (!item) return;

    item.state = 'downloading';
    item.error = undefined;
    item.progress = 0.05;
    item.statusText = 'Retrying download...';
    item.speedText = 'Connecting...';
    item.etaText = 'Calculating...';
    item.startTime = Date.now();
    this.notify();

    const video = item.videoItem || {
      id: item.videoId,
      hash: id,
      mediaUrl: item.fileUri || '',
      sourcePageUrl: item.sourcePageUrl,
      title: item.title,
      format: item.format,
      type: 'direct' as const,
      resolution: item.resolution,
      qualities: [item.resolution],
      audioTracks: [],
      subtitles: [],
      metaFormatted: `${item.format} · ${item.resolution}`,
      protectedStream: false,
      hasDrm: false,
      needsDecrypt: false,
      supportsByteRanges: false,
      detectedAt: Date.now(),
    };

    const isHls = video.format === 'HLS' || video.mediaUrl.includes('.m3u8');
    if (isHls) {
      this.executeHlsDownload(id, video.mediaUrl, item.fileUri || '', item);
    } else {
      this.executeDirectDownload(id, video.mediaUrl, item.fileUri || '', item);
    }
  }

  public static async getSavedVideos(): Promise<SavedVideoItem[]> {
    const records = await db.getDownloads();
    const completed = records.filter((r) => r.state === 'completed' && r.file_uri);

    return completed.map((r) => {
      let host = 'Unknown';
      try {
        if (r.video?.source_page_url) {
          host = new URL(r.video.source_page_url).hostname.replace('www.', '');
        }
      } catch {}

      const bytesDone = r.bytes_done || 0;
      let sizeStr = '0 MB';
      if (bytesDone > 0) {
        const mb = bytesDone / (1024 * 1024);
        sizeStr = mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
      }
      const res = r.video?.resolution || 'Auto';
      const meta = `${res} · ${sizeStr} · Today`;

      return {
        id: r.id,
        videoId: r.video_id,
        title: r.final_name || r.video?.title || 'Saved Video',
        meta,
        source: host,
        sourcePageUrl: r.video?.source_page_url || '',
        fileUri: r.file_uri || '',
        thumbnail: r.video?.thumbnail || null,
        resolution: res,
        format: r.video?.format || 'MP4',
        sizeBytes: bytesDone,
        completedAt: r.completed_at || r.started_at,
      };
    });
  }

  /**
   * Start a download for a detected video (DL-1, DL-4, DL-9, DL-10, SEC-3)
   */
  public static async startDownload(video: DetectedVideoItem): Promise<string> {
    // Check Wi-Fi restriction before starting (DL-4)
    const net = await DownloadQueue.isNetworkAllowed();
    if (!net.allowed) {
      throw new Error(net.reason || 'Wi-Fi Only is enabled. Connect to Wi-Fi to start downloads.');
    }

    const downloadId = Crypto.randomUUID();
    const tempUuid = Crypto.randomUUID();
    const isHls = video.format === 'HLS' || video.mediaUrl.includes('.m3u8');
    const fileExtension = isHls
      ? 'ts'
      : video.format.toLowerCase() === 'webm'
        ? 'webm'
        : 'mp4';
    const tempFileUri = `${FileSystem.documentDirectory}${tempUuid}.${fileExtension}`;

    let host = 'example.com';
    try {
      host = new URL(video.sourcePageUrl).hostname.replace('www.', '');
    } catch {}

    // Section 6.5: Remove 155189248 fake size constant. Total size 0 indicates unknown size.
    const totalBytes = video.sizeBytes && video.sizeBytes > 0 ? video.sizeBytes : 0;
    const activeItem: ActiveDownloadItem = {
      id: downloadId,
      videoId: video.id,
      title: video.title,
      sourceHost: host,
      sourcePageUrl: video.sourcePageUrl,
      progress: 0.05,
      statusText: totalBytes > 0 ? `0 of ${(totalBytes / (1024 * 1024)).toFixed(0)} MB` : 'Connecting...',
      state: 'downloading',
      totalBytes,
      bytesDone: 0,
      fileUri: tempFileUri,
      thumbnail: video.thumbnail || null,
      speedBytesPerSec: 0,
      speedText: 'Connecting...',
      etaText: 'Calculating...',
      resolution: video.resolution || 'Auto',
      format: video.format || 'MP4',
      startTime: Date.now(),
      videoItem: video,
    };

    this.activeDownloads.set(downloadId, activeItem);
    this.notify();

    // DL-10: Write video record to database only when user starts a download
    await db.saveVideo({
      id: video.id,
      source_page_url: video.sourcePageUrl,
      media_url: video.mediaUrl,
      title: video.title,
      format: video.format,
      resolution: video.resolution,
      size_bytes: video.sizeBytes ?? null,
      protected: video.protectedStream ? 1 : 0,
      thumbnail: video.thumbnail ?? null,
      detected_at: video.detectedAt,
    });

    await db.saveDownload({
      id: downloadId,
      video_id: video.id,
      state: 'downloading',
      bytes_done: 0,
      segments_done: 0,
      segments_total: 1,
      temp_name: tempUuid,
      file_uri: tempFileUri,
      final_name: this.cleanFileName(video.title, fileExtension),
      started_at: Date.now(),
    });

    if (isHls) {
      this.executeHlsDownload(downloadId, video.mediaUrl, tempFileUri, activeItem);
    } else {
      this.executeDirectDownload(downloadId, video.mediaUrl, tempFileUri, activeItem);
    }

    return downloadId;
  }

  private static async executeHlsDownload(
    downloadId: string,
    m3u8Url: string,
    destinationUri: string,
    item: ActiveDownloadItem
  ): Promise<void> {
    const abortCtrl = new AbortController();
    this.activeAbortControllers.set(downloadId, abortCtrl);

    try {
      const headers = this.buildDownloadHeaders(item.sourcePageUrl, item.videoItem);
      const resp = await Fetcher.fetchWithRetry(m3u8Url, { headers, signal: abortCtrl.signal });
      if (!resp.ok) throw new Error(`Failed to load HLS playlist: HTTP ${resp.status}`);
      const text = await resp.text();

      const parsed = M3U8Parser.parse(text, m3u8Url);
      let mediaPlaylistUrl = m3u8Url;
      let mediaPlaylistText = text;

      if (parsed.isMaster && parsed.variants.length > 0) {
        let chosenVariant = parsed.variants[0];
        if (item.resolution && item.resolution !== '---' && item.resolution !== 'Auto') {
          const match = parsed.variants.find((v) => v.qualityLabel === item.resolution);
          if (match) chosenVariant = match;
        }
        mediaPlaylistUrl = chosenVariant.uri;
        const subResp = await Fetcher.fetchWithRetry(mediaPlaylistUrl, { headers, signal: abortCtrl.signal });
        if (!subResp.ok) throw new Error('Failed to load HLS media variant playlist');
        mediaPlaylistText = await subResp.text();
      }

      // Check for AES-128 Encryption (#EXT-X-KEY)
      let aesKeyBuffer: ArrayBuffer | null = null;
      let aesKeyIv: Uint8Array | null = null;
      const keyMatch = mediaPlaylistText.match(/#EXT-X-KEY:METHOD=AES-128(?:,URI="([^"]+)")?(?:,IV=(0x[0-9a-fA-F]+))?/i);
      if (keyMatch && keyMatch[1]) {
        const keyUrl = M3U8Parser.resolveUrl(keyMatch[1], mediaPlaylistUrl);
        const keyResp = await Fetcher.fetchWithRetry(keyUrl, { headers, signal: abortCtrl.signal });
        if (keyResp.ok) {
          aesKeyBuffer = await keyResp.arrayBuffer();
        }
        if (keyMatch[2]) {
          const ivHex = keyMatch[2].slice(2).padStart(32, '0');
          const ivBytes = new Uint8Array(16);
          for (let i = 0; i < 16; i++) {
            ivBytes[i] = parseInt(ivHex.substr(i * 2, 2), 16);
          }
          aesKeyIv = ivBytes;
        }
      }

      interface HlsSeg {
        url: string;
        seq: number;
        rangeHeader?: string;
      }
      const segments: HlsSeg[] = [];
      let initSegmentUrl: string | null = null;
      let initRangeHeader: string | undefined = undefined;
      let pendingRangeHeader: string | undefined = undefined;
      let lastEndOffset = 0;
      let mediaSequence = 0;

      const lines = mediaPlaylistText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      for (const line of lines) {
        if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
          const seq = parseInt(line.replace('#EXT-X-MEDIA-SEQUENCE:', '').trim(), 10);
          if (!isNaN(seq)) mediaSequence = seq;
        } else if (line.startsWith('#EXT-X-MAP:')) {
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch) {
            initSegmentUrl = M3U8Parser.resolveUrl(uriMatch[1], mediaPlaylistUrl);
          }
          const rangeMatch = line.match(/BYTERANGE="([^"]+)"/);
          if (rangeMatch) {
            const parts = rangeMatch[1].split('@');
            const length = parseInt(parts[0], 10);
            const offset = parts.length > 1 ? parseInt(parts[1], 10) : 0;
            initRangeHeader = `bytes=${offset}-${offset + length - 1}`;
          }
        } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
          const parts = line.slice('#EXT-X-BYTERANGE:'.length).split('@');
          const length = parseInt(parts[0], 10);
          const offset = parts.length > 1 ? parseInt(parts[1], 10) : lastEndOffset;
          pendingRangeHeader = `bytes=${offset}-${offset + length - 1}`;
          lastEndOffset = offset + length;
        } else if (!line.startsWith('#')) {
          const segUrl = M3U8Parser.resolveUrl(line, mediaPlaylistUrl);
          segments.push({
            url: segUrl,
            seq: mediaSequence + segments.length,
            rangeHeader: pendingRangeHeader,
          });
          pendingRangeHeader = undefined;
        }
      }

      if (segments.length === 0) throw new Error('No video segments found in playlist');

      try {
        await FileSystem.deleteAsync(destinationUri, { idempotent: true });
      } catch {}

      let bytesTotalAccum = 0;
      let isFirstWrite = true;
      const speedMeter = new SpeedMeter(item.totalBytes > 0 ? item.totalBytes : undefined);

      // Download and write init segment if present
      if (initSegmentUrl) {
        const initHeaders = { ...headers };
        if (initRangeHeader) initHeaders['Range'] = initRangeHeader;
        const initResp = await Fetcher.fetchWithRetry(initSegmentUrl, { headers: initHeaders, signal: abortCtrl.signal });
        const initBuf = await initResp.arrayBuffer();
        bytesTotalAccum += initBuf.byteLength;
        await SegmentWriter.writeSegment(destinationUri, initBuf, false);
        isFirstWrite = false;
      }

      // Stream segments through SegmentPool (concurrency 6, adaptive)
      let nextWriteIndex = 0;
      const readyChunks = new Map<number, Uint8Array>();

      const pool = new SegmentPool<{ index: number; buffer: Uint8Array }>({
        concurrency: 6,
        minConcurrency: 2,
        maxConcurrency: 16,
      });

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const segIndex = i;

        pool.enqueue({
          id: segIndex,
          execute: async (signal) => {
            const segHeaders = { ...headers };
            if (seg.rangeHeader) segHeaders['Range'] = seg.rangeHeader;

            const sResp = await Fetcher.fetchWithRetry(seg.url, { headers: segHeaders, signal });
            let segData = new Uint8Array(await sResp.arrayBuffer());

            // Decrypt with AES-128 if encrypted (Section 6.1)
            if (aesKeyBuffer) {
              const iv = aesKeyIv || Decryptor.sequenceToIV(seg.seq);
              const dec = await Decryptor.decryptSegment(segData, aesKeyBuffer, iv);
              segData = new Uint8Array(dec.buffer as ArrayBuffer, dec.byteOffset, dec.byteLength);
            }

            readyChunks.set(segIndex, segData);
            bytesTotalAccum += segData.byteLength;

            // Sequentially flush ready chunks to disk without Base64 bottleneck
            while (readyChunks.has(nextWriteIndex)) {
              const toWrite = readyChunks.get(nextWriteIndex)!;