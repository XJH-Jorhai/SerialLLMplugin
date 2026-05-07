import { z } from "zod";
import {
  BridgeSession,
  CommandEntry,
  LatestData,
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
  getLatest(seconds?: number): LatestData;
}

export const serialOpenRequestSchema = z.object({
  path: z.string().min(1),
  baudrate: z.number().int().positive()
});

export const serialSendRequestSchema = z.object({
  data: z.string().min(1),
  encoding: z.literal("text").default("text")
});

export type StreamMessage =
  | { type: "raw"; ts: number; data: string }
  | ParsedFrame
  | { type: "event"; ts: number; level: string; message: string; code?: string }
  | { type: "cmd_tx"; ts: number; data: string };
