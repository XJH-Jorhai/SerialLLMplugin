# MCU Serial Bridge VS Code Extension

MCU Serial Bridge is a VS Code extension for STM32-style MCU serial debugging. Its job is to own one serial session inside the VS Code workflow, show the same raw stream to a human, expose recent data through local agent-readable APIs, and write reproducible local session logs.

It is not a standalone serial assistant, a VOFA+ clone, a Serial Studio clone, or a replacement for the existing CMake, pyOCD, or Cortex-Debug workflow.

## MVP1 Scope

MVP1 focuses on the serial bridge and logging path:

- List detected serial ports.
- Start and stop a local HTTP/WebSocket bridge on `127.0.0.1`.
- Open one selected serial port with a configurable baudrate and 8N1 defaults.
- Read raw serial chunks and completed raw lines.
- Display raw output, latest parsed frames, and events in the bottom `MCU Debug > Serial` Webview View.
- Send text commands from VS Code or the local API.
- Write per-session `session.json`, `raw.log`, `parsed.jsonl`, `events.jsonl`, and `commands.jsonl`.
- Expose `GET /session`, `GET /ports`, `GET /latest`, `GET /logs`, `POST /serial/open`, `POST /serial/close`, `POST /serial/send`, and `WS /stream`.
- Parse `raw-text` and `json-line` protocol output. Invalid JSON lines become recoverable warning events.
- Discover project configuration from `.vscode/mcu-serial-bridge.yaml`, `.vscode/stm32-serial-bridge.yaml`, or `.vscode/stm32-serial-assistant.yaml`.
- Invoke existing VS Code build and flash tasks by configured task labels.

## Not Included In MVP1

- Creating or modifying build, flash, debug, `.vscode/tasks.json`, or `.vscode/launch.json` files. Build and flash commands only invoke existing VS Code tasks by configured labels.
- Cortex-Debug, pyOCD, or probe lifecycle control.
- VOFA FireWater, waveform plotting, channel controls, binary framing, or protocol designer UI.
- External network binding. MVP1 rejects non-local HTTP/WebSocket hosts.
- VOFA+ or Serial Studio integration. Neither tool is required.
- Hardware-specific defaults such as a fixed COM port, STM32 family, UART instance, or ELF path.

## Development Install

From this repository root:

```powershell
npm.cmd install
```

The root install script installs the extension dependencies under `vscode-extension`.
You can also install only the extension package directly:

```powershell
npm.cmd --prefix vscode-extension install
```

## Compile And Tests

From `vscode-extension`:

```powershell
npm.cmd run compile
npm.cmd test
```

From the repository root:

```powershell
npm.cmd run compile
npm.cmd test
```

The automated tests are no-hardware tests. They use fake serial ports, temporary log directories, and local HTTP/WebSocket test servers.

## Release Docs

Repository-level docs:

- `docs/api.md`
- `docs/manual-test-plan.md`
- `docs/mvp1-release-checklist.md`
- `CHANGELOG.md`

PowerShell smoke scripts:

- `scripts/smoke-latest.ps1`
- `scripts/send-command.ps1`

## Launch In Extension Development Host

1. Open `C:\Users\20101\Desktop\SerialLLMplugin\vscode-extension` in VS Code.
2. Run `npm.cmd install` if dependencies are not installed yet.
3. Run `npm.cmd run compile`.
4. Press `F5`.
5. If VS Code asks for an environment, choose the VS Code extension development option.
6. In the Extension Development Host window, open the workspace you want to observe.

Alternative CLI launch:

```powershell
code --extensionDevelopmentPath="C:\Users\20101\Desktop\SerialLLMplugin\vscode-extension"
```

## Open The Serial View

The recommended human UI entry point is the bottom Panel view:

- Command Palette: `MCU Serial Bridge: Focus Serial View`.
- VS Code bottom Panel: `MCU Debug > Serial`.

The legacy command `MCU Serial Bridge: Open Panel` is still available for compatibility. It now focuses the same bottom `MCU Debug > Serial` view instead of opening a separate large panel.

## Start The Bridge

Use either path:

- Command Palette: `MCU Serial Bridge: Start Bridge`.
- Open `MCU Debug > Serial`, then click `Start Bridge`.

By default the bridge listens on:

```text
http://127.0.0.1:8765
ws://127.0.0.1:8765/stream
```

Opening a serial port from the Serial view or command palette also starts the bridge if it is not already running.

## List Ports

Use one of:

- Command Palette: `MCU Serial Bridge: List Ports`.
- `MCU Debug > Serial`: click `List Ports`.
- API after the bridge is running:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/ports"
```

## Open Serial

Use one of:

- Command Palette: `MCU Serial Bridge: Open Serial Port`, select or enter a port, then enter a baudrate.
- `MCU Debug > Serial`: select a detected port or enter a manual port, enter a baudrate, then click `Open`.
- API after the bridge is running:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8765/serial/open" `
  -ContentType "application/json" `
  -Body (@{
    path = "<serial-port>"
    baudrate = 115200
    dataBits = 8
    parity = "none"
    stopBits = 1
  } | ConvertTo-Json)
```

Close other serial monitors before opening the port. Windows serial ports are usually exclusive.

## Send Command

Use one of:

- Command Palette: `MCU Serial Bridge: Send Line`. This appends the configured `mcuSerialBridge.serial.defaultLineEnding`, which defaults to `\r\n`.
- `MCU Debug > Serial`: type a command in the send box and click `Send`. This also appends the configured default line ending.
- API after the bridge is running and the serial port is open:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8765/serial/send" `
  -ContentType "application/json" `
  -Body (@{
    data = "status`r`n"
    encoding = "text"
  } | ConvertTo-Json)
```

The API sends the exact `data` string. Include `\r`, `\n`, or `\r\n` in the request when the firmware protocol requires a line ending.

## Local API

All MVP1 endpoints bind to `127.0.0.1` by default.

### `GET /session`

Returns bridge state, project metadata when configured, serial state, protocol, API address, and active log directory.

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/session"
```

### `GET /ports`

Returns detected serial ports.

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/ports"
```

### `GET /latest`

Returns recent raw chunks, raw lines, parsed frames, samples array, events, and commands. `samples` is present for API shape compatibility, but MVP1 parsers currently produce `raw` and `json` frames only.

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/latest"
Invoke-RestMethod -Uri "http://127.0.0.1:8765/latest?seconds=20"
```

### `POST /serial/send`

Sends text to the open serial port and logs the command to `commands.jsonl`.

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8765/serial/send" `
  -ContentType "application/json" `
  -Body (@{ data = "status`r`n"; encoding = "text" } | ConvertTo-Json)
```

### `WS /stream`

Streams live messages such as `raw`, `parsed`, `event`, and `cmd_tx`.

From `vscode-extension`, using the existing `ws` dependency:

```powershell
node -e "const WebSocket=require('ws'); const ws=new WebSocket('ws://127.0.0.1:8765/stream'); ws.on('open',()=>console.log('connected')); ws.on('message',m=>console.log(m.toString()));"
```

## Logs

When logging is enabled, session logs are created under the configured logging directory. The default is `.serial-sessions` under the active workspace root:

```text
.serial-sessions/
  YYYY-MM-DD_HHMMSS_<project>/
    session.json
    raw.log
    parsed.jsonl
    events.jsonl
    commands.jsonl
```

Use `MCU Serial Bridge: Open Session Folder` or the Serial view `Open Log Folder` button to reveal the active session directory. If no session is active, there is no log folder to open.

## Settings

Default settings:

```json
{
  "mcuSerialBridge.configFile": ".vscode/mcu-serial-bridge.yaml",
  "mcuSerialBridge.bridge.host": "127.0.0.1",
  "mcuSerialBridge.bridge.port": 8765,
  "mcuSerialBridge.build.configureTask": "",
  "mcuSerialBridge.build.buildTask": "",
  "mcuSerialBridge.build.flashTask": "",
  "mcuSerialBridge.serial.defaultBaudrate": 115200,
  "mcuSerialBridge.serial.defaultLineEnding": "\r\n",
  "mcuSerialBridge.logging.enabled": true,
  "mcuSerialBridge.logging.directory": ".serial-sessions"
}
```

The project config loader also accepts `.vscode/mcu-serial-bridge.yaml` and the backward-compatible aliases `.vscode/stm32-serial-bridge.yaml` and `.vscode/stm32-serial-assistant.yaml` when the default config path is used.

## Project Configuration

The loader checks these files in order when `mcuSerialBridge.configFile` remains at the default:

1. `.vscode/mcu-serial-bridge.yaml`
2. `.vscode/stm32-serial-bridge.yaml`
3. `.vscode/stm32-serial-assistant.yaml`

Example:

```yaml
project:
  name: demo
  elf: build/Debug/demo.elf

mcu:
  family: STM32F4
  target: STM32F407VETx
  core: cortex-m4

build:
  buildTask: "Build Debug"
  flashTask: "Flash via Existing Tool"

serial:
  preferredPort: null
  baudrate: 115200
  dataBits: 8
  parity: none
  stopBits: 1

protocol:
  type: raw-text
```

When metadata exists, `GET /session` includes it under `projectMetadata`. The bridge does not auto-open a scanned serial port; `Build, Flash, and Open Serial` opens serial only when `serial.preferredPort` is explicitly configured.

## Build And Flash Commands

These commands call existing VS Code tasks by label:

- `MCU Serial Bridge: Build` uses `build.buildTask`.
- `MCU Serial Bridge: Flash` uses `build.flashTask`.
- `MCU Serial Bridge: Build, Flash, and Open Serial` runs both in order, then opens `serial.preferredPort` if configured.

If a label is missing or no matching VS Code task exists, the extension shows a diagnostic. It does not edit workspace task or debug configuration files.
