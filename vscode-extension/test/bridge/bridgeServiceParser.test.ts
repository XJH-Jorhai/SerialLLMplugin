import { EventEmitter } from "node:events";
import { Server } from "node:http";
import { describe, expect, it } from "vitest";
import { BridgeApiProvider } from "../../src/api/types";
import { HttpServer } from "../../src/api/httpServer";
import { BridgeService } from "../../src/bridge/bridgeService";
import {
  SerialManager,
  SerialPortFactoryOptions,
  SerialPortLike
} from "../../src/bridge/serialManager";
import { bridgeConfigSchema } from "../../src/config/schema";

describe("BridgeService parser integration", () => {
  it("records raw-text parser output after raw line logging", () => {
    const bridge = new BridgeService();

    bridge.recordRawLine({ ts: 100, data: "System boot" });

    expect(bridge.getLatest(Number.MAX_SAFE_INTEGER).parsed).toEqual([
      { ts: 100, type: "raw", text: "System boot" }
    ]);
  });

  it("uses the configured json-line parser for raw serial lines", async () => {
    const bridge = new BridgeService({
      configProvider: () =>
        Promise.resolve(
          bridgeConfigSchema.parse({
            logging: { enabled: false },
            protocol: { type: "json-line" }
          })
        ),
      httpServer: new StubHttpServer()
    });

    await bridge.start();
    bridge.recordRawLine({ ts: 200, data: "{\"status\":\"ok\"}" });
    bridge.recordRawLine({ ts: 201, data: "{bad json}" });

    const latest = bridge.getLatest(Number.MAX_SAFE_INTEGER);
    expect(latest.parsed).toEqual([
      { ts: 200, type: "json", value: { status: "ok" } }
    ]);
    expect(latest.events).toContainEqual(
      expect.objectContaining({
        ts: 201,
        level: "warning",
        code: "parser.jsonLine.invalid"
      })
    );

    await bridge.stop();
  });

  it("records serial raw chunks before line terminators arrive", async () => {
    const serial = createSerialHarness();
    const bridge = new BridgeService({
      configProvider: () =>
        Promise.resolve(bridgeConfigSchema.parse({ logging: { enabled: false } })),
      serialManager: serial.manager,
      httpServer: new StubHttpServer()
    });

    await bridge.start();
    await bridge.openSerial({ path: "COM_TEST" });
    serial.requirePort().pushData("status> ");

    const latest = bridge.getLatest(Number.MAX_SAFE_INTEGER);
    expect(latest.rawData).toEqual([
      expect.objectContaining({
        data: "status> ",
        bytes: Buffer.byteLength("status> "),
        port: "COM_TEST"
      })
    ]);
    expect(latest.rawLines).toEqual([]);

    await bridge.stop();
  });
});

class StubHttpServer extends HttpServer {
  public constructor() {
    super({} as BridgeApiProvider);
  }

  public override get nodeServer(): Server | undefined {
    return undefined;
  }

  public override async start(): Promise<void> {
    return undefined;
  }

  public override async stop(): Promise<void> {
    return undefined;
  }
}

interface SerialHarness {
  manager: SerialManager;
  requirePort(): FakeSerialPort;
}

function createSerialHarness(): SerialHarness {
  let port: FakeSerialPort | undefined;
  return {
    manager: new SerialManager({
      listPorts: async () => [],
      createPort: (options) => {
        port = new FakeSerialPort(options);
        return port;
      }
    }),
    requirePort() {
      if (!port) {
        throw new Error("Expected a fake serial port to be created.");
      }
      return port;
    }
  };
}

class FakeSerialPort extends EventEmitter implements SerialPortLike {
  public isOpen = false;

  public constructor(public readonly options: SerialPortFactoryOptions) {
    super();
  }

  public override on(event: "data", listener: (chunk: Buffer | string) => void): this;
  public override on(event: "error", listener: (error: Error) => void): this;
  public override on(event: "close", listener: (error?: Error) => void): this;
  public override on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  public override off(event: "data", listener: (chunk: Buffer | string) => void): this;
  public override off(event: "error", listener: (error: Error) => void): this;
  public override off(event: "close", listener: (error?: Error) => void): this;
  public override off(event: string, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }

  public open(callback: (error: Error | null) => void): void {
    this.isOpen = true;
    callback(null);
  }

  public close(callback?: (error: Error | null) => void): void {
    this.isOpen = false;
    this.emit("close");
    callback?.(null);
  }

  public write(
    _data: string,
    _encoding: BufferEncoding,
    callback: (error: Error | null | undefined) => void
  ): boolean {
    callback(undefined);
    return true;
  }

  public drain(callback: (error: Error | null | undefined) => void): void {
    callback(undefined);
  }

  public pushData(data: string | Buffer): void {
    this.emit("data", Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8"));
  }
}
