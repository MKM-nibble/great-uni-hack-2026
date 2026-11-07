import { hasDb, sql } from '@/lib/db';

// Review queue for proposed signals. Protected by ADMIN_TOKEN, sent as
// `Authorization: Bearer <token>` from the /admin page.

function authorised(request: Request) {
  const token = process.env.ADMIN_TOKEN;
  return Boolean(token) && request.headers.get('authorization') === `Bearer ${token}`;
}

export async function GET(request: Request) {
  if (!authorised(request)) return Response.json({ error: 'unauthorised' }, { status: 401 });
  if (!hasDb()) return Response.json({ error: 'no database' }, { status: 503 });
  const db = sql();
  const [signals, runs, spend] = await Promise.all([
    db`select s.id, s.category_id, s.title, s.pct_low, s.pct_high, s.effective_from, s.effective_to,
              s.confidence, s.method, s.status, s.explanation, s.source_url, h.source_id, h.published_at
       from signals s left join headlines h on h.id = s.headline_id
       where s.status in ('proposed', 'live')
       order by s.status = 'proposed' desc, s.created_at desc
       limit 200`,
    db`select job, started_at, ok, items, error from ingest_runs order by id desc limit 10`,
    db`select coalesce(sum(cost_usd), 0) as usd, count(*) as calls from llm_usage`,
  ]);
  return Response.json({ signals, runs, spend: spend[0] });
}

export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ error: 'unauthorised' }, { status: 401 });
  const { id, status } = (await request.json()) as { id: number; status: 'live' | 'rejected' | 'proposed' };
  if (!['live', 'rejected', 'proposed'].includes(status)) return Response.json({ error: 'bad status' }, { status: 400 });
  await sql()`update signals set status = ${status}, reviewed_at = now() where id = ${id}`;
  return Response.json({ ok: true });
}
