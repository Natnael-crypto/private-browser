/**
 * SegmentPool (Section 6.1)
 * Semaphore-backed concurrency worker pool for segment downloads.
 * As soon as any worker completes a segment, it pulls the next segment
 * immediately without waiting for a batch to finish.
 */

export interface PoolTask<T> {
  id: string | number;
  execute: (signal: AbortSignal) => Promise<T>;
}

export interface SegmentPoolOptions {
  concurrency?: number;
  minConcurrency?: number;
  maxConcurrency?: number;
  onTaskCompleted?: (taskId: string | number, result: any, remaining: number) => void;
  onTaskFailed?: (taskId: string | number, error: any) => void;
}

export class SegmentPool<T> {
  private concurrency: number;
  private minConcurrency: number;
  private maxConcurrency: number;
  private consecutiveErrors = 0;
  private activeWorkers = 0;
  private queue: PoolTask<T>[] = [];
  private results: Map<string | number, T> = new Map();
  private errors: Map<string | number, any> = new Map();
  private abortController: AbortController = new AbortController();
  private onTaskCompleted?: (taskId: string | number, result: T, remaining: number) => void;