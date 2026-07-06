import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { wrapMCPClientWithPayment, x402Client } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Dev-only: full paid MCP tool call against the hosted (HTTP) example server.
const raw = process.env.CDP_WALLET_KEY;
if (!raw) throw new Error("Missing CDP_WALLET_KEY in .env");
const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
const account = privateKeyToAccount(key);

const url = new URL(process.env.MCP_URL ?? "http://localhost:3001/mcp");
const transport = new StreamableHTTPClientTransport(url);

const paymentClient = new x402Client().register("eip155:*", new ExactEvmScheme(account));
const mcp = wrapMCPClientWithPayment(new Client({ name: "x402-mica-http-client", version: "0.0.1" }), paymentClient, {
  autoPayment: true,
});

await mcp.connect(transport);
console.log(`Paying from ${account.address} -> tool "echo" at ${url}`);
const res: any = await mcp.callTool("echo", { text: "hello over hosted MCP" });
console.log("result:", JSON.stringify(res?.content ?? res).slice(0, 200));
await mcp.close();
