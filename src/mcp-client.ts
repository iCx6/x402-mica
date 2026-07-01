import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { wrapMCPClientWithPayment, x402Client } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Dev-only: drive a full paid MCP tool call against the example server (mirrors client.ts).
const raw = process.env.CDP_WALLET_KEY;
if (!raw) throw new Error("Missing CDP_WALLET_KEY in .env");
const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
const account = privateKeyToAccount(key);

// The spawned server loads its own .env via config.ts (`import "dotenv/config"`).
const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/mcp-example.js"],
});

const paymentClient = new x402Client().register("eip155:*", new ExactEvmScheme(account));
const mcp = wrapMCPClientWithPayment(new Client({ name: "x402-mica-client", version: "0.0.1" }), paymentClient, {
  autoPayment: true,
});

await mcp.connect(transport);
console.log(`Paying from ${account.address} -> tool "echo"`);
const res: any = await mcp.callTool("echo", { text: "hello from MCP" });
console.log("result:", JSON.stringify(res?.content ?? res).slice(0, 200));
await mcp.close();
