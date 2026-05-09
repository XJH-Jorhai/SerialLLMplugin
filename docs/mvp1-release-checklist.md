# MVP1 Release Checklist

This checklist is for the `v0.1.0-mvp1` release of the VS Code MCU Serial Bridge.

## Scope Lock

- [ ] Raw serial output is visible in the VS Code bottom Panel view under `MCU Debug > Serial`.
- [ ] `GET /latest` returns recent raw serial output.
- [ ] Commands sent from the VS Code UI are written to `commands.jsonl`.
- [ ] Commands sent through `POST /serial/send` are written to `commands.jsonl`.
- [ ] Each logging session creates `session.json`, `raw.log`, `parsed.jsonl`, `events.jsonl`, and `commands.jsonl`.
- [ ] The bridge does not require VOFA+.
- [ ] The bridge does not require Serial Studio.
- [ ] No waveform plotting is included.
- [ ] No board-specific COM port, STM32 target, UART, pin, or build output is hard-coded.

## Resource Cleanup

- [ ] `MCU Serial Bridge: Stop Bridge` closes an open serial port.
- [ ] The HTTP server stops cleanly.
- [ ] WebSocket clients are closed when the bridge stops.
- [ ] Log streams flush and close.
- [ ] Logger close is idempotent.
- [ ] Repeated start/stop does not leave stale server instances.
- [ ] HTTP port conflicts produce a clear diagnostic.

## Automated Verification

Run from the repository root:

```powershell
npm.cmd run compile
npm.cmd test
```

Expected result:

- [ ] TypeScript compile passes.
- [ ] Vitest passes without real hardware.
- [ ] Tests cover malformed `POST /serial/send`, serial disconnect events, bounded ring buffers, repeated start/stop, and logger close idempotency.

## Manual Verification

- [ ] No-hardware API smoke test completed.
- [ ] Virtual COM pair test completed when a virtual pair is available.
- [ ] Real STM32 hardware test completed when target hardware is available.
- [ ] Serial disconnect test completed.
- [ ] Repeated start/stop manual test completed.
- [ ] HTTP port conflict manual test completed.
- [ ] Low-height bottom Panel UI test completed: serial toolbar, terminal, send row, and events/parsed inspector remain usable.

## MVP3 Foundation

- [ ] Project config discovery supports `.vscode/mcu-serial-bridge.yaml`.
- [ ] Project config discovery supports `.vscode/stm32-serial-bridge.yaml`.
- [ ] Project config discovery supports `.vscode/stm32-serial-assistant.yaml`.
- [ ] YAML project config is parsed through `yaml` and validated through `zod`.
- [ ] `/session` includes `projectMetadata` when project config metadata exists.
- [ ] Build and flash commands invoke existing VS Code tasks by configured task labels.
- [ ] Missing task labels and missing tasks show clear diagnostics.
- [ ] No STM32 workspace `.vscode/tasks.json` or `.vscode/launch.json` files are overwritten.
