export type EventLevel = "debug" | "info" | "warning" | "error";

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  friendlyName?: string;
}

export interface SerialOpenOptions {
  path: string;
  baudrate: number;
}

export interface SerialState {
  open: boolean;
  port?: string;
  baudrate?: number;
}

export interface BridgeSession {
  running: boolean;
  project?: string;
  workspace?: string;
  mcu?: string;
  elf?: string;
  serial: SerialState;
  protocol: string;
  startedAt?: string;
  api: {
    host: string;
    port: number;
    websocketPath: string;
  };
  logging: {
    enabled: boolean;
    directory: string;
    sessionDirectory?: string;
  };
}

export interface RawLineEntry {
  ts: number;
  data: string;
}

export interface SampleFrame {
  ts: number;
  type: "sample";
  channels: Record<string, number>;
}

export interface ParsedRawFrame {
  ts: number;
  type: "raw";
  text: string;
}

export interface ParsedJsonFrame {
  ts: number;
  type: "json";
  value: unknown;
}

export type ParsedFrame = ParsedRawFrame | ParsedJsonFrame | SampleFrame;

export interface BridgeEvent {
  ts: number;
  level: EventLevel;
  message: string;
  code?: string;
}

export interface CommandEntry {
  ts: number;
  encoding: "text";
  data: string;
}

export interface LatestData {
  windowSeconds: number;
  rawLines: RawLineEntry[];
  parsed: ParsedFrame[];
  samples: SampleFrame[];
  events: BridgeEvent[];
  commands: CommandEntry[];
}
