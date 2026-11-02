import { NextResponse } from 'next/server';
import { createTemplate, listAllTemplates } from '@/lib/twilio';
import { NotConfiguredError } from '@/lib/config';

export const dynamic = 'force-dynamic';

function fail(e: unknown) {
  const needsSetup = e instanceof NotConfiguredError;
  return NextResponse.json({ error: (e as Error).message, needsSetup, templates: [] }, { status: needsSetup ? 428 : 502 });
}

export async function GET() {
  try {
    return NextResponse.json({ templates: await listAllTemplates() });
  } catch (e) {
    return fail(e);
  }
}

const CATEGORIES = ['UTILITY', 'MARKETING', 'AUTHENTICATION'] as const;

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  const body = String(b.body || '').trim();
  const category = String(b.category || 'UTILITY').toUpperCase() as (typeof CATEGORIES)[number];
  const language = String(b.language || 'en').trim();

  if (!name) return NextResponse.json({ error: 'Give the template a name (lowercase letters, numbers and _).' }, { status: 400 });
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: 'Pick a category.' }, { status: 400 });
  if (!body) return NextResponse.json({ error: 'Write the message text.' }, { status: 400 });
  if (body.length > 1024) return NextResponse.json({ error: 'Message is too long (max 1024 characters).' }, { status: 400 });

  const vars = Array.from(new Set((body.match(/\{\{\s*(\w+)\s*\}\}/g) || []).map((v) => v.replace(/[{}\s]/g, ''))));
  const expected = vars.map((_, i) => String(i + 1));
  if (vars.some((v, i) => v !== expected[i])) {
    return NextResponse.json({ error: 'Number the blanks in order: {{1}}, {{2}}, {{3}}…' }, { status: 400 });
  }
  if (/^\s*\{\{|\}\}\s*$/.test(body)) {
    return NextResponse.json({ error: 'WhatsApp does not allow a {{blank}} at the very start or end of the message. Add some words around it.' }, { status: 400 });
  }
  const samples: Record<string, string> = {};
  for (const v of vars) {
    const s = String(b.samples?.[v] || '').trim();
    if (!s) return NextResponse.json({ error: `Add an example value for {{${v}}} — WhatsApp needs it to review the template.` }, { status: 400 });
    samples[v] = s;
  }

  try {
    const r = await createTemplate({ name, category, language, body, samples });
    return NextResponse.json({ ok: true, ...r, name });
  } catch (e) {
    return fail(e);
  }
}
