# EURC support (v0.2) — design

Date: 2026-07-06 · Status: approved

## Goal

Let a route (HTTP middleware or MCP decorator) settle in EURC — Circle's euro
stablecoin, a MiCA e-money token — instead of USDC. One asset per route; the
`asset` option selects it. Strengthens the product's EU story: pay in euro,
with a MiCA audit trail.

## Facts verified against CDP docs (2026-07-06)

- CDP facilitator supports EURC via EIP-3009 (gasless, same mechanism as USDC)
  on Base mainnet and Base Sepolia.
- CDP faucet dispenses 1 EURC per claim (10/day) on Base Sepolia → the full
  paid loop is testable for free on testnet.
- `@x402` price type is `Price = Money | AssetAmount` where
  `AssetAmount = { asset: string; amount: string; extra?: Record<string, unknown> }`
  — non-USDC assets are passed as an `AssetAmount`.

## API change

```ts
x402Middleware({ route: "GET /demo", price: "0.01", asset: "EURC", ... })
withPayment(handler, { price: "0.01", asset: "EURC", ... })
```

- `asset` was audit-label-only; it now also drives payment: `"USDC"` (default,
  behavior unchanged) or `"EURC"`.
- For EURC, `price` is a plain decimal string in euro (leading `€` tolerated).

## Design

1. **New `src/assets.ts`** — registry of known EIP-3009 tokens: EURC contract
   address, decimals (6), EIP-712 domain (name/version), for Base mainnet
   (`eip155:8453`) and Base Sepolia (`eip155:84532`). Addresses and domain
   values MUST be verified on-chain during implementation (`name()` /
   `version()` via RPC) — lesson learned from the USDC v2_2 signature bug.
   Exports a helper that turns (asset, network, price) into an x402
   `AssetAmount`.
2. **`src/x402-middleware.ts`** — USDC keeps today's mainnet-proven
   `price: "$0.01"` Money-string path untouched. EURC branches to the
   `AssetAmount` built from the registry.
3. **`src/mcp.ts`** — same branch for the MCP decorator.
4. **`src/audit.ts`** — `isMicaCompliant`: EURC on Base networks is compliant
   (Circle France EMI license). One line.
5. Audit row unchanged in shape; `asset: "EURC"` label.

## Error handling

- Unknown asset/network combination in the registry → throw at construction
  time (fail fast, before any request is served).
- Malformed price string → throw at construction time.

## Testing

- Unit (no network): euro-string → base-units conversion (incl. rejection of
  malformed input), `isMicaCompliant("eip155:8453", "EURC") === true`,
  registry lookup errors.
- Integration: full paid loop on Base Sepolia with faucet EURC via the CDP
  facilitator (server + `npm run client` against an EURC-gated route).

## Out of scope (deliberate)

- Arbitrary custom tokens (Permit2 path) — add when a user asks.
- Multiple accepted assets on one route — audit row cannot yet attribute the
  settled asset reliably; revisit if demanded.
- EURC mainnet test — costs real money; mechanism is identical to the
  mainnet-verified USDC path.
