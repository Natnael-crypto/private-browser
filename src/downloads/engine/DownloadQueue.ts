import * as Network from 'expo-network';
import { SpeedMeter, SpeedProgress } from './SpeedMeter';
import { db } from '../../db/database';
import { useBrowserStore } from '../../browser/browserStore';

export type JobState =
  | 'queued'
  | 'preparing'
  | 'downloading'
  | 'paused'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface DownloadJob {
  id: string;
  videoId: string;
  title: string;
  url: string;
  sourcePageUrl: string;
  format: string; // 'MP4' | 'HLS' | 'DASH'
  resolution?: string;
  totalBytes?: number;
  thumbnail?: string | null;
  state: JobState;
  speedMeter: SpeedMeter;
  bytesDone: number;
  segmentsDone: number;
  segmentsTotal: number;
  error?: string;
  abortController: AbortController;
  tempDirectory?: string;
  finalFileUri?: string;
  startedAt: number;
  completedAt?: number;
}

export type QueueEventListener = (jobs: DownloadJob[]) => void;

/**
 * DownloadQueue (Section 6.1)
 * Manages concurrent download jobs with job state persistence in SQLite.
 * Maximum concurrent jobs = 2.
 */
export class DownloadQueue {
  private static jobs: Map<string, DownloadJob> = new Map();
  private static maxConcurrentJobs = 2;
  private static listeners: Set<QueueEventListener> = new Set();
  private static isProcessing = false;

  public static subscribe(listener: QueueEventListener): () => void {
    this.listeners.add(listener);
    listener(Array.from(this.jobs.values()));
    return () => this.listeners.delete(listener);
  }

  public static getJob(id: string): DownloadJob | undefined {
    return this.jobs.get(id);
  }

  public static getAllJobs(): DownloadJob[] {
    return Array.from(this.jobs.values());
  }

  public static getActiveJobs(): DownloadJob[] {
    return Array.from(this.jobs.values()).filter(
      (j) => j.state === 'downloading' || j.state === 'preparing' || j.state === 'merging'
    );
  }

  /**
   * Check Wi-Fi requirement (DL-4)
   */
  public static async isNetworkAllowed(): Promise<{ allowed: boolean; reason?: string }> {
    const { wifiOnly } = useBrowserStore.getState();
    if (!wifiOnly) return { allowed: true };

    try {
      const state = await Network.getNetworkStateAsync();
      if (state.type !== Network.NetworkStateType.WIFI) {
        return {
          allowed: false,
          reason: 'Wi-Fi Only is enabled. Connect to Wi-Fi to start or continue downloads.',
        };
      }
    } catch {
      // In web or mocked environments, assume permitted
    }

    return { allowed: true };
  }

  /**
   * Add a new download job to the queue
   */
  public static async addJob(jobParams: {
    id: string;
    videoId: string;
    title: string;
    url: string;
    sourcePageUrl: string;
    format: string;
    resolution?: string;
    totalBytes?: number;
    thumbnail?: string | null;
    segmentsTotal?: number;
  }): Promise<DownloadJob> {
    const speedMeter = new SpeedMeter(jobParams.totalBytes);
    const job: DownloadJob = {
      ...jobParams,
      state: 'queued',
      speedMeter,
      bytesDone: 0,
      segmentsDone: 0,
      segmentsTotal: jobParams.segmentsTotal ?? 0,
      abortController: new AbortController(),
      startedAt: Date.now(),
    };

    this.jobs.set(job.id, job);

    // Persist to SQLite DB (SEC-1, DL-10)
    await db.createDownload({
      id: job.id,
      video_id: job.videoId,
      state: 'queued',
      bytes_done: 0,
      segments_done: 0,
      segments_total: job.segmentsTotal,
      temp_name: job.id,
      started_at: job.startedAt,
    });

    this.notify();
    this.processNext();
    return job;
  }

  /**
   * Update progress for a job
   */
  public static updateProgress(