import assert from "node:assert/strict";
import { parseSettlement, isMicaCompliant, buildAuditRow } from "./audit.js";

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

console.log("audit.test.ts: all assertions passed");
