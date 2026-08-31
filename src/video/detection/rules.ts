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