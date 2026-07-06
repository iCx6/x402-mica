# EURC Support (v0.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a route (HTTP middleware or MCP decorator) settle in EURC instead of USDC via a new `asset: "EURC"` option, with the MiCA audit trail unchanged.

**Architecture:** New `src/assets.ts` turns `(asset, network, price)` into what x402 needs — USDC passes through as today's mainnet-proven money string, EURC becomes an explicit `AssetAmount` (contract address + base units + EIP-712 domain). Both transports (`x402-middleware.ts`, `mcp.ts`) call it; `isMicaCompliant` gains EURC.

**Tech Stack:** Node + TypeScript ESM, `@x402/*` 2.17, `convertToTokenAmount` from `@x402/core/utils` (already installed — verified: `convertToTokenAmount("0.01", 6)` → `"10000"`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-06-eurc-support-design.md`.
- USDC price path (`"$0.01"` money string) must remain byte-for-byte untouched — it is verified on Base mainnet.
- EURC data **verified on-chain 2026-07-06** (name()/version()/decimals() via public RPC):
  - Base mainnet `eip155:8453`: `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42`, name `EURC`, version `2`, decimals 6
  - Base Sepolia `eip155:84532`: `0x808456652fdb597867f38412077A9182bf77359F`, name `EURC`, version `2`, decimals 6
- Unknown asset / unknown network / malformed price → throw at construction time, never at request time.
- Do not export new helpers from `src/lib.ts` — `resolvePrice`/`eip712Extra` are internal.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Asset registry (`src/assets.ts`)

**Files:**
- Create: `src/assets.ts`
- Create: `src/assets.test.ts`
- Modify: `package.json` (test script)

**Interfaces:**
- Produces: `resolvePrice(asset: string, network: string, price: string): string | AssetAmount` and `eip712Extra(asset: string): { name: string; version: string }` — consumed by Tasks 3 and 4. `AssetAmount = { asset: string; amount: string; extra?: Record<string, unknown> }` (structural match for x402's `Price`).

- [ ] **Step 1: Write the failing test** — create `src/assets.test.ts`:

```ts
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

// EIP-712 domain for the MCP path
assert.deepEqual(eip712Extra("EURC"), { name: "EURC", version: "2" });
assert.deepEqual(eip712Extra("USDC"), { name: "USDC", version: "2" });

console.log("assets.test.ts: all assertions passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/assets.test.ts`
Expected: FAIL — `Cannot find module './assets.js'`

- [ ] **Step 3: Write minimal implementation** — create `src/assets.ts`:

```ts
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
```

- [ ] **Step 4: Add to test script** — in `package.json`, change:

```json
"test": "tsx src/audit.test.ts && tsx src/dashboard.test.ts && tsx src/assets.test.ts"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all three test files print "all assertions passed"

- [ ] **Step 6: Commit**

```bash
git add src/assets.ts src/assets.test.ts package.json
git commit -m "Add EURC asset registry with on-chain-verified constants"
```

---

### Task 2: MiCA compliance for EURC (`src/audit.ts`)

**Files:**
- Modify: `src/audit.ts:14-22` (the `isMicaCompliant` block)
- Test: `src/audit.test.ts` (append)

**Interfaces:**
- Produces: `isMicaCompliant(network, asset)` returns `true` for EURC on Base networks. Signature unchanged.

- [ ] **Step 1: Write the failing tests** — append to `src/audit.test.ts` just above the final `console.log` line:

```ts
// EURC is MiCA-compliant on Base (Circle France EMI license), not elsewhere
assert.equal(isMicaCompliant("eip155:8453", "EURC"), true);
assert.equal(isMicaCompliant("eip155:84532", "eurc"), true);
assert.equal(isMicaCompliant("eip155:1", "EURC"), false);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx src/audit.test.ts`
Expected: FAIL on the first new assertion (EURC currently returns false)

- [ ] **Step 3: Implement** — in `src/audit.ts`, replace:

```ts
const BASE_NETWORKS = new Set(["eip155:8453", "eip155:84532"]); // mainnet, sepolia

export function isMicaCompliant(network: string, asset: string): boolean {
  return BASE_NETWORKS.has(network) && asset.toUpperCase() === "USDC";
}
```

with:

```ts
const BASE_NETWORKS = new Set(["eip155:8453", "eip155:84532"]); // mainnet, sepolia
// USDC and EURC are both issued under Circle's France EMI license.
const MICA_ASSETS = new Set(["USDC", "EURC"]);

export function isMicaCompliant(network: string, asset: string): boolean {
  return BASE_NETWORKS.has(network) && MICA_ASSETS.has(asset.toUpperCase());
}
```

Also update the comment above it: change "a payment is MiCA-compliant iff it settled in USDC on a Base network" to "…settled in USDC or EURC on a Base network".

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/audit.ts src/audit.test.ts
git commit -m "Treat EURC on Base as MiCA-compliant"
```

---

### Task 3: HTTP middleware wiring (`src/x402-middleware.ts`)

**Files:**
- Modify: `src/x402-middleware.ts`

**Interfaces:**
- Consumes: `resolvePrice` from Task 1.
- Produces: `X402Options.asset` becomes optional (`"USDC"` default). Existing callers unaffected.

- [ ] **Step 1: Implement.** Add import:

```ts
import { resolvePrice } from "./assets.js";
```

Change the `asset` option (line 12):

```ts
  asset?: string; // "USDC" (default) or "EURC" — selects the settlement asset; also the audit label
```

At the top of `x402Middleware`'s body (after `const db = …`), add:

```ts
  const asset = (options.asset ?? "USDC").toUpperCase();
  const price = resolvePrice(asset, options.network, options.price); // throws here, not at request time
```

In the `accepts` entry, replace `price: options.price` with `price`. In the `parseSettlement` call, replace `asset: options.asset` with `asset`.

- [ ] **Step 2: Typecheck + tests**

Run: `npm run build && npm test`
Expected: clean build, tests pass (structural typing: our `AssetAmount` matches x402's `Price`). If tsc rejects the price type, cast at the single call site: `price: price as Parameters<typeof paymentMiddleware>[0][string]["accepts"][number]["price"]` is NOT acceptable — instead import x402's own type: `import type { Price } from "@x402/core/types";` and type `resolvePrice`'s return as `Price` in `assets.ts` (keep the local `AssetAmount` for the object it builds).

- [ ] **Step 3: Commit**

```bash
git add src/x402-middleware.ts
git commit -m "Wire EURC settlement into x402Middleware via asset option"
```

---

### Task 4: MCP decorator wiring (`src/mcp.ts`)

**Files:**
- Modify: `src/mcp.ts`

**Interfaces:**
- Consumes: `resolvePrice`, `eip712Extra` from Task 1.
- Produces: `X402McpOptions.asset` optional, `"USDC"` default.

- [ ] **Step 1: Implement.** Add import:

```ts
import { resolvePrice, eip712Extra } from "./assets.js";
```

Change the `asset` option (line 10):

```ts
  asset?: string; // "USDC" (default) or "EURC" — selects the settlement asset; also the audit label
```

In `init()`, before `buildPaymentRequirements`, add `const asset = (options.asset ?? "USDC").toUpperCase();` (place it next to the existing `const db` line), then replace the `buildPaymentRequirements` call's fields:

```ts
    const accepts = await server.buildPaymentRequirements({
      scheme: "exact",
      network: options.network,
      payTo: options.payTo,
      price: resolvePrice(asset, options.network, options.price),
      extra: eip712Extra(asset),
    });
```

In the `onAfterSettlement` hook, replace `asset: options.asset` with `asset`.

`resolvePrice` throws inside the lazy `init()` — first tool call, not construction; acceptable for MCP (the decorator is built before any server exists). Note this with a one-line comment: `// resolvePrice throws on bad config at first call — MCP wrapper is lazy by design`.

- [ ] **Step 2: Typecheck + tests**

Run: `npm run build && npm test`
Expected: clean. Same `Price` type fallback rule as Task 3 Step 2.

- [ ] **Step 3: Commit**

```bash
git add src/mcp.ts
git commit -m "Wire EURC settlement into withPayment MCP decorator"
```

---

### Task 5: Demo knob + docs + version

**Files:**
- Modify: `src/config.ts:12` — `asset: "USDC",` → `asset: process.env.X402_ASSET ?? "USDC",`
- Modify: `.env.example` — after the `PRICE=$0.01` line add:

```
# Settlement asset: USDC (default) or EURC. For EURC use a plain euro PRICE, e.g. PRICE=0.01
X402_ASSET=USDC
```

- Modify: `README.md` — in the `x402Middleware` options table/list add the `asset` option (`"USDC"` default | `"EURC"`; for EURC, `price` is a plain euro decimal like `"0.01"`), and one EURC example snippet:

```ts
x402Middleware({ route: "GET /report", price: "0.05", asset: "EURC",
  network: "eip155:8453", payTo: process.env.PAY_TO!, dbPath: "./audit.db" })
```

- Modify: `CLAUDE.md` — in Layout section, add one line for `src/assets.ts`: "EURC/USDC settlement-asset registry (`resolvePrice`, on-chain-verified constants); USDC stays on the money-string path." Update the "USDC on Base is the default settlement asset" constraint bullet with "(EURC also supported as an opt-in `asset: "EURC"`, same Circle EMI umbrella)".
- Modify: `package.json` — `"version": "0.1.0"` → `"version": "0.2.0"` (never published, so first publish ships as 0.2.0).

- [ ] **Step 1: Make all five edits above**
- [ ] **Step 2: Verify**

Run: `npm run build && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/config.ts .env.example README.md CLAUDE.md package.json
git commit -m "Expose asset knob in demo config, document EURC, bump to 0.2.0"
```

---

### Task 6: Integration — full paid EURC loop on Base Sepolia

**Files:**
- Modify: `.env` (X402_ASSET=EURC, PRICE=0.01 — revert after)
- Contingency modify: `src/facilitator.ts` (only if step 3 fails, see below)

- [ ] **Step 1: Fund the payer with testnet EURC.** USER ACTION: claim 1 EURC on Base Sepolia to the payer address `0x91ED138f25aA0EeE7BfacBC2EeA69f5930Fa10a1` at https://portal.cdp.coinbase.com/products/faucet (Network: Base Sepolia, Token: EURC). Free, 10 claims/day.

- [ ] **Step 2: Point the demo at EURC.** In `.env`: ensure `X402_NETWORK` is unset or `eip155:84532`, set `X402_ASSET=EURC`, set `PRICE=0.01`.

- [ ] **Step 3: Run the loop.**

Run (terminal 1): `npm run dev`
Run (terminal 2): `npm run client`
Expected: HTTP 200 from `/demo`, client prints the settlement, and the new audit row shows `asset=EURC`, `mica_compliant=1`, a real tx hash.

Verify the row:
```bash
node --input-type=module -e "import('node:sqlite').then(({DatabaseSync}) => { const db = new DatabaseSync('./audit.db', {readOnly:true}); console.log(db.prepare('SELECT * FROM transactions ORDER BY id DESC LIMIT 1').get()); })"
```

- [ ] **Step 4 (contingency, only if the x402.org facilitator rejects EURC).** The open x402.org facilitator may only support USDC. If verify/settle fails with an unsupported-asset error, prefer the CDP facilitator on testnet when keys exist — in `src/facilitator.ts` replace the body of `makeFacilitatorClient` with:

```ts
export function makeFacilitatorClient(network: string): HTTPFacilitatorClient {
  if (network === BASE_MAINNET) {
    required("CDP_API_KEY_ID");
    required("CDP_API_KEY_SECRET");
    return new HTTPFacilitatorClient(facilitator);
  }
  // Testnet: CDP facilitator when keys are configured (supports all ERC-20 incl.
  // EURC on Base Sepolia); otherwise the open x402.org facilitator (USDC only).
  if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
    return new HTTPFacilitatorClient(facilitator);
  }
  const url = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";
  return new HTTPFacilitatorClient({ url });
}
```

Then rerun step 3. Commit the facilitator change separately: `git commit -m "Prefer CDP facilitator on testnet when CDP keys are configured"`.

- [ ] **Step 5: Confirm the tx on-chain.** Paste the settlement tx hash into https://sepolia.basescan.org/ — it must be an EURC `transferWithAuthorization` from the payer to `PAY_TO`.

- [ ] **Step 6: Restore `.env`** (`X402_ASSET` back to USDC or removed, `PRICE=$0.01`). Nothing to commit unless step 4 fired.

- [ ] **Step 7: Verify the on-chain check still matches the tarball.**

Run: `npm pack --dry-run`
Expected: `dist/assets.js` + `dist/assets.d.ts` appear in the tarball listing.

---

## Self-review (done at write time)

- Spec coverage: registry ✔ (T1), middleware ✔ (T3), MCP ✔ (T4), isMicaCompliant ✔ (T2), construction-time errors ✔ (T1/T3; MCP lazy-init caveat noted in T4), unit tests ✔ (T1/T2), Sepolia integration ✔ (T6). Out-of-scope items untouched.
- No placeholders; all code shown in full.
- Type consistency: `resolvePrice(asset, network, price)` used identically in T3/T4; `eip712Extra` only in T4.
