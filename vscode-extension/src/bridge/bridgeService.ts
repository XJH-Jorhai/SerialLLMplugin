import { HttpServer } from "../api/httpServer";
import { BridgeApiProvider } from "../api/types";
import { WebSocketHub } from "../api/websocketHub";
import { BridgeConfig, bridgeConfigSchema } from "../config/schema";
import { SessionLogger } from "../logging/sessionLogger";
import { BridgeError } from "../util/errors";
import { isoNow, nowEpochSeconds } from "../util/time";
import { RingBuffer } from "./ringBuffer";
import { SerialManager } from "./serialManager";
import {
  BridgeEvent,
  BridgeSession,
  CommandEntry,
  LatestData,
  ParsedFrame,
  RawLineEntry,
  SampleFrame,
  SerialOpenOptions,
  SerialPortInfo,
  SerialState
} from "./types";

export interface BridgeServiceOptions {
  configProvider?: () => Promise<BridgeConfig>;
  serialManager?: SerialManager;
  sessionLogger?: SessionLogger;
  httpServer?: HttpServer;
  webSocketHub?: WebSocketHub;
  maxRecentItems?: number;
}

export class BridgeService implements BridgeApiProvider {
  private readonly configProvider: () => Promise<BridgeConfig>;
  private readonly serialManager: SerialManager;
  private readonly sessionLogger: SessionLogger;
  private readonly httpServer: HttpServer;
  private readonly webSocketHub: WebSocketHub;
  private readonly rawLines: RingBuffer<RawLineEntry>;
  private readonly parsed: RingBuffer<ParsedFrame>;
  private readonly events: RingBuffer<BridgeEvent>;
  private readonly commands: RingBuffer<CommandEntry>;
  private config: BridgeConfig = bridgeConfigSchema.parse({});
  private startedAt: string | undefined;
  private running = false;

  public constructor(options: BridgeServiceOptions = {}) {
    this.configProvider =
      options.configProvider ?? (() => Promise.resolve(bridgeConfigSchema.parse({})));
    this.serialManager = options.serialManager ?? new SerialManager();
    this.sessionLogger = options.sessionLogger ?? new SessionLogger();
    this.webSocketHub = options.webSocketHub ?? new WebSocketHub();
    this.httpServer = options.httpServer ?? new HttpServer(this);

    const maxRecentItems = options.maxRecentItems ?? 1000;
    this.rawLines = new RingBuffer<RawLineEntry>(maxRecentItems);
    this.parsed = new RingBuffer<ParsedFrame>(maxRecentItems);
    this.events = new RingBuffer<BridgeEvent>(maxRecentItems);
    this.commands = new RingBuffer<CommandEntry>(maxRecentItems);
  }

  public async start(): Promise<BridgeSession> {
    if (this.running) {
      return this.getSession();
    }

    this.config = await this.configProvider();
    this.ensureLocalHost(this.config.bridge.host);
    this.startedAt = isoNow();

    try {
      if (this.config.logging.enabled) {
        await this.sessionLogger.start({
          workspaceRoot: this.config.workspaceRoot ?? process.cwd(),
          directory: this.config.logging.directory,
          projectName: this.config.project.name,
          session: this.buildSession(true)
        });
      }

      await this.httpServer.start(this.config.bridge.host, this.config.bridge.port);
      const server = this.httpServer.nodeServer;
      if (server) {
        this.webSocketHub.start(server, this.config.bridge.websocketPath);
      }

      this.running = true;
      this.recordEvent("info", "Bridge started.", "bridge.started");
      return this.getSession();
    } catch (error: unknown) {
      await this.cleanupFailedStart();
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (this.running) {
      this.recordEvent("info", "Bridge stopped.", "bridge.stopped");
    }
    await this.closeSerial();
    await this.webSocketHub.stop();
    await this.httpServer.stop();
    await this.sessionLogger.stop();
    this.running = false;
    this.startedAt = undefined;
  }

  public getSession(): BridgeSession {
    return this.buildSession(this.running);
  }

  private buildSession(running: boolean): BridgeSession {
    return {
      running,
      project: this.config.project.name,
      workspace: this.config.workspaceRoot ?? this.config.project.root,
      mcu: this.config.mcu.target,
      elf: this.config.project.elf,
      serial: this.getReportedSerialState(),
      protocol: this.config.protocol.type,
      startedAt: this.startedAt,
      api: {
        host: this.config.bridge.host,
        port: this.config.bridge.port,
        websocketPath: this.config.bridge.websocketPath
      },
      logging: {
        enabled: this.config.logging.enabled,
        directory: this.config.logging.directory,
        sessionDirectory: this.sessionLogger.sessionDirectory
      }
    };
  }

  public async listPorts(): Promise<SerialPortInfo[]> {
    return this.serialManager.listPorts();
  }

  public async openSerial(options: SerialOpenOptions): Promise<SerialState> {
    if (!this.running) {
      await this.start();
    }
    return this.serialManager.open(options);
  }

  public async closeSerial(): Promise<SerialState> {
    return this.serialManager.close();
  }

  public async sendText(data: string): Promise<CommandEntry> {
    if (data.length === 0) {
      throw new BridgeError("Cannot send an empty command.", "serial.command.empty");
    }

    await this.serialManager.writeText(data);
    const command: CommandEntry = {
      ts: nowEpochSeconds(),
      encoding: "text",
      data
    };
    this.commands.append(command);
    this.sessionLogger.logCommand(command);
    this.webSocketHub.broadcast({ type: "cmd_tx", ts: command.ts, data: command.data });
    return command;
  }

  public getLatest(seconds?: number): LatestData {
    const windowSeconds = seconds ?? this.config.bridge.latestWindowSeconds;
    const cutoff = nowEpochSeconds() - windowSeconds;
    const rawLines = this.rawLines.latestWhere((entry) => entry.ts >= cutoff);
    const parsed = this.parsed.latestWhere((entry) => entry.ts >= cutoff);
    return {
      windowSeconds,
      rawLines,
      parsed,
      samples: parsed.filter((entry): entry is SampleFrame => entry.type === "sample"),
      events: this.events.latestWhere((entry) => entry.ts >= cutoff),
      commands: this.commands.latestWhere((entry) => entry.ts >= cutoff)
    };
  }

  public recordRawLine(line: RawLineEntry): void {
    // Raw data is recorded before protocol parsing by design.
    this.rawLines.append(line);
    this.sessionLogger.logRaw(line);
    this.webSocketHub.broadcast({ type: "raw", ts: line.ts, data: line.data });

    // TODO(mvp1-parser): Parse raw text/json-line frames and log recoverable parser events.
  }

  public recordParsed(frame: ParsedFrame): void {
    this.parsed.append(frame);
    this.sessionLogger.logParsed(frame);
    this.webSocketHub.broadcast(frame);
  }

  public recordEvent(
    level: BridgeEvent["level"],
    message: string,
    code?: string
  ): void {
    const event: BridgeEvent = {
      ts: nowEpochSeconds(),
      level,
      message,
      code
    };
    this.events.append(event);
    this.sessionLogger.logEvent(event);
    this.webSocketHub.broadcast({
      type: "event",
      ts: event.ts,
      level: event.level,
      message: event.message,
      code: event.code
    });
  }

  private ensureLocalHost(host: string): void {
    const normalized = host.trim().toLowerCase();
    if (normalized !== "127.0.0.1" && normalized !== "localhost" && normalized !== "::1") {
      throw new BridgeError(
        "MVP1 refuses non-local bridge hosts. Use 127.0.0.1 unless explicit external binding support is added.",
        "bridge.host.nonLocal"
      );
    }
  }

  private getReportedSerialState(): SerialState {
    const state = this.serialManager.getState();
    return {
      ...state,
      port: state.port ?? this.config.serial.preferredPort ?? undefined,
      baudrate: state.baudrate ?? this.config.serial.defaultBaudrate
    };
  }

  private async cleanupFailedStart(): Promise<void> {
    this.running = false;
    this.startedAt = undefined;
    try {
      await this.webSocketHub.stop();
    } catch {
      // Startup cleanup should not mask the original startup failure.
    }
    try {
      await this.httpServer.stop();
    } catch {
      // Startup cleanup should not mask the original startup failure.
    }
    try {
      await this.sessionLogger.stop();
    } catch {
      // Startup cleanup should not mask the original startup failure.
    }
  }
}
