import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import type { MCPToolCallback, PaymentWrappedHandler } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { makeFacilitatorClient } from "./config.js";
import { openDb, logTransaction } from "./db.js";
import { buildAuditRow } from "./audit.js";

export interface X402McpOptions {
  price: string; // "$0.01"
  asset: string; // "USDC" — audit label + MiCA check
  network: `${string}:${string}`; // CAIP-2
  payTo: string;
  dbPath: string;
  description?: string;
}

/**
 * Add an x402 paywall + MiCA compliance audit logging to any MCP tool handler, in one line.
 * Reuses the shared `buildAuditRow` + `logTransaction`; `@x402/mcp` handles the payment protocol.
 */
export function withPayment<A extends Record<string, unknown>>(
  handler: PaymentWrappedHandler<A>,
  options: X402McpOptions,
): MCPToolCallback<A> {
  // buildPaymentRequirements is async, so build the wrapper once, lazily, and memoize it.
  let ready: Promise<MCPToolCallback<A>> | null = null;

  const init = async (): Promise<MCPToolCallback<A>> => {
    const server = new x402ResourceServer(makeFacilitatorClient(options.network)).register(
      options.network,
      new ExactEvmScheme(),
    );
    // Fetch the facilitator's supported schemes/networks before verify/settle can work.
    await server.initialize();
    const db = openDb(options.dbPath);
    const accepts = await server.buildPaymentRequirements({
      scheme: "exact",
      network: options.network,
      payTo: options.payTo,
      price: options.price,
      extra: { name: "USDC", version: "2" },
    });

    return createPaymentWrapper(server, {
      accepts,
      resource: { description: options.description },
      hooks: {
        // Fires after a successful settlement — log the compliance audit row.
        onAfterSettlement: ({ settlement }) => {
          const row = buildAuditRow(settlement, { asset: options.asset, amount: options.price });
          if (row) logTransaction(db, row);
        },
      },
    })(handler);
  };

  return async (args, extra) => {
    ready ??= init();
    return (await ready)(args, extra);
  };
}
