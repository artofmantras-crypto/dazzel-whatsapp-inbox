import { NextResponse } from 'next/server';
import { listTemplates } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ templates: await listTemplates() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, templates: [] }, { status: 500 });
  }
}
