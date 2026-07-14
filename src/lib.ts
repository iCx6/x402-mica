// Public package entry point. Everything else in src/ is demo/dev-only and is
// not reachable through the package "exports" map.
export { x402Middleware, type X402Options } from "./x402-middleware.js";
export { auditDashboard, type DashboardOptions } from "./dashboard.js";
export { withPayment, type X402McpOptions } from "./mcp.js";
export {
  buildAuditRow,
  parseSettlement,
  isMicaCompliant,
  classifyAsset,
  type AssetClassification,
  type AuditRow,
  type Settlement,
} from "./audit.js";
export { openDb, logTransaction } from "./db.js";
export { makeFacilitatorClient } from "./facilitator.js";
