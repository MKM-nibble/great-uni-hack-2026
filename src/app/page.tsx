import Link from 'next/link';
import { PERSONA_META, PERSONA_ORDER } from '@/data/personas';

const STEPS = [
  { title: 'Tell us how you’re paid', body: 'Salary, shifts, invoices or a student loan. Four quick screens.' },
  { title: 'See the next six months', body: 'Your balance, with the tight spots marked weeks before they happen.' },
  { title: 'Get ahead of it', body: 'A few small, specific steps, and the reason behind every one.' },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-2xl bg-nw-purple text-white">
        <div className="space-y-5 p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-white/70">Stagger by NatWest</p>
          <h1 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
            Your bank balance has a weather forecast.
          </h1>
          <p className="max-w-xl text-lg text-white/85">
            Stagger sees money storms coming weeks ahead, from quiet months to tax bills to Christmas,
            and helps you get through them. Built for everyone, and especially for people whose pay
            isn’t the same every month.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/start"
              className="rounded-full bg-white px-6 py-3 font-semibold text-nw-purple hover:bg-nw-lilac"
            >
              Get my forecast
            </Link>
            <Link
              href="/forecast/sam"
              className="rounded-full border border-white/60 px-6 py-3 font-semibold hover:bg-white/10"
            >
              See a demo
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-nw-line bg-white p-5">
            <p className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-nw-lilac font-bold text-nw-purple">
              {i + 1}
            </p>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-nw-muted">{s.body}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">Meet our demo customers</h2>
        <p className="mb-4 text-nw-muted">Same engine, four very different months ahead.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERSONA_ORDER.map((id) => {
            const p = PERSONA_META[id];
            return (
              <Link
                key={id}
                href={`/forecast/${id}`}
                className="group flex items-center gap-4 rounded-xl border border-nw-line bg-white p-4 hover:border-nw-purple"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-nw-lilac text-lg font-bold text-nw-purple">
                  {p.name[0]}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold group-hover:text-nw-purple">
                    {p.name}, {p.age}
                  </span>
                  <span className="block text-sm text-nw-muted">{p.blurb}</span>
                  <span className="mt-1 block text-sm text-nw-amber">⛈ {p.storm}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
