// Server-only helpers for talking to Twilio's REST API directly.
import 'server-only';
import { getConfig, NotConfiguredError, type Config } from '@/lib/config';

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

async function creds(): Promise<Config> {
  const c = await getConfig();
  if (!c.sid || !c.token || !c.from) throw new NotConfiguredError();
  return c;
}

function basic(sid: string, token: string): string {
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

async function call(c: Pick<Config, 'sid' | 'token'>, url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { Authorization: basic(c.sid, c.token), ...(init.headers || {}) },
    cache: 'no-store',
  });
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data.message || data.detail)) || `Twilio error ${res.status}`;
    throw new Error(res.status === 401 ? 'Twilio rejected the Account SID / Auth Token. Check them in Settings.' : msg);
  }
  return data as T;
}

/** Checks a SID + token pair and returns the account's friendly name. */
export async function verifyAccount(sid: string, token: string): Promise<string> {
  let res: Response;
  try {
    res = await call({ sid, token }, `${API}/Accounts/${encodeURIComponent(sid)}.json`);
  } catch (e) {
    throw new Error(`Could not reach Twilio (${(e as Error).message}). Try again.`);
  }
  const d = await json<{ friendly_name: string; status: string }>(res);
  return d.friendly_name || sid;
}

export async function ourNumber(): Promise<string> {
  return (await creds()).from;
}

/** All WhatsApp messages to and from our number. */
export async function listMessages(): Promise<TwilioMessage[]> {
  const c = await creds();
  const wa = encodeURIComponent(`whatsapp:${c.from}`);
  const base = `${API}/Accounts/${c.sid}/Messages.json?PageSize=1000`;
  const [inbound, outbound] = await Promise.all([
    call(c, `${base}&To=${wa}`).then((r) => json<{ messages: TwilioMessage[] }>(r)),
    call(c, `${base}&From=${wa}`).then((r) => json<{ messages: TwilioMessage[] }>(r)),
  ]);
  return [...(inbound.messages || []), ...(outbound.messages || [])];
}

export async function sendMessage(params: {
  to: string;
  body?: string;
  contentSid?: string;
  variables?: Record<string, string>;
}): Promise<TwilioMessage> {
  const c = await creds();
  const form = new URLSearchParams();
  form.set('From', `whatsapp:${c.from}`);
  form.set('To', `whatsapp:${params.to}`);
  if (params.contentSid) {
    form.set('ContentSid', params.contentSid);
    if (params.variables && Object.keys(params.variables).length) {
      form.set('ContentVariables', JSON.stringify(params.variables));
    }
  } else {
    form.set('Body', params.body || '');
  }
  const res = await call(c, `${API}/Accounts/${c.sid}/Messages.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  return json<TwilioMessage>(res);
}

export type MediaItem = { sid: string; content_type: string };

export async function listMedia(messageSid: string): Promise<MediaItem[]> {
  const c = await creds();
  const res = await call(c, `${API}/Accounts/${c.sid}/Messages/${messageSid}/Media.json`);
  const data = await json<{ media_list: MediaItem[] }>(res);
  return (data.media_list || []).map((m) => ({ sid: m.sid, content_type: m.content_type }));
}

export async function fetchMedia(messageSid: string, mediaSid: string): Promise<Response> {
  const c = await creds();
  return call(c, `${API}/Accounts/${c.sid}/Messages/${messageSid}/Media/${mediaSid}`, { redirect: 'follow' });
}

/* ---------------- Templates (Twilio Content Template Builder) ---------------- */

export type Template = {
  sid: string;
  name: string;
  body: string;
  language: string;
  variables: string[];
  sample: Record<string, string>;
  category: string;
  status: string; // approved | pending | received | rejected | paused | disabled | unsubmitted
  reason: string; // rejection reason, if any
  createdAt: string;
};

type RawContent = {
  sid: string;
  friendly_name: string;
  language?: string;
  date_created?: string;
  variables: Record<string, string> | null;
  types: Record<string, { body?: string }>;
  approval_requests?: { status?: string; category?: string; rejection_reason?: string };
};

function toTemplate(c: RawContent): Template {
  const t = c.types?.['twilio/text'] || Object.values(c.types || {})[0] || {};
  const body = t.body || '';
  const vars = Array.from(new Set((body.match(/\{\{\s*(\w+)\s*\}\}/g) || []).map((v) => v.replace(/[{}\s]/g, ''))));
  const ar = c.approval_requests || {};
  return {
    sid: c.sid,
    name: c.friendly_name,
    body,
    language: c.language || '',
    variables: vars,
    sample: c.variables || {},
    category: (ar.category || '').toUpperCase(),
    status: (ar.status || 'unsubmitted').toLowerCase(),
    reason: ar.rejection_reason || '',
    createdAt: c.date_created || '',
  };
}

/** Every template in the account with its WhatsApp approval status. */
export async function listAllTemplates(): Promise<Template[]> {
  const c = await creds();
  const out: Template[] = [];
  let url: string | null = `${CONTENT_API}/ContentAndApprovals?PageSize=200`;
  for (let i = 0; url && i < 5; i++) {
    const res = await call(c, url);
    const data: { contents: RawContent[]; meta?: { next_page_url?: string | null } } = await json(res);
    out.push(...(data.contents || []).map(toTemplate));
    url = data.meta?.next_page_url || null;
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Approved templates only (what the chat composer can send). */
export async function listTemplates(): Promise<Template[]> {
  return (await listAllTemplates()).filter((t) => t.status === 'approved');
}

/** Creates a text template and submits it to WhatsApp (Meta) for approval. */
export async function createTemplate(input: {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  body: string;
  samples: Record<string, string>;
}): Promise<{ sid: string; status: string }> {
  const c = await creds();
  const res = await call(c, `${CONTENT_API}/Content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      friendly_name: input.name,
      language: input.language,
      variables: input.samples,
      types: { 'twilio/text': { body: input.body } },
    }),
  });
  const created = await json<{ sid: string }>(res);

  const ar = await call(c, `${CONTENT_API}/Content/${created.sid}/ApprovalRequests/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, category: input.category }),
  });
  try {
    const d = await json<{ status?: string }>(ar);
    return { sid: created.sid, status: (d.status || 'received').toLowerCase() };
  } catch (e) {
    throw new Error(`Template saved, but sending it for approval failed: ${(e as Error).message}`);
  }
}

/** Re-submits an existing (unsubmitted) template for WhatsApp approval. */
export async function submitTemplate(sid: string, name: string, category: string): Promise<string> {
  const c = await creds();
  const ar = await call(c, `${CONTENT_API}/Content/${sid}/ApprovalRequests/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category }),
  });
  const d = await json<{ status?: string }>(ar);
  return (d.status || 'received').toLowerCase();
}

export async function deleteTemplate(sid: string): Promise<void> {
  const c = await creds();
  const res = await call(c, `${CONTENT_API}/Content/${sid}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) await json(res);
}
