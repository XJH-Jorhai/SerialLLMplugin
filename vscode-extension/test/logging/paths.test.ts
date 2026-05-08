import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSessionDirectoryName,
  resolveSessionBaseDirectory,
  resolveSessionLogFiles,
  sanitizePathSegment
} from "../../src/logging/paths";

describe("logging paths", () => {
  it("resolves relative log directories under the workspace root", () => {
    const workspace = path.resolve("workspace");
    expect(resolveSessionBaseDirectory(workspace, ".serial-sessions")).toBe(
      path.join(workspace, ".serial-sessions")
    );
  });

  it("sanitizes path segments for session names", () => {
    expect(sanitizePathSegment("demo project: uart")).toBe("demo_project_uart");
  });

  it("builds session directory names from timestamp and project", () => {
    expect(
      buildSessionDirectoryName(new Date(2026, 4, 7, 10, 30, 0), "demo project")
    ).toBe("2026-05-07_103000_demo_project");
  });

  it("resolves the required session log files", () => {
    const sessionDirectory = path.resolve("workspace", ".serial-sessions", "session");
    expect(resolveSessionLogFiles(sessionDirectory)).toEqual({
      sessionJson: path.join(sessionDirectory, "session.json"),
      rawLog: path.join(sessionDirectory, "raw.log"),
      parsedJsonl: path.join(sessionDirectory, "parsed.jsonl"),
      eventsJsonl: path.join(sessionDirectory, "events.jsonl"),
      commandsJsonl: path.join(sessionDirectory, "commands.jsonl")
    });
  });
});
