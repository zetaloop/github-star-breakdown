export class ConcurrencyPool {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private limit: number;
  private allDone: (() => void)[] = [];
  private donePromise: Promise<void>;

  constructor(limit: number) {
    this.limit = limit;
    this.donePromise = new Promise((resolve) => this.allDone.push(resolve));
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
      this.activeCount++;
      taskFunc().finally(() => {
        this.activeCount--;
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
}
