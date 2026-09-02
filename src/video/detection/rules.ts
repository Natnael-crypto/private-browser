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
  'vk.ru',
  'vkvideo.ru',
  'canva.com',
  'iq.com',
  'vimeo.com',
  'kick.com',
  'javrank.com',
]);

// 5.1 Step 9: jm content-type mapping table
export const JM_CONTENT_TYPES = [
  { regex: /(?:x-)?(?:pn-)?wave?/i, audio: 'wav', video: 'wav' },
  { regex: /(?:x-)?3gpp2?/i, audio: 'mp3', video: '3gpp' },
  { regex: /(?:x-)?flac/i, audio: 'flac', video: 'flac' },
  { regex: /(?:x-)?flv/i, audio: 'mp3', video: 'flv' },
  { regex: /(?:x-)?m4a/i, audio: 'm4a', video: 'm4a' },
  { regex: /(?:x-)?m4v/i, audio: 'mp3', video: 'm4v' },
  { regex: /(?:x-)?matroska/i, audio: 'mp3', video: 'mkv' },
  { regex: /(?:x-)?mov/i, audio: 'mp3', video: 'mov' },
  { regex: /(?:x-)?mp2t/i, audio: 'mp3', video: 'mp2t' },
  { regex: /(?:x-)?mp4/i, audio: 'mp3', video: 'mp4' },
  { regex: /(?:x-)?mpeg/i, audio: 'mp3', video: 'mpeg' },
  { regex: /(?:x-)?mts/i, audio: 'mp3', video: 'm2ts' },
  { regex: /(?:x-)?msvideo/i, audio: 'avi', video: 'avi' },
  { regex: /(?:x-)?og./i, audio: 'oga', video: 'ogv' },
  { regex: /(?:x-)?webm/i, audio: 'oga', video: 'webm' },
  { regex: /(?:x-)?mkv/i, audio: 'mp3', video: 'mkv' },
  { regex: /(?:x-)?vorbis/i, audio: 'oga', video: 'ogv' },
];

// 5.1 Step 9: bv allowed extension set
export const ALLOWED_EXTENSIONS = new Set([
  '3g2', '3gp', 'aac', 'ac3', 'aiff', 'amr', 'ape', 'asf', 'au', 'avi',
  'divx', 'dts', 'dv', 'f4v', 'flac', 'flv', 'h264', 'm2t', 'm2ts', 'm2v',
  'm4a', 'm4v', 'mka', 'mkv', 'mov', 'mp2', 'mp3', 'mp4', 'mpe', 'mpeg',
  'mpg', 'mpv', 'mts', 'mxf', 'oga', 'ogg', 'ogm', 'ogv', 'opus', 'qt',
  'ra', 'rm', 'rmvb', 'snd', 'ts', 'vob', 'voc', 'wav', 'webm', 'wma',
  'wmv', 'wv', 'y4m',
]);

/**
 * Fast DJB2 hash for string hashing and content deduping (matches extension be() function)
 */