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
  private onTaskFailed?: (taskId: string | number, error: any) => void;
  private resolveAll?: (results: Map<string | number, T>) => void;
  private rejectAll?: (err: any) => void;

  constructor(options: SegmentPoolOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 6);
    this.minConcurrency = options.minConcurrency ?? 2;
    this.maxConcurrency = options.maxConcurrency ?? 16;
    this.onTaskCompleted = options.onTaskCompleted;
    this.onTaskFailed = options.onTaskFailed;
  }

  public enqueue(task: PoolTask<T>): void {
    this.queue.push(task);
  }

  public enqueueAll(tasks: PoolTask<T>[]): void {
    this.queue.push(...tasks);
  }

  public abort(): void {
    this.abortController.abort();
    this.queue = [];
  }

  public run(): Promise<Map<string | number, T>> {
    return new Promise((resolve, reject) => {
      this.resolveAll = resolve;
      this.rejectAll = reject;

      if (this.queue.length === 0) {
        resolve(this.results);
        return;
      }

      const workersToStart = Math.min(this.concurrency, this.queue.length);
      for (let i = 0; i < workersToStart; i++) {
        this.startWorker();
      }
    });
  }

  private async startWorker(): Promise<void> {
    if (this.abortController.signal.aborted) return;
    this.activeWorkers++;

    while (this.queue.length > 0 && !this.abortController.signal.aborted) {
      const task = this.queue.shift();
      if (!task) break;

      try {
        const result = await task.execute(this.abortController.signal);
        this.results.set(task.id, result);
        this.consecutiveErrors = 0;

        // Slowly restore concurrency if it was degraded
        if (this.concurrency < this.maxConcurrency && Math.random() < 0.1) {
          this.concurrency = Math.min(this.maxConcurrency, this.concurrency + 1);
        }

        if (this.onTaskCompleted) {
          this.onTaskCompleted(task.id, result, this.queue.length + this.activeWorkers - 1);
        }
      } catch (err: any) {
        if (this.abortController.signal.aborted) break;

        this.errors.set(task.id, err);
        this.consecutiveErrors++;

        // Adapt: lower concurrency after repeated network errors (Section 6.1)
        if (this.consecutiveErrors >= 3 && this.concurrency > this.minConcurrency) {
          this.concurrency = Math.max(this.minConcurrency, this.concurrency - 1);
        }

        if (this.onTaskFailed) {
          this.onTaskFailed(task.id, err);
        }
      }
    }

    this.activeWorkers--;

    if (this.activeWorkers === 0 && this.queue.length === 0) {
      if (this.resolveAll) {
        this.resolveAll(this.results);
      }
    }
  }
}
