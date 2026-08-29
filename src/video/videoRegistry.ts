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