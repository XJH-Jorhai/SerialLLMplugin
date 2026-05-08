import { nowEpochSeconds } from "../util/time";
import { LineBuffer } from "./lineBuffer";
import { LineParser, ParserOutput } from "./types";

export class JsonLineParser implements LineParser {
  public readonly type = "json-line";
  private readonly lines = new LineBuffer<ParserOutput>(parseJsonLine);

  public pushText(text: string, ts = nowEpochSeconds()): ParserOutput[] {
    return this.lines.pushText(text, ts);
  }

  public flush(ts = nowEpochSeconds()): ParserOutput[] {
    return this.lines.flush(ts);
  }
}

export function parseJsonLine(line: string, ts: number): ParserOutput[] {
  if (line.length === 0) {
    return [];
  }

  try {
    const value = JSON.parse(line) as unknown;
    if (!isJsonObject(value)) {
      return [
        {
          ts,
          type: "event",
          level: "warning",
          message: "JSON line parser expected a JSON object.",
          raw: line,
          code: "parser.jsonLine.nonObject"
        }
      ];
    }

    return [{ ts, type: "json", value }];
  } catch (error: unknown) {
    return [
      {
        ts,
        type: "event",
        level: "warning",
        message: `JSON line parser failed: ${errorMessage(error)}`,
        raw: line,
        code: "parser.jsonLine.invalid"
      }
    ];
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
