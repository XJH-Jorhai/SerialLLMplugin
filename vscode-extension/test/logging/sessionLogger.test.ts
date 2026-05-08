import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeSession } from "../../src/bridge/types";
import { SessionLogger } from "../../src/logging/sessionLogger";

const tempRoots: string[] = [];

describe("SessionLogger", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((directory) =>
        fsp.rm(directory, { recursive: true, force: true })
      )
    );
  });

  it("creates the required session layout and metadata", async () => {
    const workspace = await createTempWorkspace();
    const logger = new SessionLogger();

    const info = await logger.startSession(makeMetadata(workspace));
    await logger.close();

    expect(path.dirname(info.directory)).toBe(path.join(workspace, ".serial-sessions"));
    expect(path.basename(info.directory)).toMatch(
      /^\d{4}-\d{2}-\d{2}_\d{6}_demo_project$/
    );
    await expectFile(info.files.sessionJson);
    await expectFile(info.files.rawLog);
    await expectFile(info.files.parsedJsonl);
    await expectFile(info.files.eventsJsonl);
    await expectFile(info.files.commandsJsonl);

    const session = JSON.parse(await fsp.readFile(info.files.sessionJson, "utf8"));
    expect(session).toMatchObject({
      project: "demo project",
      workspace,
      serial: { open: true, port: "COM7", baudrate: 115200 },
      protocol: "raw-text",
      startedAt: "2026-05-07T10:30:00.123Z"
    });
    expect(session.logging.sessionDirectory).toBe(info.directory);
  });

  it("streams raw, parsed, event, and command logs", async () => {
    const workspace = await createTempWorkspace();
    const logger = new SessionLogger();
    const info = await logger.startSession(makeMetadata(workspace));

    logger.logRawLine("System boot", 1710000000.123);
    logger.logParsed({ ts: 1710000000.123, type: "raw", text: "System boot" });
    logger.logEvent({
      ts: 1710000001,
      level: "error",
      message: "parser failure",
      code: "parser.failure"
    });
    logger.logCommand({ ts: 1710000002, encoding: "text", data: "status\r\n" });
    await logger.close();

    const rawLog = await fsp.readFile(info.files.rawLog, "utf8");
    expect(rawLog.trim()).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] System boot$/);

    expect(await readJsonLines(info.files.parsedJsonl)).toEqual([
      { ts: 1710000000.123, type: "raw", text: "System boot" }
    ]);
    expect(await readJsonLines(info.files.eventsJsonl)).toEqual([
      {
        ts: 1710000001,
        level: "error",
        message: "parser failure",
        code: "parser.failure"
      }
    ]);
    expect(await readJsonLines(info.files.commandsJsonl)).toEqual([
      { ts: 1710000002, encoding: "text", data: "status\r\n" }
    ]);
  });

  it("closes idempotently", async () => {
    const workspace = await createTempWorkspace();
    const logger = new SessionLogger();
    await logger.startSession(makeMetadata(workspace));

    await logger.close();
    await logger.close();

    expect(logger.getSessionInfo()?.directory).toBe(logger.sessionDirectory);
  });
});

async function createTempWorkspace(): Promise<string> {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "mcu-serial-bridge-"));
  tempRoots.push(directory);
  return directory;
}

function makeMetadata(workspace: string): BridgeSession {
  return {
    running: true,
    project: "demo project",
    workspace,
    mcu: "STM32_TEST",
    elf: "build/Debug/demo.elf",
    serial: {
      open: true,
      port: "COM7",
      baudrate: 115200
    },
    protocol: "raw-text",
    startedAt: "2026-05-07T10:30:00.123Z",
    api: {
      host: "127.0.0.1",
      port: 8765,
      websocketPath: "/stream"
    },
    logging: {
      enabled: true,
      directory: ".serial-sessions"
    }
  };
}

async function expectFile(filePath: string): Promise<void> {
  const stat = await fsp.stat(filePath);
  expect(stat.isFile()).toBe(true);
}

async function readJsonLines(filePath: string): Promise<unknown[]> {
  const text = await fsp.readFile(filePath, "utf8");
  return text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}
