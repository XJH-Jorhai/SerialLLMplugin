import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { URL } from "node:url";
import { ZodError } from "zod";
import {
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_PORT
} from "../config/defaults";
import { asErrorMessage, BridgeError } from "../util/errors";
import {
  ApiErrorResponse,
  BridgeApiProvider,
  serialOpenRequestSchema,
  serialSendRequestSchema,
  SerialSendResponse
} from "./types";

export class HttpServer {
  private server: Server | undefined;

  public constructor(private readonly provider: BridgeApiProvider) {}

  public get nodeServer(): Server | undefined {
    return this.server;
  }

  public async start(
    host = DEFAULT_BRIDGE_HOST,
    port = DEFAULT_BRIDGE_PORT
  ): Promise<void> {
    if (this.server) {
      return;
    }

    this.ensureLocalHost(host);

    this.server = createServer((request, response) => {
      this.handle(request, response).catch((error: unknown) => {
        this.respondError(response, error);
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
        this.server = undefined;
        try {
          server.close();
        } catch {
          // The failed listen may leave the server without an active handle.
        }
        reject(this.toStartError(error, host, port));
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
      const seconds = this.parseLatestSeconds(url.searchParams.get("seconds"));
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
      const value: SerialSendResponse = {
        ok: true,
        command: await this.provider.sendText(body.data)
      };
      this.respondJson(response, 200, value);
      return;
    }

    this.respondJson(response, 404, this.errorBody(404, "route.notFound", "Not found."));
  }

  private async readJsonBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > 64 * 1024) {
        throw new ApiRequestError(
          413,
          "request.bodyTooLarge",
          "Request body is too large."
        );
      }
      chunks.push(buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    if (raw.length === 0) {
      return {};
    }

    try {
      return JSON.parse(raw);
    } catch {
      throw new ApiRequestError(
        400,
        "request.invalidJson",
        "Request body must be valid JSON."
      );
    }
  }

  private respondJson(response: ServerResponse, statusCode: number, value: unknown): void {
    if (response.headersSent) {
      response.end();
      return;
    }

    response.statusCode = statusCode;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify(value));
  }

  private respondError(response: ServerResponse, error: unknown): void {
    if (error instanceof ApiRequestError) {
      this.respondJson(
        response,
        error.statusCode,
        this.errorBody(error.statusCode, error.code, error.message, error.details)
      );
      return;
    }

    if (error instanceof ZodError) {
      this.respondJson(
        response,
        400,
        this.errorBody(400, "request.validation", "Request body is invalid.", error.issues)
      );
      return;
    }

    if (error instanceof BridgeError) {
      this.respondJson(
        response,
        400,
        this.errorBody(400, error.code, error.message)
      );
      return;
    }

    this.respondJson(
      response,
      500,
      this.errorBody(500, "bridge.internalError", asErrorMessage(error))
    );
  }

  private errorBody(
    _statusCode: number,
    code: string,
    message: string,
    details?: unknown
  ): ApiErrorResponse {
    return {
      ok: false,
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details })
      }
    };
  }

  private parseLatestSeconds(value: string | null): number | undefined {
    if (value === null || value.trim().length === 0) {
      return undefined;
    }

    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new ApiRequestError(
        400,
        "request.invalidQuery",
        "Query parameter seconds must be a positive number."
      );
    }

    return seconds;
  }

  private ensureLocalHost(host: string): void {
    const normalized = host.trim().toLowerCase();
    if (normalized !== "127.0.0.1" && normalized !== "localhost" && normalized !== "::1") {
      throw new BridgeError(
        "MVP1 refuses non-local bridge hosts. Use 127.0.0.1 unless explicit external binding support is added.",
        "bridge.host.nonLocal"
      );
    }
  }

  private toStartError(error: Error, host: string, port: number): BridgeError {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      return new BridgeError(
        `Failed to start local bridge API on ${host}:${port}; the port is already in use.`,
        "bridge.http.portInUse"
      );
    }

    return new BridgeError(
      `Failed to start local bridge API on ${host}:${port}: ${asErrorMessage(error)}`,
      "bridge.http.startFailed"
    );
  }
}

class ApiRequestError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}
