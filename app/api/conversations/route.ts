import { NextResponse } from 'next/server';
import { listMessages } from '@/lib/twilio';
import { loadContacts, digits } from '@/lib/contacts';
import type { Conversation, Message } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DAY = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const [msgs, contacts] = await Promise.all([listMessages(), loadContacts()]);
    const ours = digits(process.env.TWILIO_WHATSAPP_FROM || '');
    const byPhone = new Map<string, Message[]>();

    for (const m of msgs) {
      const dir: 'in' | 'out' = digits(m.from) === ours ? 'out' : 'in';
      const other = digits(dir === 'in' ? m.from : m.to);
      if (!other || other === ours) continue;
      const list = byPhone.get(other) || [];
      if (list.some((x) => x.sid === m.sid)) continue;
      list.push({
        sid: m.sid,
        dir,
        body: m.body || '',
        at: new Date(m.date_created).toISOString(),
        status: m.status,
        error: m.error_code,
        media: Number(m.num_media || 0),
      });
      byPhone.set(other, list);
    }

    const now = Date.now();
    const conversations: Conversation[] = [...byPhone.entries()].map(([d, messages]) => {
      messages.sort((a, b) => a.at.localeCompare(b.at));
      const lastIn = [...messages].reverse().find((m) => m.dir === 'in' && m.status !== 'failed');
      const info = contacts[d];
      return {
        phone: `+${d}`,
        name: info?.name || '',
        status: info?.status || '',
        amount: info?.amount || '',
        folder: info?.folder || '',
        reminders: info?.reminders || 0,
        lastAt: messages[messages.length - 1].at,
        lastInAt: lastIn ? lastIn.at : null,
        windowOpen: !!lastIn && now - new Date(lastIn.at).getTime() < DAY,
        messages,
      };
    });
    conversations.sort((a, b) => b.lastAt.localeCompare(a.lastAt));

    return NextResponse.json({ conversations, driveRoot: process.env.DRIVE_ROOT_URL || '' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
