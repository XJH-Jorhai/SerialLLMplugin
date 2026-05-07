export class RingBuffer<T> {
  private readonly items: T[] = [];

  public constructor(private readonly maxItems: number) {
    if (!Number.isInteger(maxItems) || maxItems <= 0) {
      throw new Error("RingBuffer maxItems must be a positive integer.");
    }
  }

  public append(item: T): void {
    this.items.push(item);
    if (this.items.length > this.maxItems) {
      this.items.splice(0, this.items.length - this.maxItems);
    }
  }

  public values(): T[] {
    return [...this.items];
  }

  public latestWhere(predicate: (item: T) => boolean): T[] {
    return this.items.filter(predicate);
  }

  public clear(): void {
    this.items.length = 0;
  }

  public get size(): number {
    return this.items.length;
  }
}
