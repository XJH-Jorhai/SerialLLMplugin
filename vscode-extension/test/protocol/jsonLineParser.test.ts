import { describe, expect, it } from "vitest";
import { JsonLineParser } from "../../src/protocol/jsonLineParser";
import { createParser } from "../../src/protocol/parser";

describe("JsonLineParser", () => {
  it("parses a completed JSON object line", () => {
    const parser = createParser("json-line");

    expect(parser.pushText("{\"t\":123,\"ch\":\"adc\"}\n", 50)).toEqual([
      { ts: 50, type: "json", value: { t: 123, ch: "adc" } }
    ]);
  });

  it("returns a recoverable event for invalid JSON", () => {
    const parser = new JsonLineParser();

    const outputs = parser.pushText("{bad json}\n", 11);

    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      ts: 11,
      type: "event",
      level: "warning",
      raw: "{bad json}",
      code: "parser.jsonLine.invalid"
    });
  });

  it("returns recoverable events for non-object JSON", () => {
    const parser = new JsonLineParser();

    const outputs = parser.pushText("1\n[]\nnull\n\"text\"\n", 12);

    expect(outputs).toEqual([
      {
        ts: 12,
        type: "event",
        level: "warning",
        message: "JSON line parser expected a JSON object.",
        raw: "1",
        code: "parser.jsonLine.nonObject"
      },
      {
        ts: 12,
        type: "event",
        level: "warning",
        message: "JSON line parser expected a JSON object.",
        raw: "[]",
        code: "parser.jsonLine.nonObject"
      },
      {
        ts: 12,
        type: "event",
        level: "warning",
        message: "JSON line parser expected a JSON object.",
        raw: "null",
        code: "parser.jsonLine.nonObject"
      },
      {
        ts: 12,
        type: "event",
        level: "warning",
        message: "JSON line parser expected a JSON object.",
        raw: "\"text\"",
        code: "parser.jsonLine.nonObject"
      }
    ]);
  });

  it("handles partial JSON lines across chunks", () => {
    const parser = new JsonLineParser();

    expect(parser.pushText("{\"status\":", 1)).toEqual([]);
    expect(parser.pushText("\"ok\"}\n", 2)).toEqual([
      { ts: 2, type: "json", value: { status: "ok" } }
    ]);
  });

  it("supports CRLF, LF, and CR line endings", () => {
    const parser = new JsonLineParser();

    expect(parser.pushText("{\"a\":1}\r\n{\"b\":2}\n{\"c\":3}\r", 20)).toEqual([
      { ts: 20, type: "json", value: { a: 1 } },
      { ts: 20, type: "json", value: { b: 2 } },
      { ts: 20, type: "json", value: { c: 3 } }
    ]);
  });

  it("flushes trailing partial data", () => {
    const parser = new JsonLineParser();

    expect(parser.pushText("{\"done\":true}", 3)).toEqual([]);
    expect(parser.flush(4)).toEqual([{ ts: 4, type: "json", value: { done: true } }]);
  });

  it("ignores empty lines consistently", () => {
    const parser = new JsonLineParser();

    expect(parser.pushText("\n\r\n\r", 30)).toEqual([]);
    expect(parser.flush(31)).toEqual([]);
  });

  it("never throws on malformed input", () => {
    const parser = new JsonLineParser();

    expect(() => parser.pushText("{", 40)).not.toThrow();
    expect(() => parser.flush(41)).not.toThrow();

    expect(parser.pushText("{", 40)).toEqual([]);
    expect(parser.flush(41)[0]).toMatchObject({
      ts: 41,
      type: "event",
      level: "warning",
      raw: "{",
      code: "parser.jsonLine.invalid"
    });
  });
});
