import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Server code only (route handlers, scripts). Uses Neon's HTTP driver with
// the pooled connection string, which suits short serverless requests.

export const hasDb = () => Boolean(process.env.DATABASE_URL);

// Rows as plain objects (not arrays, not full results).
let client: NeonQueryFunction<false, false> | null = null;

export function sql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return (client ??= neon(process.env.DATABASE_URL));
}

export type Row = Record<string, unknown>;

/** Run a job and record it in ingest_runs, so failures are visible. */
export async function logged<T extends { items: number }>(job: string, run: () => Promise<T>): Promise<T> {
  const db = sql();
  const [{ id }] = (await db`insert into ingest_runs (job) values (${job}) returning id`) as { id: number }[];
  try {
    const result = await run();
    await db`update ingest_runs set finished_at = now(), ok = true, items = ${result.items} where id = ${id}`;
    return result;
  } catch (err) {
    await db`update ingest_runs set finished_at = now(), ok = false, error = ${String(err).slice(0, 2000)} where id = ${id}`;
    throw err;
  }
}
