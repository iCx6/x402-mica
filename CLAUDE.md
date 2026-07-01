# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

All four roadmap phases built (Node + TypeScript ESM, source in `src/`):
- **Phase 1** — `GET /demo` gated by x402, compliance audit logging to SQLite.
- **Phase 2** — paywall + logging extracted into a reusable `x402Middleware(options)` factory.
- **Phase 3** — read-only, key-gated, paginated audit dashboard at `GET /audit`.
- **Phase 4** — `withPayment(handler, options)` MCP tool decorator: any MCP tool gets an x402
  paywall + audit logging in one line (via `@x402/mcp`), reusing the shared audit core.

## Project: x402-mica

EU-facing payment middleware for AI-agent and API micropayments on the x402 protocol
(HTTP 402 + stablecoins), with built-in MiCA-compliance routing and audit-trail
generation.

**The product is the software layer** — payment-gating + compliance metadata + audit
log — sold to developers who want to monetize APIs/MCP tools. Payment-gating itself is
solved by x402; the `mica_compliant` flag and audit trail are the differentiator.

## Non-negotiable constraints

- **Non-custodial.** Funds flow directly payer-wallet → seller-wallet via x402. We
  never hold customer funds. This is a deliberate compliance decision (avoids needing
  an EMI/PI license) — do not suggest custodial architectures "for simplicity."
- **Use the Coinbase CDP hosted facilitator** for payment verification. Do not
  hand-roll signature/settlement verification.
- **USDC on Base is the default settlement asset** (MiCA-compliant via Circle's France
  EMI license). USDT is out of scope as a default — not MiCA-authorized, delisted from
  EU-regulated venues.
- **Every paid request must log:** timestamp, asset, amount, payer address,
  `mica_compliant: boolean`, and the facilitator's transaction reference.

## Scope discipline

Ship one phase at a time; resist scope creep. Roadmap:
1. ✅ `GET /demo` gated by x402 at $0.01 USDC on Base, logged to SQLite.
2. ✅ Extract paywall + logging into a reusable `x402Middleware()` factory (in-repo;
   not yet a separately published npm package — that's the later half of this step).
3. ✅ Read-only audit dashboard over the log.
4. ✅ Wrap as an MCP tool decorator (`withPayment`) — the long-term differentiated bet.

## Tech stack

Node.js + TypeScript · Express · official x402 Express middleware · Coinbase CDP hosted
facilitator · SQLite for the audit log (swap to Postgres only when the Phase 2
dashboard needs real querying).

x402 docs: https://docs.cdp.coinbase.com/x402/welcome

## Commands

- `npm install` — install deps
- `npm run dev` — run with hot reload (`tsx watch src/index.ts`)
- `npm run build` — typecheck + compile to `dist/`
- `npm start` — run compiled `dist/index.js`
- `npm run client` — pay `/demo` from a wallet (`CDP_WALLET_KEY`), driving a full paid loop
- `npm run mcp` — the example MCP server (stdio) with a paywalled `echo` tool
- `npm run mcp-client` — pay the MCP `echo` tool from a wallet, full paid MCP loop
- `npm test` — pure-logic self-checks (`audit.test.ts` + `dashboard.test.ts`, no network)

Copy `.env.example` → `.env` and set `PAY_TO` before running. Default network is Base
Sepolia (no keys, no real money); set `X402_NETWORK=eip155:8453` + `CDP_API_KEY_ID`/
`CDP_API_KEY_SECRET` for Base mainnet. Set `AUDIT_API_KEY` to enable `GET /audit`.

## Layout / how it fits together

- `src/index.ts` — thin app wiring only (no business logic): mounts `x402Middleware` on
  `/demo`, the `/demo` response, and the `/audit` dashboard route.
- `src/x402-middleware.ts` — `x402Middleware(options)` factory: wires x402 `paymentMiddleware`
  + facilitator, and attaches the `res.on("finish")` audit hook (fires only on paid requests).
- `src/dashboard.ts` — `auditDashboard(options)` for `GET /audit`: read-only SQLite connection,
  key check (`x-api-key` header or `?key=`), server-rendered HTML table, LIMIT/OFFSET paging.
- `src/config.ts` — env → typed config; `makeFacilitatorClient(network)` picks testnet x402.org
  vs mainnet CDP.
- `src/mcp.ts` — `withPayment(handler, options)`: wraps any MCP tool handler with an x402 paywall
  (via `@x402/mcp` `createPaymentWrapper`) + audit logging on its `onAfterSettlement` hook.
- `src/mcp-example.ts` — example `McpServer` (stdio) with a `withPayment`-gated `echo` tool.
- `src/audit.ts` — **the product**: `buildAuditRow()` (shared HTTP+MCP core) → audit row +
  `mica_compliant`; `parseSettlement()` decodes HTTP settlement headers then delegates to it.
  Pure functions, unit-tested.
- `src/db.ts` — SQLite (`better-sqlite3`) schema + `openDb()` / `logTransaction()`.
- `src/client.ts` / `src/mcp-client.ts` — dev-only x402 payers driving the full paid loop against
  `/demo` (HTTP) and the `echo` tool (MCP).

x402 header names (v2, no `X-` prefix): challenge `PAYMENT-REQUIRED`, request
`PAYMENT-SIGNATURE`, settlement response `PAYMENT-RESPONSE`. The `X-` forms are v1 aliases.
Verify actual package exports before changing imports — the `@x402/*` API is still churning.
