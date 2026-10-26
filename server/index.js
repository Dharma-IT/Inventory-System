import { createServer } from "node:http";
import { getOrders } from "./shopify.js";

const port = Number(process.env.PORT || 10000);
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method === "OPTIONS") return sendJson(response, 204, {});

  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "GET" && url.pathname === "/api/orders") {
    try {
      const requestedFirst = Number(url.searchParams.get("first") || 50);
      const first = Math.min(100, Math.max(1, requestedFirst));
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const datePattern =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
      if ((from && !datePattern.test(from)) || (to && !datePattern.test(to))) {
        return sendJson(response, 400, { error: "Invalid date range." });
      }
      const orders = await getOrders({
        first,
        after: url.searchParams.get("after"),
        from,
        to,
      });
      return sendJson(response, 200, orders);
    } catch (error) {
      console.error(
        "Orders request failed:",
        error instanceof Error ? error.message : error,
      );
      return sendJson(response, 502, {
        error: "Unable to retrieve Shopify orders.",
      });
    }
  }

  return sendJson(response, 404, { error: "Not found" });
}).listen(port, "0.0.0.0", () => {
  console.log(`Shopify API service listening on port ${port}`);
});
