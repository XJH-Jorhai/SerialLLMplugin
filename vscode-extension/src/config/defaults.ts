export const DEFAULT_CONFIG_FILE = ".vscode/mcu-serial-bridge.yaml";
export const CONFIG_FILE_ALIASES = [
  ".vscode/stm32-serial-bridge.yaml",
  ".vscode/stm32-serial-assistant.yaml"
] as const;

export const DEFAULT_BRIDGE_HOST = "127.0.0.1";
export const DEFAULT_BRIDGE_PORT = 8765;
export const DEFAULT_WEBSOCKET_PATH = "/stream";
export const DEFAULT_LATEST_WINDOW_SECONDS = 20;

export const DEFAULT_BAUDRATE = 115200;
export const DEFAULT_LINE_ENDING = "\r\n";

export const DEFAULT_LOGGING_ENABLED = true;
export const DEFAULT_LOGGING_DIRECTORY = ".serial-sessions";
