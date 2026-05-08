export interface RingBufferOptions<T> {
  timestamp?: (item: T) => number | undefined;
}

export class RingBuffer<T> {
  private readonly items: T[] = [];
  private readonly timestamp: (item: T) => number | undefined;

  public constructor(
    private readonly maxItems: number,
    options: RingBufferOptions<T> = {}
  ) {
    if (!Number.isInteger(maxItems) || maxItems <= 0) {
      throw new Error("RingBuffer maxItems must be a positive integer.");
    }

    this.timestamp = options.timestamp ?? inferTimestamp;
  }

  public push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.maxItems) {
      this.items.splice(0, this.items.length - this.maxItems);
    }
  }

  public latest(): T[] {
    return [...this.items];
  }

  public latestSince(epochSeconds: number): T[] {
    return this.items.filter((item) => {
      const timestamp = this.timestamp(item);
      return timestamp !== undefined && timestamp >= epochSeconds;
    });
  }

  public clear(): void {
    this.items.length = 0;
  }

  public size(): number {
    return this.items.length;
  }

  public append(item: T): void {
    this.push(item);
  }

  public values(): T[] {
    return this.latest();
  }

  public latestWhere(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }
}

function inferTimestamp<T>(item: T): number | undefined {
  if (typeof item !== "object" || item === null || !("ts" in item)) {
    return undefined;
  }

  const timestamp = (item as { ts?: unknown }).ts;
  return typeof timestamp === "number" && Number.isFinite(timestamp)
    ? timestamp
    : undefined;
}
