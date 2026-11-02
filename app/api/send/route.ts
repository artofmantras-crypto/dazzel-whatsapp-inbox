import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const b = await req.json().catch(() => ({}));
    let d = String(b.to || '').replace(/\D/g, '');
    if (d.length === 10) d = '91' + d;
    if (d.length < 11) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });

    if (b.contentSid) {
      const variables: Record<string, string> = {};
      for (const [k, v] of Object.entries(b.variables || {})) {
        // WhatsApp template values cannot contain line breaks or 4+ spaces in a row
        const clean = String(v ?? '').replace(/\s*\n+\s*/g, ' ').replace(/ {4,}/g, '   ').trim();
        if (!clean) return NextResponse.json({ error: `Fill in value {{${k}}}` }, { status: 400 });
        variables[k] = clean.slice(0, 1000);
      }
      const m = await sendMessage({ to: `+${d}`, contentSid: String(b.contentSid), variables });
      return NextResponse.json({ ok: true, sid: m.sid });
    }

    const text = String(b.body || '').trim();
    if (!text) return NextResponse.json({ error: 'Message is empty' }, { status: 400 });
    if (text.length > 1600) return NextResponse.json({ error: 'Message is too long (max 1600 characters)' }, { status: 400 });
    const m = await sendMessage({ to: `+${d}`, body: text });
    return NextResponse.json({ ok: true, sid: m.sid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
