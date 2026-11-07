import { claudeMatchJob, hasApiKey } from '@/lib/claude';
import { matchJob } from '@/data/jobs';
import { spendGuard } from '@/lib/spend-guard';

export async function POST(request: Request) {
  const { job } = (await request.json()) as { job: string };
  const rule = matchJob(job);
  if (rule) return Response.json({ template: rule, tidyJob: job, source: 'rules' });
  if (!hasApiKey() || !spendGuard()) return Response.json({ template: 'steady', tidyJob: job, source: 'default' });

  try {
    return Response.json({ ...(await claudeMatchJob(job)), source: 'claude' });
  } catch (err) {
    console.error('job match failed', err);
    return Response.json({ template: 'steady', tidyJob: job, source: 'default' });
  }
}
