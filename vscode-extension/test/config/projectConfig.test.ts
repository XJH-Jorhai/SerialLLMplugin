import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  deepMerge,
  loadProjectConfig,
  resolveProjectConfigPath
} from "../../src/config/projectConfig";
import { bridgeConfigSchema } from "../../src/config/schema";

const tempRoots: string[] = [];

describe("project config discovery", () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((directory) =>
        fsp.rm(directory, { recursive: true, force: true })
      )
    );
  });

  it("discovers the default config before backward-compatible aliases", async () => {
    const workspace = await createWorkspace();
    await writeConfig(workspace, ".vscode/stm32-serial-bridge.yaml", "project:\n  name: alias\n");
    await writeConfig(workspace, ".vscode/mcu-serial-bridge.yaml", "project:\n  name: default\n");

    await expect(resolveProjectConfigPath(workspace, undefined)).resolves.toBe(
      path.join(workspace, ".vscode/mcu-serial-bridge.yaml")
    );
  });

  it("discovers stm32-serial-bridge before stm32-serial-assistant when default is absent", async () => {
    const workspace = await createWorkspace();
    await writeConfig(workspace, ".vscode/stm32-serial-assistant.yaml", "project:\n  name: assistant\n");
    await writeConfig(workspace, ".vscode/stm32-serial-bridge.yaml", "project:\n  name: bridge\n");

    await expect(resolveProjectConfigPath(workspace, undefined)).resolves.toBe(
      path.join(workspace, ".vscode/stm32-serial-bridge.yaml")
    );
  });

  it("normalizes project YAML and preserves build task labels for MVP3 commands", async () => {
    const workspace = await createWorkspace();
    await writeConfig(
      workspace,
      ".vscode/mcu-serial-bridge.yaml",
      [
        "project:",
        "  name: demo",
        "  elf: build/Debug/demo.elf",
        "mcu:",
        "  family: STM32F4",
        "  target: STM32F407VETx",
        "build:",
        "  buildTask: Build Debug",
        "  flashTask: Flash via Existing Tool",
        "serial:",
        "  baudrate: 57600",
        "  preferredPort: null",
        "bridge:",
        "  httpPort: 8877"
      ].join("\n")
    );

    const loaded = await loadProjectConfig(workspace, undefined);
    const config = bridgeConfigSchema.parse(
      deepMerge({ bridge: { host: "127.0.0.1" } }, loaded.config, {
        workspaceRoot: workspace,
        projectConfigPath: loaded.path
      })
    );

    expect(config.projectConfigPath).toBe(path.join(workspace, ".vscode/mcu-serial-bridge.yaml"));
    expect(config.project.name).toBe("demo");
    expect(config.mcu.target).toBe("STM32F407VETx");
    expect(config.build).toMatchObject({
      buildTask: "Build Debug",
      flashTask: "Flash via Existing Tool"
    });
    expect(config.serial.defaultBaudrate).toBe(57600);
    expect(config.bridge.port).toBe(8877);
  });
});

async function createWorkspace(): Promise<string> {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "mcu-serial-bridge-"));
  tempRoots.push(directory);
  await fsp.mkdir(path.join(directory, ".vscode"), { recursive: true });
  return directory;
}

async function writeConfig(
  workspace: string,
  relativePath: string,
  content: string
): Promise<void> {
  const absolute = path.join(workspace, relativePath);
  await fsp.mkdir(path.dirname(absolute), { recursive: true });
  await fsp.writeFile(absolute, `${content}\n`, "utf8");
}
