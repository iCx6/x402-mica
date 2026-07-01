import "dotenv/config";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "@coinbase/x402";

type Network = `${string}:${string}`; // CAIP-2, matches x402's Network type
const BASE_MAINNET = "eip155:8453";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  network: (process.env.X402_NETWORK ?? "eip155:84532") as Network, // default: Base Sepolia
  payTo: required("PAY_TO"),
  price: process.env.PRICE ?? "$0.01",
  asset: "USDC", // Phase 1 only accepts USDC on Base
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "./audit.db",
  auditApiKey: process.env.AUDIT_API_KEY, // optional; unset -> /audit returns 503
};

// Testnet -> open x402.org facilitator (no keys). Mainnet -> Coinbase CDP hosted
// facilitator, which reads CDP_API_KEY_ID/_SECRET from env; fail fast if missing.
export function makeFacilitatorClient(network: string): HTTPFacilitatorClient {
  if (network === BASE_MAINNET) {
    required("CDP_API_KEY_ID");
    required("CDP_API_KEY_SECRET");
    return new HTTPFacilitatorClient(facilitator);
  }
  const url = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";
  return new HTTPFacilitatorClient({ url });
}
