import { SerialPort } from "serialport";
import { BridgeError } from "../util/errors";
import { SerialOpenOptions, SerialPortInfo, SerialState } from "./types";

export class SerialManager {
  private state: SerialState = { open: false };

  public async listPorts(): Promise<SerialPortInfo[]> {
    const ports = await SerialPort.list();
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer,
      serialNumber: port.serialNumber,
      vendorId: port.vendorId,
      productId: port.productId
    }));
  }

  public async open(options: SerialOpenOptions): Promise<SerialState> {
    if (!options.path.trim()) {
      throw new BridgeError("A serial port path is required.", "serial.port.required");
    }
    if (!Number.isInteger(options.baudrate) || options.baudrate <= 0) {
      throw new BridgeError("A positive serial baud rate is required.", "serial.baudrate.invalid");
    }

    // TODO(mvp1-serial): Own the serial port with serialport, stream bytes, and emit raw data.
    throw new BridgeError(
      "Serial open is scaffolded but not implemented yet.",
      "serial.open.notImplemented"
    );
  }

  public async close(): Promise<SerialState> {
    // TODO(mvp1-serial): Close the active serialport instance and drain pending writes.
    this.state = { open: false };
    return this.getState();
  }

  public async writeText(data: string): Promise<void> {
    if (!this.state.open) {
      throw new BridgeError("Serial port is not open.", "serial.notOpen");
    }
    if (data.length === 0) {
      return;
    }

    // TODO(mvp1-serial): Write text to the active serialport instance.
  }

  public getState(): SerialState {
    return { ...this.state };
  }
}
