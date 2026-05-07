import { describe, expect, it } from "vitest";
import { parseRawTextLine } from "../../src/protocol/rawTextParser";

describe("RawTextParser", () => {
  it("wraps a raw line as a parsed raw frame", () => {
    const result = parseRawTextLine("System boot", 123);

    expect(result.frames).toEqual([{ ts: 123, type: "raw", text: "System boot" }]);
    expect(result.events).toEqual([]);
  });
});
