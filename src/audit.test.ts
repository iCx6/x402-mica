import assert from "node:assert/strict";
import { parseSettlement, isMicaCompliant, buildAuditRow, classifyAsset } from "./audit.js";

const b64 = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString("base64");

// USDC on Base mainnet -> compliant, payer + txRef read from settlement header
{
  const row = parseSettlement({
    paymentResponseHeader: b64({ success: true, transaction: "0xabc", network: "eip155:8453", payer: "0xPAYER" }),
    asset: "USDC",
    amount: "$0.01",
  });
  assert(row, "expected a row for a successful settlement");
  assert.equal(row.payer, "0xPAYER");
  assert.equal(row.txRef, "0xabc");
  assert.equal(row.network, "eip155:8453");
  assert.equal(row.micaCompliant, true);
}

// settlement omits payer -> fall back to X-PAYMENT authorization.from
{
  const row = parseSettlement({
    paymentResponseHeader: b64({ success: true, transaction: "0xdef", network: "eip155:84532" }),
    paymentHeader: b64({ scheme: "exact", payload: { authorization: { from: "0xFROM" } } }),
    asset: "USDC",
    amount: "$0.01",
  });
  assert.equal(row!.payer, "0xFROM");
  assert.equal(row!.micaCompliant, true);
}

// non-Base network -> not compliant
{
  const row = parseSettlement({
    paymentResponseHeader: b64({ success: true, transaction: "0x1", network: "eip155:1", payer: "0xP" }),
    asset: "USDC",
    amount: "$0.01",
  });
  assert.equal(row!.micaCompliant, false);
}

// non-USDC asset -> not compliant
assert.equal(isMicaCompliant("eip155:8453", "USDT"), false);

// failed settlement -> no row to log
assert.equal(
  parseSettlement({
    paymentResponseHeader: b64({ success: false, transaction: "", network: "eip155:8453" }),
    asset: "USDC",
    amount: "$0.01",
  }),
  null,
);

// buildAuditRow (shared HTTP+MCP core): success -> row, mica true for USDC/Base
{
  const row = buildAuditRow(
    { success: true, network: "eip155:84532", payer: "0xP", transaction: "0xT" },
    { asset: "USDC", amount: "$0.01" },
  );
  assert.equal(row!.payer, "0xP");
  assert.equal(row!.txRef, "0xT");
  assert.equal(row!.micaCompliant, true);
}
// non-Base network -> not compliant
assert.equal(
  buildAuditRow({ success: true, network: "eip155:1", transaction: "0x1" }, { asset: "USDC", amount: "$0.01" })!.micaCompliant,
  false,
);
// failed settlement -> null
assert.equal(
  buildAuditRow({ success: false, network: "eip155:84532", transaction: "" }, { asset: "USDC", amount: "$0.01" }),
  null,
);

// EURC is MiCA-compliant on Base (Circle France EMI license), not elsewhere
assert.equal(isMicaCompliant("eip155:8453", "EURC"), true);
assert.equal(isMicaCompliant("eip155:84532", "eurc"), true);
assert.equal(isMicaCompliant("eip155:1", "EURC"), false);

// classifyAsset: issuer-authorization status, asset-level (chain-agnostic)
assert.equal(classifyAsset("USDC"), "emt_authorized");
assert.equal(classifyAsset("EURC"), "emt_authorized");
assert.equal(classifyAsset("USDT"), "emt_unauthorized");
assert.equal(classifyAsset("usdc"), "emt_authorized"); // case-insensitive
assert.equal(classifyAsset("usdt"), "emt_unauthorized");
assert.equal(classifyAsset("DOGE"), "unknown"); // unlisted asset
assert.equal(classifyAsset(""), "unknown");
// "unregulated" has no seeded members by design — the map only holds what we can
// defend (see audit.ts); the arm exists for consumers/overrides, not for guessing.

// isMicaCompliant must stay behaviourally identical to the pre-classifier
// implementation (BASE_NETWORKS.has(network) && asset in {USDC, EURC}) — this is
// the backwards-compatibility guarantee for the stored mica_compliant column.
{
  const BASE_NETWORKS = new Set(["eip155:8453", "eip155:84532"]);
  const MICA_ASSETS = new Set(["USDC", "EURC"]);
  const legacy = (network: string, asset: string) =>
    BASE_NETWORKS.has(network) && MICA_ASSETS.has(asset.toUpperCase());
  const networks = ["eip155:8453", "eip155:84532", "eip155:1", "solana:mainnet", ""];
  const assets = ["USDC", "usdc", "EURC", "eurc", "USDT", "DOGE", ""];
  for (const n of networks) {
    for (const a of assets) {
      assert.equal(isMicaCompliant(n, a), legacy(n, a), `equivalence broke for (${n}, ${a})`);
    }
  }
}

console.log("audit.test.ts: all assertions passed");
