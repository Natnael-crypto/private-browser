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
    id: string,
    bytesDone: number,
    segmentsDone?: number
  ): SpeedProgress | null {
    const job = this.jobs.get(id);
    if (!job) return null;

    job.bytesDone = bytesDone;
    if (segmentsDone !== undefined) {
      job.segmentsDone = segmentsDone;
    }

    job.speedMeter.recordBytes(bytesDone);
    const progress = job.speedMeter.getProgress(job.segmentsDone, job.segmentsTotal);

    if (job.speedMeter.shouldEmit()) {
      this.notify();
      // Periodically sync progress to DB
      db.updateDownloadProgress(id, bytesDone, job.segmentsDone, job.segmentsTotal).catch(() => {});
    }

    return progress;
  }

  /**
   * Set state of a job
   */
  public static async setJobState(
    id: string,
    state: JobState,
    meta?: { error?: string; fileUri?: string }
  ): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    job.state = state;
    if (meta?.error) job.error = meta.error;
    if (meta?.fileUri) job.finalFileUri = meta.fileUri;
    if (state === 'completed') job.completedAt = Date.now();

    await db.setDownloadState(
      id,
      state as any,
      job.bytesDone,
      meta?.fileUri,
      meta?.error,
      job.completedAt
    );

    this.notify();
    this.processNext();
  }

  /**
   * Pause a job
   */
  public static async pauseJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    if (job.state === 'downloading' || job.state === 'queued' || job.state === 'preparing') {
      job.abortController.abort();
      await this.setJobState(id, 'paused');
    }
  }

  /**
   * Resume a paused job
   */
  public static async resumeJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job || job.state !== 'paused') return;

    job.abortController = new AbortController();
    await this.setJobState(id, 'queued');
  }

  /**
   * Cancel a job
   */
  public static async cancelJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    job.abortController.abort();
    await this.setJobState(id, 'canceled');
  }

  /**
   * Process next queued job if under max concurrency
   */
  public static async processNext(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const activeCount = this.getActiveJobs().length;
      if (activeCount >= this.maxConcurrentJobs) return;

      const queuedJobs = Array.from(this.jobs.values()).filter((j) => j.state === 'queued');
      if (queuedJobs.length === 0) return;

      // Check Wi-Fi restriction before launching
      const net = await this.isNetworkAllowed();
      if (!net.allowed) {
        for (const q of queuedJobs) {
          q.error = net.reason;
        }
        this.notify();
        return;
      }

      const availableSlots = this.maxConcurrentJobs - activeCount;
      const jobsToStart = queuedJobs.slice(0, availableSlots);

      for (const job of jobsToStart) {
        // Trigger download execution via registered runner
        if (DownloadQueue.jobRunner) {
          job.state = 'preparing';
          this.notify();
          DownloadQueue.jobRunner(job).catch(async (err: any) => {
            await this.setJobState(job.id, 'failed', { error: err?.message || 'Download failed' });
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public static jobRunner?: (job: DownloadJob) => Promise<void>;

  private static notify(): void {
    const list = Array.from(this.jobs.values());
    this.listeners.forEach((listener) => {
      try {
        listener(list);
      } catch {}
    });
  }
}
