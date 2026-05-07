import { BridgeSession } from "../bridge/types";

export function renderBridgePanelHtml(session: BridgeSession): string {
  const sessionJson = escapeHtml(JSON.stringify(session, null, 2));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCU Serial Bridge</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 12px;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      padding: 12px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-inactiveSelectionBackground);
    }
  </style>
</head>
<body>
  <h1>MCU Serial Bridge</h1>
  <pre>${sessionJson}</pre>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
