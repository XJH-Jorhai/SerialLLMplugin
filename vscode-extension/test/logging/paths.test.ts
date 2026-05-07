import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveSessionBaseDirectory,
  sanitizePathSegment
} from "../../src/logging/paths";

describe("logging paths", () => {
  it("resolves relative log directories under the workspace root", () => {
    expect(resolveSessionBaseDirectory("C:\\workspace", ".serial-sessions")).toBe(
      path.join("C:\\workspace", ".serial-sessions")
    );
  });

  it("sanitizes path segments for session names", () => {
    expect(sanitizePathSegment("demo project: uart")).toBe("demo_project_uart");
  });
});
