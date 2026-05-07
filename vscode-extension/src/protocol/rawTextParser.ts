import { ParserResult, ProtocolParser } from "./types";

export class RawTextParser implements ProtocolParser {
  public readonly type = "raw-text";

  public parseLine(line: string, ts: number): ParserResult {
    return {
      frames: [{ ts, type: "raw", text: line }],
      events: []
    };
  }
}

export function parseRawTextLine(line: string, ts: number): ParserResult {
  return new RawTextParser().parseLine(line, ts);
}
