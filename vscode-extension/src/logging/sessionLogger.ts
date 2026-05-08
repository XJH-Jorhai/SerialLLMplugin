import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import {
  BridgeEvent,
  CommandEntry,
  ParsedFrame,
  RawLineEntry
} from "../bridge/types";
import { formatClockTime, nowEpochSeconds } from "../util/time";
import {
  buildSessionDirectoryName,
  resolveSessionBaseDirectory,
  resolveSessionLogFiles
} from "./paths";
import {
  LoggerStartOptions,
  SessionInfo,
  SessionLoggerState,
  SessionMetadata
} from "./types";

interface SessionStreams {
  raw: fs.WriteStream;
  parsed: fs.WriteStream;
  events: fs.WriteStream;
  commands: fs.WriteStream;
}

export class SessionLogger {
  private sessionInfo: SessionInfo | undefined;
  private streams: SessionStreams | undefined;
  private closePromise: Promise<void> | undefined;

  public get sessionDirectory(): string | undefined {
    return this.sessionInfo?.directory;
  }

  public async startSession(metadata: SessionMetadata): Promise<SessionInfo> {
    await this.close();

    const startedAt = normalizeStartedAt(metadata.startedAt);
    const workspaceRoot = metadata.workspace ?? process.cwd();
    const loggingMetadata = metadata.logging ?? {};
    const loggingDirectory = loggingMetadata.directory ?? ".serial-sessions";
    const baseDirectory = resolveSessionBaseDirectory(workspaceRoot, loggingDirectory);
    const projectName =
      metadata.project ?? (metadata.workspace ? path.basename(metadata.workspace) : "workspace");
    const sessionDirectory = path.join(
      baseDirectory,
      buildSessionDirectoryName(new Date(startedAt), projectName)
    );
    const files = resolveSessionLogFiles(sessionDirectory);
    const normalizedMetadata: SessionMetadata = {
      ...metadata,
      startedAt,
      logging: {
        ...loggingMetadata,
        enabled: loggingMetadata.enabled ?? true,
        directory: loggingDirectory,
        sessionDirectory
      }
    };

    await fsp.mkdir(sessionDirectory, { recursive: true });
    await Promise.all([
      fsp.writeFile(files.rawLog, "", { encoding: "utf8", flag: "w" }),
      fsp.writeFile(files.parsedJsonl, "", { encoding: "utf8", flag: "w" }),
      fsp.writeFile(files.eventsJsonl, "", { encoding: "utf8", flag: "w" }),
      fsp.writeFile(files.commandsJsonl, "", { encoding: "utf8", flag: "w" })
    ]);
    await fsp.writeFile(
      files.sessionJson,
      `${JSON.stringify(normalizedMetadata, null, 2)}\n`,
      "utf8"
    );

    this.streams = {
      raw: fs.createWriteStream(files.rawLog, { flags: "a", encoding: "utf8" }),
      parsed: fs.createWriteStream(files.parsedJsonl, {
        flags: "a",
        encoding: "utf8"
      }),
      events: fs.createWriteStream(files.eventsJsonl, {
        flags: "a",
        encoding: "utf8"
      }),
      commands: fs.createWriteStream(files.commandsJsonl, {
        flags: "a",
        encoding: "utf8"
      })
    };

    this.sessionInfo = {
      directory: sessionDirectory,
      startedAt,
      files,
      metadata: normalizedMetadata
    };
    return { ...this.sessionInfo, files: { ...this.sessionInfo.files } };
  }

  public async start(options: LoggerStartOptions): Promise<SessionLoggerState> {
    const metadata: SessionMetadata = {
      ...options.session,
      project: options.session.project ?? options.projectName,
      workspace: options.session.workspace ?? options.workspaceRoot,
      logging: {
        ...options.session.logging,
        directory: options.directory
      }
    };
    const info = await this.startSession(metadata);
    return { active: true, sessionDirectory: info.directory };
  }

  public logRawLine(line: string, ts?: number): void;
  public logRawLine(entry: RawLineEntry): void;
  public logRawLine(lineOrEntry: string | RawLineEntry, ts = nowEpochSeconds()): void {
    const entry =
      typeof lineOrEntry === "string"
        ? { ts, data: lineOrEntry }
        : lineOrEntry;
    this.streams?.raw.write(
      `[${formatClockTime(new Date(entry.ts * 1000))}] ${entry.data}\n`
    );
  }

  public logRaw(entry: RawLineEntry): void {
    this.logRawLine(entry);
  }

  public logParsed(item: ParsedFrame): void {
    this.writeJsonLine(this.streams?.parsed, item);
  }

  public logEvent(event: BridgeEvent): void {
    this.writeJsonLine(this.streams?.events, event);
  }

  public logCommand(command: CommandEntry): void {
    this.writeJsonLine(this.streams?.commands, command);
  }

  public async close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }

    const streams = this.streams;
    this.streams = undefined;
    if (!streams) {
      return;
    }

    this.closePromise = Promise.all([
      this.endStream(streams.raw),
      this.endStream(streams.parsed),
      this.endStream(streams.events),
      this.endStream(streams.commands)
    ])
      .then(() => undefined)
      .finally(() => {
        this.closePromise = undefined;
      });
    return this.closePromise;
  }

  public async stop(): Promise<void> {
    await this.close();
  }

  public getSessionInfo(): SessionInfo | undefined {
    if (!this.sessionInfo) {
      return undefined;
    }
    return { ...this.sessionInfo, files: { ...this.sessionInfo.files } };
  }

  private writeJsonLine(stream: fs.WriteStream | undefined, value: unknown): void {
    stream?.write(`${JSON.stringify(value)}\n`);
  }

  private async endStream(stream: fs.WriteStream): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        stream.off("finish", onFinish);
        reject(error);
      };
      const onFinish = (): void => {
        stream.off("error", onError);
        resolve();
      };

      stream.once("error", onError);
      stream.once("finish", onFinish);
      stream.end();
    });
  }
}

function normalizeStartedAt(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : value;
}
