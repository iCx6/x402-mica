import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "@coinbase/x402";

const BASE_MAINNET = "eip155:8453";

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

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
