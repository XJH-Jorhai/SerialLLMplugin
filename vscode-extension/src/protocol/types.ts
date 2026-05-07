import { BridgeEvent, ParsedFrame } from "../bridge/types";

export interface ParserResult {
  frames: ParsedFrame[];
  events: BridgeEvent[];
}

export interface ProtocolParser {
  readonly type: string;
  parseLine(line: string, ts: number): ParserResult;
}
