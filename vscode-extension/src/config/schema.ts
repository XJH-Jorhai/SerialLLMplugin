import { z } from "zod";
import {
  DEFAULT_BAUDRATE,
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_PORT,
  DEFAULT_CONFIG_FILE,
  DEFAULT_LATEST_WINDOW_SECONDS,
  DEFAULT_LINE_ENDING,
  DEFAULT_LOGGING_DIRECTORY,
  DEFAULT_LOGGING_ENABLED,
  DEFAULT_WEBSOCKET_PATH
} from "./defaults";

export const lineEndingSchema = z.enum(["", "\n", "\r", "\r\n"]);
const serialDataBitsSchema = z.union([
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8)
]);
const serialParitySchema = z.enum(["none", "even", "mark", "odd", "space"]);
const serialStopBitsSchema = z.union([z.literal(1), z.literal(1.5), z.literal(2)]);

export const bridgeConfigSchema = z.object({
  configFile: z.string().default(DEFAULT_CONFIG_FILE),
  projectConfigPath: z.string().optional(),
  workspaceRoot: z.string().optional(),
  project: z
    .object({
      name: z.string().optional(),
      root: z.string().optional(),
      elf: z.string().optional(),
      hex: z.string().optional(),
      bin: z.string().optional()
    })
    .default({}),
  mcu: z
    .object({
      vendor: z.string().optional(),
      family: z.string().optional(),
      target: z.string().optional(),
      core: z.string().optional(),
      flash: z.string().optional(),
      ram: z.string().optional()
    })
    .default({}),
  build: z
    .object({
      configureTask: z.string().optional(),
      buildTask: z.string().optional(),
      flashTask: z.string().optional()
    })
    .default({}),
  flash: z
    .object({
      tool: z.string().optional(),
      probe: z.string().optional(),
      target: z.string().optional(),
      args: z.array(z.string()).optional()
    })
    .default({}),
  debug: z
    .object({
      adapter: z.string().optional(),
      server: z.string().optional(),
      target: z.string().optional(),
      launchConfig: z.string().optional()
    })
    .default({}),
  bridge: z
    .object({
      host: z.string().default(DEFAULT_BRIDGE_HOST),
      port: z.number().int().min(1).max(65535).default(DEFAULT_BRIDGE_PORT),
      websocketPath: z.string().default(DEFAULT_WEBSOCKET_PATH),
      latestWindowSeconds: z
        .number()
        .int()
        .positive()
        .default(DEFAULT_LATEST_WINDOW_SECONDS)
    })
    .default({}),
  serial: z
    .object({
      preferredPort: z.string().nullable().optional(),
      fallbackScan: z.boolean().optional(),
      defaultBaudrate: z.number().int().positive().default(DEFAULT_BAUDRATE),
      defaultLineEnding: lineEndingSchema.default(DEFAULT_LINE_ENDING),
      dataBits: serialDataBitsSchema.optional(),
      parity: serialParitySchema.optional(),
      stopBits: serialStopBitsSchema.optional(),
      uart: z.string().optional(),
      tx: z.string().optional(),
      rx: z.string().optional()
    })
    .default({}),
  protocol: z
    .object({
      type: z.string().default("raw-text"),
      fallback: z.string().optional()
    })
    .default({}),
  logging: z
    .object({
      enabled: z.boolean().default(DEFAULT_LOGGING_ENABLED),
      directory: z.string().default(DEFAULT_LOGGING_DIRECTORY),
      rawLog: z.boolean().default(true),
      parsedJsonl: z.boolean().default(true),
      eventsJsonl: z.boolean().default(true),
      commandsJsonl: z.boolean().default(true)
    })
    .default({})
});

export type BridgeConfig = z.infer<typeof bridgeConfigSchema>;
