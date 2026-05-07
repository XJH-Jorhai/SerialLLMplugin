# AGENTS.md

## Project Mission

Build a **VS Code MCU Serial Bridge** for STM32 development.

The project is not a full serial assistant, not a VOFA+ clone, and not a Serial Studio replacement. Its core purpose is to act as a reliable bridge between:

```text
STM32 target serial output
VS Code user workflow
Codex / coding-agent readable data stream
Persistent local debug logs
Existing STM32 build / flash / debug tools
```

The bridge must provide one authoritative serial session that can be consumed by both humans and agents.

Primary goals:

```text
1. Own the serial port inside the VS Code workflow.
2. Expose raw and structured serial data to agents through local HTTP/WebSocket APIs.
3. Save reproducible session logs.
4. Provide a minimal human-facing VS Code UI for observation and command sending.
5. Integrate with existing CMake, Cortex-Debug, and pyOCD workflows without replacing them.
6. Support VOFA-style serial formats only as lightweight protocol compatibility, not as a UI cloning target.
```

The bridge should become a small but dependable infrastructure component for MCU debugging. It should not become a general-purpose visualization studio.

---

## Repository Entry Point

This file should remain named:

```text
AGENTS.md
```

Place it at the root of the repository so coding agents can read it before making changes.

Optional companion documents may be added later:

```text
docs/architecture.md
docs/protocols.md
docs/vscode-extension-design.md
docs/test-plan.md
```

`AGENTS.md` remains the primary instruction document.

---

## Product Boundary

The final deliverable is a **VS Code extension that runs a local serial bridge**.

The extension may internally use a lightweight backend process if needed, but this backend is an implementation detail. Users should experience the project as one VS Code extension, not as a separate desktop application or external visualization system.

Allowed product surface:

```text
VS Code commands
VS Code Webview panel, minimal
Local HTTP API on 127.0.0.1
Local WebSocket stream on 127.0.0.1
Local session log files
Integration with existing VS Code tasks and debug configurations
```

Disallowed product direction:

```text
Full VOFA+ clone
Full Serial Studio clone
Standalone desktop oscilloscope application
Cloud-hosted debug service
Remote multi-user telemetry dashboard
Replacement compiler / flasher / debugger
Firmware auto-rewriter
```

The project should be judged by bridge reliability, observability, and agent-readability, not by dashboard richness.

---

## Current Development Context

The reference STM32 project currently uses this kind of environment:

```text
Project type:
STM32CubeMX generated CMake project

CubeMX version:
6.14.0

Main build path:
<workspace>/build/Debug/

Build outputs:
<workspace>/build/Debug/<projectname>.elf
<workspace>/build/Debug/<projectname>.hex
<workspace>/build/Debug/<projectname>.bin
```

The actual workspace path, MCU model, COM port, UART instance, and build output names must be read from project configuration or requested from the user when unavailable.

Do not hard-code:

```text
STM32G031G6Ux
USART2
PA2 / PA3
COM8
build/Debug/<projectname>.elf
Flash STM32G031 via DAPLink
```

The first integration target may be an STM32G0 / Cortex-M0+ project, but the bridge design must remain portable across:

```text
STM32 M0 / M0+
STM32 M3
STM32 M4, for example STM32F407VET6
STM32 H7
Other Cortex-M projects using similar serial debugging workflows
```

---

## Existing VS Code Environment

The current workspace already uses these VS Code extensions:

```text
ms-vscode.cpptools
ms-vscode.cmake-tools
marus25.cortex-debug
ms-vscode.vscode-serial-monitor
```

Reference installed versions:

```text
VS Code:              1.118.1
Cortex-Debug:         1.12.1
CMake Tools:          1.23.52
C/C++:                1.32.2
Serial Monitor:       0.13.1
```

The bridge should integrate with this environment instead of replacing it.

The Microsoft Serial Monitor extension may remain installed, but it should not be the core backend for this bridge because the bridge needs:

```text
1. Exclusive serial ownership.
2. Structured agent-readable stream.
3. Persistent JSONL logs.
4. Local HTTP/WebSocket APIs.
5. One shared source of truth for human and agent observation.
```

---

## Existing Build Toolchain

The reference environment uses:

```text
CMake:
C:/Program Files/CMake/bin/cmake.exe
Version: 4.3.2

Ninja:
Version: 1.13.2

Arm GNU Toolchain:
C:/Program Files (x86)/Arm GNU Toolchain arm-none-eabi/14.2 rel1/bin

GCC:
arm-none-eabi-gcc 14.2.1

Python:
3.12.10

pyOCD:
0.44.0
```

Reference build commands:

```powershell
& "C:/Program Files/CMake/bin/cmake.exe" --preset Debug
& "C:/Program Files/CMake/bin/cmake.exe" --build --preset Debug
```

The `Debug` preset is already verified. A successful no-op build may return:

```text
ninja: no work to do.
```

Agents must preserve the CMake preset workflow.

---

## Existing Flashing Workflow

The current flashing workflow uses:

```text
DAPLink / CMSIS-DAP + pyOCD
```

It does not currently use:

```text
ST-LINK
OpenOCD
STM32CubeProgrammer
```

The bridge may support other flash tools later, but the first working path should preserve the existing pyOCD + DAPLink workflow.

---

## Key Existing Files in STM32 Application Projects

Agents should be aware of these files:

```text
.vscode/extensions.json
.vscode/settings.json
.vscode/tasks.json
.vscode/launch.json
CMakePresets.json
cmake/gcc-arm-none-eabi.cmake
pyocd.yaml
Core/Src/main.c
```

Typical meanings:

```text
.vscode/extensions.json
Recommended workspace extensions.

.vscode/settings.json
CMake, Cortex-Debug, pyOCD, compiler path, and workspace settings.

.vscode/tasks.json
Configure, build, flash, and utility tasks.

.vscode/launch.json
Cortex-Debug launch configuration.

CMakePresets.json
Ninja-based Debug/Release presets.

cmake/gcc-arm-none-eabi.cmake
Cross-compilation toolchain and MCU flags.

pyocd.yaml
pyOCD target and SWD configuration.

Core/Src/main.c
Application initialization and actual firmware UART/protocol wiring.
```

When there is a mismatch between protocol documents and firmware code, trust the firmware code only after inspection.

---

## Bridge Architecture

Target architecture:

```text
STM32 Target Board
  |
  |-- SWD: DAPLink / CMSIS-DAP
  |     |
  |     +-- pyOCD
  |          |-- flash
  |          +-- Cortex-Debug
  |
  +-- UART: USARTx / USB CDC
        |
        +-- VS Code MCU Serial Bridge
              |
              |-- Serial port owner
              |-- Raw serial reader/writer
              |-- Protocol parser
              |-- Ring buffer of recent data
              |-- Session logger
              |-- Local HTTP API
              |-- Local WebSocket stream
              |-- Minimal VS Code Webview
              +-- Agent/Codex interface
```

Avoid this architecture:

```text
MCU UART -> VOFA+ opens serial port directly
MCU UART -> Codex also tries to open the same serial port
MCU UART -> VS Code Serial Monitor also tries to open the same serial port
```

That design is fragile because Windows serial ports are usually exclusive resources.

Preferred architecture:

```text
MCU UART
  -> VS Code MCU Serial Bridge owns COM port
       -> Human view inside VS Code
       -> Codex API / WebSocket stream
       -> JSONL logs
       -> Optional external forwarding later
```

The bridge must own the serial port and distribute data internally.

---

## Core Design Principle

The bridge is a **debug data bus**, not a rich terminal application.

It must support:

```text
1. Human observation.
2. Agent observation.
3. Command injection.
4. Session replay.
5. Protocol-aware parsing.
6. Integration with build, flash, and debug tasks.
```

Human view and agent view must be derived from the same serial session.

The bridge should expose data in stable machine-readable formats before adding visual features.

---

## Recommended Implementation Direction

### Product-level decision

The project should be delivered as a VS Code extension.

### Runtime decision

There are two acceptable internal implementations:

```text
A. TypeScript-only bridge inside the VS Code extension host.
B. VS Code extension plus an internal local backend process.
```

For this project, prefer this practical compromise:

```text
MVP:
Use a TypeScript VS Code extension with a small bridge service if development speed is critical.

Long-term:
Use the VS Code extension as the product shell and run an internal Python bridge process when serial IO, logging, test orchestration, and pyOCD integration become more complex.
```

The Python process, if used, must remain hidden behind the extension UX:

```text
User installs one VS Code extension.
Extension starts/stops the bridge.
Extension owns configuration.
Extension exposes commands and panel.
Backend is not marketed as a separate application.
```

### Recommended stack

VS Code extension:

```text
Language: TypeScript
Runtime: VS Code extension host
Configuration: VS Code settings + project YAML
Schema validation: zod
Webview: minimal HTML/JS or bundled frontend
Terminal widget: xterm.js, optional
Waveform plotter: uPlot, optional for MVP2
```

Internal Python bridge, if adopted:

```text
Python 3.12+
pyserial
FastAPI
uvicorn
pydantic
orjson, optional
pytest
```

The extension must manage backend lifecycle:

```text
start bridge
stop bridge
restart bridge
show bridge status
surface bridge errors
locate logs
avoid orphan backend processes
```

---

## Recommended VS Code Extension Structure

Suggested extension directory:

```text
vscode-extension/
  package.json
  tsconfig.json
  src/
    extension.ts
    config.ts
    commands.ts
    taskIntegration.ts
    debugIntegration.ts
    bridgeProcess.ts
    bridgeClient.ts
    webview/
      panel.ts
      messages.ts
  media/
    main.js
    main.css
  resources/
    icons/
```

Main responsibilities:

```text
extension.ts
Activate extension, register commands, initialize services.

config.ts
Read workspace configuration and project-level bridge YAML.

commands.ts
Register commands such as open bridge panel, open serial, close serial, send command, build, flash, reset.

taskIntegration.ts
Invoke existing VS Code tasks such as Build Debug and Flash via DAPLink.

debugIntegration.ts
Optionally start Cortex-Debug sessions using existing launch configurations.

bridgeProcess.ts
Start, stop, and monitor internal backend process if one is used.

bridgeClient.ts
Call local bridge HTTP/WebSocket APIs.

webview/panel.ts
Create and manage minimal terminal/waveform/status panel.
```

---

## Optional Internal Bridge Structure

If the bridge is implemented as an internal Python process, use this structure:

```text
bridge/
  pyproject.toml
  src/
    mcu_serial_bridge/
      __init__.py
      main.py
      app.py
      config.py
      serial_manager.py
      protocol/
        __init__.py
        raw_text.py
        json_line.py
        vofa_firewater.py
      logging/
        __init__.py
        session_logger.py
      api/
        __init__.py
        routes.py
        websocket.py
      tasks/
        __init__.py
        build.py
        flash.py
        pyocd.py
  tests/
    test_raw_text_parser.py
    test_json_line_parser.py
    test_firewater_parser.py
    test_session_logger.py
    test_latest_api.py
```

Core bridge responsibilities:

```text
serial_manager.py
List ports, open port, close port, read stream, write command, reconnect.

protocol/*
Convert raw bytes into parsed samples, events, and frames.

session_logger.py
Write raw.log, parsed.jsonl, events.jsonl, commands.jsonl, and session.json.

api/routes.py
Expose HTTP endpoints for VS Code Webview and Codex.

api/websocket.py
Broadcast live raw and parsed serial frames.

tasks/pyocd.py
Optionally wrap pyOCD list, flash, reset, and target information commands.
```

The protocol parsers must remain pure and independently testable.

---

## Project-Level Configuration

Each STM32 firmware workspace should define a project-local bridge configuration.

Recommended file:

```text
.vscode/mcu-serial-bridge.yaml
```

Backward-compatible aliases may be accepted:

```text
.vscode/stm32-serial-assistant.yaml
.vscode/stm32-serial-bridge.yaml
```

Example for an STM32G031-style project:

```yaml
project:
  name: <projectname>
  root: C:\Users\20101\Desktop\bysj\boardstm32\<projectname>
  elf: build/Debug/<projectname>.elf
  hex: build/Debug/<projectname>.hex
  bin: build/Debug/<projectname>.bin

mcu:
  vendor: STMicroelectronics
  family: STM32G0
  target: STM32G031G6Ux
  core: cortex-m0plus
  flash: 32KB
  ram: 8KB

build:
  configureTask: "CMake: Configure"
  buildTask: "Build Debug"
  flashTask: "Flash STM32G031 via DAPLink"

flash:
  tool: pyocd
  probe: DAPLink
  target: STM32G031G6Ux
  args:
    - "-O"
    - "cmsis_dap.prefer_v1=true"

debug:
  adapter: DAPLink
  server: pyocd
  target: STM32G031G6Ux
  launchConfig: "Cortex-Debug"

serial:
  preferredPort: null
  fallbackScan: true
  baudrate: 115200
  dataBits: 8
  parity: none
  stopBits: 1
  uart: USART2
  tx: PA2
  rx: PA3

protocol:
  type: vofa-firewater
  fallback: raw-text

bridge:
  httpHost: 127.0.0.1
  httpPort: 8765
  websocketPath: /stream
  latestWindowSeconds: 20
  requireLocalToken: false

logging:
  enabled: true
  directory: .serial-sessions
  rawLog: true
  parsedJsonl: true
  eventsJsonl: true
  commandsJsonl: true
```

Rules:

```text
1. preferredPort may be null because COM numbers often change.
2. fallbackScan may list candidate serial ports but must not auto-open unsafe ports without user confirmation unless explicitly configured.
3. The bridge must not hard-code one MCU family.
4. The bridge must tolerate missing optional fields and show clear diagnostics.
```

For STM32F407VET6, use a different project configuration rather than modifying bridge core code:

```yaml
mcu:
  vendor: STMicroelectronics
  family: STM32F4
  target: STM32F407VETx
  core: cortex-m4

flash:
  tool: pyocd
  probe: DAPLink
  target: STM32F407VETx

serial:
  baudrate: 115200
  uart: USART2
```

---

## Serial Protocol Support

The bridge should support a small set of protocol modes.

Required MVP protocol modes:

```text
raw-text
json-line
vofa-firewater
```

Later protocol modes:

```text
vofa-justfloat
binary-frame
slip-frame
cobs-frame
yaml-defined
custom-parser
```

Do not implement advanced protocol modes before the raw/log/API path is stable.

### raw-text

Every line is displayed as text and logged.

Example:

```text
System boot
ADC ready
motor timeout
```

Parsed event example:

```json
{
  "type": "raw",
  "text": "ADC ready"
}
```

### json-line

Every line is expected to be one JSON object.

Example:

```json
{"t": 123456, "ch": "adc", "value": 1024}
```

Use this when firmware can afford structured textual output.

Parser failures must be recorded as recoverable events rather than fatal errors.

### vofa-firewater

Support CSV-like numeric frames for waveform plotting and agent-readable samples.

Examples:

```text
1.23,2.34,3.45
```

or:

```text
$1.23,2.34,3.45;
```

Parser output:

```json
{
  "type": "sample",
  "channels": {
    "CH0": 1.23,
    "CH1": 2.34,
    "CH2": 3.45
  }
}
```

FireWater is simple and useful for MVP, but it should not be treated as the only long-term high-throughput protocol.

### yaml-defined

This is not an early MVP feature.

The bridge may later read project protocol documents such as:

```text
stm32_frontend_serial_protocol_impl.yaml
```

Expected later uses:

```text
1. Generate command buttons.
2. Generate variable table definitions.
3. Parse known response frames.
4. Warn about mismatches between documented UART and actual firmware UART.
```

---

## Minimal Human UI Requirements

The UI should be useful but intentionally limited.

Required MVP UI:

```text
1. Bridge status
2. Serial port selector
3. Open / close serial
4. Raw terminal output
5. Send text command
6. Latest parsed data preview
7. Log folder shortcut
8. Error / event list
```

Optional MVP2 UI:

```text
1. Basic waveform plot for numeric channels
2. Pause / resume plotting
3. Clear plot
4. Channel visibility toggle
5. Sample rate estimate
```

Avoid early implementation of:

```text
Complex dashboards
Drag-and-drop visualization designer
Advanced oscilloscope measurements
Protocol designer UI
Remote telemetry dashboards
Multi-device layout system
```

### Serial terminal

Use `xterm.js` or a simpler terminal-like output area.

Required features:

```text
Open/close port
Send text
Line ending selection: none, \n, \r, \r\n
Timestamp toggle
Clear terminal
Open session folder
```

Later features:

```text
Send hex
Save visible log
Search in terminal
ANSI color rendering
```

### Waveform plotter

Use `uPlot` for basic high-performance numeric curves.

Required MVP2 features:

```text
Plot CH0, CH1, CH2, ...
Auto-scale Y
Pause/resume
Clear waveform
Channel visibility toggle
Ring buffer limit
Basic sample rate estimate
```

Later features:

```text
Cursors
Measurements
Export CSV
Trigger condition
Decimation/downsampling controls
```

### Variable table

For parsed key-value data.

Example rows:

```text
temp        36.5
adc         1024
motor_rpm   1420
err         0
```

This is optional for the first bridge MVP.

### Event timeline

Extract and display events such as:

```text
boot
assert
error
warning
timeout
command sent
response received
flash completed
reset completed
parser failure
serial disconnected
```

---

## Agent / Codex Interface

Agents must not read directly from the COM port.

Agents should use local HTTP and WebSocket interfaces exposed by the bridge.

Recommended endpoints:

```text
GET  /session
GET  /ports
POST /serial/open
POST /serial/close
POST /serial/send
GET  /latest?seconds=20
GET  /logs
POST /mark
POST /run-test
WS   /stream
```

All endpoints must listen on `127.0.0.1` by default.

External network binding is not allowed unless explicitly configured.

### GET /session

Returns the current bridge session state.

Example response:

```json
{
  "project": "<projectname>",
  "mcu": "STM32G031G6Ux",
  "elf": "build/Debug/<projectname>.elf",
  "serial": {
    "port": "COM8",
    "baudrate": 115200,
    "open": true
  },
  "protocol": "vofa-firewater",
  "startedAt": "2026-05-07T10:30:00+08:00"
}
```

### GET /latest?seconds=20

Returns recent serial logs in an agent-readable form.

Example response:

```json
{
  "windowSeconds": 20,
  "rawLines": [
    "System boot",
    "ADC ready"
  ],
  "samples": [
    {
      "ts": 1710000000.123,
      "channels": {
        "CH0": 1.23,
        "CH1": 2.34
      }
    }
  ],
  "events": [
    {
      "ts": 1710000001.000,
      "level": "info",
      "message": "boot complete"
    }
  ]
}
```

### POST /serial/send

Sends a command to the device.

Example request:

```json
{
  "data": "status\r\n",
  "encoding": "text"
}
```

The bridge must log the command in `commands.jsonl`.

### WS /stream

Broadcasts live serial data.

Message types:

```json
{"type":"raw","ts":1710000000.123,"data":"System boot"}
{"type":"sample","ts":1710000000.456,"channels":{"CH0":1.23,"CH1":2.34}}
{"type":"event","ts":1710000001.000,"level":"error","message":"motor timeout"}
{"type":"cmd_tx","ts":1710000002.000,"data":"status\\r\\n"}
```

---

## Logging Format

Each serial session should create a session directory:

```text
.serial-sessions/
  2026-05-07_103000_<projectname>/
    session.json
    raw.log
    parsed.jsonl
    events.jsonl
    commands.jsonl
```

### session.json

Contains metadata:

```json
{
  "project": "<projectname>",
  "workspace": "C:\\Users\\20101\\Desktop\\bysj\\boardstm32\\<projectname>",
  "mcu": "STM32G031G6Ux",
  "elf": "build/Debug/<projectname>.elf",
  "serial": {
    "port": "COM8",
    "baudrate": 115200,
    "frame": "8N1"
  },
  "protocol": "vofa-firewater",
  "startedAt": "2026-05-07T10:30:00+08:00"
}
```

### raw.log

Human-readable raw serial stream:

```text
[10:30:00.123] System boot
[10:30:00.456] ADC ready
```

### parsed.jsonl

One parsed object per line:

```jsonl
{"ts":1710000000.123,"type":"sample","channels":{"CH0":1.23,"CH1":2.34}}
{"ts":1710000000.456,"type":"kv","values":{"temp":36.5,"adc":1024}}
```

### events.jsonl

One event per line:

```jsonl
{"ts":1710000001.000,"level":"info","message":"boot complete"}
{"ts":1710000002.000,"level":"error","message":"motor timeout"}
```

### commands.jsonl

One transmitted command per line:

```jsonl
{"ts":1710000003.000,"encoding":"text","data":"status\\r\\n"}
```

Logging rules:

```text
1. Always log raw data before parsing.
2. Parser failures must be logged as events.
3. Long-running logs must use file streams, not in-memory accumulation.
4. Recent data should use bounded ring buffers.
```

---

## Build / Flash / Debug Integration

The bridge should call existing VS Code tasks rather than duplicating build logic.

Required commands:

```text
MCU Serial Bridge: Open Panel
MCU Serial Bridge: List Ports
MCU Serial Bridge: Open Serial Port
MCU Serial Bridge: Close Serial Port
MCU Serial Bridge: Send Line
MCU Serial Bridge: Build
MCU Serial Bridge: Flash
MCU Serial Bridge: Build, Flash, and Open Serial
MCU Serial Bridge: Start Bridge
MCU Serial Bridge: Stop Bridge
MCU Serial Bridge: Open Session Folder
```

For the reference project:

```text
Build -> existing task: Build Debug
Flash -> existing task: Flash STM32G031 via DAPLink
Debug -> existing Cortex-Debug launch configuration
```

The bridge may show pyOCD status but must not assume a probe is connected.

If `pyocd list` returns no probes, show a clear diagnostic:

```text
No CMSIS-DAP probe detected. Check USB connection, DAPLink firmware, Windows driver, and cable.
```

Do not treat missing hardware as a source code error.

---

## STM32 Family Abstraction

The bridge must support project-specific MCU targets through configuration.

Core target model:

```ts
interface McuTarget {
  vendor: "STMicroelectronics" | string;
  family: string;
  target: string;
  core?: "cortex-m0" | "cortex-m0plus" | "cortex-m3" | "cortex-m4" | "cortex-m7";
  elf: string;
  flashTool: "pyocd" | "openocd" | "stlink" | "cubeprogrammer";
  debugServer: "pyocd" | "openocd" | "stlink";
}
```

Initial implementation may only support `pyocd`, but the data model should not prevent future OpenOCD or STM32CubeProgrammer support.

Do not hard-code board-specific settings into generic modules.

---

## VOFA+ Compatibility Strategy

VOFA+ should be treated as a protocol reference and optional compatibility target, not as the core product.

Recommended stance:

```text
Human visualization:
Provide only minimal VS Code waveform preview.

Protocol compatibility:
Support VOFA FireWater in MVP2.
Support JustFloat later if needed.

Interoperability:
Optional forwarding to external tools may be added later.
```

Avoid:

```text
VOFA+ source-code modification
VOFA+ plugin dependency for the default path
VOFA+ UI cloning
```

Rationale:

```text
1. The project value is bridge infrastructure, not visualization richness.
2. GUI internals are not the right place for an agent-readable data interface.
3. Serial port ownership conflicts are likely when external tools open COM ports directly.
4. A local structured stream is more robust for Codex and automated debugging.
```

---

## Serial Studio Compatibility Strategy

Serial Studio may be used as a modern visualization reference or optional external consumer, but it must not be required.

Recommended stance:

```text
Do not require Serial Studio.
Do not try to out-feature Serial Studio.
Keep the core bridge self-contained.
Produce standard logs and streams that external tools could consume later.
```

The bridge should win by being inside the VS Code STM32 workflow and by being agent-readable.

---

## Automatic Debugging Loop

The desired future loop is:

```text
1. Agent invokes build through the bridge/extension.
2. Build result is captured.
3. Agent invokes flash through the bridge/extension.
4. Flash result is captured.
5. Bridge opens the serial port.
6. Target resets or starts.
7. Agent observes recent serial logs through /latest.
8. Agent sends test commands through /serial/send.
9. Bridge records responses.
10. Agent diagnoses failure or confirms success.
```

Example agent workflow:

```text
Build Debug
Flash via DAPLink
Open detected COM port at 115200 8N1
Wait for boot banner
Send status command
Check response fields
Report pass/fail and likely cause
```

Agents should use structured outputs wherever possible.

---

## Safety and Reliability Rules

Agents must follow these rules when modifying the project:

```text
1. Do not overwrite existing .vscode/tasks.json or .vscode/launch.json without preserving user settings.
2. Do not hard-code COM ports.
3. Do not hard-code STM32G031-specific settings into generic code.
4. Do not assume a hardware probe is connected.
5. Do not assume a serial device exists just because a historical COM port was documented.
6. Do not require VOFA+, Serial Studio, ST-LINK, OpenOCD, or STM32CubeProgrammer for the default path.
7. Preserve the existing CMake preset workflow.
8. Preserve the existing pyOCD + DAPLink path.
9. Always log raw serial data before parsing.
10. Treat parser failures as recoverable events, not fatal crashes.
11. Keep local APIs bound to 127.0.0.1 by default.
12. Do not expose serial command injection to external networks by default.
13. Use bounded ring buffers for recent data.
14. Use streaming file writes for long logs.
15. Avoid blocking the VS Code extension host.
```

---

## MVP Plan

### MVP 1: Serial Bridge and Logging

Required features:

```text
List serial ports
Open selected COM port
Configure 115200 8N1 or configured frame
Read raw serial stream
Display raw terminal output in VS Code
Send text commands
Write raw.log
Write parsed.jsonl for simple line events
Write events.jsonl
Write commands.jsonl
Expose GET /session
Expose GET /ports
Expose GET /latest
Expose POST /serial/send
Expose WS /stream
```

Acceptance criteria:

```text
A human can see serial output in VS Code.
An agent can fetch the latest serial output through HTTP.
Commands sent by humans or agents are logged.
Raw logs are saved per session.
The bridge does not require VOFA+ or Serial Studio.
```

### MVP 2: VOFA FireWater Basic Samples

Required features:

```text
Parse CSV numeric lines
Expose parsed CH0, CH1, CH2, ... values through /latest and WebSocket
Write samples to parsed.jsonl
Optionally plot basic waveform in Webview
Pause/resume plotting if waveform is enabled
Clear waveform buffer
Enable/disable channels if waveform is enabled
```

Acceptance criteria:

```text
A firmware line like "1.0,2.0,3.0" becomes three parsed channels.
The same sample is written to parsed.jsonl.
Codex can read parsed channel values through /latest.
Waveform UI is useful but not required for core bridge correctness.
```

### MVP 3: STM32 Project Integration

Required features:

```text
Read .vscode/mcu-serial-bridge.yaml
Support backward-compatible config names if present
Run existing Build Debug task
Run existing Flash task
Open serial after flash
Show pyOCD no-probe diagnostic clearly
Expose project and target metadata in /session
```

Acceptance criteria:

```text
The current STM32 project can build, flash, and open serial using existing tasks.
The bridge does not rewrite user task files.
The bridge does not assume one specific STM32 family or COM port.
```

### MVP 4: Agent-Assisted Debugging

Required features:

```text
Codex-readable session summary
Codex-readable latest logs
Codex command send endpoint
Test script runner
Session report generation
Build/flash/serial action history
```

Acceptance criteria:

```text
An agent can perform a build-flash-observe-send-diagnose loop using the bridge API.
The report includes build result, flash result, serial observations, commands sent, and likely diagnosis.
```

### MVP 5: Protocol and Configuration Expansion

Required features:

```text
Read project protocol YAML when configured
Generate command palette items from protocol description
Generate variable table definitions
Warn if documented UART differs from actual firmware UART when detectable
Add vofa-justfloat or binary protocol only after FireWater and JSON-line are stable
```

Acceptance criteria:

```text
The bridge can expose project-specific commands without hard-coding them in the extension.
Known UART/protocol mismatches can be surfaced as warnings.
Advanced protocol support does not destabilize the raw/log/API path.
```

---

## Suggested Initial VS Code Commands

Command IDs:

```text
mcuSerialBridge.openPanel
mcuSerialBridge.listPorts
mcuSerialBridge.openSerial
mcuSerialBridge.closeSerial
mcuSerialBridge.sendLine
mcuSerialBridge.build
mcuSerialBridge.flash
mcuSerialBridge.buildFlashOpenSerial
mcuSerialBridge.startBridge
mcuSerialBridge.stopBridge
mcuSerialBridge.openSessionFolder
```

Command titles:

```text
MCU Serial Bridge: Open Panel
MCU Serial Bridge: List Ports
MCU Serial Bridge: Open Serial Port
MCU Serial Bridge: Close Serial Port
MCU Serial Bridge: Send Line
MCU Serial Bridge: Build
MCU Serial Bridge: Flash
MCU Serial Bridge: Build, Flash, and Open Serial
MCU Serial Bridge: Start Bridge
MCU Serial Bridge: Stop Bridge
MCU Serial Bridge: Open Session Folder
```

---

## Suggested VS Code Settings

Extension settings:

```jsonc
{
  "mcuSerialBridge.configFile": ".vscode/mcu-serial-bridge.yaml",
  "mcuSerialBridge.bridge.mode": "auto",
  "mcuSerialBridge.bridge.host": "127.0.0.1",
  "mcuSerialBridge.bridge.port": 8765,
  "mcuSerialBridge.serial.defaultBaudrate": 115200,
  "mcuSerialBridge.serial.defaultLineEnding": "\\r\\n",
  "mcuSerialBridge.logging.enabled": true,
  "mcuSerialBridge.logging.directory": ".serial-sessions"
}
```

Possible bridge modes:

```text
auto
typescript
python
```

Rules:

```text
1. auto should choose the safest available bridge runtime.
2. python mode may start an internal backend process.
3. typescript mode should avoid long blocking work in the extension host.
```

---

## Testing Requirements

### Unit tests

Required parser tests:

```text
raw text parser
JSON line parser
VOFA FireWater parser
invalid numeric frame handling
empty line handling
partial line handling
line ending handling
```

### Bridge tests

Required bridge tests:

```text
session logger creates expected files
/latest returns bounded recent data
/serial/send validates input
WebSocket broadcasts parsed events
commands are logged
parser failures become events
```

### VS Code extension tests

Required extension tests:

```text
configuration loading
command registration
task lookup
bridge start/stop lifecycle
webview message handling
```

### Integration tests

Use simulated serial ports where possible.

On Windows, virtual COM pairs may be used for manual testing.

Do not require real STM32 hardware for basic CI tests.

### Manual hardware tests

For the reference STM32G031-style project:

```text
1. Connect DAPLink.
2. Confirm pyocd list detects probe.
3. Build Debug.
4. Flash via DAPLink.
5. Connect actual UART pins to USB-UART adapter.
6. Open detected COM port at configured baudrate and frame.
7. Confirm boot logs or protocol responses appear.
8. Confirm parsed samples if firmware outputs numeric frames.
9. Confirm /latest returns raw lines, samples, and events.
10. Confirm session logs are written.
```

For STM32F407VET6:

```text
1. Create a project-local bridge YAML.
2. Set pyOCD target for STM32F407VETx or the exact supported target string.
3. Set ELF path.
4. Set UART and baudrate.
5. Reuse the same bridge core.
```

---

## Coding Guidelines for Agents

When implementing this project:

```text
Use small modules with clear boundaries.
Prefer typed interfaces.
Keep protocol parsers independent from VS Code UI.
Keep bridge API independent from Webview implementation.
Log raw data before parsing.
Make parser errors visible but non-fatal.
Avoid blocking the VS Code extension host.
Avoid global mutable state where possible.
Use ring buffers for recent data.
Use file streams for long logs.
Keep the extension UX simple.
Prioritize bridge correctness over UI richness.
```

For TypeScript:

```text
Use strict TypeScript.
Use zod for config validation.
Keep VS Code API usage isolated in extension-facing modules.
Keep serial, API, and parser logic testable.
```

For Python, if used internally:

```text
Use Python 3.12+.
Use pydantic for request/response schemas.
Use FastAPI for HTTP and WebSocket endpoints.
Use pyserial for serial IO.
Use pytest for tests.
Keep protocol parsers pure and unit-testable.
Ensure the VS Code extension controls process lifecycle.
```

---

## Non-Goals

Do not implement these unless explicitly requested after the bridge is stable:

```text
Full VOFA+ clone
Full Serial Studio clone
JTAG/SWD register viewer
Logic analyzer
CAN/Modbus/MQTT support
Binary protocol designer UI
Firmware source code modification automation
Cloud synchronization
Remote multi-user sessions
Complex dashboard designer
Full oscilloscope replacement
```

Focus first on:

```text
Reliable serial ownership
Raw terminal observation
Structured logs
Local HTTP/WebSocket stream
Codex-readable latest state
Command injection
Build/flash task integration
Recoverable parser errors
```

---

## Important Current Project Warning

For the current STM32G031-style project, remember this mismatch:

```text
Protocol document metadata: USART1
Actual code: FrontendProtocol_Init(&huart2)
Actual UART: USART2
Pins: PA2 TX, PA3 RX
Baudrate: 115200
```

Agents should not blindly trust protocol document metadata.

Recommended action when working on this project:

```text
1. Inspect Core/Src/main.c or generated UART init code.
2. Confirm which UART handle is passed to FrontendProtocol_Init.
3. Use that UART as the actual serial interface.
4. Optionally propose correcting the protocol YAML.
5. Surface mismatch as a bridge diagnostic, not as a fatal error.
```

---

## Desired End State

The desired end state is this workflow:

```text
User opens STM32 project in VS Code.
User runs: MCU Serial Bridge: Build, Flash, and Open Serial.
The extension runs the existing CMake build task.
The extension runs the existing pyOCD flash task.
The bridge opens the configured or detected serial port.
Human sees raw terminal output and minimal parsed state in VS Code.
Codex reads the same session through local HTTP/WebSocket APIs.
Codex can send test commands and inspect responses.
All raw data, parsed data, events, and commands are logged for replay and diagnosis.
```

The core design should remain portable across STM32G0, STM32F4, STM32H7, and other Cortex-M projects.

The bridge is successful when it makes MCU serial debugging observable, reproducible, and agent-readable without replacing the existing embedded toolchain.
