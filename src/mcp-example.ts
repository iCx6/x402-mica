import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "./config.js";
import { withPayment } from "./mcp.js";

// Example MCP server: one `echo` tool, x402-paywalled + audit-logged in a single wrap.
const server = new McpServer({ name: "x402-mica-example", version: "0.0.1" });

server.tool(
  "echo",
  "Echo back the given text. Requires an x402 payment of $0.01 USDC.",
  { text: z.string().describe("Text to echo back") },
  withPayment(
    async ({ text }: { text: string }) => ({ content: [{ type: "text" as const, text }] }),
    {
      price: config.price,
      asset: config.asset,
      network: config.network,
      payTo: config.payTo,
      dbPath: config.dbPath,
      description: "x402-mica echo tool",
    },
  ),
);

await server.connect(new StdioServerTransport());
