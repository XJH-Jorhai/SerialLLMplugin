import { Server } from "node:http";
import { describe, expect, it } from "vitest";
import { BridgeApiProvider } from "../../src/api/types";
import { HttpServer } from "../../src/api/httpServer";
import { BridgeService } from "../../src/bridge/bridgeService";
import { bridgeConfigSchema } from "../../src/config/schema";

describe("BridgeService parser integration", () => {
  it("records raw-text parser output after raw line logging", () => {
    const bridge = new BridgeService();

    bridge.recordRawLine({ ts: 100, data: "System boot" });

    expect(bridge.getLatest(Number.MAX_SAFE_INTEGER).parsed).toEqual([
      { ts: 100, type: "raw", text: "System boot" }
    ]);
  });

  it("uses the configured json-line parser for raw serial lines", async () => {
    const bridge = new BridgeService({
      configProvider: () =>
        Promise.resolve(
          bridgeConfigSchema.parse({
            logging: { enabled: false },
            protocol: { type: "json-line" }
          })
        ),
      httpServer: new StubHttpServer()
    });

    await bridge.start();
    bridge.recordRawLine({ ts: 200, data: "{\"status\":\"ok\"}" });
    bridge.recordRawLine({ ts: 201, data: "{bad json}" });

    const latest = bridge.getLatest(Number.MAX_SAFE_INTEGER);
    expect(latest.parsed).toEqual([
      { ts: 200, type: "json", value: { status: "ok" } }
    ]);
    expect(latest.events).toContainEqual(
      expect.objectContaining({
        ts: 201,
        level: "warning",
        code: "parser.jsonLine.invalid"
      })
    );

    await bridge.stop();
  });
});

class StubHttpServer extends HttpServer {
  public constructor() {
    super({} as BridgeApiProvider);
  }

  public override get nodeServer(): Server | undefined {
    return undefined;
  }

  public override async start(): Promise<void> {
    return undefined;
  }

  public override async stop(): Promise<void> {
    return undefined;
  }
}
