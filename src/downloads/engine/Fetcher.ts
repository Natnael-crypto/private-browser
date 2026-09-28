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
        });

        // Retry on 5xx server errors or 429 Too Many Requests
        if (!resp.ok && (resp.status >= 500 || resp.status === 429)) {
          if (attempt === maxRetries) {
            return resp;
          }
          await this.sleep(delay, options.signal);
          delay = Math.min(10000, delay * 2);
          continue;
        }

        return resp;
      } catch (err: any) {
        if (options.signal?.aborted) {
          throw err;
        }
        if (attempt === maxRetries) {
          throw err;
        }
        await this.sleep(delay, options.signal);
        delay = Math.min(10000, delay * 2);
      }
    }

    throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
  }

  /**
   * Fetch array buffer with retries
   */
  public static async fetchBuffer(url: string, options: FetchOptions = {}): Promise<Uint8Array> {
    const resp = await this.fetchWithRetry(url, options);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} fetching ${url}`);
    }

    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (options.onBytesReceived) {
      options.onBytesReceived(bytes.byteLength);
    }

    return bytes;
  }

  private static sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'));
        return;
      }
      const timeout = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Aborted'));
        }, { once: true });
      }
    });
  }
}
