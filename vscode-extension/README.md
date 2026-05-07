# MCU Serial Bridge VS Code Extension

This directory contains the initial TypeScript-only VS Code extension scaffold for MVP1 of the MCU Serial Bridge project.

The product boundary is intentionally narrow: the bridge is a VS Code extension that owns one serial session, exposes local agent-readable APIs, and writes reproducible session logs. It is not a standalone app, a VOFA+ clone, or a Serial Studio clone.

## MVP1 Scope

Implemented in this scaffold:

- VS Code extension metadata, command contributions, and configuration schema.
- Strict TypeScript project setup with Vitest.
- Core service boundaries for commands, bridge lifecycle, serial ownership, local HTTP API, WebSocket fanout, session logging, protocol parsing, and Webview shell.
- Safe command stubs for start, stop, list ports, open serial, close serial, send line, build, flash, build-flash-open-serial, and open session folder.
- Bounded ring buffer utility for recent bridge data.
- Session logger structure that uses file streams for long-running log files.
- Minimal tests that do not require STM32 hardware or a serial device.

Intentionally left for follow-up work:

- Actual serial port open/read/write lifecycle in `src/bridge/serialManager.ts`.
- Raw byte to line framing and parser dispatch in `src/bridge/bridgeService.ts`.
- Full `/latest`, `/serial/send`, and WebSocket live-stream behavior backed by serial input.
- Complete Webview terminal UI and command controls.
- Build, flash, and debug task integration for later MVP stages.

## Commands

- `mcuSerialBridge.openPanel` - MCU Serial Bridge: Open Panel
- `mcuSerialBridge.listPorts` - MCU Serial Bridge: List Ports
- `mcuSerialBridge.openSerial` - MCU Serial Bridge: Open Serial Port
- `mcuSerialBridge.closeSerial` - MCU Serial Bridge: Close Serial Port
- `mcuSerialBridge.sendLine` - MCU Serial Bridge: Send Line
- `mcuSerialBridge.build` - MCU Serial Bridge: Build
- `mcuSerialBridge.flash` - MCU Serial Bridge: Flash
- `mcuSerialBridge.buildFlashOpenSerial` - MCU Serial Bridge: Build, Flash, and Open Serial
- `mcuSerialBridge.startBridge` - MCU Serial Bridge: Start Bridge
- `mcuSerialBridge.stopBridge` - MCU Serial Bridge: Stop Bridge
- `mcuSerialBridge.openSessionFolder` - MCU Serial Bridge: Open Session Folder

## Settings

Defaults:

```json
{
  "mcuSerialBridge.configFile": ".vscode/mcu-serial-bridge.yaml",
  "mcuSerialBridge.bridge.host": "127.0.0.1",
  "mcuSerialBridge.bridge.port": 8765,
  "mcuSerialBridge.serial.defaultBaudrate": 115200,
  "mcuSerialBridge.serial.defaultLineEnding": "\r\n",
  "mcuSerialBridge.logging.enabled": true,
  "mcuSerialBridge.logging.directory": ".serial-sessions"
}
```

The bridge refuses non-local bind hosts in MVP1. External network binding requires an explicit future design.

## Development

```powershell
npm install
npm run compile
npm test
```

No hardware is required for compile or the current tests.

## Subagent Work Plan

1. Serial IO: implement `SerialManager` with exclusive port ownership, byte stream handling, write queueing, and clean close behavior.
2. Logging and parsing: wire raw bytes into line framing, log raw lines before parsing, dispatch `raw-text` and `json-line`, and convert parser failures into warning events.
3. HTTP/WebSocket API: complete request validation and live stream coverage for `/session`, `/ports`, `/latest`, `/logs`, `/serial/open`, `/serial/close`, `/serial/send`, and `/stream`.
4. Webview: replace the placeholder panel with status, port selector, open/close controls, raw terminal output, send line, latest parsed preview, log folder action, and event list.
5. Tests: add parser, logger, bridge API, command registration, and lifecycle tests using simulated serial input rather than real hardware.
6. STM32 workflow integration: later MVP stages should invoke existing VS Code tasks and debug configurations without rewriting `.vscode/tasks.json` or `.vscode/launch.json`.
