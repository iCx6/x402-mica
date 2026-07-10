# x402-mica

EU-facing payment middleware for AI-agent and API micropayments on the
[x402 protocol](https://docs.cdp.coinbase.com/x402/welcome) (HTTP 402 + stablecoins),
with built-in MiCA-compliance flagging and audit-trail generation.

**Landing page:** https://icx6.github.io/x402-mica/

- **Non-custodial** — funds flow payer-wallet → your wallet via x402; this library never touches them.
- **MiCA audit trail** — every paid request logs timestamp, asset, amount, payer address,
  a `mica_compliant` flag, and the facilitator's transaction reference to SQLite.
- **USDC on Base** by default; **EURC** (Circle's euro stablecoin) as an opt-in
  `asset: "EURC"` — both MiCA-compliant via Circle's France EMI license.

## See it live

[**eu-tools-mcp**](https://github.com/iCx6/eu-tools-mcp) is a production deployment
built on this package: paid MCP tools for AI agents (EU VAT validation + official ECB
FX rates), settling real USDC on Base mainnet.

- Endpoint: `https://eu-tools-mcp.fly.dev/mcp` (MCP Streamable HTTP)
- [Live public audit dashboard](https://eu-tools-mcp.fly.dev/audit?key=demo-c43d89b159ec2227) —
  every paid call with its `mica_compliant` flag and on-chain settlement tx,
  CSV/JSON export included. That dashboard *is* this package's output.

## Install

```sh
npm install x402-mica
```

## Express middleware

```ts
import express from "express";
import { x402Middleware } from "x402-mica";

const app = express();

app.use(
  x402Middleware({
    route: "GET /demo",
    price: "$0.01",
    asset: "USDC",
    network: "eip155:84532", // Base Sepolia; "eip155:8453" for Base mainnet
    payTo: "0xYourWallet",
    dbPath: "./audit.db",
  }),
);

app.get("/demo", (_req, res) => res.json({ ok: true }));
app.listen(3000);
```

Unpaid requests get an HTTP 402 challenge; paid requests pass through and are audit-logged.

`asset` is optional and defaults to `"USDC"` (price as a dollar string, `"$0.01"`).
To settle in euro instead, set `asset: "EURC"` and give `price` as a plain euro
decimal (`"0.01"` — a leading `€` is fine). Same for `withPayment` below.

```ts
x402Middleware({ route: "GET /report", price: "0.05", asset: "EURC",
  network: "eip155:8453", payTo: "0xYourWallet", dbPath: "./audit.db" })
```

## MCP tool decorator

Put any MCP tool behind an x402 paywall + audit logging in one line:

```ts
import { withPayment } from "x402-mica";

server.tool("echo", "Echo back text. Requires $0.01 USDC.",
  { text: z.string() },
  withPayment(async ({ text }) => ({ content: [{ type: "text", text }] }), {
    price: "$0.01",
    asset: "USDC",
    network: "eip155:84532",
    payTo: "0xYourWallet",
    dbPath: "./audit.db",
  }),
);
```

The decorator is transport-agnostic — the payment flow travels inside the MCP
protocol, so the same tool works on a hosted Streamable HTTP server exactly as
it does over stdio. See `src/mcp-http-example.ts` in the repo for a complete
Express + `StreamableHTTPServerTransport` recipe (`npm run mcp-http`, then
`npm run mcp-http-client` to pay it).

## Audit dashboard

```ts
import { auditDashboard } from "x402-mica";

app.get("/audit", auditDashboard({ dbPath: "./audit.db", apiKey: process.env.AUDIT_API_KEY }));
```

Read-only, key-gated (`x-api-key` header or `?key=`), paginated HTML table over the audit log.

The same route also exports the log: `?format=csv` or `?format=json`, optionally
filtered with inclusive `?from=YYYY-MM-DD&to=YYYY-MM-DD`. The HTML view has the
same date filter and download links. Example — Q2 as CSV:

```sh
curl -H "x-api-key: $AUDIT_API_KEY" -OJ \
  "http://localhost:3000/audit?format=csv&from=2026-04-01&to=2026-06-30"
```

## Networks & facilitators

| Network | Facilitator | Keys needed |
|---|---|---|
| Base Sepolia `eip155:84532` (default) | x402.org (open) | none |
| Base mainnet `eip155:8453` | Coinbase CDP hosted | `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` env vars |

Payment verification/settlement is always delegated to the facilitator — no hand-rolled
signature checking, and no custody of funds.

## Development

Demo server, paying test clients, and a full walkthrough: see
[DEVELOPMENT.md](./DEVELOPMENT.md) (repo only, not shipped with the package).

## License

MIT
