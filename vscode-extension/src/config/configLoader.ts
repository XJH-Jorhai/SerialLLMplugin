import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { parse as parseYaml } from "yaml";
import { CONFIG_FILE_ALIASES, DEFAULT_CONFIG_FILE } from "./defaults";
import { BridgeConfig, bridgeConfigSchema } from "./schema";

type JsonRecord = Record<string, unknown>;
type SettingsConfig = JsonRecord & {
  configFile?: string;
};

export async function loadBridgeConfig(): Promise<BridgeConfig> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const workspaceRoot = workspaceFolder?.uri.fsPath ?? process.cwd();
  const settingsConfig = readVsCodeSettings(workspaceFolder);
  const projectConfig = await loadProjectConfig(workspaceRoot, settingsConfig.configFile);
  return bridgeConfigSchema.parse(
    deepMerge(settingsConfig, projectConfig, { workspaceRoot })
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

async function loadProjectConfig(
  workspaceRoot: string,
  configuredPath: string | undefined
): Promise<JsonRecord> {
  const configPath = await resolveProjectConfigPath(workspaceRoot, configuredPath);
  if (!configPath) {
    return {};
  }

  const raw = await fs.readFile(configPath, "utf8");
  const parsed = parseYaml(raw);
  if (!isRecord(parsed)) {
    return {};
  }
  return normalizeProjectConfig(parsed);
}

async function resolveProjectConfigPath(
  workspaceRoot: string,
  configuredPath: string | undefined
): Promise<string | undefined> {
  const preferred = configuredPath ?? DEFAULT_CONFIG_FILE;
  const candidates = [preferred];
  if (preferred === DEFAULT_CONFIG_FILE) {
    candidates.push(...CONFIG_FILE_ALIASES);
  }

  for (const candidate of candidates) {
    const absolute = path.isAbsolute(candidate)
      ? candidate
      : path.join(workspaceRoot, candidate);
    try {
      await fs.access(absolute);
      return absolute;
    } catch {
      // Missing project config is valid for the scaffold and default-only use.
    }
  }
  return undefined;
}

function normalizeProjectConfig(source: JsonRecord): JsonRecord {
  const result: JsonRecord = {};
  if (isRecord(source.project)) {
    result.project = source.project;
  }
  if (isRecord(source.mcu)) {
    result.mcu = source.mcu;
  }
  if (isRecord(source.protocol)) {
    result.protocol = source.protocol;
  }
  if (isRecord(source.bridge)) {
    result.bridge = {
      host: source.bridge.host ?? source.bridge.httpHost,
      port: source.bridge.port ?? source.bridge.httpPort,
      websocketPath: source.bridge.websocketPath,
      latestWindowSeconds: source.bridge.latestWindowSeconds
    };
  }
  if (isRecord(source.serial)) {
    result.serial = {
      preferredPort: source.serial.preferredPort,
      defaultBaudrate: source.serial.defaultBaudrate ?? source.serial.baudrate,
      defaultLineEnding: source.serial.defaultLineEnding,
      dataBits: source.serial.dataBits,
      parity: source.serial.parity,
      stopBits: source.serial.stopBits,
      uart: source.serial.uart,
      tx: source.serial.tx,
      rx: source.serial.rx
    };
  }
  if (isRecord(source.logging)) {
    result.logging = source.logging;
  }
  return result;
}

function deepMerge(...sources: JsonRecord[]): JsonRecord {
  const merged: JsonRecord = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) {
        continue;
      }
      if (isRecord(value) && isRecord(merged[key])) {
        merged[key] = deepMerge(merged[key] as JsonRecord, value);
      } else {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
