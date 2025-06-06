export type WorkerStatus = "idle" | "active" | "error";

export class ConcurrencyPool {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private limit: number;
  private allDone: (() => void)[] = [];
  private donePromise: Promise<void>;

  // New properties for worker status tracking
  private workerStatus: WorkerStatus[];
  private workerPromiseMap: Map<number, Promise<void>> = new Map();
  private statusCallback?: (statuses: WorkerStatus[]) => void;

  constructor(limit: number) {
    this.limit = limit;
    this.donePromise = new Promise((resolve) => this.allDone.push(resolve));
    this.workerStatus = Array(limit).fill("idle");
  }

  setStatusCallback(cb: (statuses: WorkerStatus[]) => void) {
    this.statusCallback = cb;
    this.statusCallback([...this.workerStatus]);
  }

  add(taskFunc: () => Promise<void>) {
    if (this.activeCount === 0 && this.queue.length === 0) {
      this.donePromise = new Promise((resolve) => {
        this.allDone = [resolve];
      });
    }
    this.queue.push(taskFunc);
    this.runNext();
  }

  private runNext() {
    while (this.activeCount < this.limit && this.queue.length > 0) {
      const taskFunc = this.queue.shift()!;

      // Find an available worker slot
      let workerIndex = -1;
      for (let i = 0; i < this.limit; i++) {
        if (
          this.workerStatus[i] === "idle" ||
          this.workerStatus[i] === "error"
        ) {
          workerIndex = i;
          break;
        }
      }

      if (workerIndex !== -1) {
        this.activeCount++;
        this.workerStatus[workerIndex] = "active";
        if (this.statusCallback) this.statusCallback([...this.workerStatus]);

        const taskPromise = taskFunc()
          .then(() => {
            this.workerStatus[workerIndex] = "idle";
            if (this.statusCallback)
              this.statusCallback([...this.workerStatus]);
          })
          .catch((err) => {
            console.error(`Task in worker ${workerIndex} failed:`, err);
            this.workerStatus[workerIndex] = "error";
            if (this.statusCallback)
              this.statusCallback([...this.workerStatus]);
            // We still need to continue processing other tasks
          })
          .finally(() => {
            this.activeCount--;
            this.workerPromiseMap.delete(workerIndex);
            // Continue immediately with the next task
            this.runNext();
            if (this.activeCount === 0 && this.queue.length === 0) {
              this.allDone.forEach((cb) => cb());
            }
          });

        this.workerPromiseMap.set(workerIndex, taskPromise);
      } else {
        // This case should technically not be reached if activeCount < limit
        // but as a safeguard, we put the task back.
        this.queue.unshift(taskFunc);
        break;
      }
    }
  }

  async awaitAll() {
    if (this.activeCount === 0 && this.queue.length === 0) return;
    await this.donePromise;
  }

  getActiveCount() {
    return this.activeCount;
  }

  getQueueLength() {
    return this.queue.length;
  }

  getLimit() {
    return this.limit;
  }

  // Method to get the status of all workers
  getWorkerStatuses(): WorkerStatus[] {
    return [...this.workerStatus];
  }
}
