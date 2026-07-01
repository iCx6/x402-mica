# Project: x402-mica (working name)

## Why this exists
EU-facing payment middleware for AI-agent and API micropayments on the x402
protocol (HTTP 402 + stablecoins), with built-in MiCA-compliance routing and
audit-trail generation. We are NOT a custodian and NOT a stablecoin issuer.
We never hold customer funds — payment flows directly payer-wallet ->
seller-wallet via x402. Our product is the software layer: payment-gating +
compliance metadata + audit log, sold to developers who want to monetize
APIs/MCP tools without becoming payments-compliance experts themselves.

This positioning matters: because we never custody funds, we do not need an
EMI/PI license to operate. Don't suggest custodial architectures "for
simplicity" — non-custodial is a deliberate compliance decision, not a
shortcut.

## Current phase: Phase 0 only
Prove the core loop end-to-end with ONE paywalled demo endpoint. Do not
build the middleware package, dashboard, or MCP wrapper yet — those are
Phase 1-3, see roadmap below. Resist scope creep.

## Tech stack
- Node.js + TypeScript
- Express for the API layer
- x402 payment-gating via the official x402 Express middleware
  (docs: https://docs.cdp.coinbase.com/x402/welcome)
- Coinbase's hosted CDP x402 facilitator for payment verification — do not
  hand-roll signature/settlement verification, use the facilitator
- Settlement asset: USDC on Base by default (MiCA-compliant via Circle's
  France EMI license). USDT is explicitly out of scope as a default — it is
  not MiCA-authorized and is delisted from EU-regulated venues.
- SQLite for the transaction/audit log at this stage (swap to Postgres only
  when the dashboard in Phase 2 needs real querying)

## Compliance logging (the actual product, not an afterthought)
Every paid request must log: timestamp, asset used, amount, payer address,
a `mica_compliant: boolean` flag, and the facilitator's transaction
reference. The payment-gating itself is a solved problem (x402 handles
it) — the compliance flag and audit trail are the differentiator.

## Roadmap
1. NOW: single demo endpoint behind x402, gated at $0.01 USDC on Base,
   verified via the Coinbase facilitator, logs each transaction to SQLite.
2. Extract the paywall + logging into a reusable, installable middleware
   package.
3. Minimal read-only dashboard over the SQLite/Postgres log (the audit
   view a EU business would actually want to show a regulator or partner).
4. Wrap the middleware as an MCP tool decorator so any MCP server can add
   x402 paywalls + compliance logging in one line. This is the
   differentiated long-term bet — x402-MCP integration is still early
   industry-wide, not a solved/crowded space yet.

## Commands
(leave this section for `/init` to fill in once the scaffold exists)

## First task for this Claude Code session
Build Phase 1 of the roadmap ONLY: a single Express + TypeScript endpoint
at `GET /demo`, gated by x402 at $0.01 USDC on Base, verified through
Coinbase's hosted facilitator. On successful payment, return
`{"status": "paid", "message": "hello"}` and log the transaction (asset,
amount, payer, mica_compliant: true) to a local SQLite file. Nothing else.
Use plan mode first and confirm the approach before writing code.
