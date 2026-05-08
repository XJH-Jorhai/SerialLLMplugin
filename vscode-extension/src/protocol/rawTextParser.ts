import { nowEpochSeconds } from "../util/time";
import { LineBuffer } from "./lineBuffer";
import { LineParser, ParserOutput } from "./types";

export class RawTextParser implements LineParser {
  public readonly type = "raw-text";
  private readonly lines = new LineBuffer<ParserOutput>(parseRawTextLine);

  public pushText(text: string, ts = nowEpochSeconds()): ParserOutput[] {
    return this.lines.pushText(text, ts);
  }

  public flush(ts = nowEpochSeconds()): ParserOutput[] {
    return this.lines.flush(ts);
  }
}

export function parseRawTextLine(line: string, ts: number): ParserOutput[] {
  if (line.length === 0) {
    return [];
  }

  return [{ ts, type: "raw", text: line }];
}
