// Demo/app-only env config — NOT part of the published library (which must be
// importable without dotenv side effects or a PAY_TO env var).
import "dotenv/config";
import { required } from "./facilitator.js";

type Network = `${string}:${string}`; // CAIP-2, matches x402's Network type

export const config = {
  network: (process.env.X402_NETWORK ?? "eip155:84532") as Network, // default: Base Sepolia
  payTo: required("PAY_TO"),
  price: process.env.PRICE ?? "$0.01",
  asset: process.env.X402_ASSET ?? "USDC", // "USDC" or "EURC"
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "./audit.db",
  auditApiKey: process.env.AUDIT_API_KEY, // optional; unset -> /audit returns 503
};
