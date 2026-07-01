import "dotenv/config";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const raw = process.env.CDP_WALLET_KEY;
if (!raw) throw new Error("Missing CDP_WALLET_KEY in .env (payer wallet private key)");
const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;

const url = `http://localhost:${process.env.PORT ?? 3000}/demo`;

const signer = privateKeyToAccount(key);
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(signer));

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

console.log(`Paying from ${signer.address} -> GET ${url}`);
const res = await fetchWithPayment(url, { method: "GET" });
console.log("HTTP", res.status, await res.json());
