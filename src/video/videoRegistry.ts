import * as Crypto from 'expo-crypto';
import { M3U8Parser } from './m3u8Parser';
import { MPDParser } from './mpdParser';
import { evaluateDetectionRules, hashString, DetectedMediaType } from './detection/rules';

export interface DetectedVideoItem {
  id: string;
  hash: string;
  mediaUrl: string;
  sourcePageUrl: string;
  frameUrl?: string;
  tabId?: string;
  title: string;
  format: string; // 'MP4' | 'HLS' | 'DASH' | 'WebM' | 'Embed'
  type: DetectedMediaType;
  resolution: string; // e.g. '1080p', 'Auto'
  qualities: string[];
  audioTracks: string[];
  subtitles: string[];
  sizeBytes?: number;
  sizeFormatted?: string; // e.g. '148 MB'
  metaFormatted: string; // e.g. 'MP4 · 1080p · 148 MB'
  protectedStream: boolean;
  hasDrm: boolean;
  needsDecrypt: boolean;
  supportsByteRanges: boolean;
  thumbnail?: string | null;
  duration?: number;
  detectedAt: number;
  cookies?: string;
  userAgent?: string;
  headers?: Record<string, string>;
}

export class VideoRegistry {
  private static tabVideos: Map<string, Map<string, DetectedVideoItem>> = new Map();
  private static activeTabId: string = 'default';
  private static tabManifestFlags: Map<string, boolean> = new Map();
  private static listeners: Set<(videos: DetectedVideoItem[]) => void> = new Set();

  public static setActiveTab(tabId: string): void {
    this.activeTabId = tabId;
    this.notify();
  }

  public static subscribe(listener: (videos: DetectedVideoItem[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getVideosForTab(this.activeTabId));
    return () => this.listeners.delete(listener);
  }

  public static clearTab(tabId: string): void {
    this.tabVideos.delete(tabId);
    this.tabManifestFlags.delete(tabId);
    this.notify();
  }

  public static clearCurrentPage(): void {
    this.clearTab(this.activeTabId);
  }

  public static getVideos(): DetectedVideoItem[] {
    return this.getVideosForTab(this.activeTabId);
  }

  public static getVideosForTab(tabId: string): DetectedVideoItem[] {
    const tabMap = this.tabVideos.get(tabId);
    return tabMap ? Array.from(tabMap.values()) : [];
  }

  /**
   * Register detected video from injected script or network observer
   */
  public static async registerDetected(raw: {
    mediaUrl: string;
    sourcePageUrl: string;
    frameUrl?: string;
    tabId?: string;
    title?: string;
    thumbnail?: string | null;
    format?: string;
    resolution?: string;
    hasDrm?: boolean;
    duration?: number;
    sizeBytes?: number;
    cookies?: string;
    userAgent?: string;
    headers?: Record<string, string>;
    type?: string;
  }): Promise<void> {
    const tabId = raw.tabId || this.activeTabId;
    let tabMap = this.tabVideos.get(tabId);
    if (!tabMap) {
      tabMap = new Map();
      this.tabVideos.set(tabId, tabMap);
    }

    const hasManifest = !!this.tabManifestFlags.get(tabId);

    // Evaluate detection rules from pure TS engine (Section 5.1)
    const decision = evaluateDetectionRules(
      {
        url: raw.mediaUrl,
        headers: raw.headers,
        type: (raw.type as any) || 'media',
        pageUrl: raw.sourcePageUrl,
      },
      {
        hasManifestStream: hasManifest,
      }
    );

    // Ignore if rejected by rules (e.g. segment, small file, anti-spam)
    if (!decision.matched) {
      return;
    }

    const mediaHash = decision.hash || hashString(raw.mediaUrl);
    if (tabMap.has(mediaHash)) return;

    const id = Crypto.randomUUID();
    const isDrm = !!raw.hasDrm;
    const mediaType: DetectedMediaType = decision.type || (raw.format === 'HLS' ? 'hls_master' : raw.format === 'DASH' ? 'dash' : 'direct');
    
    if (mediaType === 'hls_master' || mediaType === 'dash') {
      this.tabManifestFlags.set(tabId, true);
    }

    const format = raw.format || (mediaType === 'hls_master' ? 'HLS' : mediaType === 'dash' ? 'DASH' : 'MP4');
    const resolution = raw.resolution || 'Auto';
    const sizeBytes = decision.sizeBytes || (raw.sizeBytes && raw.sizeBytes > 0 ? raw.sizeBytes : undefined);
    const sizeFormatted = sizeBytes ? VideoRegistry.formatBytes(sizeBytes) : undefined;

    let metaFormatted = format;
    if (resolution && resolution !== 'Auto') {
      metaFormatted += ` · ${resolution}`;
    }
    if (sizeFormatted) {
      metaFormatted += ` · ${sizeFormatted}`;
    }
    if (isDrm) {
      metaFormatted = 'Protected — DRM stream';
    }

    const item: DetectedVideoItem = {
      id,
      hash: mediaHash,
      mediaUrl: raw.mediaUrl,
      sourcePageUrl: raw.sourcePageUrl,
      frameUrl: raw.frameUrl || raw.sourcePageUrl,
      tabId,
      title: decision.filename || raw.title || 'Video',
      format,
      type: mediaType,
      resolution,
      qualities: resolution && resolution !== 'Auto' ? [resolution] : [],
      audioTracks: [],
      subtitles: [],
      sizeBytes,
      sizeFormatted,
      metaFormatted,
      protectedStream: isDrm,
      hasDrm: isDrm,
      needsDecrypt: false,
      supportsByteRanges: !!decision.supportsByteRanges,
      thumbnail: raw.thumbnail || null,
      duration: raw.duration,
      detectedAt: Date.now(),