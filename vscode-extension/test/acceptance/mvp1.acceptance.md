# MVP1 Acceptance Checklist

This checklist records how MVP1 acceptance is verified. It is intentionally split into automated evidence and manual evidence. Do not mark manual or hardware items as passed unless the steps were actually run.

## Test Run Metadata

```text
Date/time:
Tester:
Machine:
Repository commit:
VS Code version:
Node version:
Extension host workspace:
Serial test mode: no-hardware / mock / virtual COM pair / real STM32
Serial port(s):
Baudrate/frame:
Hardware, if used:
```

## Automated Evidence

Run from `vscode-extension` or use the root scripts:

```powershell
npm.cmd run compile
npm.cmd test
```

Record result:

```text
Compile result:
Test result:
Failure summary, if any:
```

Automated tests can support acceptance, but they do not by themselves prove that a human saw output in a VS Code Extension Development Host connected to a real or virtual serial stream.

## Acceptance Criteria

### AC1: A human can see serial output in VS Code

Verification type: manual with virtual COM pair or real STM32.

Steps:

1. Launch the Extension Development Host.
2. Open `MCU Serial Bridge: Open Panel`.
3. Start the bridge.
4. Open a virtual or real serial port.
5. Inject or generate known serial text, for example `System boot`.
6. Confirm the panel raw output shows the text.

Expected result:

- The same known text appears in the panel raw output without using another serial monitor.

Evidence:

```text
Status: not run / pass / fail
Port:
Input text:
Observed panel text:
Screenshot or notes:
```

### AC2: An agent can fetch latest serial output through HTTP

Verification type: automated API tests plus manual end-to-end serial check.

Steps:

1. Start the bridge.
2. Open the serial port.
3. Inject or generate known serial text.
4. Run:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/latest?seconds=20"
```

Expected result:

- The response includes the known serial text in `rawData` and, after a line ending, in `rawLines`.
- For `raw-text`, completed lines also appear as parsed `raw` frames.

Evidence:

```text
Status: not run / pass / fail
HTTP status:
Observed rawData:
Observed rawLines:
Observed parsed frames:
Notes:
```

### AC3: Commands sent by humans or agents are logged

Verification type: automated logger/API tests plus manual panel/API send.

Steps:

1. Start the bridge and open the serial port.
2. Send a command from the panel or `MCU Serial Bridge: Send Line`.
3. Send a command through:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8765/serial/send" `
  -ContentType "application/json" `
  -Body (@{ data = "status`r`n"; encoding = "text" } | ConvertTo-Json)
```

4. Open the active session folder.
5. Inspect `commands.jsonl`.

Expected result:

- Each successful command send appears as one JSONL entry with `encoding: "text"` and the sent `data`.
- Failed sends, such as sending while no serial port is open, are reported as errors and should not be counted as accepted command sends.

Evidence:

```text
Status: not run / pass / fail
Panel command:
API command:
commands.jsonl entries:
Notes:
```

### AC4: Raw logs are saved per session

Verification type: automated logger tests plus manual serial session check.

Steps:

1. Start the bridge with logging enabled.
2. Open a serial port.
3. Inject or generate known serial text.
4. Open the session folder.
5. Inspect:

```text
session.json
raw.log
parsed.jsonl
events.jsonl
commands.jsonl
```

Expected result:

- The session folder exists under the configured logging directory, default `.serial-sessions`.
- `raw.log` contains the known serial text.
- `session.json` records session metadata and the active logging directory.

Evidence:

```text
Status: not run / pass / fail
Session folder:
raw.log excerpt:
session.json notes:
Missing files, if any:
```

### AC5: The bridge does not require VOFA+ or Serial Studio

Verification type: static review plus manual run with those tools closed.

Steps:

1. Confirm `package.json` does not add VOFA+ or Serial Studio dependencies.
2. Close VOFA+, Serial Studio, and other serial monitor tools.
3. Run compile/tests.
4. Run the virtual COM or real STM32 manual serial check using only the extension and local API.

Expected result:

- The extension can start, open serial, expose `/latest`, and write logs without VOFA+ or Serial Studio.
- No documented MVP1 step requires either tool.

Evidence:

```text
Status: not run / pass / fail
Tools closed:
package.json reviewed:
Manual serial check mode:
Notes:
```

## Final MVP1 Sign-Off

Use this summary only after filling the criteria above.

```text
AC1 human VS Code output: not run / pass / fail
AC2 HTTP latest output: not run / pass / fail
AC3 command logging: not run / pass / fail
AC4 raw per-session logs: not run / pass / fail
AC5 no VOFA+/Serial Studio required: not run / pass / fail

Accepted for MVP1: yes / no
Remaining blockers:
Residual risks:
```

## Notes

- Automated tests are mandatory for sign-off.
- Manual hardware tests are optional unless the release claim mentions real STM32 hardware.
- Virtual COM pair tests are acceptable for MVP1 end-to-end serial behavior when no STM32 board is available.
- Do not modify STM32 project files while executing this checklist.
