import { NextResponse } from 'next/server';
import { CONFIG_COOKIE, encodeConfig, getConfig, normalizeFrom, savedConfig, type Config } from '@/lib/config';
import { verifyAccount } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

const mask = (v: string) => (v ? `••••••••${v.slice(-4)}` : '');

// Never sends the Auth Token or n8n key back to the browser — only whether they are set.
export async function GET() {
  const c = await getConfig();
  return NextResponse.json({
    source: c.source,
    sid: c.sid,
    tokenHint: mask(c.token),
    from: c.from,
    n8nUrl: c.n8nUrl,
    n8nKeyHint: mask(c.n8nKey),
    driveRoot: c.driveRoot,
  });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const prev = await savedConfig();
  const current = await getConfig();

  const sid = String(b.sid ?? '').trim();
  // Blank token = keep the one already saved
  const token = String(b.token ?? '').trim() || prev.token || current.token;
  const from = normalizeFrom(String(b.from ?? ''));

  if (!/^AC[0-9a-f]{32}$/i.test(sid)) return NextResponse.json({ error: 'Account SID should start with AC and be 34 characters.' }, { status: 400 });
  if (!token) return NextResponse.json({ error: 'Enter the Auth Token.' }, { status: 400 });
  if (from.replace(/\D/g, '').length < 10) return NextResponse.json({ error: 'Enter the WhatsApp number with country code, e.g. +18208993837.' }, { status: 400 });

  let account = '';
  try {
    account = await verifyAccount(sid, token);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const cfg: Config = {
    sid,
    token,
    from,
    n8nUrl: String(b.n8nUrl ?? '').trim(),
    n8nKey: String(b.n8nKey ?? '').trim() || prev.n8nKey || current.n8nKey,
    driveRoot: String(b.driveRoot ?? '').trim(),
  };
  const res = NextResponse.json({ ok: true, account });
  res.cookies.set(CONFIG_COOKIE, encodeConfig(cfg), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CONFIG_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
