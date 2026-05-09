# MVP1 Release Checklist

This checklist is for the `v0.1.0-mvp1` release of the VS Code MCU Serial Bridge.

## Scope Lock

- [1 ] Raw serial output is visible in the VS Code bottom Panel view under `MCU Debug > Serial`.
- [1 ] `GET /latest` returns recent raw serial output.
- [1 ] Commands sent from the VS Code UI are written to `commands.jsonl`.
- [1 ] Commands sent through `POST /serial/send` are written to `commands.jsonl`.
- [1 ] Each logging session creates `session.json`, `raw.log`, `parsed.jsonl`, `events.jsonl`, and `commands.jsonl`.
- [1 ] The bridge does not require VOFA+.
- [1 ] The bridge does not require Serial Studio.
- [1 ] No waveform plotting is included.
- [1 ] No board-specific COM port, STM32 target, UART, pin, or build output is hard-coded.

## Resource Cleanup

- [1 ] `MCU Serial Bridge: Stop Bridge` closes an open serial port.
- [1 ] The HTTP server stops cleanly.
- [1 ] WebSocket clients are closed when the bridge stops.
- [1 ] Log streams flush and close. 
- [1 ] Logger close is idempotent.
- [1 ] Repeated start/stop does not leave stale server instances.
- [1 ] HTTP port conflicts produce a clear diagnostic.

## Automated Verification

Run from the repository root:

```powershell
npm.cmd run compile
npm.cmd test
```

Expected result:

- [1 ] TypeScript compile passes.
- [1 ] Vitest passes without real hardware.
- [1 ] Tests cover malformed `POST /serial/send`, serial disconnect events, bounded ring buffers, repeated start/stop, and logger close idempotency.

## Manual Verification

- [1 ] No-hardware API smoke test completed.
- [1 ] Virtual COM pair test completed when a virtual pair is available.
- [1 ] Real STM32 hardware test completed when target hardware is available.
- [1 ] Serial disconnect test completed.
- [1 ] Repeated start/stop manual test completed.
- [1 ] HTTP port conflict manual test completed.
- [1 ] Low-height bottom Panel UI test completed: serial toolbar, terminal, send row, and events/parsed inspector remain usable.

## MVP3 Foundation

- [1 ] Project config discovery supports `.vscode/mcu-serial-bridge.yaml`.
- [1 ] Project config discovery supports `.vscode/stm32-serial-bridge.yaml`.
- [1 ] Project config discovery supports `.vscode/stm32-serial-assistant.yaml`.
- [1 ] YAML project config is parsed through `yaml` and validated through `zod`.
- [1 ] `/session` includes `projectMetadata` when project config metadata exists.
- [1 ] Build and flash commands invoke existing VS Code tasks by configured task labels.
- [1 ] Missing task labels and missing tasks show clear diagnostics.
- [1 ] No STM32 workspace `.vscode/tasks.json` or `.vscode/launch.json` files are overwritten.
