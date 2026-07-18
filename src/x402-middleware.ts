import type { RequestHandler } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { makeFacilitatorClient } from "./facilitator.js";
import { openDb, tryLogTransaction } from "./db.js";
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
      // "finish" never fires when the client aborts mid-response ("close" always
      // does) — and the payment settles BEFORE the buffered response is flushed,
      // so an abort after settlement must still produce an audit row. Listen on
      // both; `logged` + the tx_ref unique index guard against a double write.
      // Residual gap: an abort while the settle RPC is still in flight fires
      // "close" before the settlement header exists — that payment is only
      // recoverable from the payTo wallet's on-chain history.
      let logged = false;
      const audit = () => {
        // A throw in a res-event listener is an uncaught exception that kills the
        // process — and the payment has already settled by now, so never let
        // audit logging take the server down.
        try {
          // Server writes settlement to "PAYMENT-RESPONSE"; "X-PAYMENT-RESPONSE" is the v1 alias.
          const settleHeader = res.getHeader("PAYMENT-RESPONSE") ?? res.getHeader("X-PAYMENT-RESPONSE");
          if (logged || typeof settleHeader !== "string") return;
          logged = true;
          tryLogTransaction(db, parseSettlement({
            paymentResponseHeader: settleHeader,
            // v2 sends PAYMENT-SIGNATURE; X-PAYMENT is the v1 alias. Payer fallback only.
            paymentHeader: req.header("PAYMENT-SIGNATURE") ?? req.header("X-PAYMENT") ?? undefined,
            asset,
            amount: options.price,
          }));
        } catch (err) {
          console.error("x402-mica: settlement audit failed (payment already settled):", err);
        }
      };
      res.on("finish", audit);
      res.on("close", audit);
      next();
    });
  };
}
