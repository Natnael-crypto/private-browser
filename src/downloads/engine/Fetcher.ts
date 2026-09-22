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
   * Fetch with exponential backoff retry loop
   */
  public static async fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
    const maxRetries = options.maxRetries ?? 6;
    let delay = options.initialDelayMs ?? 500;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (options.signal?.aborted) {
        throw new Error('Fetch aborted by user');
      }

      try {
        const resp = await fetch(url, {
          method: 'GET',
          headers: options.headers,
          signal: options.signal,