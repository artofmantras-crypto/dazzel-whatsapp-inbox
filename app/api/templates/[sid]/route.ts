import { NextResponse } from 'next/server';
import { deleteTemplate, submitTemplate } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

const valid = (sid: string) => /^HX[0-9a-f]{32}$/i.test(sid);

export async function DELETE(_req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  if (!valid(sid)) return NextResponse.json({ error: 'Bad template id' }, { status: 400 });
  try {
    await deleteTemplate(sid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// Send an unsubmitted template for WhatsApp approval
export async function POST(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  if (!valid(sid)) return NextResponse.json({ error: 'Bad template id' }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  try {
    const status = await submitTemplate(sid, String(b.name || ''), String(b.category || 'UTILITY').toUpperCase());
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
