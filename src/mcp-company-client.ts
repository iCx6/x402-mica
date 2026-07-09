import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { wrapMCPClientWithPayment, x402Client } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// Dev-only: full paid verify_hungarian_company call (mirrors mcp-client.ts).
// Usage: npm run build && npm run mcp-company-client [-- <adószám>]
const raw = process.env.CDP_WALLET_KEY;
if (!raw) throw new Error("Missing CDP_WALLET_KEY in .env");
const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
const account = privateKeyToAccount(key);

const taxNumber = process.argv[2] ?? "10484878"; // default: Richter Gedeon Nyrt.

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/mcp-company-lookup.js"],
});

const paymentClient = new x402Client().register("eip155:*", new ExactEvmScheme(account));
const mcp = wrapMCPClientWithPayment(new Client({ name: "x402-mica-client", version: "0.0.1" }), paymentClient, {
  autoPayment: true,
});

await mcp.connect(transport);
console.log(`Paying from ${account.address} -> tool "verify_hungarian_company" (${taxNumber})`);
const res: any = await mcp.callTool("verify_hungarian_company", { taxNumber });
console.log("result:", JSON.stringify(res?.content ?? res).slice(0, 400));
await mcp.close();
