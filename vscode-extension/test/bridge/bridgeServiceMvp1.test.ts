import { EventEmitter, once } from "node:events";
import * as fsp from "node:fs/promises";
import { AddressInfo, createServer } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import WebSocket from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeService } from "../../src/bridge/bridgeService";
import {
  SerialManager,
  SerialPortFactoryOptions,
  SerialPortLike
} from "../../src/bridge/serialManager";
import {
  BridgeSession,
  CommandEntry,
  LatestData,
  SerialPortInfo
} from "../../src/bridge/types";
import { bridgeConfigSchema } from "../../src/config/schema";
import { resolveSessionLogFiles } from "../../src/logging/paths";

const tempRoots: string[] = [];

describe("BridgeService MVP1 integration", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((directory) =>
        fsp.rm(directory, { recursive: true, force: true })
      )
    );
  });

  it("serves session, ports, latest data, and logs API text commands", async () => {
    const workspace = await createTempWorkspace();
    const apiPort = await getFreePort();
    const serial = createSerialHarness();
    const bridge = createBridge(workspace, apiPort, serial);

    try {
      await bridge.start();
      await bridge.openSerial({ path: "COM_TEST" });
      serial.requirePort().pushData("System boot\n");

      const baseUrl = `http://127.0.0.1:${apiPort}`;
      const sessionResponse = await fetch(`${baseUrl}/session`);
      const session = (await sessionResponse.json()) as BridgeSession;
      const portsResponse = await fetch(`${baseUrl}/ports`);
      const ports = (await portsResponse.json()) as { ports: SerialPortInfo[] };
      const sendResponse = await fetch(`${baseUrl}/serial/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: "status\r\n", encoding: "text" })
      });
      const send = (await sendResponse.json()) as { ok: true; command: CommandEntry };
      const latestResponse = await fetch(`${baseUrl}/latest?seconds=999999`);
      const latest = (await latestResponse.json()) as LatestData;
      const sessionDirectory = bridge.getSession().logging.sessionDirectory;

      expect(sessionResponse.status).toBe(200);
      expect(session).toMatchObject({
        running: true,
        project: "mvp1-test",
        serial: {
          open: true,
          port: "COM_TEST",
          baudrate: 57600,
          dataBits: 7,
          parity: "even",
          stopBits: 2
        },
        protocol: "raw-text",
        api: {
          host: "127.0.0.1",
          port: apiPort,
          websocketPath: "/stream"
        }
      });
      expect(portsResponse.status).toBe(200);
      expect(ports.ports).toEqual([
        {
          path: "COM_TEST",
          manufacturer: "Test Vendor"
        }
      ]);
      expect(sendResponse.status).toBe(200);
      expect(send.command).toMatchObject({
        encoding: "text",
        data: "status\r\n"
      });
      expect(serial.requirePort().writes).toEqual(["status\r\n"]);
      expect(latestResponse.status).toBe(200);
      expect(latest.rawData).toEqual([
        expect.objectContaining({
          data: "System boot\n",
          bytes: Buffer.byteLength("System boot\n"),
          port: "COM_TEST"
        })
      ]);
      expect(latest.rawLines).toEqual([
        expect.objectContaining({ data: "System boot" })
      ]);
      expect(latest.parsed).toEqual([
        expect.objectContaining({ type: "raw", text: "System boot" })
      ]);
      expect(latest.commands).toEqual([
        expect.objectContaining({ encoding: "text", data: "status\r\n" })
      ]);
      expect(sessionDirectory).toBeDefined();

      await bridge.stop();
      const files = resolveSessionLogFiles(sessionDirectory ?? "");
      const commands = await readJsonLines(files.commandsJsonl);
      expect(commands).toEqual([
        expect.objectContaining({ encoding: "text", data: "status\r\n" })
      ]);
    } finally {
      await bridge.stop();
    }
  });

  it("broadcasts raw, parsed, event, and cmd_tx messages on the WebSocket stream", async () => {
    const workspace = await createTempWorkspace();
    const apiPort = await getFreePort();
    const serial = createSerialHarness();
    const bridge = createBridge(workspace, apiPort, serial, false);

    try {
      await bridge.start();
      await bridge.openSerial({ path: "COM_TEST" });

      const client = new WebSocket(`ws://127.0.0.1:${apiPort}/stream`);
      const messages: unknown[] = [];
      client.on("message", (data) => {
        messages.push(JSON.parse(data.toString()));
      });
      await once(client, "open");

      serial.requirePort().pushData("hello\n");
      bridge.recordEvent("info", "manual event", "test.event");
      await bridge.sendText("status\r\n");

      await waitForMessages(messages, 4);
      expect(messages).toEqual([
        expect.objectContaining({ type: "raw", data: "hello\n" }),
        expect.objectContaining({
          type: "parsed",
          data: expect.objectContaining({ type: "raw", text: "hello" })
        }),
        expect.objectContaining({
          type: "event",
          level: "info",
          message: "manual event",
          code: "test.event"
        }),
        expect.objectContaining({ type: "cmd_tx", data: "status\r\n" })
      ]);

      client.terminate();
    } finally {
      await bridge.stop();
    }
  });

  it("falls back to raw-text for unsupported MVP1 protocols and emits an event", async () => {
    const workspace = await createTempWorkspace();
    const apiPort = await getFreePort();
    const serial = createSerialHarness();
    const bridge = new BridgeService({
      configProvider: () =>
        Promise.resolve(
          bridgeConfigSchema.parse({
            workspaceRoot: workspace,
            bridge: { host: "127.0.0.1", port: apiPort },
            logging: { enabled: false },
            protocol: { type: "vofa-firewater" }
          })
        ),
      serialManager: serial.manager
    });

    try {
      await bridge.start();

      expect(bridge.getSession().protocol).toBe("raw-text");
      expect(bridge.getLatest(999999).events).toContainEqual(
        expect.objectContaining({
          level: "warning",
          code: "protocol.unsupported",
          message: expect.stringContaining("vofa-firewater")
        })
      );
    } finally {
      await bridge.stop();
    }
  });
});

interface SerialHarness {
  manager: SerialManager;
  requirePort(): FakeSerialPort;
}

function createSerialHarness(): SerialHarness {
  let port: FakeSerialPort | undefined;
  return {
    manager: new SerialManager({
      listPorts: async () => [
        {
          path: "COM_TEST",
          manufacturer: "Test Vendor"
        }
      ],
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

function createBridge(
  workspace: string,
  apiPort: number,
  serial: SerialHarness,
  loggingEnabled = true
): BridgeService {
  return new BridgeService({
    configProvider: () =>
      Promise.resolve(
        bridgeConfigSchema.parse({
          workspaceRoot: workspace,
          project: { name: "mvp1-test" },
          bridge: { host: "127.0.0.1", port: apiPort },
          logging: { enabled: loggingEnabled, directory: ".serial-sessions" },
          serial: {
            defaultBaudrate: 57600,
            dataBits: 7,
            parity: "even",
            stopBits: 2
          },
          protocol: { type: "raw-text" }
        })
      ),
    serialManager: serial.manager
  });
}

class FakeSerialPort extends EventEmitter implements SerialPortLike {
  public isOpen = false;
  public readonly writes: string[] = [];

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
    data: string,
    _encoding: BufferEncoding,
    callback: (error: Error | null | undefined) => void
  ): boolean {
    this.writes.push(data);
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

async function createTempWorkspace(): Promise<string> {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "mcu-serial-bridge-"));
  tempRoots.push(directory);
  return directory;
}

async function getFreePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address.");
  }
  const port = (address as AddressInfo).port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  return port;
}

async function readJsonLines(filePath: string): Promise<unknown[]> {
  const text = await fsp.readFile(filePath, "utf8");
  return text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

async function waitForMessages(messages: unknown[], expected: number): Promise<void> {
  const deadline = Date.now() + 3000;
  while (messages.length < expected) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${expected} WebSocket messages.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
