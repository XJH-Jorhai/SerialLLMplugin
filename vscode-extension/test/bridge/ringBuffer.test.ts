import { describe, expect, it } from "vitest";
import { RingBuffer } from "../../src/bridge/ringBuffer";

describe("RingBuffer", () => {
  it("keeps only the most recent entries", () => {
    const buffer = new RingBuffer<number>(2);
    buffer.append(1);
    buffer.append(2);
    buffer.append(3);

    expect(buffer.values()).toEqual([2, 3]);
    expect(buffer.size).toBe(2);
  });

  it("filters entries without mutating the buffer", () => {
    const buffer = new RingBuffer<number>(3);
    buffer.append(1);
    buffer.append(2);
    buffer.append(3);

    expect(buffer.latestWhere((value) => value >= 2)).toEqual([2, 3]);
    expect(buffer.values()).toEqual([1, 2, 3]);
  });
});
