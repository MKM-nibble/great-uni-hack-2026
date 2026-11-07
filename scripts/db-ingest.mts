// Run an ingestion job from the terminal (the same code the cron route runs).
//   pnpm db:ingest headlines | weather | weather-normals
import { logged } from '@/lib/db';
import { fetchHeadlines, processHeadlines } from '@/ingest/headlines';
import { buildWeatherNormals, fetchWeatherForecast } from '@/ingest/weather';

const jobs: Record<string, () => Promise<{ items: number }>> = {
  headlines: async () => {
    const fetched = await fetchHeadlines();
    const processed = await processHeadlines();
    return { items: fetched.added, ...fetched, ...processed };
  },
  weather: fetchWeatherForecast,
  'weather-normals': () => buildWeatherNormals(),
};

const job = process.argv[2];
if (!jobs[job]) {
  console.error(`Usage: pnpm db:ingest <${Object.keys(jobs).join(' | ')}>`);
  process.exit(1);
}
console.log(JSON.stringify(await logged(job, jobs[job]), null, 2));
