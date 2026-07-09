# x402-mica

## 1. Indítás

```bash
npm install
cp .env.example .env      # állítsd be a PAY_TO címet
npm run dev
```

A szerver a `http://localhost:3000/demo` végponton figyel (alapértelmezés: Base Sepolia testnet).

## 2. Funded testnet wallet (Base Sepolia)

A fizetéshez testnet **USDC** kell a payer walletben Base Sepolia hálózaton:

- USDC faucet (Circle): https://faucet.circle.com → válaszd a **Base Sepolia** hálózatot
- (opcionális) Base Sepolia ETH gázra: https://portal.cdp.coinbase.com/products/faucet

Az `exact` séma EIP-3009 gasless transferrel dolgozik, így a payernek jellemzően
csak USDC-re van szüksége — a facilitator küldi be a tranzakciót.

## 3. x402 kliens telepítése és a /demo hívása

```bash
npm install @x402/fetch @x402/evm viem
```

`client.mjs`:

```js
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY); // 0x... funded testnet wallet
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const res = await fetchWithPayment("http://localhost:3000/demo", { method: "GET" });
console.log(res.status, await res.json());
```

Futtatás:

```bash
EVM_PRIVATE_KEY=0x... node client.mjs
```

## 4. Mit vársz

1. A kliens első hívása **402 Payment Required** választ kap (payment challenge).
2. A `wrapFetchWithPayment` automatikusan aláírja és beküldi a fizetést, majd újrahívja a végpontot.
3. Sikeres settlement után a válasz: `{"status":"paid","message":"hello"}`.
4. A szerver egy **audit sort** ír a SQLite-ba (`./audit.db`, `transactions` tábla):
   timestamp, network, asset, amount, payer cím, `mica_compliant`, facilitator tx hash.

Ellenőrzés:

```bash
sqlite3 audit.db "SELECT * FROM transactions;"
```

## 5. Audit dashboard (read-only)

Állíts be egy `AUDIT_API_KEY`-t a `.env`-ben, majd nyisd meg a `GET /audit` oldalt.
A kulcs `x-api-key` headerben vagy `?key=` query paraméterben adható (utóbbi a böngészős
lapozáshoz kell):

```bash
curl -H "x-api-key: $AUDIT_API_KEY" http://localhost:3000/audit
# vagy böngészőben:
# http://localhost:3000/audit?key=<AUDIT_API_KEY>
```

Szerver-oldalon renderelt HTML tábla az `audit.db` sorai fölött: ts, network, asset, amount,
payer (rövidítve), tx_ref (kattintható Basescan link), mica_compliant (✓/✗). 50 soronként lapoz
(`?page=N`). Kulcs nélkül 401; ha nincs `AUDIT_API_KEY` beállítva, a route 503.

## 6. MCP tool paywall (x402 + compliance logging egy sorban)

Bármely MCP tool egy sorban x402-paywall + audit logging mögé tehető a `withPayment`
decoratorral (`src/mcp.ts`). Példa szerver egy `echo` toollal: `src/mcp-example.ts`.

```ts
server.tool("echo", "Echo back text. Requires $0.01 USDC.",
  { text: z.string() },
  withPayment(async ({ text }) => ({ content: [{ type: "text", text }] }),
    { price: config.price, asset: config.asset, network: config.network,
      payTo: config.payTo, dbPath: config.dbPath }));
```

Indítás és fizetős hívás (a kliens a `CDP_WALLET_KEY`-jel fizet, mint a HTTP kliensnél):

```bash
npm run mcp          # a példa MCP szerver (stdio transport)
npm run mcp-client   # fizető MCP kliens: egy paid "echo" hívás
```

Mit vársz: fizetés nélküli tool hívás **x402 payment-required** választ ad (a tool nem fut le);
sikeres fizetés után a tool lefut, és egy **audit sor** kerül az `audit.db`-be (ugyanaz a
`buildAuditRow` + `logTransaction`, amit a HTTP út is használ) — az `onAfterSettlement` hookon át.

## 7. Saját MCP tool: cégjegyzék lookup

Az első valódi (nem demo) fizetős tool: `verify_hungarian_company`
(`src/mcp-company-lookup.ts` + `src/company-lookup.ts`). Magyar adószám alapján
visszaadja a hivatalos cégnevet, székhelycímet és az áfa-érvényességet a
hivatalos EU **VIES** REST API-ból ($0.02 USDC / lekérdezés).

```bash
npm run mcp-company                        # a cég-lookup MCP szerver (stdio transport)
npm run build && npm run mcp-company-client  # fizető kliens: egy paid lekérdezés (Richter)
npm run mcp-company-client -- 10537914       # tetszőleges adószámmal
```

Kutatási konklúzió: **nincs ingyenes hivatalos magyar cégkereső API** — a
hivatalos gépi hozzáférés (OCCSZ XML) szerződéses és fizetős, ezért a forrás a
VIES (`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/HU/vat/{adószám}`),
ami ingyenes és hivatalos, de szűkebb adatkört ad.

Korlátok:
- csak adószám alapján keres (cégnév-keresés nincs), az első 8 számjegyet használja;
- nem ad cégjegyzékszámot, képviselőket, cégstátuszt;
- **áfa-csoportos tagok (pl. nagybankok) `INVALID`-ot adnak**, pedig működő cégek — a
  tool válasza ezt jelzi;
- sikertelen VIES-hívásnál (timeout, `MS_UNAVAILABLE`, …) a handler hibát dob, így a
  fizetés **cancel**-lel zárul, settlement és levonás nélkül. Az érvénytelen adószám
  (`INVALID`) viszont valódi KYB-válasz, az fizetős.

Bővítési út, ha teljes cégkivonat kell: fizetős `cegadatapi.hu` (~16e Ft/hó / 1000
lekérés) vagy hivatalos OCCSZ-szerződés (cegszolgalat@mkifk.hu).
