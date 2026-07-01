import express from "express";
import { config } from "./config.js";
import { x402Middleware } from "./x402-middleware.js";
import { auditDashboard } from "./dashboard.js";

const app = express();

app.use(
  x402Middleware({
    route: "GET /demo",
    price: config.price,
    asset: config.asset,
    network: config.network,
    payTo: config.payTo,
    dbPath: config.dbPath,
    description: "x402-mica demo endpoint",
  }),
);

app.get("/demo", (_req, res) => res.json({ status: "paid", message: "hello" }));

app.get("/audit", auditDashboard({ dbPath: config.dbPath, apiKey: config.auditApiKey }));

app.listen(config.port, () => {
  console.log(`x402-mica listening on :${config.port} (network ${config.network})`);
});
