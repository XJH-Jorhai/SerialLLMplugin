import { HttpServer } from "../api/httpServer";
import { BridgeApiProvider } from "../api/types";
import { WebSocketHub } from "../api/websocketHub";
import { BridgeConfig, bridgeConfigSchema } from "../config/schema";
import { SessionLogger } from "../logging/sessionLogger";
import { createProtocolParser } from "../protocol/parser";
import { ParserOutput, ProtocolParser } from "../protocol/types";
import { BridgeError } from "../util/errors";
import { isoNow, nowEpochSeconds } from "../util/time";
import { RingBuffer } from "./ringBuffer";
import { SerialManager } from "./serialManager";
import {
  BridgeEvent,
  BridgeProjectMetadata,
  BridgeSession,
  CommandEntry,
  LatestData,
  ParsedFrame,
  RawDataEntry,
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
  private readonly rawData: RingBuffer<RawDataEntry>;
  private readonly rawLines: RingBuffer<RawLineEntry>;
  private readonly parsed: RingBuffer<ParsedFrame>;
  private readonly events: RingBuffer<BridgeEvent>;
  private readonly commands: RingBuffer<CommandEntry>;
  private config: BridgeConfig = bridgeConfigSchema.parse({});
  private parser: ProtocolParser = createProtocolParser(this.config.protocol.type);
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
    this.rawData = new RingBuffer<RawDataEntry>(maxRecentItems);
    this.rawLines = new RingBuffer<RawLineEntry>(maxRecentItems);
    this.parsed = new RingBuffer<ParsedFrame>(maxRecentItems);
    this.events = new RingBuffer<BridgeEvent>(maxRecentItems);
    this.commands = new RingBuffer<CommandEntry>(maxRecentItems);

    this.serialManager.onRawData((entry) => {
      this.recordRawData({
        ts: entry.ts,
        data: entry.text,
        bytes: entry.data.length,
        port: entry.port
      });
    });
    this.serialManager.onRawLine((line) => {
      this.recordRawLineEntry({ ts: line.ts, data: line.data });
    });
    this.serialManager.onEvent((event) => {
      this.recordEventEntry(event);
    });
  }

  public async start(): Promise<BridgeSession> {
    if (this.running) {
      return this.getSession();
    }

    this.config = await this.configProvider();
    this.ensureLocalHost(this.config.bridge.host);
    const requestedProtocol = this.config.protocol.type;
    this.parser = createProtocolParser(requestedProtocol);
    const unsupportedProtocol =
      this.parser.type === requestedProtocol ? undefined : requestedProtocol;
    if (unsupportedProtocol) {
      this.config = {
        ...this.config,
        protocol: {
          ...this.config.protocol,
          type: this.parser.type,
          fallback: unsupportedProtocol
        }
      };
    }
    this.startedAt = isoNow();

    try {
      if (this.config.logging.enabled) {
        await this.sessionLogger.startSession(this.buildSession(true));
      }

      await this.httpServer.start(this.config.bridge.host, this.config.bridge.port);
      const server = this.httpServer.nodeServer;
      if (server) {
        this.webSocketHub.start(server, this.config.bridge.websocketPath);
      }

      this.running = true;
      this.recordEvent("info", "Bridge started.", "bridge.started");
      if (unsupportedProtocol) {
        this.recordEvent(
          "warning",
          `Protocol "${unsupportedProtocol}" is not implemented in MVP1; using ${this.parser.type}.`,
          "protocol.unsupported"
        );
      }
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

    const errors: unknown[] = [];
    await this.tryStopStep(() => this.closeSerial(), errors);
    await this.tryStopStep(() => this.webSocketHub.stop(), errors);
    await this.tryStopStep(() => this.httpServer.stop(), errors);
    await this.tryStopStep(() => this.sessionLogger.close(), errors);
    this.running = false;
    this.startedAt = undefined;

    if (errors.length > 0) {
      throw errors[0];
    }
  }

  public getSession(): BridgeSession {
    return this.buildSession(this.running);
  }

  public async getConfigSnapshot(): Promise<BridgeConfig> {
    const config = this.running ? this.config : await this.configProvider();
    this.ensureLocalHost(config.bridge.host);
    return config;
  }

  private buildSession(running: boolean): BridgeSession {
    return {
      running,
      project: this.config.project.name,
      workspace: this.config.workspaceRoot ?? this.config.project.root,
      mcu: this.config.mcu.target,
      elf: this.config.project.elf,
      projectMetadata: this.buildProjectMetadata(),
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

  private buildProjectMetadata(): BridgeProjectMetadata | undefined {
    const metadata: BridgeProjectMetadata = {
      configPath: this.config.projectConfigPath,
      project: this.config.project,
      mcu: this.config.mcu,
      build: this.config.build,
      flash: this.config.flash,
      debug: this.config.debug,
      serial: {
        preferredPort: this.config.serial.preferredPort,
        fallbackScan: this.config.serial.fallbackScan,
        baudrate: this.config.serial.defaultBaudrate,
        dataBits: this.config.serial.dataBits,
        parity: this.config.serial.parity,
        stopBits: this.config.serial.stopBits,
        uart: this.config.serial.uart,
        tx: this.config.serial.tx,
        rx: this.config.serial.rx
      },
      protocol: this.config.protocol
    };

    return hasProjectMetadata(metadata) ? metadata : undefined;
  }

  public async listPorts(): Promise<SerialPortInfo[]> {
    return this.serialManager.listPorts();
  }

  public async openSerial(options: SerialOpenOptions): Promise<SerialState> {
    if (!this.running) {
      await this.start();
    }
    await this.serialManager.open(this.withConfiguredSerialDefaults(options));
    return this.serialManager.getState();
  }

  public async closeSerial(): Promise<SerialState> {
    await this.serialManager.close();
    return this.serialManager.getState();
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
    this.commands.push(command);
    this.sessionLogger.logCommand(command);
    this.webSocketHub.broadcast({ type: "cmd_tx", ts: command.ts, data: command.data });
    return command;
  }

  public getLatest(seconds?: number): LatestData {
    const windowSeconds = seconds ?? this.config.bridge.latestWindowSeconds;
    const cutoff = nowEpochSeconds() - windowSeconds;
    const rawData = this.rawData.latestSince(cutoff);
    const rawLines = this.rawLines.latestSince(cutoff);
    const parsed = this.parsed.latestSince(cutoff);
    return {
      windowSeconds,
      rawData,
      rawLines,
      parsed,
      samples: parsed.filter((entry): entry is SampleFrame => entry.type === "sample"),
      events: this.events.latestSince(cutoff),
      commands: this.commands.latestSince(cutoff)
    };
  }

  public recordRawData(entry: RawDataEntry): void {
    if (entry.data.length === 0 && entry.bytes === 0) {
      return;
    }

    // Raw data is recorded before protocol parsing by design.
    this.rawData.push(entry);
    this.sessionLogger.logRawData(entry);
    this.webSocketHub.broadcast({ type: "raw", ts: entry.ts, data: entry.data });

    this.recordParserOutputs(this.parser.pushText(entry.data, entry.ts));
  }

  public recordRawLine(line: RawLineEntry): void {
    // Raw data is recorded before protocol parsing by design.
    this.recordRawLineEntry(line);
    this.sessionLogger.logRawLine(line);
    this.webSocketHub.broadcast({ type: "raw", ts: line.ts, data: line.data });

    this.recordParserOutputs(this.parser.pushText(`${line.data}\n`, line.ts));
  }

  public recordParsed(frame: ParsedFrame): void {
    this.parsed.push(frame);
    this.sessionLogger.logParsed(frame);
    this.webSocketHub.broadcast({ type: "parsed", ts: frame.ts, data: frame });
  }

  private recordRawLineEntry(line: RawLineEntry): void {
    this.rawLines.push(line);
  }

  public recordEvent(
    level: BridgeEvent["level"],
    message: string,
    code?: string
  ): void {
    this.recordEventEntry({
      ts: nowEpochSeconds(),
      level,
      message,
      code
    });
  }

  private recordEventEntry(event: BridgeEvent): void {
    this.events.push(event);
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

  private withConfiguredSerialDefaults(options: SerialOpenOptions): SerialOpenOptions {
    return {
      path: options.path,
      baudrate: options.baudrate ?? this.config.serial.defaultBaudrate,
      dataBits: options.dataBits ?? this.config.serial.dataBits,
      parity: options.parity ?? this.config.serial.parity,
      stopBits: options.stopBits ?? this.config.serial.stopBits
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
      await this.sessionLogger.close();
    } catch {
      // Startup cleanup should not mask the original startup failure.
    }
  }

  private async tryStopStep(
    step: () => Promise<unknown>,
    errors: unknown[]
  ): Promise<void> {
    try {
      await step();
    } catch (error: unknown) {
      errors.push(error);
    }
  }

  private recordParserOutputs(outputs: ParserOutput[]): void {
    for (const output of outputs) {
      switch (output.type) {
        case "raw":
        case "json":
          this.recordParsed(output);
          break;
        case "event":
          this.recordEventEntry({
            ts: output.ts,
            level: output.level,
            message: output.message,
            code: output.code
          });
          break;
      }
    }
  }
}

function hasProjectMetadata(metadata: BridgeProjectMetadata): boolean {
  return Boolean(
    metadata.configPath ||
      hasDefinedValue(metadata.project) ||
      hasDefinedValue(metadata.mcu) ||
      hasDefinedValue(metadata.build) ||
      hasDefinedValue(metadata.flash) ||
      hasDefinedValue(metadata.debug)
  );
}

function hasDefinedValue(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return value !== undefined;
  }
  return Object.values(value).some((entry) => {
    if (Array.isArray(entry)) {
      return entry.length > 0;
    }
    if (typeof entry === "object" && entry !== null) {
      return hasDefinedValue(entry);
    }
    return entry !== undefined;
  });
}
