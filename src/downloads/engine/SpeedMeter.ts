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
    const cutoff = now - this.windowDurationMs;
    while (this.samples.length > 2 && this.samples[0].timestamp < cutoff) {
      this.samples.shift();
    }

    this.calculateSpeed();
  }

  private calculateSpeed(): void {
    if (this.samples.length < 2) return;

    const oldest = this.samples[0];
    const newest = this.samples[this.samples.length - 1];
    const elapsedSec = (newest.timestamp - oldest.timestamp) / 1000;

    if (elapsedSec > 0.05) {
      const deltaBytes = Math.max(0, newest.bytesDone - oldest.bytesDone);
      const instantSpeed = deltaBytes / elapsedSec;

      if (this.emaSpeed === 0) {
        this.emaSpeed = instantSpeed;
      } else {
        this.emaSpeed = this.alpha * instantSpeed + (1 - this.alpha) * this.emaSpeed;
      }
    }
  }

  /**
   * Get current progress snapshot
   */
  public getProgress(segmentsDone?: number, segmentsTotal?: number): SpeedProgress {
    this.calculateSpeed();
    const speed = Math.max(0, Math.round(this.emaSpeed));
    const speedMbps = Number(((speed * 8) / (1000 * 1000)).toFixed(2));

    let etaSeconds: number | null = null;
    if (this.totalBytes && this.totalBytes > this.currentBytes && speed > 0) {
      etaSeconds = Math.max(0, Math.round((this.totalBytes - this.currentBytes) / speed));
    }

    let percent: number | null = null;
    if (this.totalBytes && this.totalBytes > 0) {
      percent = Math.min(100, Math.max(0, Math.round((this.currentBytes / this.totalBytes) * 100)));
    } else if (segmentsTotal && segmentsTotal > 0 && segmentsDone !== undefined) {
      percent = Math.min(100, Math.max(0, Math.round((segmentsDone / segmentsTotal) * 100)));
    }

    return {
      bytesDone: this.currentBytes,
      totalBytes: this.totalBytes,
      speedBytesPerSec: speed,
      speedMbps,
      formattedSpeed: SpeedMeter.formatSpeed(speed),
      speedFormatted: SpeedMeter.formatSpeed(speed),
      formattedSpeedMbps: `${speedMbps} Mbps`,
      etaSeconds,
      formattedEta: SpeedMeter.formatEta(etaSeconds),
      etaFormatted: SpeedMeter.formatEta(etaSeconds),
      percent,
      segmentsDone,
      segmentsTotal,
    };
  }

  /**
   * Check if progress update should be emitted based on throttle interval
   */
  public shouldEmit(now = Date.now()): boolean {
    if (now - this.lastEmitTime >= this.emitIntervalMs) {
      this.lastEmitTime = now;
      return true;
    }
    return false;
  }

  public static formatSpeed(bytesPerSec: number): string {