export function renderBridgePanelHtml(): string {
  const nonce = createNonce();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
  >
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCU Serial Bridge</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      margin: 0;
      padding: 14px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-size: var(--vscode-font-size);
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 17px;
      font-weight: 600;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 600;
    }
    button,
    input,
    select {
      font: inherit;
    }
    button {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 1px solid var(--vscode-button-border, transparent);
      padding: 4px 10px;
      min-height: 26px;
      cursor: pointer;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    button:disabled {
      cursor: default;
      opacity: 0.55;
    }
    input,
    select {
      min-height: 26px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      padding: 3px 7px;
    }
    .status {
      text-align: right;
      line-height: 1.45;
      color: var(--vscode-descriptionForeground);
    }
    .status strong {
      color: var(--vscode-foreground);
      font-weight: 600;
    }
    .toolbar,
    .serial-row,
    .send-row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .serial-row label {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 130px;
      color: var(--vscode-descriptionForeground);
    }
    .serial-row select {
      min-width: 220px;
    }
    .serial-row input[name="manualPort"] {
      min-width: 160px;
    }
    .serial-row input[name="baudrate"] {
      width: 110px;
    }
    .send-row input {
      flex: 1 1 260px;
      min-width: 160px;
    }
    section {
      border-top: 1px solid var(--vscode-panel-border);
      padding-top: 10px;
      margin-top: 10px;
    }
    .terminal {
      height: 260px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      padding: 9px;
      color: var(--vscode-terminal-foreground, var(--vscode-editor-foreground));
      background: var(--vscode-terminal-background, var(--vscode-editorWidget-background));
      border: 1px solid var(--vscode-panel-border);
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.45;
    }
    .two-column {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
    }
    pre,
    .events {
      min-height: 130px;
      max-height: 230px;
      overflow: auto;
      margin: 0;
      padding: 9px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }
    .event-row {
      margin-bottom: 6px;
      line-height: 1.35;
    }
    .event-row.error {
      color: var(--vscode-errorForeground);
    }
    .event-row.warning {
      color: var(--vscode-editorWarning-foreground, var(--vscode-foreground));
    }
    .message {
      min-height: 18px;
      margin-top: 8px;
      color: var(--vscode-descriptionForeground);
    }
    .message.error {
      color: var(--vscode-errorForeground);
    }
    @media (max-width: 760px) {
      header {
        display: block;
      }
      .status {
        margin-top: 8px;
        text-align: left;
      }
      .two-column {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>MCU Serial Bridge</h1>
    </div>
    <div id="status" class="status">Waiting for bridge state...</div>
  </header>

  <div class="toolbar">
    <button id="startBridge">Start Bridge</button>
    <button id="stopBridge" class="secondary">Stop Bridge</button>
    <button id="refresh" class="secondary">Refresh</button>
    <button id="openLogs" class="secondary">Open Log Folder</button>
  </div>

  <section>
    <h2>Serial</h2>
    <div class="serial-row">
      <label>
        Detected port
        <select id="portSelect"></select>
      </label>
      <label>
        Manual port
        <input id="manualPort" name="manualPort" placeholder="COM8 or /dev/ttyUSB0">
      </label>
      <label>
        Baudrate
        <input id="baudrate" name="baudrate" inputmode="numeric" value="115200">
      </label>
      <button id="listPorts" class="secondary">List Ports</button>
      <button id="openSerial">Open</button>
      <button id="closeSerial" class="secondary">Close</button>
    </div>
  </section>

  <section>
    <h2>Raw Output</h2>
    <div id="terminal" class="terminal" aria-live="polite"></div>
    <div class="send-row">
      <input id="sendValue" placeholder="Command text">
      <button id="sendLine">Send</button>
      <button id="clearTerminal" class="secondary">Clear View</button>
    </div>
  </section>

  <section class="two-column">
    <div>
      <h2>Latest Parsed</h2>
      <pre id="parsedPreview">No parsed frames yet.</pre>
    </div>
    <div>
      <h2>Events</h2>
      <div id="events" class="events">No events yet.</div>
    </div>
  </section>

  <div id="message" class="message"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = {
      session: undefined,
      latest: undefined,
      ports: [],
      rawClearedAt: 0,
      rawEntries: [],
      rawSignatures: new Set(),
      maxRawEntries: 2000
    };

    const el = {
      status: document.getElementById("status"),
      startBridge: document.getElementById("startBridge"),
      stopBridge: document.getElementById("stopBridge"),
      refresh: document.getElementById("refresh"),
      openLogs: document.getElementById("openLogs"),
      portSelect: document.getElementById("portSelect"),
      manualPort: document.getElementById("manualPort"),
      baudrate: document.getElementById("baudrate"),
      listPorts: document.getElementById("listPorts"),
      openSerial: document.getElementById("openSerial"),
      closeSerial: document.getElementById("closeSerial"),
      terminal: document.getElementById("terminal"),
      sendValue: document.getElementById("sendValue"),
      sendLine: document.getElementById("sendLine"),
      clearTerminal: document.getElementById("clearTerminal"),
      parsedPreview: document.getElementById("parsedPreview"),
      events: document.getElementById("events"),
      message: document.getElementById("message")
    };

    window.addEventListener("message", (event) => {
      const message = event.data;
      switch (message.type) {
        case "session":
          state.session = message.session;
          renderSession();
          renderPorts();
          return;
        case "latest":
          state.latest = message.latest;
          renderLatest();
          return;
        case "ports":
          state.ports = Array.isArray(message.ports) ? message.ports : [];
          renderPorts();
          return;
        case "info":
          showMessage(message.message, false);
          return;
        case "error":
          showMessage(message.message, true);
          return;
      }
    });

    el.startBridge.addEventListener("click", () => post({ type: "startBridge" }));
    el.stopBridge.addEventListener("click", () => post({ type: "stopBridge" }));
    el.refresh.addEventListener("click", () => post({ type: "refresh" }));
    el.openLogs.addEventListener("click", () => post({ type: "openSessionFolder" }));
    el.listPorts.addEventListener("click", () => post({ type: "listPorts" }));
    el.openSerial.addEventListener("click", openSerial);
    el.closeSerial.addEventListener("click", () => post({ type: "closeSerial" }));
    el.portSelect.addEventListener("change", () => {
      el.manualPort.value = "";
    });
    el.sendLine.addEventListener("click", sendLine);
    el.clearTerminal.addEventListener("click", () => {
      state.rawClearedAt = Date.now() / 1000;
      renderLatest();
    });
    el.sendValue.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        sendLine();
      }
    });

    post({ type: "ready" });

    function post(message) {
      vscode.postMessage(message);
    }

    function openSerial() {
      const selected = el.portSelect.value;
      const manual = el.manualPort.value.trim();
      const port = manual || selected;
      const baudrate = Number(el.baudrate.value.trim());
      if (!port) {
        showMessage("Select or enter a serial port first.", true);
        return;
      }
      if (!Number.isInteger(baudrate) || baudrate <= 0) {
        showMessage("Baudrate must be a positive integer.", true);
        return;
      }
      post({ type: "openSerial", port, baudrate });
    }

    function sendLine() {
      const value = el.sendValue.value;
      if (value.length === 0) {
        showMessage("Enter command text first.", true);
        return;
      }
      post({ type: "sendLine", value });
      el.sendValue.value = "";
    }

    function renderSession() {
      const session = state.session;
      if (!session) {
        return;
      }
      const serial = session.serial || {};
      const serialText = serial.open
        ? "open " + (serial.port || "unknown") + " @ " + (serial.baudrate || "unknown")
        : "closed";
      el.status.textContent = "";
      appendStatus("Bridge", session.running ? "running" : "stopped");
      appendStatus("Serial", serialText);
      appendStatus("Protocol", session.protocol || "raw-text");
      appendStatus("API", session.api ? session.api.host + ":" + session.api.port : "not started");
      appendStatus("Logs", session.logging && session.logging.sessionDirectory ? session.logging.sessionDirectory : "no active session");

      el.startBridge.disabled = Boolean(session.running);
      el.stopBridge.disabled = !session.running;
      el.closeSerial.disabled = !serial.open;
      el.openLogs.disabled = !(session.logging && session.logging.sessionDirectory);

      if (serial.baudrate && document.activeElement !== el.baudrate) {
        el.baudrate.value = String(serial.baudrate);
      }
      if (serial.port && document.activeElement !== el.manualPort) {
        const hasDetected = state.ports.some((port) => port.path === serial.port);
        if (!hasDetected) {
          el.manualPort.value = serial.port;
        }
      }
    }

    function appendStatus(label, value) {
      const line = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = label + ": ";
      line.append(strong, document.createTextNode(value));
      el.status.appendChild(line);
    }

    function renderPorts() {
      const currentValue = el.portSelect.value || (state.session && state.session.serial && state.session.serial.port) || "";
      el.portSelect.textContent = "";
      if (state.ports.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No detected ports";
        el.portSelect.appendChild(option);
        return;
      }
      for (const port of state.ports) {
        const option = document.createElement("option");
        option.value = port.path;
        option.textContent = port.path + (port.manufacturer ? " - " + port.manufacturer : "");
        el.portSelect.appendChild(option);
      }
      if (currentValue && state.ports.some((port) => port.path === currentValue)) {
        el.portSelect.value = currentValue;
      }
    }

    function renderLatest() {
      const latest = state.latest;
      if (!latest) {
        return;
      }
      ingestRaw(latest.rawData || []);
      renderRaw();
      renderParsed(latest.parsed || []);
      renderEvents(latest.events || []);
    }

    function ingestRaw(rawData) {
      for (const entry of rawData) {
        const signature = rawSignature(entry);
        if (state.rawSignatures.has(signature)) {
          continue;
        }
        state.rawSignatures.add(signature);
        state.rawEntries.push(entry);
      }
      while (state.rawEntries.length > state.maxRawEntries) {
        const removed = state.rawEntries.shift();
        if (removed) {
          state.rawSignatures.delete(rawSignature(removed));
        }
      }
    }

    function rawSignature(entry) {
      return [
        entry.ts,
        entry.bytes || 0,
        entry.port || "",
        entry.data || ""
      ].join("|");
    }

    function renderRaw() {
      const visible = state.rawEntries.filter((entry) => entry.ts >= state.rawClearedAt);
      if (visible.length === 0) {
        el.terminal.textContent = "";
        return;
      }
      el.terminal.textContent = visible
        .map((entry) => {
          const text = String(entry.data || "");
          const suffix = text.endsWith("\\n") ? "" : "\\n";
          return "[" + formatTime(entry.ts) + "] " + text + suffix;
        })
        .join("");
      el.terminal.scrollTop = el.terminal.scrollHeight;
    }

    function renderParsed(parsed) {
      const visible = parsed.slice(-10);
      el.parsedPreview.textContent =
        visible.length === 0 ? "No parsed frames yet." : JSON.stringify(visible, null, 2);
    }

    function renderEvents(events) {
      const visible = events.slice(-25).reverse();
      el.events.textContent = "";
      if (visible.length === 0) {
        el.events.textContent = "No events yet.";
        return;
      }
      for (const event of visible) {
        const row = document.createElement("div");
        row.className = "event-row " + (event.level || "");
        row.textContent =
          "[" +
          formatTime(event.ts) +
          "] " +
          String(event.level || "info").toUpperCase() +
          " " +
          (event.message || "");
        el.events.appendChild(row);
      }
    }

    function showMessage(message, isError) {
      el.message.textContent = message || "";
      el.message.className = isError ? "message error" : "message";
    }

    function formatTime(epochSeconds) {
      if (!Number.isFinite(epochSeconds)) {
        return "--:--:--";
      }
      const date = new Date(epochSeconds * 1000);
      return date.toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    }
  </script>
</body>
</html>`;
}

function createNonce(): string {
  const source = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let index = 0; index < 32; index += 1) {
    result += source.charAt(Math.floor(Math.random() * source.length));
  }
  return result;
}
