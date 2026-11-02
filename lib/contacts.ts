// Customer names and order status from the n8n agent (which reads the Payments Google Sheet).
import 'server-only';

export type ContactInfo = {
  name: string;
  status: string;
  amount: string;
  folder: string;
  reminders: number;
};

export const digits = (s: string) => String(s || '').replace(/\D/g, '');

export async function loadContacts(): Promise<Record<string, ContactInfo>> {
  const url = process.env.N8N_CONTACTS_URL;
  const key = process.env.N8N_CONTACTS_KEY;
  if (!url || !key) return {};
  try {
    const res = await fetch(`${url}?key=${encodeURIComponent(key)}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const out: Record<string, ContactInfo> = {};
    for (const c of data?.conversations || []) {
      if (!c?.phone) continue;
      out[digits(c.phone)] = {
        name: c.name || '',
        status: c.status || '',
        amount: c.amount ? String(c.amount) : '',
        folder: c.folder || '',
        reminders: Number(c.reminders || 0),
      };
    }
    return out;
  } catch {
    return {};
  }
}
