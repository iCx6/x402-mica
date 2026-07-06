import type { RequestHandler } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { makeFacilitatorClient } from "./facilitator.js";
import { openDb, logTransaction } from "./db.js";
import { parseSettlement } from "./audit.js";
import { resolvePrice } from "./assets.js";

export interface X402Options {
  route: string; // e.g. "GET /demo" — paymentMiddleware route key to gate
  price: string; // "$0.01" for USDC; plain euro decimal like "0.01" for EURC
  asset?: string; // "USDC" (default) or "EURC" — selects the settlement asset; also the audit label
  network: `${string}:${string}`; // CAIP-2
  payTo: string;
  dbPath: string;
  description?: string;
  facilitatorClient?: HTTPFacilitatorClient; // defaults to makeFacilitatorClient(network)
}

/**
 * Reusable x402 paywall + MiCA-compliance audit logging as a single Express middleware.
 * Gates `options.route` behind payment and logs a compliance audit row on each paid request.
 */
export function x402Middleware(options: X402Options): RequestHandler {
  const db = openDb(options.dbPath);

  const asset = (options.asset ?? "USDC").toUpperCase();
  const price = resolvePrice(asset, options.network, options.price); // throws here, not at request time

  const facilitatorClient = options.facilitatorClient ?? makeFacilitatorClient(options.network);
  const server = new x402ResourceServer(facilitatorClient).register(
    options.network,
    new ExactEvmScheme(),
  );

  const pay = paymentMiddleware(
    {
      [options.route]: {
        accepts: [
          { scheme: "exact", price, network: options.network, payTo: options.payTo },
        ],
        description: options.description,
        mimeType: "application/json",
      },
    },
    server,
  );

  return (req, res, next) => {
    // pay() invokes this callback only on a verified + settled payment; on an unpaid
    // request it writes the 402 itself and never calls back. So the audit hook is
    // attached only to paid requests.
    pay(req, res, () => {
      res.on("finish", () => {
        // Server writes settlement to "PAYMENT-RESPONSE"; "X-PAYMENT-RESPONSE" is the v1 alias.
        const settleHeader = res.getHeader("PAYMENT-RESPONSE") ?? res.getHeader("X-PAYMENT-RESPONSE");
        if (typeof settleHeader !== "string") return;
        const row = parseSettlement({
          paymentResponseHeader: settleHeader,
          // v2 sends PAYMENT-SIGNATURE; X-PAYMENT is the v1 alias. Payer fallback only.
          paymentHeader: req.header("PAYMENT-SIGNATURE") ?? req.header("X-PAYMENT") ?? undefined,
          asset,
          amount: options.price,
        });
        if (row) logTransaction(db, row);
      });
      next();
    });
  };
}
