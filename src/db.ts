import Database from "better-sqlite3";
import type { AuditRow } from "./audit.js";

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
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

export function logTransaction(db: Database.Database, row: AuditRow): void {
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
