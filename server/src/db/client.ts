import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '../config/env.js';
import * as schema from './schema/index.js';

let sql: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getSql(connectionString?: string) {
  if (!sql) {
    const url = connectionString ?? getEnv().DATABASE_URL;
    sql = postgres(url, { max: 10 });
  }
  return sql;
}

export function getDb(connectionString?: string) {
  if (!db) {
    db = drizzle(getSql(connectionString), { schema });
  }
  return db;
}

export async function checkDatabaseConnectivity(): Promise<boolean> {
  try {
    const client = getSql();
    await client`select 1 as ok`;
    return true;
  } catch {
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
    db = null;
  }
}

export type AppDb = ReturnType<typeof getDb>;
