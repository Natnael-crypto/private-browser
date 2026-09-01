/**
 * Pure TypeScript Video Detection Rule Engine (Section 5.1 & 5.3)
 * Ported from Video DownloadHelper service/main.js.
 * NO React or Expo imports - strictly pure JS/TS for 100% testability in Node and WebView.
 */

export type DetectedMediaType = 'direct' | 'hls_master' | 'hls_media' | 'dash' | 'embed';

export interface CandidateRequest {
  url: string;
  statusCode?: number;
  type?: 'xmlhttprequest' | 'media' | 'main_frame' | 'sub_frame' | 'other';
  headers?: Record<string, string>;
  initiatorUrl?: string;
  pageUrl?: string;
}

export interface PageDetectionState {
  hasManifestStream?: boolean; // True if page has already emitted an HLS/DASH manifest
  allowSmallFiles?: boolean;
}

export interface DetectionDecision {
  matched: boolean;
  reason?: string;
  type?: DetectedMediaType;
  hash?: string;
  filename?: string;
  extension?: string;
  sizeBytes?: number;
  supportsByteRanges?: boolean;
  specialExtractor?: 'vimeo_config' | 'iqiyi_config' | null;
}

// 5.1 Step 2: Segment extensions that must be ignored
export const SEGMENT_REGEX = /\.(?:ts|m4s|m2ts)(?:[?#]|$)/i;

// 5.1 Step 4: Registrable domains handled by dedicated site extractors
export const SITE_EXTRACTOR_DOMAINS = new Set([
  'youtube.com',
  'instagram.com',
  'ok.ru',
  'vk.com',