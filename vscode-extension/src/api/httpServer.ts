import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { URL } from "node:url";
import { asErrorMessage } from "../util/errors";
import {
  BridgeApiProvider,
  serialOpenRequestSchema,
  serialSendRequestSchema
} from "./types";

export class HttpServer {
  private server: Server | undefined;

  public constructor(private readonly provider: BridgeApiProvider) {}

  public get nodeServer(): Server | undefined {
    return this.server;
  }

  public async start(host: string, port: number): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer((request, response) => {
      this.handle(request, response).catch((error: unknown) => {
        this.respondJson(response, 500, { error: asErrorMessage(error) });
      });
    });

    await new Promise<void>((resolve, reject) => {
      const server = this.server;
      if (!server) {
        reject(new Error("HTTP server was not created."));
        return;
      }

      const onError = (error: Error): void => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        server.off("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, host);
    });
  }

  public async stop(): Promise<void> {
    const server = this.server;
    if (!server) {
      return;
    }

    this.server = undefined;
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const method = request.method ?? "GET";

    if (method === "GET" && url.pathname === "/session") {
      this.respondJson(response, 200, this.provider.getSession());
      return;
    }

    if (method === "GET" && url.pathname === "/ports") {
      this.respondJson(response, 200, { ports: await this.provider.listPorts() });
      return;
    }

    if (method === "GET" && url.pathname === "/latest") {
      const secondsParam = url.searchParams.get("seconds");
      const seconds = secondsParam ? Number(secondsParam) : undefined;
      this.respondJson(response, 200, this.provider.getLatest(seconds));
      return;
    }

    if (method === "GET" && url.pathname === "/logs") {
      this.respondJson(response, 200, {
        directory: this.provider.getSession().logging.sessionDirectory
      });
      return;
    }

    if (method === "POST" && url.pathname === "/serial/open") {
      const body = serialOpenRequestSchema.parse(await this.readJsonBody(request));
      this.respondJson(response, 200, await this.provider.openSerial(body));
      return;
    }

    if (method === "POST" && url.pathname === "/serial/close") {
      this.respondJson(response, 200, await this.provider.closeSerial());
      return;
    }

    if (method === "POST" && url.pathname === "/serial/send") {
      const body = serialSendRequestSchema.parse(await this.readJsonBody(request));
      this.respondJson(response, 200, await this.provider.sendText(body.data));
      return;
    }

    this.respondJson(response, 404, { error: "Not found." });
  }

  private async readJsonBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > 64 * 1024) {
        throw new Error("Request body is too large.");
      }
      chunks.push(buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw.length > 0 ? JSON.parse(raw) : {};
  }

  private respondJson(response: ServerResponse, statusCode: number, value: unknown): void {
    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify(value));
  }
}
