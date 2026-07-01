import assert from "node:assert/strict";
import { short, explorerTxUrl, esc } from "./dashboard.js";

// short(): truncate long, pass through short
assert.equal(short("0x1234567890abcdef1234"), "0x1234…1234");
assert.equal(short("0xabcd"), "0xabcd"); // <=12 chars unchanged

// explorerTxUrl(): both Base networks + unknown
assert.equal(explorerTxUrl("eip155:8453", "0xaa"), "https://basescan.org/tx/0xaa");
assert.equal(explorerTxUrl("eip155:84532", "0xbb"), "https://sepolia.basescan.org/tx/0xbb");
assert.equal(explorerTxUrl("eip155:1", "0xcc"), null);

// esc(): escapes HTML-significant chars
assert.equal(esc(`<script>&"'`), "&lt;script&gt;&amp;&quot;&#39;");

console.log("dashboard.test.ts: all assertions passed");
