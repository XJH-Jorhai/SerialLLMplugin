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
      height: 100vh;
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-size: var(--vscode-font-size);
      overflow: hidden;
    }
    .shell {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 100vh;
      min-height: 0;
      padding: 6px;
    }
    .command-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 28px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .command-group,
    .serial-row,
    .send-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .command-group {
      flex: 0 0 auto;
      flex-wrap: wrap;
    }
    h2 {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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
      padding: 2px 8px;
      min-height: 24px;
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
      box-sizing: border-box;
      min-height: 24px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      padding: 2px 6px;
    }
    .status {
      display: flex;
      flex: 1 1 auto;
      justify-content: flex-end;
      gap: 5px;
      min-width: 120px;
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    .status strong {
      color: var(--vscode-foreground);
      font-weight: 600;
    }
    .status div {
      min-width: 0;
      max-width: 260px;
      overflow: hidden;
      padding: 2px 6px;
      border: 1px solid var(--vscode-panel-border);
      text-overflow: ellipsis;
    }
    .serial-strip {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      min-width: 0;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .serial-row {
      flex: 1 1 auto;
      flex-wrap: wrap;
    }
    .serial-row label {
      display: flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      color: var(--vscode-descriptionForeground);
    }
    .serial-row select {
      width: clamp(130px, 20vw, 230px);
    }
    .serial-row input[name="manualPort"] {
      width: clamp(110px, 16vw, 180px);
    }
    .serial-row input[name="baudrate"] {
      width: 88px;
    }
    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 28%);
      gap: 6px;
      flex: 1 1 auto;
      min-height: 0;
    }
    .terminal-pane,
    .inspector {
      display: flex;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
    }
    .terminal {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      padding: 6px 8px;
      color: var(--vscode-terminal-foreground, var(--vscode-editor-foreground));
      background: var(--vscode-terminal-background, var(--vscode-editorWidget-background));
      border: 1px solid var(--vscode-panel-border);
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.35;
    }
    .send-row {
      flex: 0 0 auto;
      padding-top: 6px;
    }
    .send-row input {
      flex: 1 1 auto;
      min-width: 80px;
    }
    pre,
    .events {
      flex: 1 1 0;
      min-height: 0;
      overflow: auto;
      margin: 0;
      padding: 6px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.35;
    }
    .inspector-section {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      gap: 4px;
      min-height: 0;
    }
    .inspector-section + .inspector-section {
      padding-top: 6px;
    }
    .event-row {
      margin-bottom: 4px;
      line-height: 1.35;
    }
    .event-row.error {
      color: var(--vscode-errorForeground);
    }
    .event-row.warning {
      color: var(--vscode-editorWarning-foreground, var(--vscode-foreground));
    }
    .message {
      flex: 0 0 auto;
      min-height: 18px;
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .message.error {
      color: var(--vscode-errorForeground);
    }
    @media (max-width: 820px) {
      .command-strip,
      .serial-strip {
        align-items: flex-start;
        flex-direction: column;
      }
      .status {
        justify-content: flex-start;
        width: 100%;
      }
      .workspace {
        grid-template-columns: 1fr;
      }
      .inspector {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 6px;
        min-height: 82px;
        max-height: 38%;
      }
      .inspector-section + .inspector-section {
        padding-top: 0;
      }
    }
    @media (max-width: 520px) {
      .inspector {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="command-strip" role="toolbar" aria-label="Bridge commands">
      <div class="command-group">
        <button id="startBridge" title="Start local bridge">Start</button>
        <button id="stopBridge" class="secondary" title="Stop local bridge">Stop</button>
        <button id="refresh" class="secondary" title="Refresh bridge state">Refresh</button>
        <button id="openLogs" class="secondary" title="Open active session log folder">Logs</button>
      </div>
      <div id="status" class="status" title="Bridge status">Waiting for bridge state...</div>
    </div>

    <div class="serial-strip" role="toolbar" aria-label="Serial port controls">
      <h2>Serial</h2>
      <div class="serial-row">
      <label>
        <span class="sr-only">Detected port</span>
        <select id="portSelect" title="Detected serial port" aria-label="Detected serial port"></select>
      </label>
      <label>
        <span class="sr-only">Manual port</span>
        <input id="manualPort" name="manualPort" placeholder="Manual port" title="Manual serial port" aria-label="Manual serial port">
      </label>
      <label>
        <span class="sr-only">Baudrate</span>
        <input id="baudrate" name="baudrate" inputmode="numeric" value="115200" title="Baudrate" aria-label="Baudrate">
      </label>
        <button id="listPorts" class="secondary" title="List detected serial ports">List</button>
        <button id="openSerial" title="Open selected serial port">Open</button>
        <button id="closeSerial" class="secondary" title="Close serial port">Close</button>
      </div>
    </div>

    <main class="workspace">
      <section class="terminal-pane" aria-label="Raw serial terminal">
        <div id="terminal" class="terminal" aria-live="polite" role="log"></div>
        <div class="send-row">
          <label class="sr-only" for="sendValue">Command text</label>
          <input id="sendValue" placeholder="Send command" title="Command text" aria-label="Command text">
          <button id="sendLine" title="Send command with configured line ending">Send</button>
          <button id="clearTerminal" class="secondary" title="Clear terminal view">Clear</button>
        </div>
      </section>

      <aside class="inspector" aria-label="Parsed data and events">
        <section class="inspector-section">
          <h2>Parsed</h2>
          <pre id="parsedPreview">No parsed frames yet.</pre>
        </section>
        <section class="inspector-section">
          <h2>Events</h2>
          <div id="events" class="events">No events yet.</div>
        </section>
      </aside>
    </main>

    <div id="message" class="message" role="status"></div>
  </div>

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
