# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project: x402-mica

EU-facing payment middleware for AI-agent and API micropayments on the x402 protocol
(HTTP 402 + stablecoins), with built-in MiCA-compliance flagging and audit-trail
generation. **The product is the software layer** — payment-gating + compliance
metadata + audit log — sold to developers who monetize APIs/MCP tools. Payment-gating
itself is solved by x402; the `mica_compliant` flag and audit trail are the differentiator.

## Status (2026-07-18) — v0.2.4 on npm (0.2.5 committed, publish pending), landing live, repo public

- 0.2.5 (committed 2026-07-18, NOT yet published): audit-loss fix pair from the
  payment-flow audit. (1) The HTTP audit hook listens on res `"close"` as well as
  `"finish"` (once-flag) — a client abort after settlement used to lose the audit
  row silently: settle happens BEFORE the buffered response flushes, and `"finish"`
  never fires on abort (verified in `@x402/express` dist). Residual gap: an abort
  while the settle RPC is in flight is recoverable only from on-chain history.
  (2) Partial unique index on `tx_ref` (`WHERE tx_ref != ''`) + `INSERT OR IGNORE`
  — a duplicate settlement tx is "already audited", never a second row; a legacy
  db with pre-existing dupes degrades to no-index (console.error) instead of
  crashing `openDb` at startup. New `src/x402-middleware.test.ts` drives the real
  middleware network-free (fake req/res on a non-gated path).
- 0.2.4 (published 2026-07-17): HBAR → "unregulated" in the `classifyAsset()` map —
  first seeded member of the "unregulated" arm (native L1 coin, not a fiat-pegged
  EMT). Map-only change + case-insensitivity test; `isMicaCompliant()` untouched.
  Publish gotchas hit: package-lock.json version had drifted (stuck at 0.2.2, now
  synced), and npm auth had expired — `npm publish` reports that as a misleading
  E404 on PUT (`npm whoami` → 401 is the tell; re-login with bluenami866).
- 0.2.3 (published 2026-07-14): `classifyAsset()` + `AssetClassification` — issuer-
  authorization status behind `mica_compliant` (emt_authorized USDC/EURC,
  emt_unauthorized USDT, unregulated, unknown; asset-level, and explicitly NOT a
  claim about payment legality — MiCA Art. 88 binds CASPs, not wallet-to-wallet).
  Deliberately no db column/migration until non-uniform data exists. Plus:
  `tryLogTransaction` guard — a post-settlement audit-write failure can no longer
  crash the server (greppable `AUDIT_WRITE_FAILED` line carries the full row for
  manual reconstruction), and `PRAGMA busy_timeout = 5000` in `openDb`.
- Landing page fixes (2026-07-14): 402 star-ring centering (CSS specificity),
  demo section corrected Sepolia→mainnet wording, Node ≥ 22.13.
- 0.2.1: `auditDashboard` opens its db lazily (eager open crashed fresh deploys).
- 0.2.2: mainnet USDC EIP-712 domain fix on the MCP path (`"USD Coin"`, not `"USDC"`).
  Both found by dogfooding the eu-tools-mcp deployment; both live-verified on Fly.
- **First production consumer live:** https://eu-tools-mcp.fly.dev (paid MCP tools,
  Base mainnet USDC, real settled txs in its public audit dashboard).
- **Landing page live:** https://icx6.github.io/x402-mica/ (GitHub Pages from
  `docs/index.html`, the "Official Journal" design from `Design/`). Repo made
  public 2026-07-10 (history secret-scanned first; Pages requires public on free plan).

- 0.2.1: `auditDashboard` opens its read-only SQLite connection lazily on first
  request — the eager factory-time open crashed consumers at startup whenever the
  db file didn't exist yet (fresh deploy, `AUDIT_API_KEY` set, no payment logged).
  Found by eu-tools-mcp's task-3 review; reproduced, TDD-fixed, unit-tested.

- `x402Middleware(options)` Express factory + `withPayment(handler, options)` MCP tool
  decorator, both audit-logged via the shared core.
- EURC opt-in (`asset: "EURC"`) alongside the USDC default.
- Audit dashboard `GET /audit`: HTML view + CSV/JSON export, inclusive date filter.
- Hosted MCP proven: `withPayment` is transport-agnostic (stdio and Streamable HTTP).
- **Live-verified:** Base mainnet USDC loop (2026-07-05, real $0.01, tx on-chain);
  Base Sepolia EURC loop and hosted-MCP USDC loop (2026-07-06). Package `npm pack`-tested.
- **Published 2026-07-06:** `x402-mica@0.2.0` live on npmjs.com (maintainer bluenami866),
  `v0.2.0` tag pushed, post-publish smoke test passed (fresh registry install, all 9
  exports load without `PAY_TO`).

## TODO

1. **x402-trust submission — BLOCKED on an eu-tools-mcp ECB parser fix.**
   `GET /eur-fx` paid HTTP route is deployed (Phase 3 verified on mainnet: bare GET
   → correct 402 challenge incl. "USD Coin" domain; all pre-paywall 400s work), but
   the paid loop 502s on dated queries: `parseEcbXml` accepts only single-quoted XML
   attributes — ECB's daily file is single-quoted, the hist-90d file is DOUBLE-quoted,
   and the dated path had never run in production. No money was lost (settlement
   skipped on non-2xx; verified on-chain). Fix awaiting user go-ahead: accept both
   quote styles + a double-quoted fixture test, re-run Phase 3 from step 3, then
   submit `https://eu-tools-mcp.fly.dev/eur-fx` to https://x402.fuchss.app/submit.
2. **Launch post** — Reddit first (r/mcp + r/SideProject), user posts manually;
   drafts in `docs/launch-post-drafts.md` (still uncommitted). Landing + README + live
   demo are all in place to link.
3. **Validation before more code** — first outside users. New features are guesses
   until someone external uses the package.

## Future roadmap (unordered ideas — build only on demand)

- ~~Cloud deploy of the hosted MCP demo~~ — shipped as the separate `eu-tools-mcp`
  project (github.com/iCx6/eu-tools-mcp, live on Fly.io, Base mainnet).
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

- USDC's EIP-712 domain **name** differs per network: Base mainnet = `"USD Coin"`,
  Base Sepolia = `"USDC"` (both version "2"). A Sepolia-passing MCP payment loop can
  still fail on mainnet with a generic `execution reverted` if the domain name is wrong.

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
