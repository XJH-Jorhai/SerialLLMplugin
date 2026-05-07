import * as path from "node:path";

export function resolveSessionBaseDirectory(
  workspaceRoot: string,
  configuredDirectory: string
): string {
  return path.isAbsolute(configuredDirectory)
    ? configuredDirectory
    : path.join(workspaceRoot, configuredDirectory);
}

export function sanitizePathSegment(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized.length > 0 ? sanitized : "session";
}
