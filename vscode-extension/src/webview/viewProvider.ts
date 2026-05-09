import * as vscode from "vscode";
import { BridgeService } from "../bridge/bridgeService";
import { LatestDataLimits } from "../bridge/types";
import { DEFAULT_LINE_ENDING } from "../config/defaults";
import { asErrorMessage } from "../util/errors";
import { renderBridgePanelHtml } from "./html";
import { ExtensionToWebviewMessage, WebviewToExtensionMessage } from "./messages";

export const SERIAL_VIEW_ID = "mcuSerialBridge.serialView";
const WEBVIEW_REFRESH_MS = 1000;
const WEBVIEW_LATEST_SECONDS = 3;
const WEBVIEW_LATEST_LIMITS: LatestDataLimits = {
  rawData: 120,
  rawDataBytes: 64 * 1024,
  rawLines: 120,
  parsed: 60,
  events: 60,
  commands: 30
};

export class BridgeSerialViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private postStateInProgress = false;
  private postStateQueued = false;
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(private readonly bridge: BridgeService) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.disposeViewResources();
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = renderBridgePanelHtml();

    this.disposables.push(
      webviewView.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
        this.handleMessage(message).catch((error: unknown) => {
          const messageText = asErrorMessage(error);
          void this.postMessage({ type: "error", message: messageText });
          void vscode.window.showErrorMessage(messageText);
          void this.postState();
        });
      }),
      webviewView.onDidDispose(() => {
        this.view = undefined;
        this.disposeViewResources();
      })
    );

    this.startRefreshTimer();
    void this.postState();
  }

  public async focus(): Promise<void> {
    await vscode.commands.executeCommand(`${SERIAL_VIEW_ID}.focus`);
    await this.postPorts();
    await this.postState();
  }

  public refresh(): void {
    void this.postState();
  }

  public async runWithRefreshPaused<T>(operation: () => Promise<T>): Promise<T> {
    this.stopRefreshTimer();
    try {
      return await operation();
    } finally {
      this.startRefreshTimer();
    }
  }

  public dispose(): void {
    this.view = undefined;
    this.disposeViewResources();
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
        await this.runWithRefreshPaused(async () => {
          await this.bridge.stop();
          await this.postInfo("Bridge stopped.");
          await this.postState();
        });
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
    if (!this.view) {
      return;
    }
    if (this.postStateInProgress) {
      this.postStateQueued = true;
      return;
    }

    this.postStateInProgress = true;
    try {
      do {
        this.postStateQueued = false;
        await this.postMessage({ type: "session", session: this.bridge.getSession() });
        await this.postMessage({
          type: "latest",
          latest: this.bridge.getLatest(WEBVIEW_LATEST_SECONDS, WEBVIEW_LATEST_LIMITS)
        });
      } while (this.postStateQueued && this.view);
    } finally {
      this.postStateInProgress = false;
    }
  }

  private async postPorts(): Promise<void> {
    const ports = await this.bridge.listPorts();
    await this.postMessage({ type: "ports", ports });
  }

  private async postInfo(message: string): Promise<void> {
    await this.postMessage({ type: "info", message });
  }

  private async postMessage(message: ExtensionToWebviewMessage): Promise<void> {
    await this.view?.webview.postMessage(message);
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

  private disposeViewResources(): void {
    this.stopRefreshTimer();
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
  }

  private startRefreshTimer(): void {
    if (this.refreshTimer || !this.view) {
      return;
    }
    this.refreshTimer = setInterval(() => {
      void this.postState();
    }, WEBVIEW_REFRESH_MS);
  }

  private stopRefreshTimer(): void {
    if (!this.refreshTimer) {
      return;
    }
    clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
  }
}
