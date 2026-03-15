import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DbType = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbType | null = null;

/**
 * Hent databasetilkoblingen (lazy-initialisert).
 * Bruker postgres.js som fungerer med både lokal PostgreSQL og Neon.
 */
export function getDb(): DbType {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
        return {} as DbType;
      }
      throw new Error(
        "DATABASE_URL er ikke satt. Opprett .env med databasetilkoblingen."
      );
    }
    const client = postgres(url);
    _db = drizzle(client, { schema });
  }
  return _db;
}

/**
 * Convenience export – proxy som delegerer til getDb() ved første bruk.
 * Trygt å importere uten at databasetilkobling opprettes ved import-tid.
 */
export const db = new Proxy({} as DbType, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    if (typeof value === "function") {
      return value.bind(real);
    }
    return value;
  },
});
