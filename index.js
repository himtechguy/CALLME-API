
import { CallRoom } from "./call-room.js";

export { CallRoom };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: corsHeaders
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        name: "CALLME API",
        status: "online",
        message: "Connect Without Borders.",
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/signal") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return json({
          error: "WebSocket upgrade required."
        }, 426);
      }

      const room = url.searchParams.get("room");

      if (!room || !/^[a-zA-Z0-9_-]{8,64}$/.test(room)) {
        return json({
          error: "Room ID must contain 8–64 valid characters."
        }, 400);
      }

      if (!env.CALL_ROOMS) {
        return json({
          error: "CALL_ROOMS binding is missing."
        }, 503);
      }

      const id = env.CALL_ROOMS.idFromName(room);
      const roomObject = env.CALL_ROOMS.get(id);

      return roomObject.fetch(request);
    }

    return json({
      error: "Route not found."
    }, 404);
  }
};
