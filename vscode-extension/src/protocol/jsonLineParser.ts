import { asErrorMessage } from "../util/errors";
import { ParserResult, ProtocolParser } from "./types";

export class JsonLineParser implements ProtocolParser {
  public readonly type = "json-line";

  public parseLine(line: string, ts: number): ParserResult {
    try {
      return {
        frames: [{ ts, type: "json", value: JSON.parse(line) as unknown }],
        events: []
      };
    } catch (error: unknown) {
      return {
        frames: [],
        events: [
          {
            ts,
            level: "warning",
            message: `JSON line parser failed: ${asErrorMessage(error)}`,
            code: "parser.jsonLine.invalid"
          }
        ]
      };
    }
  }
}
