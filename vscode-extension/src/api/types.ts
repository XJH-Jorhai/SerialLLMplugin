import { z } from "zod";
import { DEFAULT_BAUDRATE } from "../config/defaults";
import {
  BridgeSession,
  CommandEntry,
  LatestData,
  LatestDataLimits,
  ParsedFrame,
  SerialOpenOptions,
  SerialPortInfo,
  SerialState
} from "../bridge/types";

export interface BridgeApiProvider {
  getSession(): BridgeSession;
  listPorts(): Promise<SerialPortInfo[]>;
  openSerial(options: SerialOpenOptions): Promise<SerialState>;
  closeSerial(): Promise<SerialState>;
  sendText(data: string): Promise<CommandEntry>;
  getLatest(seconds?: number, limits?: LatestDataLimits): LatestData;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  ok: false;
  error: ApiErrorBody;
}

export interface SerialSendResponse {
  ok: true;
  command: CommandEntry;
}

const serialDataBitsSchema = z.union([
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8)
]);
const serialParitySchema = z.enum(["none", "even", "mark", "odd", "space"]);
const serialStopBitsSchema = z.union([z.literal(1), z.literal(1.5), z.literal(2)]);

export const serialOpenRequestSchema = z.object({
  path: z.string().min(1),
  baudrate: z.number().int().positive().default(DEFAULT_BAUDRATE),
  dataBits: serialDataBitsSchema.optional(),
  parity: serialParitySchema.optional(),
  stopBits: serialStopBitsSchema.optional()
});

export const serialSendRequestSchema = z.object({
  data: z.string().min(1),
  encoding: z.literal("text").default("text")
});

export type StreamMessage =
  | { type: "raw"; ts: number; data: string }
  | { type: "parsed"; ts: number; data: ParsedFrame }
  | { type: "event"; ts: number; level: string; message: string; code?: string }
  | { type: "cmd_tx"; ts: number; data: string };
