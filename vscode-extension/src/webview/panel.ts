import * as vscode from "vscode";
import { BridgeService } from "../bridge/bridgeService";
import { DEFAULT_LINE_ENDING } from "../config/defaults";
import { asErrorMessage } from "../util/errors";
import { renderBridgePanelHtml } from "./html";
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from "./messages";

export class BridgePanel {
  private static current: BridgePanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly refreshTimer: ReturnType<typeof setInterval>;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly bridge: BridgeService
  ) {
    this.panel.onDidDispose(() => {
      this.dispose();
      BridgePanel.current = undefined;
    });
    this.disposables.push(this.panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      this.handleMessage(message).catch((error: unknown) => {
        const messageText = asErrorMessage(error);
        void this.postMessage({ type: "error", message: messageText });
        void vscode.window.showErrorMessage(messageText);
        void this.postState();
      });
    }));
    this.panel.webview.html = renderBridgePanelHtml();
    this.refreshTimer = setInterval(() => {
      void this.postState();
    }, 1000);
  }

  public static show(context: vscode.ExtensionContext, bridge: BridgeService): void {
    if (BridgePanel.current) {
      BridgePanel.current.panel.reveal(vscode.ViewColumn.One);
      BridgePanel.current.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "mcuSerialBridge",
      "MCU Serial Bridge",
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    BridgePanel.current = new BridgePanel(panel, bridge);
    context.subscriptions.push(panel);
    BridgePanel.current.refresh();
  }

  public static refreshCurrent(): void {
    BridgePanel.current?.refresh();
  }

  private refresh(): void {
    void this.postState();
  }

  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        await this.postPorts();
        await this.postState();
        return;
      case "refresh":
        await this.postPorts();
        await this.postState();
        return;
      case "listPorts":
        await this.postPorts();
        return;
      case "startBridge":
        await this.bridge.start();
        await this.postInfo("Bridge started.");
        await this.postState();
        return;
      case "stopBridge":
        await this.bridge.stop();
        await this.postInfo("Bridge stopped.");
        await this.postState();
        return;
      case "openSerial":
        await this.bridge.openSerial({
          path: message.port,
          baudrate: message.baudrate
        });
        await this.postInfo(`Serial port opened: ${message.port}.`);
        await this.postPorts();
        await this.postState();
        return;
      case "closeSerial":
        await this.bridge.closeSerial();
        await this.postInfo("Serial port closed.");
        await this.postState();
        return;
      case "sendLine":
        await this.bridge.sendText(`${message.value}${this.getDefaultLineEnding()}`);
        await this.postInfo("Command sent.");
        await this.postState();
        return;
      case "openSessionFolder":
        await this.openSessionFolder();
        return;
    }
  }

  private async postState(): Promise<void> {
    await this.postMessage({ type: "session", session: this.bridge.getSession() });
    await this.postMessage({ type: "latest", latest: this.bridge.getLatest() });
  }

  private async postPorts(): Promise<void> {
    const ports = await this.bridge.listPorts();
    await this.postMessage({ type: "ports", ports });
  }

  private async postInfo(message: string): Promise<void> {
    await this.postMessage({ type: "info", message });
  }

  private async postMessage(message: ExtensionToWebviewMessage): Promise<void> {
    await this.panel.webview.postMessage(message);
  }

  private getDefaultLineEnding(): string {
    return vscode.workspace
      .getConfiguration("mcuSerialBridge")
      .get<string>("serial.defaultLineEnding", DEFAULT_LINE_ENDING);
  }

  private async openSessionFolder(): Promise<void> {
    const directory = this.bridge.getSession().logging.sessionDirectory;
    if (!directory) {
      await this.postInfo("No bridge session folder is active.");
      return;
    }
    await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(directory));
  }

  private dispose(): void {
    clearInterval(this.refreshTimer);
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
  }
}
