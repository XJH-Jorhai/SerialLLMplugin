# Changelog

## v1.5.2

Fixed:

- Reduced Webview refresh payloads and terminal retention to avoid UI stalls during high-rate serial streams.
- Paused Webview refresh during bridge stop so shutdown is not delayed by large retained console output.
- Dropped late raw serial data after stop is requested to prevent new data from extending logger shutdown.

Validated:

- `npm.cmd run compile`
- `npm.cmd test`
- Manual high-throughput serial view regression recorded in `docs/mvp1-release-checklist.md`.

## v0.1.0-mvp1

MVP1 establishes the reliable serial bridge and logging baseline.

Added:

- VS Code command and Webview paths to start/stop the local bridge.
- Serial port listing, serial open/close, raw read, and text command send.
- Local HTTP API on `127.0.0.1`: `GET /session`, `GET /ports`, `GET /latest`, `GET /logs`, `POST /serial/open`, `POST /serial/close`, and `POST /serial/send`.
- Local WebSocket stream at `/stream`.
- Per-session logs: `session.json`, `raw.log`, `parsed.jsonl`, `events.jsonl`, and `commands.jsonl`.
- `raw-text` and `json-line` parser support.
- Recoverable events for parser failures, serial errors, and serial disconnects.
- Bounded in-memory recent-data buffers.
- MVP1.5 hardening docs, release checklist, manual test plan, API docs, and PowerShell smoke scripts.
- MVP3 foundation config discovery for `.vscode/mcu-serial-bridge.yaml`, `.vscode/stm32-serial-bridge.yaml`, and `.vscode/stm32-serial-assistant.yaml`.
- MVP3 foundation task commands that invoke existing VS Code tasks by configured labels.
- Bottom Panel `MCU Debug > Serial` view as the recommended serial UI, with `MCU Serial Bridge: Open Panel` retained as a compatibility command that focuses the same view.

Not included:

- Waveform plotting.
- VOFA FireWater parsing.
- Complex dashboard UI.
- Cortex-Debug session management.
- pyOCD probe lifecycle management.
- Any hard-coded COM port, STM32 target, UART, pins, or build output name.
