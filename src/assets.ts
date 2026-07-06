// Known EIP-3009 settlement assets beyond USDC. USDC stays on the x402 money-string
// path ("$0.01"), which the scheme's built-in parser resolves per network; every other
// asset here is materialized as an explicit AssetAmount.
// EURC addresses + EIP-712 domain verified on-chain 2026-07-06 (name()/version()).
import { convertToTokenAmount } from "@x402/core/utils";

// Structural match for x402's Price/AssetAmount — declared locally because the
// @x402 type exports are still churning (see CLAUDE.md).
export type AssetAmount = { asset: string; amount: string; extra?: Record<string, unknown> };

const EURC_DOMAIN = { name: "EURC", version: "2" };
const EURC_DECIMALS = 6;
const EURC_ADDRESSES: Record<string, string> = {
  "eip155:8453": "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", // Base mainnet
  "eip155:84532": "0x808456652fdb597867f38412077A9182bf77359F", // Base Sepolia
};

const EURC_PRICE_RE = /^\d+(\.\d{1,6})?$/; // plain decimal, max 6 fraction digits

/** USDC passes through as an x402 money string; EURC becomes an explicit AssetAmount. Throws on anything else. */
export function resolvePrice(asset: string, network: string, price: string): string | AssetAmount {
  const sym = asset.toUpperCase();
  if (sym === "USDC") return price;
  if (sym !== "EURC") throw new Error(`Unsupported asset "${asset}" (supported: USDC, EURC)`);
  const address = EURC_ADDRESSES[network];
  if (!address) {
    throw new Error(`EURC is not configured for network ${network} (supported: ${Object.keys(EURC_ADDRESSES).join(", ")})`);
  }
  const decimal = price.replace(/^€/, "");
  if (!EURC_PRICE_RE.test(decimal)) {
    throw new Error(`Invalid EURC price "${price}" — expected a plain euro decimal like "0.01" or "€0.01"`);
  }
  return { asset: address, amount: convertToTokenAmount(decimal, EURC_DECIMALS), extra: { ...EURC_DOMAIN } };
}

/** EIP-712 domain for buildPaymentRequirements' `extra` (MCP path). */
export function eip712Extra(asset: string): { name: string; version: string } {
  return asset.toUpperCase() === "EURC" ? { ...EURC_DOMAIN } : { name: "USDC", version: "2" };
}
