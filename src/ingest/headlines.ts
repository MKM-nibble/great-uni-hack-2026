import { sql, type Row } from '@/lib/db';
import { claudeJudge, heuristicJudge, type Judgement } from '@/ingest/classify';

// News → signals:
// 1. Fetch each RSS/Atom source and store new headlines.
// 2. Match headlines to price drivers (oil supply, shipping, fares…) by keyword.
// 3. Judge the matches: relevant? prices up or down? how strongly?
// 4. Apply the driver's impact rules to propose a signal per spending
//    category, with a lag and a range. A person makes it live.

interface FeedItem {
  guid: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

/** Minimal RSS 2.0 + Atom parser: enough for news feeds, no dependency. */
export function parseFeed(xml: string): FeedItem[] {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);
  if (items.length) {
    return items.map((b) => {
      const url = tag(b, 'link');
      return {
        guid: tag(b, 'guid') || url,
        title: tag(b, 'title'),
        summary: tag(b, 'description'),
        url,
        publishedAt: tag(b, 'pubDate') || null,
      };
    });
  }
  return [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map(({ 0: b }) => {
    const url = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '';
    return {
      guid: tag(b, 'id') || url,
      title: tag(b, 'title'),
      summary: tag(b, 'summary') || tag(b, 'content'),
      url,
      publishedAt: tag(b, 'published') || tag(b, 'updated') || null,
    };
  });
}

export async function fetchHeadlines() {
  const db = sql();
  const sources = (await db`select id, url from sources where active and kind = 'rss'`) as { id: string; url: string }[];
  let added = 0;
  const errors: string[] = [];
  for (const s of sources) {
    try {
      const res = await fetch(s.url, { headers: { 'user-agent': 'Stagger/0.1 (hackathon prototype)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      for (const item of parseFeed(await res.text()).slice(0, 60)) {
        if (!item.title || !item.guid) continue;
        const published = item.publishedAt && !Number.isNaN(Date.parse(item.publishedAt)) ? new Date(item.publishedAt) : null;
        const rows = await db`
          insert into headlines (source_id, guid, title, summary, url, published_at)
          values (${s.id}, ${item.guid}, ${item.title}, ${item.summary.slice(0, 1000)}, ${item.url}, ${published})
          on conflict (source_id, guid) do nothing
          returning id`;
        added += (rows as Row[]).length;
      }
    } catch (err) {
      errors.push(`${s.id}: ${String(err)}`);
    }
  }
  return { added, errors };
}

export async function processHeadlines() {
  const db = sql();
  const keywords = (await db`select driver_id, pattern from driver_keywords`) as { driver_id: string; pattern: string }[];
  const rules = (await db`
    select r.*, d.label as driver_label
    from impact_rules r join drivers d on d.id = r.driver_id`) as {
    driver_id: string;
    driver_label: string;
    category_id: string;
    pct_low: string;
    pct_high: string;
    lag_days: number;
    duration_days: number;
    rationale: string;
  }[];
  const pending = (await db`
    select h.id, h.title, h.summary, h.url, coalesce(h.published_at, h.fetched_at) as at, s.trust
    from headlines h join sources s on s.id = h.source_id
    where h.processed_at is null
    order by h.id
    limit 500`) as { id: number; title: string; summary: string | null; url: string; at: string; trust: string }[];

  const matchers = keywords.map((k) => ({ driver: k.driver_id, re: new RegExp(k.pattern, 'i') }));
  const status = process.env.AUTO_PUBLISH_SIGNALS === 'true' ? 'live' : 'proposed';

  // Step 1, free: keywords pick out candidate stories and the categories their drivers touch.
  const candidates = pending
    .map((h) => {
      const text = `${h.title}. ${h.summary ?? ''}`;
      const drivers = new Set(matchers.filter((m) => m.re.test(text)).map((m) => m.driver));
      const matched = rules.filter((r) => drivers.has(r.driver_id));
      return { h, text, matched };
    })
    .filter((c) => c.matched.length);

  // Step 2: judge relevance and direction, with Claude when a key is set.
  const allowed = [...new Set(rules.map((r) => r.category_id))];
  let judged: Judgement[];
  let method: 'llm' | 'rule' = 'rule';
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('no key');
    judged = await claudeJudge(
      candidates.map((c) => ({ id: c.h.id, text: c.text, categories: [...new Set(c.matched.map((r) => r.category_id))] })),
      allowed,
    );
    method = 'llm';
  } catch {
    judged = candidates.map((c) => heuristicJudge(c.h.id, c.text, c.matched.map((r) => r.category_id)));
  }
  const byId = new Map(judged.map((j) => [j.id, j]));

  // Step 3: our impact rules set size and timing; the judgement sets sign and strength.
  let proposed = 0;
  for (const { h, matched } of candidates) {
    const j = byId.get(h.id);
    if (!j?.relevant || j.direction === 'none') continue;
    const sign = j.direction === 'down' ? -1 : 1;
    for (const r of matched.filter((r) => j.categories.includes(r.category_id))) {
      const lo = Number(r.pct_low);
      const hi = Number(r.pct_high);
      const [a, b] = j.strength === 'small' ? [lo, (lo + hi) / 2] : j.strength === 'large' ? [(lo + hi) / 2, hi] : [lo, hi];
      const [pctLow, pctHigh] = sign > 0 ? [a, b] : [-b, -a];
      const from = new Date(new Date(h.at).getTime() + r.lag_days * 86_400_000);
      const to = new Date(from.getTime() + r.duration_days * 86_400_000);
      const rows = await db`
        insert into signals (driver_id, headline_id, category_id, title, pct_low, pct_high, effective_from,
                             effective_to, confidence, method, status, explanation, source_url)
        values (${r.driver_id}, ${h.id}, ${r.category_id}, ${h.title}, ${pctLow}, ${pctHigh},
                ${from.toISOString().slice(0, 10)}, ${to.toISOString().slice(0, 10)},
                ${h.trust === 'official' ? 'likely' : 'signal'}, ${method}, ${status},
                ${`${j.reason} ${r.driver_label}: ${r.rationale.toLowerCase()}.`}, ${h.url})
        on conflict do nothing
        returning id`;
      proposed += (rows as Row[]).length;
    }
  }
  const ids = pending.map((h) => h.id);
  if (ids.length) await db`update headlines set processed_at = now() where id = any(${ids})`;
  return { processed: pending.length, candidates: candidates.length, proposed, method };
}
