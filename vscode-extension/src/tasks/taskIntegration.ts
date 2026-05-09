import * as vscode from "vscode";
import { BridgeConfig } from "../config/schema";
import { BridgeError } from "../util/errors";

export type BridgeTaskKind = "build" | "flash";

export async function runConfiguredTask(
  config: BridgeConfig,
  kind: BridgeTaskKind
): Promise<void> {
  const label = getConfiguredTaskLabel(config, kind);
  if (!label) {
    throw new BridgeError(
      `No ${kind} task label is configured. Set build.${kind === "build" ? "buildTask" : "flashTask"} in .vscode/mcu-serial-bridge.yaml or VS Code settings.`,
      `task.${kind}.labelMissing`
    );
  }

  await runTaskByLabel(label, kind);
}

export function getConfiguredTaskLabel(
  config: BridgeConfig,
  kind: BridgeTaskKind
): string | undefined {
  const value = kind === "build" ? config.build.buildTask : config.build.flashTask;
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function runTaskByLabel(
  label: string,
  kind: BridgeTaskKind
): Promise<void> {
  const task = await findTaskByLabel(label);
  if (!task) {
    throw new BridgeError(
      `Configured ${kind} task "${label}" was not found. Check the workspace tasks and the bridge project configuration.`,
      `task.${kind}.notFound`
    );
  }
  ensureFiniteTask(task, label, kind);

  const execution = await vscode.tasks.executeTask(task);
  await waitForTaskEnd(execution, task, label, kind);
}

async function findTaskByLabel(label: string): Promise<vscode.Task | undefined> {
  const tasks = await vscode.tasks.fetchTasks();
  return tasks.find((task) => task.name === label || getDefinitionLabel(task) === label);
}

function getDefinitionLabel(task: vscode.Task): string | undefined {
  const definition = task.definition as { label?: unknown };
  return typeof definition.label === "string" ? definition.label : undefined;
}

function ensureFiniteTask(
  task: vscode.Task,
  label: string,
  kind: BridgeTaskKind
): void {
  if (!task.isBackground) {
    return;
  }

  throw new BridgeError(
    `Configured ${kind} task "${label}" is a background task. MCU Serial Bridge build and flash commands require a finite task that completes.`,
    `task.${kind}.backgroundUnsupported`
  );
}

async function waitForTaskEnd(
  execution: vscode.TaskExecution,
  task: vscode.Task,
  label: string,
  kind: BridgeTaskKind
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = (): void => {
      processEndDisposable.dispose();
      taskEndDisposable.dispose();
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
    const settle = (error?: BridgeError): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    const processEndDisposable = vscode.tasks.onDidEndTaskProcess((event) => {
      if (event.execution !== execution) {
        return;
      }

      if (typeof event.exitCode === "number" && event.exitCode !== 0) {
        settle(
          new BridgeError(
            `Configured ${kind} task "${label}" exited with code ${event.exitCode}.`,
            `task.${kind}.failed`
          )
        );
        return;
      }

      settle();
    });

    const taskEndDisposable = vscode.tasks.onDidEndTask((event) => {
      if (event.execution !== execution || fallbackTimer) {
        return;
      }

      const delayMs = expectsProcessEndEvent(task) ? 250 : 0;
      fallbackTimer = setTimeout(() => {
        settle();
      }, delayMs);
    });
  });
}

function expectsProcessEndEvent(task: vscode.Task): boolean {
  return (
    task.execution instanceof vscode.ProcessExecution ||
    task.execution instanceof vscode.ShellExecution
  );
}
