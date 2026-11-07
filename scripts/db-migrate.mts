// Applies db/migrations/*.sql in order, once each. Run: pnpm db:migrate
import { readdirSync, readFileSync } from 'node:fs';
import { Pool } from '@neondatabase/serverless';

// Migrations use the direct (unpooled) connection.
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });

await pool.query(`create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
)`);
const done = new Set((await pool.query('select name from schema_migrations')).rows.map((r) => r.name));

for (const file of readdirSync('db/migrations').filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(file)) continue;
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(readFileSync(`db/migrations/${file}`, 'utf8'));
    await client.query('insert into schema_migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log(`applied ${file}`);
  } catch (err) {
    await client.query('rollback');
    console.error(`failed ${file}`);
    throw err;
  } finally {
    client.release();
  }
}
console.log('migrations up to date');
await pool.end();
