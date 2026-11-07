import Link from 'next/link';
import { PERSONA_META, PERSONA_ORDER } from '@/data/personas';
import { StartDialog } from '@/components/StartDialog';

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-2xl bg-nw-purple text-white">
        <div className="space-y-5 p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-white/70">Stagger by NatWest</p>
          <h1 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
            See when money gets tight, before it does.
          </h1>
          <div className="flex flex-wrap gap-3 pt-2">
            <StartDialog className="rounded-full bg-white px-6 py-3 font-semibold text-nw-purple hover:bg-nw-lilac">
              Get my forecast
            </StartDialog>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">View demos</h2>
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
