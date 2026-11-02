import { fetchMedia } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

// Streams a customer's photo / video / voice note through the app (Twilio media needs our login).
export async function GET(_req: Request, ctx: { params: Promise<{ messageSid: string; mediaSid: string }> }) {
  const { messageSid, mediaSid } = await ctx.params;
  if (!/^(MM|SM)[0-9a-f]{32}$/i.test(messageSid) || !/^ME[0-9a-f]{32}$/i.test(mediaSid)) {
    return new Response('Bad request', { status: 400 });
  }
  const res = await fetchMedia(messageSid, mediaSid);
  if (!res.ok || !res.body) return new Response('Media not available', { status: 404 });
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
