// Server-only helpers for talking to Twilio's REST API directly.
import 'server-only';

const API = 'https://api.twilio.com/2010-04-01';
const CONTENT_API = 'https://content.twilio.com/v1';

export type TwilioMessage = {
  sid: string;
  from: string;
  to: string;
  body: string;
  status: string;
  direction: string;
  date_created: string;
  num_media: string;
  error_code: number | null;
};

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export function whatsappFrom(): string {
  const n = (process.env.TWILIO_WHATSAPP_FROM || '').replace(/^whatsapp:/, '').trim();
  if (!n) throw new Error('Missing environment variable TWILIO_WHATSAPP_FROM');
  return n.startsWith('+') ? n : `+${n}`;
}

function authHeader(): string {
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

export async function twilioFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { Authorization: authHeader(), ...(init.headers || {}) },
    cache: 'no-store',
  });
}

async function twilioJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await twilioFetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data.message || data.detail)) || `Twilio error ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

/** All WhatsApp messages to and from our number (newest first from Twilio). */
export async function listMessages(): Promise<TwilioMessage[]> {
  const sid = env('TWILIO_ACCOUNT_SID');
  const wa = encodeURIComponent(`whatsapp:${whatsappFrom()}`);
  const base = `${API}/Accounts/${sid}/Messages.json?PageSize=1000`;
  const [inbound, outbound] = await Promise.all([
    twilioJson<{ messages: TwilioMessage[] }>(`${base}&To=${wa}`),
    twilioJson<{ messages: TwilioMessage[] }>(`${base}&From=${wa}`),
  ]);
  return [...(inbound.messages || []), ...(outbound.messages || [])];
}

export async function sendMessage(params: {
  to: string;
  body?: string;
  contentSid?: string;
  variables?: Record<string, string>;
}): Promise<TwilioMessage> {
  const sid = env('TWILIO_ACCOUNT_SID');
  const form = new URLSearchParams();
  form.set('From', `whatsapp:${whatsappFrom()}`);
  form.set('To', `whatsapp:${params.to}`);
  if (params.contentSid) {
    form.set('ContentSid', params.contentSid);
    if (params.variables && Object.keys(params.variables).length) {
      form.set('ContentVariables', JSON.stringify(params.variables));
    }
  } else {
    form.set('Body', params.body || '');
  }
  return twilioJson<TwilioMessage>(`${API}/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
}

export type MediaItem = { sid: string; content_type: string };

export async function listMedia(messageSid: string): Promise<MediaItem[]> {
  const sid = env('TWILIO_ACCOUNT_SID');
  const data = await twilioJson<{ media_list: MediaItem[] }>(
    `${API}/Accounts/${sid}/Messages/${messageSid}/Media.json`,
  );
  return (data.media_list || []).map((m) => ({ sid: m.sid, content_type: m.content_type }));
}

export async function fetchMedia(messageSid: string, mediaSid: string): Promise<Response> {
  const sid = env('TWILIO_ACCOUNT_SID');
  return twilioFetch(`${API}/Accounts/${sid}/Messages/${messageSid}/Media/${mediaSid}`, { redirect: 'follow' });
}

export type Template = {
  sid: string;
  name: string;
  body: string;
  variables: string[];
  sample: Record<string, string>;
  category: string;
};

/** Approved WhatsApp templates from Twilio Content Template Builder. */
export async function listTemplates(): Promise<Template[]> {
  type Raw = {
    sid: string;
    friendly_name: string;
    variables: Record<string, string> | null;
    types: Record<string, { body?: string }>;
    approval_requests?: { status?: string; category?: string };
  };
  const data = await twilioJson<{ contents: Raw[] }>(`${CONTENT_API}/ContentAndApprovals?PageSize=100`);
  return (data.contents || [])
    .filter((c) => (c.approval_requests?.status || '').toLowerCase() === 'approved')
    .map((c) => {
      const t = c.types?.['twilio/text'] || Object.values(c.types || {})[0] || {};
      const body = t.body || '';
      const vars = Array.from(new Set((body.match(/\{\{\s*(\w+)\s*\}\}/g) || []).map((v) => v.replace(/[{}\s]/g, ''))));
      return {
        sid: c.sid,
        name: c.friendly_name,
        body,
        variables: vars,
        sample: c.variables || {},
        category: c.approval_requests?.category || '',
      };
    });
}
