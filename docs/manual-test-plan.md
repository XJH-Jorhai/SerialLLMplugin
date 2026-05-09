# Manual Test Plan

This plan covers MVP1 release hardening and MVP3 foundation behavior. Do not mark hardware-dependent sections as passed unless the exact test was run and observed.

Record for every manual run:

```text
Date/time:
Machine:
Extension commit:
Workspace:
Bridge API host/port:
Tester:
Result:
Notes:
```

## No-Hardware Test

Purpose: verify compile, unit tests, API startup diagnostics, and docs/scripts without requiring an STM32 board or serial adapter.

Steps:

1. Open a PowerShell terminal at the repository root.
2. Run:

   ```powershell
   npm.cmd run compile
   npm.cmd test
   ```

3. Launch the extension development host.
4. Run `MCU Serial Bridge: Start Bridge`.
5. Run:

   ```powershell
   .\scripts\smoke-latest.ps1
   ```

Expected result:

- Compile passes.
- Tests pass with fake serial ports only.
- The bridge starts on `127.0.0.1`.
- `smoke-latest.ps1` prints `/session` and `/latest` JSON.
- `/latest` may contain no serial data because no port is open.

## Virtual COM Pair Test

Purpose: verify serial read/write/log/API behavior without real STM32 hardware.

Preconditions:

- A Windows virtual null-modem pair is available, for example `COM10` paired with `COM11`.
- No other serial monitor owns either port.

Steps:

1. Launch the extension development host.
2. Open the bottom Panel view with `MCU Serial Bridge: Focus Serial View`, or use `MCU Serial Bridge: Open Panel` for the compatibility command that focuses the same view.
3. Start the bridge.
4. Open the bridge side of the virtual pair, for example `COM10`, at `115200`.
5. Inject data through the paired port:

   ```powershell
   $port = [System.IO.Ports.SerialPort]::new("COM11", 115200, "None", 8, "One")
   $port.Open()
   $port.Write("System boot`r`nADC ready`r`n")
   $port.Close()
   ```

6. Run:

   ```powershell
   .\scripts\smoke-latest.ps1 -Seconds 20
   ```

7. Verify command send:

   ```powershell
   $port = [System.IO.Ports.SerialPort]::new("COM11", 115200, "None", 8, "One")
   $port.ReadTimeout = 5000
   $port.NewLine = "`r`n"
   $port.Open()
   .\scripts\send-command.ps1 -Data "status`r`n"
   $received = $port.ReadLine()
   $port.Close()
   $received
   ```

Expected result:

- The bottom `MCU Debug > Serial` view shows `System boot` and `ADC ready`.
- `/latest` includes the same raw data and raw lines.
- The paired port receives `status`.
- `commands.jsonl` contains the API command.
- `raw.log`, `parsed.jsonl`, `events.jsonl`, and `commands.jsonl` exist in the session folder.

## Real STM32 Hardware Test

Purpose: verify bridge behavior with actual firmware serial output.

Preconditions:

- Firmware is already built and flashed through the existing STM32 workflow.
- Target UART TX/RX/GND is wired to a USB-UART adapter.
- The correct UART and baudrate are known from inspected firmware or project config.
- No other serial tool owns the COM port.

Steps:

1. Open the STM32 workspace in the extension development host.
2. Run `MCU Serial Bridge: Focus Serial View` to open the bottom `MCU Debug > Serial` view.
3. Start the bridge.
4. List ports and identify the USB-UART adapter.
5. Open the adapter COM port with the firmware baudrate and frame.
6. Reset or power-cycle the target if needed.
7. Confirm boot output appears in the bottom Serial view.
8. Run:

   ```powershell
   .\scripts\smoke-latest.ps1 -Seconds 20
   ```

9. Send a known firmware command from the bottom Serial view.
10. Send the same command through:

    ```powershell
    .\scripts\send-command.ps1 -Data "status`r`n"
    ```

11. Open the session folder and inspect all log files.

Expected result:

- Human-visible output and `/latest` show the same session stream.
- Commands are logged.
- Raw data is logged before parsed data.
- Parser warnings are recoverable events, not bridge crashes.

## Serial Disconnect Test

Purpose: verify unexpected serial removal is reported as a recoverable event.

Steps:

1. Open a real or virtual serial port through the bridge.
2. Confirm `/session` reports `"open": true`.
3. Disconnect the USB-UART adapter or close/remove the virtual pair endpoint.
4. Run:

   ```powershell
   .\scripts\smoke-latest.ps1 -Seconds 60
   ```

Expected result:

- The bridge records a warning event with code `serial.disconnected` or `serial.closedUnexpectedly`.
- The bottom Serial view does not crash.

## Bottom Panel Low-Height UI Test

Purpose: verify the compact terminal-first UI remains usable when VS Code's bottom Panel has limited height.

Steps:

1. Launch the extension development host.
2. Run `MCU Serial Bridge: Focus Serial View`.
3. Resize the bottom Panel to a low but realistic debugging height.
4. Start the bridge and list ports.
5. If a real or virtual serial port is available, open it and inject at least one raw line and one parser event. If no port is available, verify the no-data state.
6. Inspect the serial toolbar, terminal, send row, and events/parsed inspector.

Expected result:

- The toolbar controls remain reachable.
- The terminal remains the primary visible area for raw serial output.
- The send row remains usable without overlapping the terminal.
- The events/parsed inspector is available without turning the UI into a large form-style page.
- The bridge can be stopped cleanly.

## Repeated Start/Stop Test

Purpose: verify lifecycle cleanup.

Steps:

1. Run `MCU Serial Bridge: Start Bridge`.
2. Run `MCU Serial Bridge: Stop Bridge`.
3. Repeat at least five times.
4. Run `MCU Serial Bridge: Start Bridge` again.
5. Run:

   ```powershell
   .\scripts\smoke-latest.ps1
   ```

Expected result:

- The same API port can be reused.
- No stale server instance blocks restart.
- No duplicate WebSocket server is left attached.
- Stopping with no open serial port is safe.

## HTTP Port Conflict Test

Purpose: verify a clear diagnostic when the configured API port is already occupied.

Steps:

1. In one PowerShell terminal, reserve port `8765`:

   ```powershell
   $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 8765)
   $listener.Start()
   ```

2. In VS Code, run `MCU Serial Bridge: Start Bridge`.
3. Stop the listener:

   ```powershell
   $listener.Stop()
   ```

Expected result:

- The bridge reports that `127.0.0.1:8765` is already in use.
- The failed start does not leave a stale bridge server.
- Starting the bridge after freeing the port succeeds.

## MVP3 Foundation Task Test

Purpose: verify build/flash commands call existing tasks by configured labels without modifying workspace task files.

Preconditions:

- The STM32 workspace has existing VS Code tasks.
- `.vscode/mcu-serial-bridge.yaml` or an accepted alias contains:

  ```yaml
  build:
    buildTask: "<existing build task label>"
    flashTask: "<existing flash task label>"
  ```

Steps:

1. Run `MCU Serial Bridge: Build`.
2. Run `MCU Serial Bridge: Flash`.
3. Temporarily configure a missing task label and run the command again.

Expected result:

- Configured tasks execute through VS Code's task system.
- Missing labels or missing tasks show a clear diagnostic.
- `.vscode/tasks.json` and `.vscode/launch.json` are not modified.
