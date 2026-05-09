import { once } from "node:events";
import { AddressInfo } from "node:net";
import WebSocket from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { HttpServer } from "../../src/api/httpServer";
import {
  ApiErrorResponse,
  BridgeApiProvider,
  SerialSendResponse
} from "../../src/api/types";
import { WebSocketHub } from "../../src/api/websocketHub";
import {
  BridgeSession,
  CommandEntry,
  LatestData,
  SerialPortInfo,
  SerialState
} from "../../src/bridge/types";

const activeServers: HttpServer[] = [];

describe("HttpServer", () => {
  afterEach(async () => {
    await Promise.all(activeServers.splice(0).map((server) => server.stop()));
  });

  it("serves the current bridge session", async () => {
    const harness = createProviderHarness();
    const { baseUrl } = await startServer(harness.provider);

    const response = await fetch(`${baseUrl}/session`);
    const body = (await response.json()) as BridgeSession;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      project: "demo",
      serial: {
        open: false,
        port: "COM_TEST",
        baudrate: 115200
      },
      protocol: "raw-text",
      startedAt: "2026-05-07T10:30:00.123Z",
      logging: {
        sessionDirectory: "C:\\logs\\session"
      }
    });
  });

  it("serves serial ports from the bridge provider", async () => {
    const harness = createProviderHarness();
    const { baseUrl } = await startServer(harness.provider);

    const response = await fetch(`${baseUrl}/ports`);
    const body = (await response.json()) as { ports: SerialPortInfo[] };

    expect(response.status).toBe(200);
    expect(body.ports).toEqual([
      {
        path: "COM_TEST",
        manufacturer: "Test Vendor"
      }
    ]);
    expect(harness.calls.listPorts).toBe(1);
  });

  it("serves latest bridge data with the configured default and optional window", async () => {
    const harness = createProviderHarness();
    const { baseUrl } = await startServer(harness.provider);

    const defaultResponse = await fetch(`${baseUrl}/latest`);
    const defaultBody = (await defaultResponse.json()) as LatestData;
    const windowResponse = await fetch(`${baseUrl}/latest?seconds=7`);
    const windowBody = (await windowResponse.json()) as LatestData;

    expect(defaultResponse.status).toBe(200);
    expect(defaultBody.windowSeconds).toBe(20);
    expect(defaultBody.rawLines).toEqual([{ ts: 100, data: "System boot" }]);
    expect(defaultBody.parsed).toEqual([{ ts: 100, type: "raw", text: "System boot" }]);
    expect(defaultBody.events).toEqual([
      {
        ts: 101,
        level: "info",
        message: "boot complete"
      }
    ]);
    expect(defaultBody.commands).toEqual([
      {
        ts: 102,
        encoding: "text",
        data: "status\r\n"
      }
    ]);

    expect(windowResponse.status).toBe(200);
    expect(windowBody.windowSeconds).toBe(7);
    expect(harness.calls.latestSeconds).toEqual([undefined, 7]);
  });

  it("validates and routes text serial sends through the bridge provider", async () => {
    const harness = createProviderHarness();
    const { baseUrl } = await startServer(harness.provider);

    const response = await fetch(`${baseUrl}/serial/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "status\r\n", encoding: "text" })
    });
    const body = (await response.json()) as SerialSendResponse;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      command: {
        ts: 123,
        encoding: "text",
        data: "status\r\n"
      }
    });
    expect(harness.calls.sentText).toEqual(["status\r\n"]);
  });

  it("returns a structured validation error for invalid serial send bodies", async () => {
    const harness = createProviderHarness();
    const { baseUrl } = await startServer(harness.provider);

    const response = await fetch(`${baseUrl}/serial/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: 123, encoding: "text" })
    });
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("request.validation");
    expect(harness.calls.sentText).toEqual([]);
  });

  it("returns a structured validation error for empty serial send bodies", async () => {
    const harness = createProviderHarness();
    const { baseUrl } = await startServer(harness.provider);

    const response = await fetch(`${baseUrl}/serial/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("request.validation");
    expect(harness.calls.sentText).toEqual([]);
  });

  it("returns a structured error for malformed JSON", async () => {
    const harness = createProviderHarness();
    const { baseUrl } = await startServer(harness.provider);

    const response = await fetch(`${baseUrl}/serial/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad json"
    });
    const body = (await response.json()) as ApiErrorResponse;

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "request.invalidJson",
        message: "Request body must be valid JSON."
      }
    });
    expect(harness.calls.sentText).toEqual([]);
  });

  it("rejects non-local bind hosts", async () => {
    const harness = createProviderHarness();
    const server = new HttpServer(harness.provider);

    await expect(server.start("0.0.0.0", 0)).rejects.toMatchObject({
      code: "bridge.host.nonLocal"
    });
    expect(server.nodeServer).toBeUndefined();
  });

  it("reports a clear error when the HTTP port is already in use", async () => {
    const harness = createProviderHarness();
    const { server } = await startServer(harness.provider);
    const address = server.nodeServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected HTTP server to listen on a TCP address.");
    }

    const conflictingServer = new HttpServer(harness.provider);
    await expect(
      conflictingServer.start("127.0.0.1", (address as AddressInfo).port)
    ).rejects.toMatchObject({
      code: "bridge.http.portInUse"
    });
    expect(conflictingServer.nodeServer).toBeUndefined();
  });

  it("stops cleanly and idempotently", async () => {
    const harness = createProviderHarness();
    const { server } = await startServer(harness.provider);

    await server.stop();
    await server.stop();

    expect(server.nodeServer).toBeUndefined();
  });

  it("broadcasts bridge events on the /stream WebSocket endpoint", async () => {
    const harness = createProviderHarness();
    const { server, baseUrl } = await startServer(harness.provider);
    const hub = new WebSocketHub();
    const nodeServer = server.nodeServer;
    if (!nodeServer) {
      throw new Error("Expected HTTP server to be running.");
    }
    hub.start(nodeServer, "/stream");

    const client = new WebSocket(`${baseUrl.replace("http://", "ws://")}/stream`);
    try {
      await once(client, "open");
      const message = new Promise<unknown>((resolve, reject) => {
        client.once("message", (data) => {
          resolve(JSON.parse(data.toString()));
        });
        client.once("error", reject);
      });

      hub.broadcast({
        type: "event",
        ts: 10,
        level: "info",
        message: "bridge started"
      });

      await expect(message).resolves.toEqual({
        type: "event",
        ts: 10,
        level: "info",
        message: "bridge started"
      });
    } finally {
      client.terminate();
      await hub.stop();
    }
  });

  it("closes WebSocket clients when the hub stops", async () => {
    const harness = createProviderHarness();
    const { server, baseUrl } = await startServer(harness.provider);
    const hub = new WebSocketHub();
    const nodeServer = server.nodeServer;
    if (!nodeServer) {
      throw new Error("Expected HTTP server to be running.");
    }
    hub.start(nodeServer, "/stream");

    const client = new WebSocket(`${baseUrl.replace("http://", "ws://")}/stream`);
    try {
      await once(client, "open");
      const closed = once(client, "close");

      await hub.stop();

      await expect(closed).resolves.toBeDefined();
    } finally {
      client.terminate();
      await hub.stop();
    }
  });
});

interface ProviderHarness {
  provider: BridgeApiProvider;
  calls: {
    sentText: string[];
    latestSeconds: Array<number | undefined>;
    listPorts: number;
  };
}

function createProviderHarness(): ProviderHarness {
  const calls = {
    sentText: [] as string[],
    latestSeconds: [] as Array<number | undefined>,
    listPorts: 0
  };

  const provider: BridgeApiProvider = {
    getSession: () => makeSession(),
    listPorts: async () => {
      calls.listPorts += 1;
      return [
        {
          path: "COM_TEST",
          manufacturer: "Test Vendor"
        }
      ];
    },
    openSerial: async () => makeSession().serial,
    closeSerial: async () => ({ open: false }),
    sendText: async (data: string): Promise<CommandEntry> => {
      calls.sentText.push(data);
      return {
        ts: 123,
        encoding: "text",
        data
      };
    },
    getLatest: (seconds?: number): LatestData => {
      calls.latestSeconds.push(seconds);
      return {
        windowSeconds: seconds ?? 20,
        rawData: [],
        rawLines: [{ ts: 100, data: "System boot" }],
        parsed: [{ ts: 100, type: "raw", text: "System boot" }],
        samples: [],
        events: [
          {
            ts: 101,
            level: "info",
            message: "boot complete"
          }
        ],
        commands: [
          {
            ts: 102,
            encoding: "text",
            data: "status\r\n"
          }
        ]
      };
    }
  };

  return { provider, calls };
}

async function startServer(
  provider: BridgeApiProvider
): Promise<{ server: HttpServer; baseUrl: string }> {
  const server = new HttpServer(provider);
  await server.start("127.0.0.1", 0);
  activeServers.push(server);

  const address = server.nodeServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected HTTP server to listen on a TCP address.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`
  };
}

function makeSession(): BridgeSession {
  const serial: SerialState = {
    open: false,
    port: "COM_TEST",
    baudrate: 115200
  };

  return {
    running: true,
    project: "demo",
    workspace: "C:\\workspace\\demo",
    mcu: "STM32_TEST",
    elf: "build/Debug/demo.elf",
    serial,
    protocol: "raw-text",
    startedAt: "2026-05-07T10:30:00.123Z",
    api: {
      host: "127.0.0.1",
      port: 0,
      websocketPath: "/stream"
    },
    logging: {
      enabled: true,
      directory: ".serial-sessions",
      sessionDirectory: "C:\\logs\\session"
    }
  };
}
