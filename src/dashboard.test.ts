import assert from "node:assert/strict";
import { short, explorerTxUrl, esc, toCsv, dateBounds, exportFilename } from "./dashboard.js";

// short(): truncate long, pass through short
assert.equal(short("0x1234567890abcdef1234"), "0x1234…1234");
assert.equal(short("0xabcd"), "0xabcd"); // <=12 chars unchanged

// explorerTxUrl(): both Base networks + unknown
assert.equal(explorerTxUrl("eip155:8453", "0xaa"), "https://basescan.org/tx/0xaa");
assert.equal(explorerTxUrl("eip155:84532", "0xbb"), "https://sepolia.basescan.org/tx/0xbb");
assert.equal(explorerTxUrl("eip155:1", "0xcc"), null);

// esc(): escapes HTML-significant chars
assert.equal(esc(`<script>&"'`), "&lt;script&gt;&amp;&quot;&#39;");

// dateBounds: passthrough, end-of-day expansion, full ISO kept, malformed -> null
assert.deepEqual(dateBounds(undefined, undefined), { from: undefined, to: undefined });
assert.deepEqual(dateBounds("2026-04-01", "2026-06-30"),
  { from: "2026-04-01", to: "2026-06-30T23:59:59.999Z" });
assert.equal(dateBounds(undefined, "2026-07-06T05:00:00.000Z")!.to, "2026-07-06T05:00:00.000Z");
assert.equal(dateBounds("junk", undefined), null);
assert.equal(dateBounds(undefined, "06/30/2026"), null);

// toCsv: header, CRLF, RFC 4180 quoting + formula-injection guard on a hostile payer
const csvRows = [{
  ts: "2026-07-06T05:12:33.006Z", network: "eip155:84532", asset: "EURC", amount: "0.01",
  payer: '=HYPERLINK("http://evil")', tx_ref: "0x82df", mica_compliant: 1,
}];
const csv = toCsv(csvRows as never);
assert(csv.startsWith("ts,network,asset,amount,payer,tx_ref,mica_compliant\r\n"));
assert(csv.includes('"\'=HYPERLINK(""http://evil"")"')); // guarded THEN quoted
assert(csv.endsWith(",0x82df,1\r\n"));

// exportFilename
assert.equal(exportFilename("csv", "2026-04-01", "2026-06-30"), "x402-mica-audit-2026-04-01-2026-06-30.csv");
assert.equal(exportFilename("json", undefined, undefined), "x402-mica-audit.json");

console.log("dashboard.test.ts: all assertions passed");
