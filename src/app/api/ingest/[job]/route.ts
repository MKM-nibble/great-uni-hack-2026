import { hasDb, logged } from '@/lib/db';
import { fetchHeadlines, processHeadlines } from '@/ingest/headlines';
import { buildWeatherNormals, fetchWeatherForecast } from '@/ingest/weather';

// Called by Vercel Cron (see vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`. Locally:
//   curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/ingest/headlines

const JOBS = {
  headlines: async () => {
    const fetched = await fetchHeadlines();
    const processed = await processHeadlines();
    return { items: fetched.added, ...fetched, ...processed };
  },
  weather: () => fetchWeatherForecast(),
  'weather-normals': () => buildWeatherNormals(),
} as const;

export async function GET(request: Request, { params }: RouteContext<'/api/ingest/[job]'>) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }
  if (!hasDb()) return Response.json({ error: 'no database' }, { status: 503 });

  const { job } = await params;
  if (!(job in JOBS)) return Response.json({ error: `unknown job ${job}` }, { status: 404 });
  try {
    return Response.json(await logged(job, JOBS[job as keyof typeof JOBS]));
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
