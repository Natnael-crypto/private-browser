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