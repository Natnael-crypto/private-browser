/**
 * SpeedMeter (Section 6.2)
 * High-precision sliding window (5s) with exponential moving average (EMA)
 * for real-time download speed and ETA estimation.
 * Pure TypeScript - no React or Expo imports, testable in Node.
 */

export interface SpeedSample {
  timestamp: number;
  bytesDone: number;
}

export interface SpeedProgress {
  bytesDone: number;
  totalBytes?: number;
  speedBytesPerSec: number;
  speedMbps: number;
  formattedSpeed: string;
  speedFormatted: string;
  formattedSpeedMbps: string;
  etaSeconds: number | null;
  formattedEta: string;
  etaFormatted: string;
  percent: number | null;
  segmentsDone?: number;
  segmentsTotal?: number;
}

export class SpeedMeter {
  private windowDurationMs: number;
  private samples: SpeedSample[] = [];
  private emaSpeed = 0;
  private alpha = 0.25; // Smoothing factor
  private totalBytes?: number;
  private currentBytes = 0;
  private lastEmitTime = 0;
  private emitIntervalMs = 250; // Throttle UI updates to 4/sec

  constructor(totalBytes?: number, windowDurationMs = 5000) {
    this.totalBytes = totalBytes && totalBytes > 0 ? totalBytes : undefined;
    this.windowDurationMs = windowDurationMs;
  }

  public setTotalBytes(total: number): void {
    if (total > 0) {
      this.totalBytes = total;
    }
  }

  /**
   * Record newly completed bytes
   */
  public recordBytes(totalBytesDoneSoFar: number, now = Date.now()): void {
    this.currentBytes = totalBytesDoneSoFar;
    this.samples.push({ timestamp: now, bytesDone: totalBytesDoneSoFar });

    // Prune samples older than the sliding window