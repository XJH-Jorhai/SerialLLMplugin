import * as path from "node:path";
import { formatSessionDirectoryStamp } from "../util/time";
import { SessionLogFiles } from "./types";

export const SESSION_LOG_FILE_NAMES = {
  sessionJson: "session.json",
  rawLog: "raw.log",
  parsedJsonl: "parsed.jsonl",
  eventsJsonl: "events.jsonl",
  commandsJsonl: "commands.jsonl"
} as const;

export function resolveSessionBaseDirectory(
  workspaceRoot: string,
  configuredDirectory: string
): string {
  return path.isAbsolute(configuredDirectory)
    ? configuredDirectory
    : path.join(workspaceRoot, configuredDirectory);
}

export function sanitizePathSegment(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized.length > 0 ? sanitized : "session";
}

export function buildSessionDirectoryName(startedAt: Date, projectName: string): string {
  return `${formatSessionDirectoryStamp(startedAt)}_${sanitizePathSegment(projectName)}`;
}

export function resolveSessionLogFiles(sessionDirectory: string): SessionLogFiles {
  return {
    sessionJson: path.join(sessionDirectory, SESSION_LOG_FILE_NAMES.sessionJson),
    rawLog: path.join(sessionDirectory, SESSION_LOG_FILE_NAMES.rawLog),
    parsedJsonl: path.join(sessionDirectory, SESSION_LOG_FILE_NAMES.parsedJsonl),
    eventsJsonl: path.join(sessionDirectory, SESSION_LOG_FILE_NAMES.eventsJsonl),
    commandsJsonl: path.join(sessionDirectory, SESSION_LOG_FILE_NAMES.commandsJsonl)
  };
}
