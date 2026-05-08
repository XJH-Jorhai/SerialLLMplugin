import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  SerialManager,
  SerialPortFactoryOptions,
  SerialPortLike
} from "../../src/bridge/serialManager";
import {
  BridgeEvent,
  SerialRawDataEvent,
  SerialRawLineEvent
} from "../../src/bridge/types";
import { BridgeError } from "../../src/util/errors";

describe("SerialManager", () => {
  it("lists serial ports through the configured provider", async () => {
    const manager = new SerialManager({
      listPorts: async () => [
        {
          path: "COM_TEST",
          manufacturer: "Test Vendor",
          serialNumber: "abc123",
          vendorId: "1209",
          productId: "0001",
          pnpId: "USB\\VID_1209&PID_0001",
          locationId: "1-2",
          friendlyName: "Test UART"
        }
      ]
    });

    await expect(manager.listPorts()).resolves.toEqual([
      {
        path: "COM_TEST",
        manufacturer: "Test Vendor",
        serialNumber: "abc123",
        vendorId: "1209",
        productId: "0001",
        pnpId: "USB\\VID_1209&PID_0001",
        locationId: "1-2",
        friendlyName: "Test UART"
      }
    ]);
  });

  it("opens the selected port with the default 115200 8N1 frame", async () => {
    const harness = createHarness();

    await harness.manager.open({ path: " COM_TEST " });

    expect(harness.port?.options).toMatchObject({
      path: "COM_TEST",
      baudRate: 115200,
      dataBits: 8,
      parity: "none",
      stopBits: 1,
      autoOpen: false,
      lock: true
    });
    expect(harness.manager.isOpen()).toBe(true);
    expect(harness.manager.getState()).toMatchObject({
      open: true,
      port: "COM_TEST",
      baudrate: 115200,
      dataBits: 8,
      parity: "none",
      stopBits: 1
    });
  });

  it("opens with an explicitly configured serial frame", async () => {
    const harness = createHarness();

    await harness.manager.open({
      path: "COM_FRAME",
      baudrate: 57600,
      dataBits: 7,
      parity: "even",
      stopBits: 2
    });

    expect(harness.port?.options).toMatchObject({
      path: "COM_FRAME",
      baudRate: 57600,
      dataBits: 7,
      parity: "even",
      stopBits: 2
    });
  });

  it("emits raw chunks before splitting LF-terminated lines", async () => {
    const harness = createHarness();
    const rawData: SerialRawDataEvent[] = [];
    const lines: SerialRawLineEvent[] = [];
    harness.manager.onRawData((event) => rawData.push(event));
    harness.manager.onRawLine((event) => lines.push(event));
    await harness.manager.open({ path: "COM_TEST" });

    harness.requirePort().pushData("alpha\n");

    expect(rawData).toHaveLength(1);
    expect(rawData[0]?.port).toBe("COM_TEST");
    expect(rawData[0]?.data.equals(Buffer.from("alpha\n"))).toBe(true);
    expect(rawData[0]?.text).toBe("alpha\n");
    expect(lines.map((line) => line.data)).toEqual(["alpha"]);
  });

  it("splits CRLF-terminated lines", async () => {
    const harness = createHarness();
    const lines: string[] = [];
    harness.manager.onRawLine((event) => lines.push(event.data));
    await harness.manager.open({ path: "COM_TEST" });

    harness.requirePort().pushData("alpha\r\nbeta\r\n");

    expect(lines).toEqual(["alpha", "beta"]);
  });

  it("does not emit a blank line when CRLF is split across chunks", async () => {
    const harness = createHarness();
    const lines: string[] = [];
    harness.manager.onRawLine((event) => lines.push(event.data));
    await harness.manager.open({ path: "COM_TEST" });

    harness.requirePort().pushData("alpha\r");
    harness.requirePort().pushData("\nbeta\r\n");

    expect(lines).toEqual(["alpha", "beta"]);
  });

  it("splits CR-terminated lines", async () => {
    const harness = createHarness();
    const lines: string[] = [];
    harness.manager.onRawLine((event) => lines.push(event.data));
    await harness.manager.open({ path: "COM_TEST" });

    harness.requirePort().pushData("alpha\rbeta\r");

    expect(lines).toEqual(["alpha", "beta"]);
  });

  it("buffers partial chunks until a line ending arrives", async () => {
    const harness = createHarness();
    const lines: string[] = [];
    harness.manager.onRawLine((event) => lines.push(event.data));
    await harness.manager.open({ path: "COM_TEST" });

    harness.requirePort().pushData("al");
    harness.requirePort().pushData("pha\nbe");
    harness.requirePort().pushData("ta\r\n");

    expect(lines).toEqual(["alpha", "beta"]);
  });

  it("rejects writeText when the port is not open", async () => {
    const manager = new SerialManager({
      listPorts: async () => [],
      createPort: (options) => new FakeSerialPort(options)
    });

    await expect(manager.writeText("status\r\n")).rejects.toMatchObject({
      code: "serial.notOpen"
    } satisfies Partial<BridgeError>);
  });

  it("writes and drains text commands on an open port", async () => {
    const harness = createHarness();
    await harness.manager.open({ path: "COM_TEST" });

    await harness.manager.writeText("status\r\n");

    const port = harness.requirePort();
    expect(port.writes).toEqual(["status\r\n"]);
    expect(port.drainCount).toBe(1);
  });

  it("closes cleanly and is safe when already closed", async () => {
    const harness = createHarness();
    await harness.manager.open({ path: "COM_TEST" });

    await harness.manager.close();
    await harness.manager.close();

    expect(harness.manager.isOpen()).toBe(false);
    expect(harness.manager.getState()).toEqual({ open: false });
    expect(harness.requirePort().closeCount).toBe(1);
  });

  it("emits recoverable bridge events for serial errors and disconnects", async () => {
    const harness = createHarness();
    const events: BridgeEvent[] = [];
    harness.manager.onEvent((event) => events.push(event));
    await harness.manager.open({ path: "COM_TEST" });

    harness.requirePort().fail(new Error("read failed"));
    harness.requirePort().disconnect(new Error("device removed"));

    expect(events).toContainEqual(
      expect.objectContaining({
        level: "error",
        code: "serial.error",
        message: expect.stringContaining("read failed")
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        level: "warning",
        code: "serial.disconnected",
        message: expect.stringContaining("device removed")
      })
    );
    expect(harness.manager.isOpen()).toBe(false);
  });
});

interface Harness {
  manager: SerialManager;
  port: FakeSerialPort | undefined;
  requirePort(): FakeSerialPort;
}

function createHarness(): Harness {
  let port: FakeSerialPort | undefined;
  const harness: Harness = {
    manager: new SerialManager({
      listPorts: async () => [],
      createPort: (options) => {
        port = new FakeSerialPort(options);
        return port;
      }
    }),
    get port() {
      return port;
    },
    requirePort() {
      if (!port) {
        throw new Error("Expected a fake serial port to be created.");
      }
      return port;
    }
  };
  return harness;
}

class FakeSerialPort extends EventEmitter implements SerialPortLike {
  public isOpen = false;
  public readonly writes: string[] = [];
  public drainCount = 0;
  public closeCount = 0;

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
    this.closeCount += 1;
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
    this.drainCount += 1;
    callback(undefined);
  }

  public pushData(data: string | Buffer): void {
    this.emit("data", Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8"));
  }

  public fail(error: Error): void {
    this.emit("error", error);
  }

  public disconnect(error: Error): void {
    this.isOpen = false;
    this.emit("close", error);
  }
}
