import { processDueSubmissionWindows } from '@/features/periods/process-windows';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization');
  if (!secret || header !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await processDueSubmissionWindows();
  return Response.json(result);
}
