import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { config } from "./config.js";
import { withPayment } from "./mcp.js";

// Hosted variant of mcp-example.ts: same paywalled echo tool, Streamable HTTP
// transport instead of stdio. The decorated handler is created once at module
// level so withPayment's memoized init (db, facilitator, payment requirements)
// is shared across requests.
const echo = withPayment(
  async ({ text }: { text: string }) => ({ content: [{ type: "text" as const, text }] }),
  {
    price: config.price,
    asset: config.asset,
    network: config.network,
    payTo: config.payTo,
    dbPath: config.dbPath,
    description: "x402-mica echo tool (hosted)",
  },
);

function buildServer(): McpServer {
  const server = new McpServer({ name: "x402-mica-http-example", version: "0.0.1" });
  server.tool("echo", "Echo back the given text. Requires an x402 payment.",
    { text: z.string().describe("Text to echo back") }, echo);
  return server;
}

const app = express();
app.use(express.json());

// Stateless mode: fresh McpServer + transport per request — the SDK's documented
// minimal pattern; no session bookkeeping. The shared `echo` handler carries the state
// that matters (payment wrapper + audit db).
app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => void transport.close());
    await buildServer().connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "internal error" }, id: null });
  }
});
// ponytail: stateless demo — no GET (SSE notification stream) / DELETE (session teardown); add with stateful mode if ever needed.
app.get("/mcp", (_req, res) => { res.status(405).send("stateless demo: POST only"); });
app.delete("/mcp", (_req, res) => { res.status(405).send("stateless demo: POST only"); });

const port = Number(process.env.MCP_PORT ?? 3001);
app.listen(port, () =>
  console.log(`x402-mica hosted MCP example on :${port} (network ${config.network})`));
