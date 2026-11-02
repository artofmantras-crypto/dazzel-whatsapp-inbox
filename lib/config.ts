// Account settings saved from the Settings page.
// They live in a secure, httpOnly cookie in the browser where they were entered
// (the Auth Token is never readable by page scripts). Vercel environment
// variables, if set, are used as a fallback.
import 'server-only';
import { cookies } from 'next/headers';

export const CONFIG_COOKIE = 'dz_cfg';

export type Config = {
  sid: string;
  token: string;
  from: string; // WhatsApp sender, e.g. +18208993837
  n8nUrl: string;
  n8nKey: string;
  driveRoot: string;
};

const EMPTY: Config = { sid: '', token: '', from: '', n8nUrl: '', n8nKey: '', driveRoot: '' };

export function normalizeFrom(v: string): string {
  const n = String(v || '').replace(/^whatsapp:/i, '').replace(/[^\d+]/g, '');
  if (!n) return '';
  return n.startsWith('+') ? n : `+${n}`;
}

export function encodeConfig(c: Config): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function decodeConfig(v: string | undefined): Partial<Config> {
  if (!v) return {};
  try {
    return JSON.parse(Buffer.from(v, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

export async function savedConfig(): Promise<Partial<Config>> {
  const jar = await cookies();
  return decodeConfig(jar.get(CONFIG_COOKIE)?.value);
}

export async function getConfig(): Promise<Config & { source: 'settings' | 'env' | 'none' }> {
  const s = await savedConfig();
  const env = process.env;
  const c: Config = {
    sid: (s.sid || env.TWILIO_ACCOUNT_SID || '').trim(),
    token: (s.token || env.TWILIO_AUTH_TOKEN || '').trim(),
    from: normalizeFrom(s.from || env.TWILIO_WHATSAPP_FROM || ''),
    n8nUrl: (s.n8nUrl || env.N8N_CONTACTS_URL || '').trim(),
    n8nKey: (s.n8nKey || env.N8N_CONTACTS_KEY || '').trim(),
    driveRoot: (s.driveRoot || env.DRIVE_ROOT_URL || '').trim(),
  };
  const source = s.sid && s.token ? 'settings' : env.TWILIO_ACCOUNT_SID ? 'env' : 'none';
  return { ...EMPTY, ...c, source };
}

export class NotConfiguredError extends Error {
  constructor() {
    super('Twilio is not connected yet. Open Settings and add your Twilio account details.');
  }
}
