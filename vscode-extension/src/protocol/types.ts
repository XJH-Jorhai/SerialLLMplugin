export type ProtocolType = "raw-text" | "json-line";

export type ParserEventLevel = "debug" | "info" | "warning" | "error";

export interface RawTextOutput {
  ts: number;
  type: "raw";
  text: string;
}

export interface JsonLineOutput {
  ts: number;
  type: "json";
  value: Record<string, unknown>;
}

export interface ParserEventOutput {
  ts: number;
  type: "event";
  level: ParserEventLevel;
  message: string;
  raw?: string;
  code?: string;
}

export type ParserOutput = RawTextOutput | JsonLineOutput | ParserEventOutput;

export interface LineParser {
  readonly type: ProtocolType;
  pushText(text: string, ts?: number): ParserOutput[];
  flush(ts?: number): ParserOutput[];
}

export type ProtocolParser = LineParser;
