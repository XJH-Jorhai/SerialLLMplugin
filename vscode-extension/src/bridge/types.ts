export type EventLevel = "debug" | "info" | "warning" | "error";

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  pnpId?: string;
  locationId?: string;
  friendlyName?: string;
}

export type SerialDataBits = 5 | 6 | 7 | 8;
export type SerialParity = "none" | "even" | "mark" | "odd" | "space";
export type SerialStopBits = 1 | 1.5 | 2;

export interface SerialOpenOptions {
  path: string;
  baudrate?: number;
  dataBits?: SerialDataBits;
  parity?: SerialParity;
  stopBits?: SerialStopBits;
}

export interface SerialState {
  open: boolean;
  port?: string;
  baudrate?: number;
  dataBits?: SerialDataBits;
  parity?: SerialParity;
  stopBits?: SerialStopBits;
}

export interface SerialRawDataEvent {
  ts: number;
  port: string;
  data: Buffer;
  text: string;
}

export interface SerialRawLineEvent extends RawLineEntry {
  port: string;
}

export type SerialEventHandler<T> = (event: T) => void;
export type SerialUnsubscribe = () => void;

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

export interface RawDataEntry {
  ts: number;
  data: string;
  bytes: number;
  port?: string;
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
  rawData: RawDataEntry[];
  rawLines: RawLineEntry[];
  parsed: ParsedFrame[];
  samples: SampleFrame[];
  events: BridgeEvent[];
  commands: CommandEntry[];
}
