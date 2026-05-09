import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import { CONFIG_FILE_ALIASES, DEFAULT_CONFIG_FILE } from "./defaults";

export type JsonRecord = Record<string, unknown>;

export interface ProjectConfigLoadResult {
  path?: string;
  config: JsonRecord;
}

export async function loadProjectConfig(
  workspaceRoot: string,
  configuredPath: string | undefined
): Promise<ProjectConfigLoadResult> {
  const configPath = await resolveProjectConfigPath(workspaceRoot, configuredPath);
  if (!configPath) {
    return { config: {} };
  }

  const raw = await fs.readFile(configPath, "utf8");
  const parsed = parseYaml(raw);
  if (!isRecord(parsed)) {
    return { path: configPath, config: {} };
  }

  return {
    path: configPath,
    config: normalizeProjectConfig(parsed)
  };
}

export async function resolveProjectConfigPath(
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
      // Missing project config is valid for default-only use.
    }
  }
  return undefined;
}

export function normalizeProjectConfig(source: JsonRecord): JsonRecord {
  const result: JsonRecord = {};
  if (isRecord(source.project)) {
    result.project = source.project;
  }
  if (isRecord(source.mcu)) {
    result.mcu = source.mcu;
  }
  if (isRecord(source.build)) {
    result.build = source.build;
  }
  if (isRecord(source.flash)) {
    result.flash = source.flash;
  }
  if (isRecord(source.debug)) {
    result.debug = source.debug;
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
      fallbackScan: source.serial.fallbackScan,
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

export function deepMerge(...sources: JsonRecord[]): JsonRecord {
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
