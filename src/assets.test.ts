import assert from "node:assert/strict";
import { resolvePrice, eip712Extra } from "./assets.js";

// USDC passes through untouched (mainnet-proven money-string path)
assert.equal(resolvePrice("USDC", "eip155:8453", "$0.01"), "$0.01");

// EURC on Base mainnet -> AssetAmount with verified address, base units, EIP-712 domain
assert.deepEqual(resolvePrice("EURC", "eip155:8453", "0.01"), {
  asset: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
  amount: "10000",
  extra: { name: "EURC", version: "2" },
});

// leading € tolerated; Base Sepolia uses the Sepolia address
assert.equal(
  (resolvePrice("EURC", "eip155:84532", "€1") as { asset: string }).asset,
  "0x808456652fdb597867f38412077A9182bf77359F",
);
assert.equal((resolvePrice("EURC", "eip155:84532", "€1") as { amount: string }).amount, "1000000");

// unsupported asset -> throw
assert.throws(() => resolvePrice("USDT", "eip155:8453", "0.01"), /Unsupported asset/);
// EURC on a non-Base network -> throw
assert.throws(() => resolvePrice("EURC", "eip155:1", "0.01"), /not configured/);
// malformed EURC prices -> throw
assert.throws(() => resolvePrice("EURC", "eip155:8453", "$0.01"), /Invalid EURC price/);
assert.throws(() => resolvePrice("EURC", "eip155:8453", "abc"), /Invalid EURC price/);
assert.throws(() => resolvePrice("EURC", "eip155:8453", "0.1234567"), /Invalid EURC price/);

// EIP-712 domain for the MCP path — USDC's domain name differs per network
// (verified on-chain 2026-07-09: mainnet "USD Coin", Sepolia "USDC"; a wrong
// name makes every mainnet MCP payment fail signature verification).
assert.deepEqual(eip712Extra("EURC", "eip155:8453"), { name: "EURC", version: "2" });
assert.deepEqual(eip712Extra("USDC", "eip155:8453"), { name: "USD Coin", version: "2" });
assert.deepEqual(eip712Extra("USDC", "eip155:84532"), { name: "USDC", version: "2" });

console.log("assets.test.ts: all assertions passed");
