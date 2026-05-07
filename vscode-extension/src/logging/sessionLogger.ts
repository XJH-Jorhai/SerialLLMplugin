import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import {
  BridgeEvent,
  CommandEntry,
  ParsedFrame,
  RawLineEntry
} from "../bridge/types";
import { formatClockTime, formatSessionDirectoryStamp } from "../util/time";
import { resolveSessionBaseDirectory, sanitizePathSegment } from "./paths";
import { LoggerStartOptions, SessionLoggerState } from "./types";

export class SessionLogger {
  private state: SessionLoggerState = { active: false };
  private rawStream: fs.WriteStream | undefined;
  private parsedStream: fs.WriteStream | undefined;
  private eventsStream: fs.WriteStream | undefined;
  private commandsStream: fs.WriteStream | undefined;

  public get sessionDirectory(): string | undefined {
    return this.state.sessionDirectory;
  }

  public async start(options: LoggerStartOptions): Promise<SessionLoggerState> {
    await this.stop();

    const baseDirectory = resolveSessionBaseDirectory(
      options.workspaceRoot,
      options.directory
    );
    const sessionName = `${formatSessionDirectoryStamp(new Date())}_${sanitizePathSegment(
      options.projectName ?? "workspace"
    )}`;
    const sessionDirectory = path.join(baseDirectory, sessionName);
    await fsp.mkdir(sessionDirectory, { recursive: true });

    await fsp.writeFile(
      path.join(sessionDirectory, "session.json"),
      `${JSON.stringify(options.session, null, 2)}\n`,
      "utf8"
    );

    this.rawStream = fs.createWriteStream(path.join(sessionDirectory, "raw.log"), {
      flags: "a"
    });
    this.parsedStream = fs.createWriteStream(path.join(sessionDirectory, "parsed.jsonl"), {
      flags: "a"
    });
    this.eventsStream = fs.createWriteStream(path.join(sessionDirectory, "events.jsonl"), {
      flags: "a"
    });
    this.commandsStream = fs.createWriteStream(path.join(sessionDirectory, "commands.jsonl"), {
      flags: "a"
    });

    this.state = { active: true, sessionDirectory };
    return { ...this.state };
  }

  public async stop(): Promise<void> {
    await Promise.all([
      this.endStream(this.rawStream),
      this.endStream(this.parsedStream),
      this.endStream(this.eventsStream),
      this.endStream(this.commandsStream)
    ]);
    this.rawStream = undefined;
    this.parsedStream = undefined;
    this.eventsStream = undefined;
    this.commandsStream = undefined;
    this.state = { active: false, sessionDirectory: this.state.sessionDirectory };
  }

  public logRaw(entry: RawLineEntry): void {
    this.rawStream?.write(`[${formatClockTime(new Date(entry.ts * 1000))}] ${entry.data}\n`);
  }

  public logParsed(entry: ParsedFrame): void {
    this.writeJsonLine(this.parsedStream, entry);
  }

  public logEvent(entry: BridgeEvent): void {
    this.writeJsonLine(this.eventsStream, entry);
  }

  public logCommand(entry: CommandEntry): void {
    this.writeJsonLine(this.commandsStream, entry);
  }

  private writeJsonLine(stream: fs.WriteStream | undefined, value: unknown): void {
    stream?.write(`${JSON.stringify(value)}\n`);
  }

  private async endStream(stream: fs.WriteStream | undefined): Promise<void> {
    if (!stream) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      stream.once("error", reject);
      stream.end(() => {
        stream.off("error", reject);
        resolve();
      });
    });
  }
}
