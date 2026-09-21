/**
 * Fetcher (Section 6.1)
 * Robust HTTP client with exponential backoff retries (up to 6 attempts),
 * AbortSignal handling, Range support, and header replay.
 */

export interface FetchOptions {
  headers?: Record<string, string>;
  maxRetries?: number;
  initialDelayMs?: number;
  signal?: AbortSignal;
  onBytesReceived?: (bytes: number) => void;
}

export class Fetcher {
  /**