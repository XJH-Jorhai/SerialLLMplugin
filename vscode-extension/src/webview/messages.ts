import { BridgeSession, LatestData } from "../bridge/types";

export type WebviewToExtensionMessage =
  | { type: "refresh" }
  | { type: "sendLine"; value: string };

export type ExtensionToWebviewMessage =
  | { type: "session"; session: BridgeSession }
  | { type: "latest"; latest: LatestData }
  | { type: "error"; message: string };
