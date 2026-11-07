import { notFound } from 'next/navigation';
import { Dashboard } from '@/components/Dashboard';
import { PERSONA_ORDER } from '@/data/personas';
import type { PersonaId } from '@/lib/types';

const IDS = [...PERSONA_ORDER, 'me'] as const;

export function generateStaticParams() {
  return IDS.map((id) => ({ id }));
}

export default async function ForecastPage({ params }: PageProps<'/forecast/[id]'>) {
  const { id } = await params;
  if (!(IDS as readonly string[]).includes(id)) notFound();
  return <Dashboard id={id as PersonaId | 'me'} />;
}
