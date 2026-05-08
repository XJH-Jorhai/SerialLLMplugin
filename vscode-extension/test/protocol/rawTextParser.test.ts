import { describe, expect, it } from "vitest";
import { createParser } from "../../src/protocol/parser";
import { RawTextParser, parseRawTextLine } from "../../src/protocol/rawTextParser";

describe("RawTextParser", () => {
  it("wraps a raw line as a parsed raw frame", () => {
    const result = parseRawTextLine("System boot", 123);

    expect(result).toEqual([{ ts: 123, type: "raw", text: "System boot" }]);
  });

  it("parses completed LF lines from pushed text", () => {
    const parser = createParser("raw-text");

    expect(parser.pushText("System boot\n", 123)).toEqual([
      { ts: 123, type: "raw", text: "System boot" }
    ]);
  });

  it("handles partial lines across chunks", () => {
    const parser = new RawTextParser();

    expect(parser.pushText("System ", 1)).toEqual([]);
    expect(parser.pushText("boot\n", 2)).toEqual([
      { ts: 2, type: "raw", text: "System boot" }
    ]);
  });

  it("supports CRLF, LF, and CR line endings", () => {
    const parser = new RawTextParser();

    expect(parser.pushText("a\r\nb\nc\r", 10)).toEqual([
      { ts: 10, type: "raw", text: "a" },
      { ts: 10, type: "raw", text: "b" },
      { ts: 10, type: "raw", text: "c" }
    ]);
  });

  it("does not create an empty line when CRLF is split across chunks", () => {
    const parser = new RawTextParser();

    expect(parser.pushText("a\r", 10)).toEqual([
      { ts: 10, type: "raw", text: "a" }
    ]);
    expect(parser.pushText("\nb\r\n", 11)).toEqual([
      { ts: 11, type: "raw", text: "b" }
    ]);
  });

  it("flushes trailing partial data", () => {
    const parser = new RawTextParser();

    expect(parser.pushText("tail", 1)).toEqual([]);
    expect(parser.flush(2)).toEqual([{ ts: 2, type: "raw", text: "tail" }]);
  });

  it("ignores empty lines consistently", () => {
    const parser = new RawTextParser();

    expect(parser.pushText("\n\r\n\r", 99)).toEqual([]);
    expect(parser.flush(100)).toEqual([]);
  });
});
