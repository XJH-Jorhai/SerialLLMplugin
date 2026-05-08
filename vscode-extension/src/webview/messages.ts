import { BridgeSession, LatestData, SerialPortInfo } from "../bridge/types";

export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "listPorts" }
  | { type: "startBridge" }
  | { type: "stopBridge" }
  | { type: "openSerial"; port: string; baudrate?: number }
  | { type: "closeSerial" }
  | { type: "sendLine"; value: string }
  | { type: "openSessionFolder" };

export type ExtensionToWebviewMessage =
  | { type: "session"; session: BridgeSession }
  | { type: "latest"; latest: LatestData }
  | { type: "ports"; ports: SerialPortInfo[] }
  | { type: "info"; message: string }
  | { type: "error"; message: string };
