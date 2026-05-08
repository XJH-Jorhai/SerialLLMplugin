import * as vscode from "vscode";
import { BridgeService } from "../bridge/bridgeService";
import { DEFAULT_BAUDRATE, DEFAULT_LINE_ENDING } from "../config/defaults";
import { asErrorMessage, BridgeError } from "../util/errors";
import { BridgePanel } from "../webview/panel";

export function registerCommands(
  context: vscode.ExtensionContext,
  bridge: BridgeService
): void {
  register(context, "mcuSerialBridge.openPanel", async () => {
    BridgePanel.show(context, bridge);
  });

  register(context, "mcuSerialBridge.startBridge", async () => {
    const session = await bridge.start();
    BridgePanel.refreshCurrent();
    void vscode.window.showInformationMessage(
      `MCU Serial Bridge listening on ${session.api.host}:${session.api.port}.`
    );
  });

  register(context, "mcuSerialBridge.stopBridge", async () => {
    await bridge.stop();
    BridgePanel.refreshCurrent();
    void vscode.window.showInformationMessage("MCU Serial Bridge stopped.");
  });

  register(context, "mcuSerialBridge.listPorts", async () => {
    const ports = await bridge.listPorts();
    if (ports.length === 0) {
      void vscode.window.showInformationMessage("No serial ports detected.");
      return;
    }
    await vscode.window.showQuickPick(
      ports.map((port) => ({
        label: port.path,
        description: port.manufacturer ?? port.friendlyName,
        detail: [
          port.serialNumber ? `Serial: ${port.serialNumber}` : undefined,
          port.vendorId ? `VID: ${port.vendorId}` : undefined,
          port.productId ? `PID: ${port.productId}` : undefined
        ]
          .filter(Boolean)
          .join("  ")
      })),
      {
        title: "MCU Serial Bridge: Detected Serial Ports",
        placeHolder: "Select is informational only; use Open Serial Port to connect."
      }
    );
  });

  register(context, "mcuSerialBridge.openSerial", async () => {
    const selected = await pickSerialPort(bridge);
    if (!selected) {
      return;
    }
    const baudrate = await askForBaudrate(getDefaultBaudrate(bridge));
    if (baudrate === undefined) {
      return;
    }
    await bridge.openSerial({
      path: selected,
      baudrate
    });
    BridgePanel.refreshCurrent();
    void vscode.window.showInformationMessage(`Serial port opened: ${selected} @ ${baudrate}.`);
  });

  register(context, "mcuSerialBridge.closeSerial", async () => {
    await bridge.closeSerial();
    BridgePanel.refreshCurrent();
    void vscode.window.showInformationMessage("Serial port closed.");
  });

  register(context, "mcuSerialBridge.sendLine", async () => {
    const value = await vscode.window.showInputBox({
      title: "MCU Serial Bridge: Send Line",
      prompt: "Text to send to the open serial port.",
      ignoreFocusOut: true
    });
    if (value === undefined) {
      return;
    }
    const lineEnding = vscode.workspace
      .getConfiguration("mcuSerialBridge")
      .get<string>("serial.defaultLineEnding", DEFAULT_LINE_ENDING);
    await bridge.sendText(`${value}${lineEnding}`);
    BridgePanel.refreshCurrent();
  });

  register(context, "mcuSerialBridge.build", () => {
    throw new BridgeError(
      "Build task integration is scaffolded but not implemented yet.",
      "task.build.notImplemented"
    );
  });

  register(context, "mcuSerialBridge.flash", () => {
    throw new BridgeError(
      "Flash task integration is scaffolded but not implemented yet.",
      "task.flash.notImplemented"
    );
  });

  register(context, "mcuSerialBridge.buildFlashOpenSerial", () => {
    throw new BridgeError(
      "Build, flash, and open serial workflow is scaffolded but not implemented yet.",
      "task.buildFlashOpenSerial.notImplemented"
    );
  });

  register(context, "mcuSerialBridge.openSessionFolder", async () => {
    const directory = bridge.getSession().logging.sessionDirectory;
    if (!directory) {
      void vscode.window.showInformationMessage("No bridge session folder is active.");
      return;
    }
    await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(directory));
  });
}

function register(
  context: vscode.ExtensionContext,
  command: string,
  handler: () => Promise<void> | void
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(command, async () => {
      try {
        await handler();
      } catch (error: unknown) {
        const message = asErrorMessage(error);
        if (error instanceof BridgeError && error.code.endsWith("notImplemented")) {
          void vscode.window.showWarningMessage(message);
          return;
        }
        void vscode.window.showErrorMessage(message);
      }
    })
  );
}

async function pickSerialPort(bridge: BridgeService): Promise<string | undefined> {
  const ports = await bridge.listPorts();
  const items = ports.map((port) => ({
    label: port.path,
    description: port.manufacturer ?? port.friendlyName,
    detail: port.serialNumber ? `Serial: ${port.serialNumber}` : undefined
  }));
  const picked = await vscode.window.showQuickPick(items, {
    title: "MCU Serial Bridge: Open Serial Port",
    placeHolder: "Select a detected serial port, or press Escape to cancel."
  });
  if (picked) {
    return picked.label;
  }
  return vscode.window.showInputBox({
    title: "MCU Serial Bridge: Open Serial Port",
    prompt: "Enter a serial port path manually if it was not detected.",
    ignoreFocusOut: true
  });
}

async function askForBaudrate(defaultBaudrate: number): Promise<number | undefined> {
  const value = await vscode.window.showInputBox({
    title: "MCU Serial Bridge: Baudrate",
    prompt: "Enter the serial baudrate.",
    value: String(defaultBaudrate),
    validateInput(input) {
      const parsed = Number(input.trim());
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return "Baudrate must be a positive integer.";
      }
      return undefined;
    },
    ignoreFocusOut: true
  });
  if (value === undefined) {
    return undefined;
  }
  return Number(value.trim());
}

function getDefaultBaudrate(bridge: BridgeService): number {
  return (
    bridge.getSession().serial.baudrate ??
    vscode.workspace
      .getConfiguration("mcuSerialBridge")
      .get<number>("serial.defaultBaudrate", DEFAULT_BAUDRATE)
  );
}
