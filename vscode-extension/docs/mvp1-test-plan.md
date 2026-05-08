# MVP1 Test Plan

This plan verifies the MVP1 serial bridge and logging path. It separates automated checks from manual checks because hardware, USB-UART adapters, and virtual COM pairs are environment-specific.

Do not mark hardware tests as passed unless they were run on the named machine, with the named port, and the result was observed.

## Test Scope

MVP1 in scope:

- Bridge start and stop on a local loopback host.
- Serial port listing.
- Serial open, raw read, line framing, text send, and close.
- Minimal VS Code panel observation.
- Local HTTP API: `/session`, `/ports`, `/latest`, `/serial/send`.
- WebSocket stream: `/stream`.
- Session files: `session.json`, `raw.log`, `parsed.jsonl`, `events.jsonl`, `commands.jsonl`.
- `raw-text` and `json-line` parsing.
- Recoverable parser and serial events.

Out of scope for MVP1 verification:

- Build and flash task execution.
- Cortex-Debug launch integration.
- pyOCD probe handling.
- VOFA FireWater parsing and waveform UI.
- VOFA+ or Serial Studio interoperability.
- External network binding.

## Automated No-Hardware Tests

Run from `vscode-extension`:

```powershell
npm.cmd install
npm.cmd run compile
npm.cmd test
```

Run from the repository root:

```powershell
npm.cmd --prefix vscode-extension install
npm.cmd run compile
npm.cmd test
```

Expected result:

- TypeScript compilation succeeds.
- Vitest completes without requiring a real serial port or STM32 board.
- No test creates files outside temporary test directories except normal build output under `vscode-extension/out`.

Current automated coverage areas:

- `test/protocol`: raw text and JSON line parsing, partial lines, CR/LF handling, invalid JSON as recoverable events.
- `test/bridge`: fake serial port listing/open/read/write/close, raw chunk handling, line splitting, bridge parser integration, bounded ring buffers.
- `test/logging`: session directory naming, required log files, streamed raw/parsed/event/command logs.
- `test/api`: `/session`, `/ports`, `/latest`, `/serial/send` validation, structured errors, local host rejection, WebSocket broadcast.

Pass criteria:

- The command output shows all tests passing.
- Failures are investigated as code or test failures, not as missing hardware failures.

## Mock Serial Tests

Mock serial tests are automated tests that inject fake serial implementations through `SerialManager` and `BridgeService` constructor options. They should remain the default way to verify serial behavior in CI or on a developer machine without hardware.

Existing mock test flow:

1. Create a fake serial port provider.
2. Open `COM_TEST` through `SerialManager`.
3. Push raw chunks such as `alpha\n`, `alpha\r\nbeta\r\n`, or partial chunks.
4. Assert raw data is emitted before line events.
5. Assert writes are captured and drained.
6. Assert close and disconnect events are recoverable.

Additional mock tests to add when MVP1 changes:

- BridgeService logs a command after an API send succeeds.
- BridgeService does not log a command when serial write fails.
- `/latest` includes raw chunks, raw lines, parsed frames, events, and commands from one fake serial session.
- WebSocket clients receive `raw`, `parsed`, `event`, and `cmd_tx` messages from one bridge instance.

Pass criteria:

- Mock tests prove bridge behavior without opening a real COM port.
- Tests do not assume a hard-coded user COM port.
- Tests do not require VOFA+, Serial Studio, pyOCD, or an STM32 board.

## Optional Virtual COM Pair Manual Tests

Use this section when a Windows virtual null-modem pair is available, for example `COM10` paired with `COM11`. Do not use the same port on both sides. Close Microsoft Serial Monitor, VOFA+, Serial Studio, terminal programs, and any other process that may own either port.

Record before testing:

```text
Date/time:
Machine:
Extension commit:
Bridge port:
Virtual pair:
Opened by bridge:
Written by test process:
Baudrate:
```

Setup:

1. Launch the Extension Development Host.
2. Open `MCU Serial Bridge: Open Panel`.
3. Click `Start Bridge`.
4. Open the bridge side of the virtual pair, for example `COM10`, at `115200`.
5. Confirm the panel status shows the serial port as open.

Inject raw serial data from the paired port:

```powershell
$port = [System.IO.Ports.SerialPort]::new("COM11", 115200, "None", 8, "One")
$port.Open()
$port.Write("System boot`r`nADC ready`r`n")
$port.Close()
```

Expected result:

- The panel raw output shows `System boot` and `ADC ready`.
- `GET /latest` returns recent raw data and raw lines.

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/latest?seconds=20"
```

Verify API command send reaches the paired port:

```powershell
$port = [System.IO.Ports.SerialPort]::new("COM11", 115200, "None", 8, "One")
$port.ReadTimeout = 5000
$port.NewLine = "`r`n"
$port.Open()
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8765/serial/send" `
  -ContentType "application/json" `
  -Body (@{ data = "status`r`n"; encoding = "text" } | ConvertTo-Json)
$received = $port.ReadLine()
$port.Close()
$received
```

Expected result:

- The received text is `status` when `ReadLine()` consumes the configured CRLF line ending.
- The panel event list does not show a write error.
- `commands.jsonl` contains the sent command.

Verify WebSocket stream:

```powershell
node -e "const WebSocket=require('ws'); const ws=new WebSocket('ws://127.0.0.1:8765/stream'); ws.on('message',m=>console.log(m.toString()));"
```

Then inject another line through the paired port.

Expected result:

- The WebSocket client prints a `raw` message.
- If `raw-text` is selected, it also prints a `parsed` message for completed lines.

Verify logs:

1. Click `Open Log Folder`.
2. Open the active session directory.
3. Confirm these files exist: `session.json`, `raw.log`, `parsed.jsonl`, `events.jsonl`, `commands.jsonl`.
4. Confirm `raw.log` contains injected lines.
5. Confirm `commands.jsonl` contains API and panel commands sent during the session.

## USB-UART Loopback Manual Test Evidence

This section records a real USB-to-serial adapter loopback test. It verifies the extension's serial open/read/write/API/logging path with real Windows serial hardware, but it is not a real STM32 firmware test because no STM32 target was connected.

Record:

```text
Date/time: 2026-05-08 11:22
Machine: local machine
Extension commit: not recorded
Serial test mode: USB-UART adapter with TX/RX shorted for loopback
USB-UART adapter: actual USB-to-serial tool, model not recorded
COM port: COM10
Baudrate/frame: 115200, default 8N1
STM32 board: not used
Firmware commit/build: not applicable
How firmware was flashed: not applicable
```

Observed results:

```text
Open Panel: Pass
Start Bridge: Pass
List Ports: Pass
Open COM port: Pass
Panel raw output: Pass
GET /latest: Pass
Panel send command: Pass
POST /serial/send: Pass
raw.log written: Pass
commands.jsonl written: Pass
events.jsonl written: Pass
parsed.jsonl written: Pass
Close serial / Stop bridge: Pass
```

Coverage note:

- This validates MVP1 end-to-end serial behavior through a real COM port and loopback.
- This does not validate STM32 UART wiring, firmware boot output, firmware command handling, flashing, reset behavior, or MCU-specific configuration.
- Real STM32 Manual Tests below remain not run until an STM32 target is connected and observed.

## Real STM32 Manual Tests

These tests require real hardware and must not be reported as passed unless actually run.

Record before testing:

```text
Date/time:
Machine:
Extension commit:
STM32 board:
MCU:
Firmware commit/build:
UART instance and pins:
USB-UART adapter:
COM port:
Baudrate/frame:
How firmware was flashed:
```

Preconditions:

- Firmware is already flashed or flashed through the existing project workflow outside MVP1 bridge commands.
- The target UART is wired to a USB-UART adapter using the correct TX/RX crossing and common ground.
- No other tool owns the COM port.
- Firmware emits a known boot line or supports a known command.

Steps:

1. Launch the Extension Development Host.
2. Open the STM32 workspace in the Extension Development Host.
3. Run `MCU Serial Bridge: Open Panel`.
4. Click `Start Bridge`.
5. Click `List Ports` and confirm the expected USB-UART adapter appears.
6. Open the target COM port at the configured baudrate and frame.
7. Reset or power-cycle the STM32 target if needed.
8. Observe raw boot output in the panel.
9. Call `GET /latest?seconds=20` and confirm the same recent output is visible through HTTP.
10. Send a known command from the panel if firmware supports commands.
11. Send the same command through `POST /serial/send`.
12. Confirm the firmware response appears in the panel and `/latest`.
13. Open the session folder.
14. Inspect `raw.log`, `parsed.jsonl`, `events.jsonl`, and `commands.jsonl`.
15. Close the serial port and stop the bridge.

Expected result:

- Human-visible raw serial output appears in the VS Code panel.
- Agent-readable recent output is available through `/latest`.
- Commands sent through the panel and API are written to `commands.jsonl`.
- Raw serial data is written to `raw.log`.
- No VOFA+ or Serial Studio process is needed.

Failure notes to capture:

- COM port not listed.
- COM port listed but open fails.
- Port opens but no target output appears.
- `/latest` is empty while panel output appears, or vice versa.
- Commands do not reach firmware.
- Logs are missing or incomplete.
- Unexpected parser warning or serial disconnect event.

## Acceptance Evidence

Use `test/acceptance/mvp1.acceptance.md` to record the pass/fail state. A complete MVP1 sign-off needs automated test output plus either virtual COM pair evidence or real STM32 evidence for human-visible serial output and end-to-end logging.
