// Signed session cookie using Web Crypto (works in middleware and route handlers).
export const SESSION_COOKIE = 'dz_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

function secret(): string {
  return process.env.SESSION_SECRET || process.env.DASHBOARD_PASSWORD || 'change-me';
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

export async function createSession(): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `v1.${exp}`;
  return { value: `${payload}.${await hmac(payload)}`, maxAge: MAX_AGE_SECONDS };
}

export async function verifySession(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [v, exp, sig] = parts;
  if (v !== 'v1' || Number(exp) < Date.now() / 1000) return false;
  const expected = await hmac(`${v}.${exp}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function passwordMatches(input: string): boolean {
  const real = process.env.DASHBOARD_PASSWORD || '';
  if (!real || input.length !== real.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ input.charCodeAt(i);
  return diff === 0;
}
