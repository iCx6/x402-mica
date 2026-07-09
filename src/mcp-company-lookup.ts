import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "./config.js";
import { withPayment } from "./mcp.js";
import { verifyHungarianCompany } from "./company-lookup.js";

// First real (non-demo) paid tool: Hungarian company verification behind the x402 paywall.
const server = new McpServer({ name: "x402-mica-company-lookup", version: "0.0.1" });

server.tool(
  "verify_hungarian_company",
  "Verify a Hungarian company by tax number (adószám) via the official EU VIES service. " +
    "Returns registered name, address and VAT validity. Lookup is by tax number only " +
    "(no name search); members of Hungarian VAT groups report as invalid in VIES. " +
    "Requires an x402 payment of $0.02 USDC.",
  { taxNumber: z.string().describe('Hungarian tax number: "12345678", "12345678-1-23" or "HU12345678"') },
  withPayment(
    // verifyHungarianCompany throws on VIES outage/timeout -> payment is cancelled, not settled.
    async ({ taxNumber }: { taxNumber: string }) => ({
      content: [{ type: "text" as const, text: JSON.stringify(await verifyHungarianCompany(taxNumber)) }],
    }),
    {
      price: "$0.02", // real data behind it — higher than the demo echo
      asset: config.asset,
      network: config.network,
      payTo: config.payTo,
      dbPath: config.dbPath,
      description: "Hungarian company verification (VIES)",
    },
  ),
);

await server.connect(new StdioServerTransport());
