import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Dashboard } from '@/components/Dashboard';
import { PERSONA_ORDER } from '@/data/personas';
import type { PersonaId } from '@/lib/types';

const IDS = [...PERSONA_ORDER, 'me'] as const;

export function generateStaticParams() {
  return IDS.map((id) => ({ id }));
}

// Reading `params` sits inside Suspense so navigation between customers stays instant.
export default function ForecastPage({ params }: PageProps<'/forecast/[id]'>) {
  return (
    <Suspense fallback={<p className="py-20 text-center text-nw-muted">Loading your forecast…</p>}>
      <ForecastFor params={params} />
    </Suspense>
  );
}

async function ForecastFor({ params }: { params: PageProps<'/forecast/[id]'>['params'] }) {
  const { id } = await params;
  if (!(IDS as readonly string[]).includes(id)) notFound();
  return <Dashboard id={id as PersonaId | 'me'} />;
}
