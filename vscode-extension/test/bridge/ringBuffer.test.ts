import { describe, expect, it } from "vitest";
import { RingBuffer } from "../../src/bridge/ringBuffer";

describe("RingBuffer", () => {
  it("keeps only the most recent entries", () => {
    const buffer = new RingBuffer<number>(2);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);

    expect(buffer.latest()).toEqual([2, 3]);
    expect(buffer.size()).toBe(2);
  });

  it("filters timestamped entries without mutating the buffer", () => {
    const buffer = new RingBuffer<{ ts: number; value: string }>(3);
    buffer.push({ ts: 10, value: "old" });
    buffer.push({ ts: 20, value: "kept" });
    buffer.push({ ts: 30, value: "new" });

    expect(buffer.latestSince(20)).toEqual([
      { ts: 20, value: "kept" },
      { ts: 30, value: "new" }
    ]);
    expect(buffer.latest()).toEqual([
      { ts: 10, value: "old" },
      { ts: 20, value: "kept" },
      { ts: 30, value: "new" }
    ]);
  });

  it("clears entries", () => {
    const buffer = new RingBuffer<number>(2);
    buffer.push(1);
    buffer.clear();

    expect(buffer.latest()).toEqual([]);
    expect(buffer.size()).toBe(0);
  });
});
