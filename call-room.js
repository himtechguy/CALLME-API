
import { DurableObject } from "cloudflare:workers";

const ALLOWED_TYPES = new Set([
  "offer",
  "answer",
  "ice-candidate",
  "call",
  "accept",
  "reject",
  "hangup"
]);

export class CallRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
  }

  async fetch(request) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required.", {
        status: 426
      });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);

    server.send(JSON.stringify({
      type: "ready",
      participants: this.ctx.getWebSockets().length
    }));

    this.broadcast({
      type: "user-joined",
      participants: this.ctx.getWebSockets().length
    }, server);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  broadcast(data, excludedSocket) {
    const message = JSON.stringify(data);

    for (const socket of this.ctx.getWebSockets()) {
      if (socket === excludedSocket) continue;

      try {
        socket.send(message);
      } catch {
        // Ignore disconnected sockets.
      }
    }
  }

  async webSocketMessage(socket, message) {
    if (typeof message !== "string" || message.length > 65536) {
      socket.close(1009, "Message too large");
      return;
    }

    let data;

    try {
      data = JSON.parse(message);
    } catch {
      socket.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON message."
      }));
      return;
    }

    if (!data || !ALLOWED_TYPES.has(data.type)) {
      socket.send(JSON.stringify({
        type: "error",
        message: "Unsupported signalling message."
      }));
      return;
    }

    this.broadcast({
      type: data.type,
      payload: data.payload ?? null
    }, socket);
  }

  async webSocketClose(socket) {
    this.broadcast({
      type: "user-left"
    }, socket);
  }

  async webSocketError(socket) {
    this.broadcast({
      type: "user-left"
    }, socket);
  }
}
