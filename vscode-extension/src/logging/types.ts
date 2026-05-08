import { BridgeSession, SerialState } from "../bridge/types";

export interface SessionMetadata {
  running?: boolean;
  project?: string;
  workspace?: string;
  mcu?: string;
  elf?: string;
  serial: SerialState;
  protocol: string;
  startedAt?: string;
  api?: BridgeSession["api"];
  logging?: Partial<BridgeSession["logging"]>;
}

export interface SessionLogFiles {
  sessionJson: string;
  rawLog: string;
  parsedJsonl: string;
  eventsJsonl: string;
  commandsJsonl: string;
}

export interface SessionInfo {
  directory: string;
  startedAt: string;
  files: SessionLogFiles;
  metadata: SessionMetadata;
}

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
