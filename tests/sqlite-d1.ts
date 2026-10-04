import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import type { D1Like, D1PreparedLike, D1Value } from "../worker/auth/types";

export type Value = string | number | null | Uint8Array;
export interface Sqlite {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...values: Value[]): unknown;
    all(...values: Value[]): unknown[];
    run(...values: Value[]): { changes: number };
  };
  close(): void;
}
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => Sqlite;
};

/** Real SQLite; batch metadata belongs to this shim, not production D1 types. */
export function sqliteD1(migrations: string[]) {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of migrations) {
    db.exec(readFileSync(new URL(`../db/migrations/${file}`, import.meta.url), "utf8"));
  }
  const statements = new WeakMap<D1PreparedLike, { query: string; values: Value[] }>();
  const binding: D1Like = {
    prepare(query) {
      const metadata = { query, values: [] as Value[] };
      const statement: D1PreparedLike = {
        bind(...values: D1Value[]) {
          metadata.values = values.map((v) => v instanceof ArrayBuffer ? new Uint8Array(v) : v);
          return this;
        },
        async first<T>() { return (db.prepare(query).get(...metadata.values) ?? null) as T | null; },
        async all<T>() { return { results: db.prepare(query).all(...metadata.values) as T[] }; },
        async run() { return { success: true, meta: { changes: Number(db.prepare(query).run(...metadata.values).changes) } }; },
      };
      statements.set(statement, metadata);
      return statement;
    },
    async batch(batch) {
      db.exec("BEGIN");
      try {
        const results = batch.map((statement) => {
          const metadata = statements.get(statement);
          if (!metadata) throw new Error("Statement was not prepared by this SQLite binding");
          return { success: true, meta: { changes: Number(db.prepare(metadata.query).run(...metadata.values).changes) } };
        });
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { db, binding };
}
