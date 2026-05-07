import { JsonLineParser } from "./jsonLineParser";
import { RawTextParser } from "./rawTextParser";
import { ProtocolParser } from "./types";

export function createProtocolParser(type: string): ProtocolParser {
  switch (type) {
    case "json-line":
      return new JsonLineParser();
    case "raw-text":
      return new RawTextParser();
    default:
      // TODO(mvp1-parser): Surface unsupported parser selection as a bridge event.
      return new RawTextParser();
  }
}
