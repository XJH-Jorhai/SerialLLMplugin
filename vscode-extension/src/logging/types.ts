import { BridgeSession } from "../bridge/types";

export interface LoggerStartOptions {
  workspaceRoot: string;
  directory: string;
  projectName?: string;
  session: BridgeSession;
}

export interface SessionLoggerState {
  sessionDirectory?: string;
  active: boolean;
}
