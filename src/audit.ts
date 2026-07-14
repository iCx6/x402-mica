// Compliance audit capture — the actual product. Turns an x402 settlement into
// the audit row we persist. Pure/testable: no I/O, no network.

export interface AuditRow {
  ts: string;
  network: string;
  asset: string;
  amount: string;
  payer: string;
  txRef: string;
  micaCompliant: boolean;
}

/** Issuer's authorization status under MiCA's e-money-token regime. Asset-level,
 * not network-level: MiCA authorization is issuer/token-scoped, not chain-scoped.
 * Describes the issuer's status only — NOT the legality of a given payment
 * (Art. 88 binds CASPs offering to the public, not wallet-to-wallet transfers). */
export type AssetClassification =
  | "emt_authorized"    // EMT from a MiCA-authorized issuer (USDC, EURC — Circle EMI license)
  | "emt_unauthorized"  // fiat-pegged (EMT by economic structure), issuer holds no MiCA authorization
  | "unregulated"       // not a fiat-pegged EMT; outside the MiCA EMT regime
  | "unknown";          // asset we hold no classification for

// Only what we can defend; anything unlisted classifies as "unknown", never guessed.
const CLASSIFICATIONS: Record<string, AssetClassification> = {
  USDC: "emt_authorized",   // Circle France EMI license
  EURC: "emt_authorized",   // Circle France EMI license
  USDT: "emt_unauthorized", // EMT by structure; issuer never obtained MiCA authorization
};

export function classifyAsset(asset: string): AssetClassification {
  return CLASSIFICATIONS[asset.toUpperCase()] ?? "unknown";
}

// MiCA rule: a payment is MiCA-compliant iff it settled in an issuer-authorized
// EMT on a Base network. Computed, not hard-coded, so a future non-compliant
// asset/network logs `false` instead of silently claiming compliance.
const BASE_NETWORKS = new Set(["eip155:8453", "eip155:84532"]); // mainnet, sepolia

export function isMicaCompliant(network: string, asset: string): boolean {
  return BASE_NETWORKS.has(network) && classifyAsset(asset) === "emt_authorized";
}

function decodeB64Json(header: string): any {
  return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
}

/** An x402 settlement result (subset of SettleResponse) used by both transports. */
export interface Settlement {
  success?: boolean;
  network: string;
  payer?: string;
  transaction?: string;
}

/**
 * Build an audit row from a settlement object. Shared by the HTTP and MCP paths.
 * @returns the row, or `null` if settlement did not succeed (nothing to log).
 */
export function buildAuditRow(
  settle: Settlement,
  opts: { asset: string; amount: string },
): AuditRow | null {
  if (!settle || settle.success === false) return null;
  return {
    ts: new Date().toISOString(),
    network: settle.network,
    asset: opts.asset,
    amount: opts.amount,
    payer: settle.payer ?? "",
    txRef: settle.transaction ?? "",
    micaCompliant: isMicaCompliant(settle.network, opts.asset),
  };
}

/**
 * HTTP path: decode x402 settlement headers into an audit row.
 * @returns the row, or `null` if settlement did not succeed.
 */
export function parseSettlement(params: {
  paymentResponseHeader: string; // X-PAYMENT-RESPONSE (base64 SettleResponse)
  paymentHeader?: string;        // X-PAYMENT (base64 PaymentPayload) — payer fallback
  asset: string;                 // configured settlement asset label, e.g. "USDC"
  amount: string;                // configured price, e.g. "$0.01"
}): AuditRow | null {
  const settle: Settlement = decodeB64Json(params.paymentResponseHeader);
  if (!settle?.success) return null;

  if (!settle.payer && params.paymentHeader) {
    try {
      settle.payer = decodeB64Json(params.paymentHeader)?.payload?.authorization?.from ?? "";
    } catch {
      // malformed X-PAYMENT — leave payer blank rather than drop the audit row
    }
  }

  return buildAuditRow(settle, { asset: params.asset, amount: params.amount });
}
