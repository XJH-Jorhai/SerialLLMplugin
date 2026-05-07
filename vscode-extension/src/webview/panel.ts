import * as vscode from "vscode";
import { BridgeService } from "../bridge/bridgeService";
import { asErrorMessage } from "../util/errors";
import { renderBridgePanelHtml } from "./html";
import { WebviewToExtensionMessage } from "./messages";

export class BridgePanel {
  private static current: BridgePanel | undefined;

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly bridge: BridgeService
  ) {
    this.panel.onDidDispose(() => {
      BridgePanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      this.handleMessage(message).catch((error: unknown) => {
        void vscode.window.showErrorMessage(asErrorMessage(error));
      });
    });
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

  private refresh(): void {
    this.panel.webview.html = renderBridgePanelHtml(this.bridge.getSession());
  }

  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case "refresh":
        this.refresh();
        return;
      case "sendLine":
        await this.bridge.sendText(message.value);
        return;
    }
  }
}
