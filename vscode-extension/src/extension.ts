import * as vscode from "vscode";
import { registerCommands } from "./commands/registerCommands";
import { loadBridgeConfig } from "./config/configLoader";
import { BridgeService } from "./bridge/bridgeService";

let bridge: BridgeService | undefined;

export function activate(context: vscode.ExtensionContext): void {
  bridge = new BridgeService({
    configProvider: loadBridgeConfig
  });
  registerCommands(context, bridge);
  context.subscriptions.push({
    dispose: () => {
      void bridge?.stop();
    }
  });
}

export async function deactivate(): Promise<void> {
  await bridge?.stop();
}
