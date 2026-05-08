import { StringDecoder } from "node:string_decoder";
import { SerialPort } from "serialport";
import { DEFAULT_BAUDRATE } from "../config/defaults";
import { LineBuffer } from "../protocol/lineBuffer";
import { asErrorMessage, BridgeError } from "../util/errors";
import { nowEpochSeconds } from "../util/time";
import {
  BridgeEvent,
  SerialDataBits,
  SerialEventHandler,
  SerialOpenOptions,
  SerialParity,
  SerialPortInfo,
  SerialRawDataEvent,
  SerialRawLineEvent,
  SerialState,
  SerialStopBits,
  SerialUnsubscribe
} from "./types";

interface SerialPortListItem {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  pnpId?: string;
  locationId?: string;
  friendlyName?: string;
}

export interface SerialPortFactoryOptions {
  path: string;
  baudRate: number;
  dataBits: SerialDataBits;
  parity: SerialParity;
  stopBits: SerialStopBits;
  autoOpen: false;
  lock: true;
}

export interface SerialPortLike {
  readonly isOpen: boolean;
  on(event: "data", listener: (chunk: Buffer | string) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: (error?: Error) => void): this;
  off(event: "data", listener: (chunk: Buffer | string) => void): this;
  off(event: "error", listener: (error: Error) => void): this;
  off(event: "close", listener: (error?: Error) => void): this;
  open(callback: (error: Error | null) => void): void;
  close(callback?: (error: Error | null) => void): void;
  write(
    data: string,
    encoding: BufferEncoding,
    callback: (error: Error | null | undefined) => void
  ): boolean;
  drain(callback: (error: Error | null | undefined) => void): void;
}

export type SerialPortFactory = (options: SerialPortFactoryOptions) => SerialPortLike;

export interface SerialManagerOptions {
  listPorts?: () => Promise<SerialPortListItem[]>;
  createPort?: SerialPortFactory;
}

interface NormalizedSerialOpenOptions {
  path: string;
  baudrate: number;
  dataBits: SerialDataBits;
  parity: SerialParity;
  stopBits: SerialStopBits;
}

export class SerialManager {
  private state: SerialState = { open: false };
  private port: SerialPortLike | undefined;
  private opening = false;
  private closeRequested = false;
  private decoder = new StringDecoder("utf8");
  private lineBuffer = this.createLineBuffer();
  private readonly listPortsImpl: () => Promise<SerialPortListItem[]>;
  private readonly createPort: SerialPortFactory;
  private readonly rawDataHandlers = new Set<SerialEventHandler<SerialRawDataEvent>>();
  private readonly rawLineHandlers = new Set<SerialEventHandler<SerialRawLineEvent>>();
  private readonly eventHandlers = new Set<SerialEventHandler<BridgeEvent>>();

  public constructor(options: SerialManagerOptions = {}) {
    this.listPortsImpl = options.listPorts ?? (() => SerialPort.list());
    this.createPort =
      options.createPort ??
      ((openOptions: SerialPortFactoryOptions) => new SerialPort(openOptions));
  }

  public async listPorts(): Promise<SerialPortInfo[]> {
    try {
      const ports = await this.listPortsImpl();
      return ports.map((port) => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        vendorId: port.vendorId,
        productId: port.productId,
        pnpId: port.pnpId,
        locationId: port.locationId,
        friendlyName: port.friendlyName
      }));
    } catch (error: unknown) {
      const message = `Failed to list serial ports: ${asErrorMessage(error)}`;
      this.emitBridgeEvent("error", message, "serial.list.failed");
      throw new BridgeError(message, "serial.list.failed");
    }
  }

  public async open(options: SerialOpenOptions): Promise<void> {
    if (this.opening) {
      throw new BridgeError("A serial port is already opening.", "serial.open.inProgress");
    }
    if (this.isOpen()) {
      throw new BridgeError("A serial port is already open.", "serial.alreadyOpen");
    }

    const normalized = normalizeOpenOptions(options);
    const port = this.createPort({
      path: normalized.path,
      baudRate: normalized.baudrate,
      dataBits: normalized.dataBits,
      parity: normalized.parity,
      stopBits: normalized.stopBits,
      autoOpen: false,
      lock: true
    });

    this.opening = true;
    this.port = port;
    this.decoder = new StringDecoder("utf8");
    this.lineBuffer = this.createLineBuffer();
    port.on("data", this.handleData);
    port.on("error", this.handleError);
    port.on("close", this.handleClose);

    try {
      await this.openPort(port);
      this.state = {
        open: true,
        port: normalized.path,
        baudrate: normalized.baudrate,
        dataBits: normalized.dataBits,
        parity: normalized.parity,
        stopBits: normalized.stopBits
      };
      this.emitBridgeEvent(
        "info",
        `Serial port opened: ${normalized.path} @ ${normalized.baudrate}.`,
        "serial.opened"
      );
    } catch (error: unknown) {
      this.cleanupPort(port);
      this.state = { open: false };
      const message = `Failed to open serial port ${normalized.path}: ${asErrorMessage(error)}`;
      this.emitBridgeEvent("error", message, "serial.open.failed");
      throw new BridgeError(message, "serial.open.failed");
    } finally {
      this.opening = false;
    }
  }

  public async close(): Promise<void> {
    const port = this.port;
    if (!port) {
      this.state = { open: false };
      this.resetTextBuffers();
      return;
    }

    this.closeRequested = true;
    try {
      if (port.isOpen) {
        await this.drainPort(port);
        await this.closePort(port);
      }
    } catch (error: unknown) {
      const message = `Failed to close serial port: ${asErrorMessage(error)}`;
      this.emitBridgeEvent("error", message, "serial.close.failed");
      throw new BridgeError(message, "serial.close.failed");
    } finally {
      this.cleanupPort(port);
      this.state = { open: false };
      this.closeRequested = false;
    }
  }

  public async writeText(data: string): Promise<void> {
    const port = this.port;
    if (!this.isOpen() || !port) {
      throw new BridgeError("Serial port is not open.", "serial.notOpen");
    }
    if (data.length === 0) {
      return;
    }

    try {
      await this.writePort(port, data);
      await this.drainPort(port);
    } catch (error: unknown) {
      const message = `Failed to write serial data: ${asErrorMessage(error)}`;
      this.emitBridgeEvent("error", message, "serial.write.failed");
      throw new BridgeError(message, "serial.write.failed");
    }
  }

  public isOpen(): boolean {
    return this.state.open && this.port?.isOpen === true;
  }

  public getState(): SerialState {
    return { ...this.state };
  }

  public onRawData(callback: SerialEventHandler<SerialRawDataEvent>): SerialUnsubscribe {
    return this.addHandler(this.rawDataHandlers, callback);
  }

  public onRawLine(callback: SerialEventHandler<SerialRawLineEvent>): SerialUnsubscribe {
    return this.addHandler(this.rawLineHandlers, callback);
  }

  public onEvent(callback: SerialEventHandler<BridgeEvent>): SerialUnsubscribe {
    return this.addHandler(this.eventHandlers, callback);
  }

  private readonly handleData = (chunk: Buffer | string): void => {
    const port = this.state.port;
    if (!port) {
      return;
    }

    const buffer = Buffer.isBuffer(chunk) ? Buffer.from(chunk) : Buffer.from(chunk, "utf8");
    const ts = nowEpochSeconds();
    const text = this.decoder.write(buffer);
    this.emitHandlers(this.rawDataHandlers, {
      ts,
      port,
      data: buffer,
      text
    });

    if (text.length === 0) {
      return;
    }

    for (const line of this.lineBuffer.pushText(text, ts)) {
      this.emitHandlers(this.rawLineHandlers, line);
    }
  };

  private readonly handleError = (error: Error): void => {
    this.emitBridgeEvent(
      "error",
      `Serial port error: ${asErrorMessage(error)}`,
      "serial.error"
    );
  };

  private readonly handleClose = (error?: Error): void => {
    const previousState = this.state;
    const wasRequested = this.closeRequested;

    this.state = { ...previousState, open: false };
    if (error) {
      this.emitBridgeEvent(
        "warning",
        `Serial port disconnected: ${asErrorMessage(error)}`,
        "serial.disconnected"
      );
    } else if (!wasRequested && previousState.open) {
      this.emitBridgeEvent(
        "warning",
        "Serial port closed unexpectedly.",
        "serial.closedUnexpectedly"
      );
    }

    if (!wasRequested && this.port) {
      this.cleanupPort(this.port);
    }
  };

  private createLineBuffer(): LineBuffer<SerialRawLineEvent> {
    return new LineBuffer<SerialRawLineEvent>((line, ts) => [
      {
        ts,
        data: line,
        port: this.state.port ?? ""
      }
    ]);
  }

  private addHandler<T>(
    handlers: Set<SerialEventHandler<T>>,
    callback: SerialEventHandler<T>
  ): SerialUnsubscribe {
    handlers.add(callback);
    return () => {
      handlers.delete(callback);
    };
  }

  private emitHandlers<T>(handlers: Set<SerialEventHandler<T>>, event: T): void {
    for (const handler of handlers) {
      try {
        handler(event);
      } catch {
        // Serial stream consumers should not be able to break port ownership.
      }
    }
  }

  private emitBridgeEvent(
    level: BridgeEvent["level"],
    message: string,
    code: string
  ): void {
    this.emitHandlers(this.eventHandlers, {
      ts: nowEpochSeconds(),
      level,
      message,
      code
    });
  }

  private openPort(port: SerialPortLike): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      port.open((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private closePort(port: SerialPortLike): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      port.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private writePort(port: SerialPortLike, data: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      port.write(data, "utf8", (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private drainPort(port: SerialPortLike): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      port.drain((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private cleanupPort(port: SerialPortLike): void {
    port.off("data", this.handleData);
    port.off("error", this.handleError);
    port.off("close", this.handleClose);
    if (this.port === port) {
      this.port = undefined;
    }
    this.resetTextBuffers();
  }

  private resetTextBuffers(): void {
    this.decoder = new StringDecoder("utf8");
    this.lineBuffer = this.createLineBuffer();
  }
}

function normalizeOpenOptions(options: SerialOpenOptions): NormalizedSerialOpenOptions {
  const path = options.path.trim();
  if (!path) {
    throw new BridgeError("A serial port path is required.", "serial.port.required");
  }

  const baudrate = options.baudrate ?? DEFAULT_BAUDRATE;
  if (!Number.isInteger(baudrate) || baudrate <= 0) {
    throw new BridgeError("A positive serial baud rate is required.", "serial.baudrate.invalid");
  }

  return {
    path,
    baudrate,
    dataBits: normalizeDataBits(options.dataBits),
    parity: normalizeParity(options.parity),
    stopBits: normalizeStopBits(options.stopBits)
  };
}

function normalizeDataBits(value: SerialDataBits | undefined): SerialDataBits {
  const dataBits = value ?? 8;
  if (dataBits !== 5 && dataBits !== 6 && dataBits !== 7 && dataBits !== 8) {
    throw new BridgeError("Serial dataBits must be 5, 6, 7, or 8.", "serial.dataBits.invalid");
  }
  return dataBits;
}

function normalizeParity(value: SerialParity | undefined): SerialParity {
  const parity = value ?? "none";
  if (
    parity !== "none" &&
    parity !== "even" &&
    parity !== "mark" &&
    parity !== "odd" &&
    parity !== "space"
  ) {
    throw new BridgeError(
      "Serial parity must be none, even, mark, odd, or space.",
      "serial.parity.invalid"
    );
  }
  return parity;
}

function normalizeStopBits(value: SerialStopBits | undefined): SerialStopBits {
  const stopBits = value ?? 1;
  if (stopBits !== 1 && stopBits !== 1.5 && stopBits !== 2) {
    throw new BridgeError("Serial stopBits must be 1, 1.5, or 2.", "serial.stopBits.invalid");
  }
  return stopBits;
}
