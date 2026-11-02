import { NextResponse } from 'next/server';
import { listMedia } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ messageSid: string }> }) {
  const { messageSid } = await ctx.params;
  if (!/^(MM|SM)[0-9a-f]{32}$/i.test(messageSid)) return NextResponse.json({ media: [] }, { status: 400 });
  try {
    const media = await listMedia(messageSid);
    return NextResponse.json({
      media: media.map((m) => ({ url: `/api/media/${messageSid}/${m.sid}`, type: m.content_type })),
    });
  } catch (e) {
    return NextResponse.json({ media: [], error: (e as Error).message }, { status: 502 });
  }
}
