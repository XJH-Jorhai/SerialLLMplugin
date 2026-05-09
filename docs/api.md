# MCU Serial Bridge Local API

The bridge API is bound to `127.0.0.1` by default. MVP1 rejects non-local bind hosts. The default base URL is:

```text
http://127.0.0.1:8765
```

The default WebSocket URL is:

```text
ws://127.0.0.1:8765/stream
```

## `GET /session`

Returns current bridge state, serial state, API address, logging state, and project metadata when a bridge YAML file or task metadata is configured.

Example:

```json
{
  "running": true,
  "project": "demo",
  "workspace": "C:\\workspace\\demo",
  "mcu": "STM32F407VETx",
  "elf": "build/Debug/demo.elf",
  "projectMetadata": {
    "configPath": "C:\\workspace\\demo\\.vscode\\mcu-serial-bridge.yaml",
    "project": {
      "name": "demo",
      "elf": "build/Debug/demo.elf"
    },
    "mcu": {
      "family": "STM32F4",
      "target": "STM32F407VETx",
      "core": "cortex-m4"
    },
    "build": {
      "buildTask": "Build Debug",
      "flashTask": "Flash via DAPLink"
    }
  },
  "serial": {
    "open": true,
    "port": "COM10",
    "baudrate": 115200,
    "dataBits": 8,
    "parity": "none",
    "stopBits": 1
  },
  "protocol": "raw-text",
  "startedAt": "2026-05-08T05:30:00.000Z",
  "api": {
    "host": "127.0.0.1",
    "port": 8765,
    "websocketPath": "/stream"
  },
  "logging": {
    "enabled": true,
    "directory": ".serial-sessions",
    "sessionDirectory": "C:\\workspace\\demo\\.serial-sessions\\2026-05-08_133000_demo"
  }
}
```

PowerShell:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/session"
```

## `GET /ports`

Returns detected serial ports from the local serial backend.

Example response:

```json
{
  "ports": [
    {
      "path": "COM10",
      "manufacturer": "USB Serial",
      "serialNumber": "ABC123",
      "vendorId": "1A86",
      "productId": "7523"
    }
  ]
}
```

PowerShell:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/ports"
```

## `GET /latest`

Returns recent bounded ring-buffer data. Use the optional `seconds` query parameter to change the time window.

Example:

```text
GET /latest?seconds=20
```

Example response:

```json
{
  "windowSeconds": 20,
  "rawData": [
    {
      "ts": 1710000000.123,
      "data": "System boot\r\n",
      "bytes": 13,
      "port": "COM10"
    }
  ],
  "rawLines": [
    {
      "ts": 1710000000.123,
      "data": "System boot"
    }
  ],
  "parsed": [
    {
      "ts": 1710000000.123,
      "type": "raw",
      "text": "System boot"
    }
  ],
  "samples": [],
  "events": [
    {
      "ts": 1710000001,
      "level": "info",
      "message": "Bridge started.",
      "code": "bridge.started"
    }
  ],
  "commands": [
    {
      "ts": 1710000002,
      "encoding": "text",
      "data": "status\r\n"
    }
  ]
}
```

PowerShell:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/latest?seconds=20"
```

## `POST /serial/send`

Sends text to the currently open serial port and logs the command to `commands.jsonl`.

Request:

```json
{
  "data": "status\r\n",
  "encoding": "text"
}
```

Response:

```json
{
  "ok": true,
  "command": {
    "ts": 1710000002,
    "encoding": "text",
    "data": "status\r\n"
  }
}
```

Validation failures return `400` with a structured error:

```json
{
  "ok": false,
  "error": {
    "code": "request.validation",
    "message": "Request body is invalid."
  }
}
```

PowerShell:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8765/serial/send" `
  -ContentType "application/json" `
  -Body (@{ data = "status`r`n"; encoding = "text" } | ConvertTo-Json)
```

## `WS /stream`

Streams live bridge messages. MVP1 message types are `raw`, `parsed`, `event`, and `cmd_tx`.

Examples:

```json
{"type":"raw","ts":1710000000.123,"data":"System boot\r\n"}
{"type":"parsed","ts":1710000000.123,"data":{"ts":1710000000.123,"type":"raw","text":"System boot"}}
{"type":"event","ts":1710000001,"level":"warning","message":"Serial port disconnected: device removed","code":"serial.disconnected"}
{"type":"cmd_tx","ts":1710000002,"data":"status\r\n"}
```

Node smoke client from `vscode-extension`:

```powershell
node -e "const WebSocket=require('ws'); const ws=new WebSocket('ws://127.0.0.1:8765/stream'); ws.on('open',()=>console.log('connected')); ws.on('message',m=>console.log(m.toString()));"
```
