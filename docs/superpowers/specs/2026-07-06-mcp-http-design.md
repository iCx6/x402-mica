# Hosted MCP (Streamable HTTP) demo — design

Date: 2026-07-06 · Status: approved

## Goal

Prove and document that `withPayment` works for remote (hosted) MCP servers over
the Streamable HTTP transport — the roadmap's long-term bet. The library is
expected to need **no changes**: the x402 MCP payment flow travels inside the
MCP protocol at tool level (`createPaymentWrapper` server-side,
`wrapMCPClientWithPayment` client-side), so the transport is irrelevant.
Deliverable = working example server + paying client + README recipe, verified
with a real paid loop on Base Sepolia.

## Design

1. **`src/mcp-http-example.ts`** (dev-only, mirrors `mcp-example.ts`): Express app
   with a `POST /mcp` endpoint using the MCP SDK's `StreamableHTTPServerTransport`
   in **stateless mode** (`sessionIdGenerator: undefined`, fresh `McpServer` +
   transport per request — the SDK's documented minimal pattern; no session
   bookkeeping). The single `echo` tool is decorated with the same `withPayment`
   call as the stdio example. The decorated handler is created **once at module
   level** so `withPayment`'s memoized lazy init (DB handle, facilitator client,
   payment requirements) is shared across requests. Port `MCP_PORT` env, default
   3001. `express.json()` mounted (handleRequest consumes the parsed body).
2. **`src/mcp-http-client.ts`** (dev-only, mirrors `mcp-client.ts`): same
   `x402Client` + `wrapMCPClientWithPayment` payer, connected via
   `StreamableHTTPClientTransport` to `MCP_URL` env, default
   `http://localhost:3001/mcp`.
3. **npm scripts:** `"mcp-http"` and `"mcp-http-client"`.
4. **Docs:** README MCP section gains a "Hosted (Streamable HTTP)" snippet;
   CLAUDE.md gets the two new layout lines + two new commands.

## Testing / verification

- No new unit tests — no new library logic exists, only demo wiring.
- Verification is the live loop: `npm run mcp-http` + `npm run mcp-http-client`
  on Base Sepolia ($0.01 USDC), expecting the echoed text back and a new audit
  row (asset USDC, network eip155:84532, mica_compliant 1, real tx hash).
- `npm run build && npm test` stay green.

## Out of scope (deliberate)

- Cloud deployment (Fly/Render/etc.) — recipe works on any Node host; ops later.
- Stateful session mode, resumability/SSE streaming extras.
- Auth on the demo endpoint (the payment gate is the point; the demo is local).
- Library changes of any kind — if the loop surfaces a genuine `src/mcp.ts` bug,
  that becomes its own fix with a test, not part of this demo scope.
