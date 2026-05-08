import { JsonLineParser } from "./jsonLineParser";
import { RawTextParser } from "./rawTextParser";
import { LineParser, ProtocolType } from "./types";

export function createParser(protocol: ProtocolType): LineParser {
  switch (protocol) {
    case "json-line":
      return new JsonLineParser();
    case "raw-text":
      return new RawTextParser();
  }
}

export function createProtocolParser(type: string): LineParser {
  if (isProtocolType(type)) {
    return createParser(type);
  }

  // TODO(mvp1-parser): Surface unsupported parser selection as a bridge event.
  return createParser("raw-text");
}

function isProtocolType(type: string): type is ProtocolType {
  return type === "raw-text" || type === "json-line";
}
