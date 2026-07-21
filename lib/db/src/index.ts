import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function createMissingDatabaseProxy() {
  const error = new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );

  const createChain = (): any =>
    new Proxy(function noop() {}, {
      get(_target, prop) {
        if (prop === "then") {
          return (_resolve: unknown, reject: (reason?: unknown) => void) => reject(error);
        }
        return createChain();
      },
      apply() {
        return createChain();
      },
    });

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (_resolve: unknown, reject: (reason?: unknown) => void) => reject(error);
        }
        if (prop === "select" || prop === "insert" || prop === "update" || prop === "delete" || prop === "transaction") {
          return () => createChain();
        }
        return createChain();
      },
    },
  ) as typeof import("drizzle-orm/node-postgres").drizzle extends (...args: any[]) => infer T ? T : any;
}

export const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
export const db = pool ? drizzle(pool, { schema }) : createMissingDatabaseProxy();

export * from "./schema";
