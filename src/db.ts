import { DatabaseSync } from "node:sqlite";
import type { AuditRow } from "./audit.js";

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    network TEXT NOT NULL,
    asset TEXT NOT NULL,
    amount TEXT NOT NULL,
    payer TEXT NOT NULL,
    tx_ref TEXT NOT NULL,
    mica_compliant INTEGER NOT NULL
  )`);
  return db;
}

const insert = `INSERT INTO transactions (ts, network, asset, amount, payer, tx_ref, mica_compliant)
  VALUES (@ts, @network, @asset, @amount, @payer, @txRef, @mica)`;

export function logTransaction(db: DatabaseSync, row: AuditRow): void {
  db.prepare(insert).run({
    ts: row.ts,
    network: row.network,
    asset: row.asset,
    amount: row.amount,
    payer: row.payer,
    txRef: row.txRef,
    mica: row.micaCompliant ? 1 : 0,
  });
}
