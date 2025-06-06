export class ConcurrencyPool {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private limit: number;
  private allDone: (() => void)[] = [];
  private donePromise: Promise<void>;
  private statuses: Array<"idle" | "active" | "error">;
  private statusCallback?: (
    statuses: Array<"idle" | "active" | "error">
  ) => void;

  constructor(limit: number) {
    this.limit = limit;
    this.donePromise = new Promise((resolve) => this.allDone.push(resolve));
    this.statuses = new Array(limit).fill("idle");
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
      const slot = this.statuses.findIndex((s) => s === "idle");
      if (slot === -1) return;
      this.activeCount++;
      this.statuses[slot] = "active";
      this.statusCallback?.([...this.statuses]);
      taskFunc()
        .then(() => {
          this.statuses[slot] = "idle";
        })
        .catch(() => {
          this.statuses[slot] = "error";
        })
        .finally(() => {
          this.activeCount--;
          this.statusCallback?.([...this.statuses]);
          this.runNext();
          if (this.activeCount === 0 && this.queue.length === 0) {
            this.allDone.forEach((cb) => cb());
          }
        });
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

  setStatusCallback(
    cb: (statuses: Array<"idle" | "active" | "error">) => void
  ) {
    this.statusCallback = cb;
    cb([...this.statuses]);
  }
}
