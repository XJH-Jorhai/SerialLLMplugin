import * as vscode from "vscode";
import { DEFAULT_CONFIG_FILE } from "./defaults";
import { deepMerge, JsonRecord, loadProjectConfig } from "./projectConfig";
import { BridgeConfig, bridgeConfigSchema } from "./schema";

type SettingsConfig = JsonRecord & {
  configFile?: string;
};

export async function loadBridgeConfig(): Promise<BridgeConfig> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const workspaceRoot = workspaceFolder?.uri.fsPath ?? process.cwd();
  const settingsConfig = readVsCodeSettings(workspaceFolder);
  const projectConfig = await loadProjectConfig(workspaceRoot, settingsConfig.configFile);
  return bridgeConfigSchema.parse(
    deepMerge(settingsConfig, projectConfig.config, {
      workspaceRoot,
      projectConfigPath: projectConfig.path
    })
  );
}

function readVsCodeSettings(
  workspaceFolder: vscode.WorkspaceFolder | undefined
): SettingsConfig {
  const scope = workspaceFolder?.uri;
  const config = vscode.workspace.getConfiguration("mcuSerialBridge", scope);
  return {
    configFile: config.get<string>("configFile") ?? DEFAULT_CONFIG_FILE,
    bridge: {
      host: config.get<string>("bridge.host"),
      port: config.get<number>("bridge.port")
    },
    build: {
      configureTask: emptyStringToUndefined(config.get<string>("build.configureTask")),
      buildTask: emptyStringToUndefined(config.get<string>("build.buildTask")),
      flashTask: emptyStringToUndefined(config.get<string>("build.flashTask"))
    },
    serial: {
      defaultBaudrate: config.get<number>("serial.defaultBaudrate"),
      defaultLineEnding: config.get<string>("serial.defaultLineEnding")
    },
    logging: {
      enabled: config.get<boolean>("logging.enabled"),
      directory: config.get<string>("logging.directory")
    }
  };
}

function emptyStringToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
