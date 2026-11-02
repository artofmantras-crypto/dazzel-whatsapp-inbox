import { NextResponse } from 'next/server';
import { SESSION_COOKIE, createSession, passwordMatches } from '@/lib/session';

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!passwordMatches(String(b.password || ''))) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const s = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: s.maxAge,
  });
  return res;
}
