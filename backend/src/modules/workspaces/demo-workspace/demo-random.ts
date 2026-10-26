/**
 * A small seeded generator (mulberry32) for the demo data. The demo must come
 * out the same for the same anchor date — the guide's screenshots are taken
 * from it — so nothing in it may call Math.random.
 */
export class DemoRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in [min, max], both included. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** An amount in cents between two amounts in euros. */
  cents(min: number, max: number): number {
    return this.int(Math.round(min * 100), Math.round(max * 100));
  }
}
