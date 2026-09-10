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
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Extract registrable domain (e.g. "player.vimeo.com" -> "vimeo.com")
 */
export function getRegistrableDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  return parts.slice(-2).join('.');
}

/**
 * Maps Content-Type to file extension using the reference jm table
 */
export function mapContentTypeToExtension(contentType?: string): string | null {
  if (!contentType) return null;
  const mime = contentType.split(';')[0].trim().toLowerCase();
  const [kind, sub] = mime.split('/');
  if (!kind || !sub) return null;

  const targetKind = kind === 'audio' ? 'audio' : 'video';
  for (const entry of JM_CONTENT_TYPES) {
    if (entry.regex.test(sub)) {
      return entry[targetKind];
    }
  }
  return null;
}

/**
 * Parses Content-Disposition header for filename* or filename
 */
export function parseContentDispositionFilename(disposition?: string): string | null {
  if (!disposition) return null;
  const match = disposition.match(
    /filename\*=(?:UTF-8'')?['"]?([^'";]*)['"]?|filename=['"]?([^'";]*)['"]?/i
  );
  if (match) {
    if (match[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    if (match[2]) return match[2];
  }
  return null;
}

/**
 * Resolves filename and lowercase extension using reference priority:
 * Content-Disposition -> URL path -> Content-Type
 */
export function resolveFilenameAndExtension(
  url: string,
  contentType?: string,
  disposition?: string
): { filename?: string; extension: string } {
  const dispFilename = parseContentDispositionFilename(disposition);
  let urlFilename: string | undefined;

  try {
    const parsed = new URL(url);
    const lastPart = parsed.pathname.split('/').filter(Boolean).pop();
    if (lastPart && lastPart.includes('.')) {
      urlFilename = lastPart;
    }
  } catch {}

  const candidates: { name?: string; ext: string }[] = [];

  if (dispFilename) {
    const dot = dispFilename.lastIndexOf('.');
    if (dot > 0) {
      candidates.push({
        name: dispFilename.substring(0, dot),
        ext: dispFilename.substring(dot + 1).toLowerCase(),
      });
    }
  }

  if (urlFilename) {
    const dot = urlFilename.lastIndexOf('.');
    if (dot > 0) {
      candidates.push({
        name: urlFilename.substring(0, dot),
        ext: urlFilename.substring(dot + 1).toLowerCase(),
      });
    }
  }

  const mimeExt = mapContentTypeToExtension(contentType);
  if (mimeExt) {
    candidates.push({ ext: mimeExt });
  }

  for (const cand of candidates) {
    if (ALLOWED_EXTENSIONS.has(cand.ext)) {
      return {
        filename: cand.name,
        extension: cand.ext,
      };
    }
  }

  return { extension: 'mp4' };
}

/**
 * Core Evaluation Engine (Section 5.1 rules 1-9 in exact order)
 */
export function evaluateDetectionRules(
  req: CandidateRequest,
  state: PageDetectionState = {}
): DetectionDecision {
  // 1. Status Code must be 2xx (if provided)
  if (req.statusCode !== undefined && (req.statusCode < 200 || req.statusCode > 299)) {
    return { matched: false, reason: 'status_not_2xx' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(req.url);
  } catch {
    return { matched: false, reason: 'invalid_url' };
  }

  // 2. Ignore URL paths ending in .ts, .m4s, .m2ts (segments)
  if (SEGMENT_REGEX.test(parsedUrl.pathname)) {
    return { matched: false, reason: 'segment_ignored' };
  }

  // 3. Special cases: Vimeo config and iQIYI dash
  if (parsedUrl.host === 'player.vimeo.com' && parsedUrl.pathname.endsWith('/config')) {
    return {
      matched: true,
      type: 'embed',
      specialExtractor: 'vimeo_config',
      hash: `vimeo_config_${hashString(req.url)}`,
    };
  }
  if (parsedUrl.host === 'intl-api.iq.com' && parsedUrl.pathname.endsWith('/dash')) {
    return {
      matched: true,
      type: 'dash',
      specialExtractor: 'iqiyi_config',
      hash: `iqiyi_dash_${hashString(req.url)}`,
    };
  }

  // 4. Ignore pages whose registrable domain has a dedicated site extractor
  if (req.pageUrl) {
    try {
      const pageHost = new URL(req.pageUrl).hostname;
      const regDomain = getRegistrableDomain(pageHost);
      if (SITE_EXTRACTOR_DOMAINS.has(regDomain)) {
        return { matched: false, reason: `handled_by_extractor_${regDomain}` };
      }
    } catch {}
  }

  const headers = req.headers || {};
  // Normalize header names to lowercase
  const normHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    normHeaders[k.toLowerCase()] = v;
  }

  const contentType = normHeaders['content-type'] || '';
  const contentLength = normHeaders['content-length'];
  const contentRange = normHeaders['content-range'];
  const contentDisposition = normHeaders['content-disposition'];
  const acceptRanges = normHeaders['accept-ranges'];

  // 6. HLS Stream Detection (Ef): Content-Type matches mpegurl, or URL matches /hls|m3u8/, or /api/playlist/master/
  const isHls =
    /mpegurl/i.test(contentType) ||