import { Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { StreamMessage } from "./types";

export class WebSocketHub {
  private server: WebSocketServer | undefined;

  public start(httpServer: Server, path = "/stream"): void {
    if (this.server) {
      return;
    }

    const websocketPath = path.startsWith("/") ? path : `/${path}`;
    this.server = new WebSocketServer({ server: httpServer, path: websocketPath });
    this.server.on("connection", (socket) => {
      socket.on("error", () => {
        socket.terminate();
      });
    });
  }

  public async stop(): Promise<void> {
    const server = this.server;
    if (!server) {
      return;
    }
    this.server = undefined;

    for (const client of server.clients) {
      client.close();
      client.terminate();
    }

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

  public broadcast(message: StreamMessage): void {
    const server = this.server;
    if (!server) {
      return;
    }
    const payload = JSON.stringify(message);
    for (const client of server.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload, (error) => {
          if (error) {
            client.terminate();
          }
        });
      }
    }
  }
}
