import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://u1p_finance:changeme@localhost:5432/u1p_finance";

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: connectionString.includes("railway") ? { rejectUnauthorized: false } : undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(text: string, params?: unknown[]): Promise<any[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryOne(text: string, params?: unknown[]): Promise<any | null> {
  const rows = await query(text, params);
  return rows[0] || null;
}
