import * as vscode from "vscode";
import { registerCommands } from "./commands/registerCommands";
import { loadBridgeConfig } from "./config/configLoader";
import { BridgeService } from "./bridge/bridgeService";
import { BridgeSerialViewProvider, SERIAL_VIEW_ID } from "./webview/viewProvider";

let bridge: BridgeService | undefined;

export function activate(context: vscode.ExtensionContext): void {
  bridge = new BridgeService({
    configProvider: loadBridgeConfig
  });
  const serialViewProvider = new BridgeSerialViewProvider(bridge);
  context.subscriptions.push(
    serialViewProvider,
    vscode.window.registerWebviewViewProvider(SERIAL_VIEW_ID, serialViewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  registerCommands(context, bridge, serialViewProvider);
  context.subscriptions.push({
    dispose: () => {
      void bridge?.stop();
    }
  });
}

export async function deactivate(): Promise<void> {
  await bridge?.stop();
}
