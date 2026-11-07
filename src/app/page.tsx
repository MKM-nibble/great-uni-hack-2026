import Link from 'next/link';
import { PERSONA_META, PERSONA_ORDER } from '@/data/personas';
import { StartDialog } from '@/components/StartDialog';
import { Container, PageHero } from '@/components/ui';

export default function Home() {
  return (
    <>
      <PageHero
        eyebrow="Banking with NatWest"
        title="See when money gets tight, before it does"
        lead="Stagger looks weeks ahead at your bills, pay and prices, and warns you before a money storm hits."
      >
        <StartDialog className="rounded-full bg-white px-7 py-3 font-semibold text-nw-purple hover:bg-nw-lilac">
          Get my forecast
        </StartDialog>
      </PageHero>

      <section className="py-12 sm:py-16">
        <Container>
          <h2 className="text-3xl sm:text-[40px]">View demos</h2>
          <p className="mt-3 max-w-2xl">Pick someone to see how Stagger would forecast their next six months.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PERSONA_ORDER.map((id) => {
              const p = PERSONA_META[id];
              return (
                <Link
                  key={id}
                  href={`/forecast/${id}`}
                  className="group flex flex-col rounded-lg bg-nw-mist p-6 transition hover:bg-nw-lilac"
                >
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-nw-purple font-display text-xl font-extrabold text-white">
                    {p.name[0]}
                  </span>
                  <span className="font-display text-2xl font-extrabold text-nw-purple">
                    {p.name}, {p.age}
                  </span>
                  <span className="mt-2 block text-[15px]">{p.blurb}</span>
                  <span className="mt-3 block text-[15px] font-medium text-nw-amber">⛈ {p.storm}</span>
                  <span className="nw-link mt-auto pt-5 text-[15px]">See {p.name}’s forecast</span>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>
    </>
  );
}
