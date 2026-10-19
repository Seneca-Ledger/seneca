export class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(capacity: number) {
    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new Error('Semaphore capacity must be a positive number');
    }
    this.available = Math.floor(capacity);
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
      return () => this.release();
    }

    await new Promise<void>(resolve => {
      this.waiters.push(resolve);
    });

    this.available -= 1;
    return () => this.release();
  }

  private release() {
    this.available += 1;
    const next = this.waiters.shift();
    if (next) {
      next();
    }
  }

  async use<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
