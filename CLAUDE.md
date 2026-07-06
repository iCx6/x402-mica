# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project: x402-mica

EU-facing payment middleware for AI-agent and API micropayments on the x402 protocol
(HTTP 402 + stablecoins), with built-in MiCA-compliance flagging and audit-trail
generation. **The product is the software layer** — payment-gating + compliance
metadata + audit log — sold to developers who monetize APIs/MCP tools. Payment-gating
itself is solved by x402; the `mica_compliant` flag and audit trail are the differentiator.

## Status (2026-07-06) — all planned features shipped, v0.2.0

- `x402Middleware(options)` Express factory + `withPayment(handler, options)` MCP tool
  decorator, both audit-logged via the shared core.
- EURC opt-in (`asset: "EURC"`) alongside the USDC default.
- Audit dashboard `GET /audit`: HTML view + CSV/JSON export, inclusive date filter.
- Hosted MCP proven: `withPayment` is transport-agnostic (stdio and Streamable HTTP).
- **Live-verified:** Base mainnet USDC loop (2026-07-05, real $0.01, tx on-chain);
  Base Sepolia EURC loop and hosted-MCP USDC loop (2026-07-06). Package `npm pack`-tested.

## TODO

1. **`npm publish`** — BLOCKED: npmjs.com signup OTP emails don't arrive for the user.
   Once unblocked: `npm login` (interactive, user runs it) → `npm publish` (`prepack`
   runs build+test; ships 0.2.0) → `npm view x402-mica` → `git tag v0.2.0` + push tag
   → post-publish smoke test (`npm i x402-mica` in a temp dir, import without `PAY_TO`).
2. **Validation before more code** — README showcase, launch post, first outside users.
   New features are guesses until someone external uses the package.

## Future roadmap (unordered ideas — build only on demand)

- Cloud deploy of the hosted MCP demo (Fly/Render/etc.) — recipe already works on any Node host.
- Stateful MCP sessions (SSE notification stream, session teardown) on the HTTP example.
- Custom ERC-20 assets via Permit2; multiple accepted assets per route.
- Export upgrades: XLSX, streaming for huge logs, non-date filters (asset/payer/network).
- Postgres backend when a real deployment outgrows SQLite.
- x402 Bazaar/discovery extension declarations for paid tools.

## Non-negotiable constraints

- **Non-custodial.** Funds flow payer-wallet → seller-wallet via x402; we never hold
  funds (deliberate: avoids EMI/PI licensing). Do not suggest custodial architectures.
- **Coinbase CDP hosted facilitator** for verification/settlement — never hand-rolled.
- **USDC on Base is the default asset**; EURC is the opt-in alternative (both under
  Circle's France EMI license). USDT is out of scope — not MiCA-authorized.
- **Every paid request logs:** timestamp, asset, amount, payer, `mica_compliant`,
  facilitator tx reference.

## Gotchas (hard-won, verified on-chain)

- CDP facilitator rejects payer == payTo (`self_send_not_allowed`) — no self-payment tests.
- An EIP-7702-delegated wallet (code `0xef0100…`, e.g. Coinbase Smart Wallet upgrade)
  cannot be an x402 payer with a raw key — USDC verifies via ERC-1271 and rejects ECDSA
  sigs. Payer must be a plain EOA.
- Testnet balances are per-network: the payer's mainnet USDC is invisible on Sepolia.
  CDP faucet claims are scriptable via the transitive `@coinbase/cdp-sdk`
  (`CdpClient.evm.requestFaucet`, tokens `usdc`/`eurc`) with the existing CDP keys.
- The `@x402/*` API is still churning — verify actual package exports before changing imports.
- x402 header names (v2, no `X-` prefix): challenge `PAYMENT-REQUIRED`, request
  `PAYMENT-SIGNATURE`, settlement `PAYMENT-RESPONSE`; `X-` forms are v1 aliases.

## Tech stack & commands

Node >=22.13 + TypeScript ESM · Express · `@x402/*` + CDP hosted facilitator ·
SQLite via stdlib `node:sqlite` (no native addon). x402 docs:
https://docs.cdp.coinbase.com/x402/welcome

- `npm run dev` — demo server with hot reload (`/demo` paywall + `/audit` dashboard)
- `npm run build` / `npm start` — typecheck+compile to `dist/`, run compiled
- `npm test` — pure-logic self-checks (audit/dashboard/assets tests, no network)
- `npm run client` — pay `/demo` from a wallet (`CDP_WALLET_KEY`), full paid loop
- `npm run mcp` / `npm run mcp-client` — stdio MCP example (paywalled `echo`) + payer
- `npm run mcp-http` / `npm run mcp-http-client` — hosted (Streamable HTTP, :3001) twin pair

Copy `.env.example` → `.env`, set `PAY_TO`. Defaults: Base Sepolia, USDC. Knobs:
`X402_ASSET=EURC` (with plain euro `PRICE`), `X402_NETWORK=eip155:8453` +
`CDP_API_KEY_ID`/`CDP_API_KEY_SECRET` for mainnet, `AUDIT_API_KEY` to enable `/audit`.

## Layout / how it fits together

- `src/lib.ts` — **public package entry** (`exports` map): re-exports the library API.
  Anything not reachable from it is demo/dev-only and blocked by the exports map.
- `src/index.ts` — thin demo wiring only: `x402Middleware` on `/demo` + `/audit` route.
- `src/x402-middleware.ts` — `x402Middleware(options)`: x402 `paymentMiddleware` +
  facilitator wiring; `res.on("finish")` audit hook fires only on paid requests.
- `src/mcp.ts` — `withPayment(handler, options)`: paywalls any MCP tool handler (via
  `@x402/mcp`) + audit logging on `onAfterSettlement`. Transport-agnostic.
- `src/audit.ts` — **the product**: `buildAuditRow()` (shared HTTP+MCP core) +
  `isMicaCompliant`; `parseSettlement()` decodes HTTP settlement headers. Pure, unit-tested.
- `src/assets.ts` — settlement-asset registry (`resolvePrice`, on-chain-verified EURC
  constants); USDC stays on the money-string path, EURC becomes an explicit `AssetAmount`.
- `src/dashboard.ts` — `auditDashboard(options)`: read-only SQLite, key check (`x-api-key`
  or `?key=`), HTML table + paging, CSV/JSON export (RFC 4180 + formula-injection guard),
  inclusive `?from=`/`?to=` date filter shared by view and export.
- `src/db.ts` — `node:sqlite` schema + `openDb()` / `logTransaction()`.
- `src/facilitator.ts` — `makeFacilitatorClient(network)`: testnet x402.org vs mainnet CDP;
  library-side, no import-time env requirements.
- `src/config.ts` — demo-only env → typed config (dotenv; requires `PAY_TO` at import
  time — must never be imported from library code).
- `src/client.ts`, `src/mcp-client.ts`, `src/mcp-example.ts`, `src/mcp-http-example.ts`,
  `src/mcp-http-client.ts` — dev-only demo servers/payers for the three paid loops
  (HTTP `/demo`, stdio MCP, hosted MCP).
