'use client';

import { useEffect, useState } from 'react';
import TopBar from '../TopBar';

type Loaded = {
  source: 'settings' | 'env' | 'none';
  sid: string;
  tokenHint: string;
  from: string;
  n8nUrl: string;
  n8nKeyHint: string;
  driveRoot: string;
};

export default function SettingsPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sid, setSid] = useState('');
  const [token, setToken] = useState('');
  const [from, setFrom] = useState('');
  const [n8nUrl, setN8nUrl] = useState('');
  const [n8nKey, setN8nKey] = useState('');
  const [driveRoot, setDriveRoot] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const d: Loaded = await fetch('/api/settings', { cache: 'no-store' }).then((r) => r.json());
    setLoaded(d);
    setSid(d.sid);
    setFrom(d.from);
    setN8nUrl(d.n8nUrl);
    setDriveRoot(d.driveRoot);
    setToken('');
    setN8nKey('');
  }
  useEffect(() => {
    load().catch(() => setMsg({ ok: false, text: 'Could not load settings.' }));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid, token, from, n8nUrl, n8nKey, driveRoot }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not save');
      setMsg({ ok: true, text: `Connected to Twilio account “${d.account}”. Saved.` });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Remove the saved Twilio details from this browser?')) return;
    await fetch('/api/settings', { method: 'DELETE' });
    setMsg({ ok: true, text: 'Removed from this browser.' });
    await load();
  }

  const connected = loaded && loaded.source !== 'none';

  return (
    <div className="shell">
      <TopBar />
      <main className="page">
        <div className="page-head">
          <h1>Settings</h1>
          {loaded && (
            <span className={`pill ${connected ? 'ok' : 'warn'}`}>
              {loaded.source === 'settings' ? '● Twilio connected' : loaded.source === 'env' ? '● Connected via Vercel variables' : '● Not connected'}
            </span>
          )}
        </div>

        <form className="card" onSubmit={save}>
          <h2>Twilio account</h2>
          <p className="muted">
            Find these in the Twilio Console home page under <b>Account Info</b>. They are checked with Twilio before saving.
          </p>

          <label className="form-field">
            <span>Account SID</span>
            <input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" autoComplete="off" spellCheck={false} required />
          </label>
          <label className="form-field">
            <span>Auth Token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={loaded?.tokenHint ? `Saved (${loaded.tokenHint}) — leave blank to keep` : 'Your Twilio Auth Token'}
              autoComplete="new-password"
              spellCheck={false}
            />
          </label>
          <label className="form-field">
            <span>WhatsApp number (sender)</span>
            <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="+18208993837" autoComplete="off" required />
          </label>

          <h2 className="mt">Customer details (optional)</h2>
          <p className="muted">Shows customer names, payment and file status from the n8n agent, and links to their Drive folder.</p>
          <label className="form-field">
            <span>n8n contacts URL</span>
            <input value={n8nUrl} onChange={(e) => setN8nUrl(e.target.value)} placeholder="https://…/webhook/dazzel-inbox-data" autoComplete="off" />
          </label>
          <label className="form-field">
            <span>n8n key</span>
            <input
              type="password"
              value={n8nKey}
              onChange={(e) => setN8nKey(e.target.value)}
              placeholder={loaded?.n8nKeyHint ? `Saved (${loaded.n8nKeyHint}) — leave blank to keep` : 'Key for the n8n webhook'}
              autoComplete="new-password"
            />
          </label>
          <label className="form-field">
            <span>Google Drive folder link</span>
            <input value={driveRoot} onChange={(e) => setDriveRoot(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" autoComplete="off" />
          </label>

          {msg && <div className={msg.ok ? 'note ok' : 'note bad'}>{msg.text}</div>}

          <div className="form-actions">
            {loaded?.source === 'settings' && (
              <button type="button" className="btn-ghost" onClick={disconnect}>
                Disconnect
              </button>
            )}
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Checking with Twilio…' : 'Save & connect'}
            </button>
          </div>
        </form>

        <p className="muted small">
          Details are saved securely in this browser only (the Auth Token can’t be read by the page). Each team member enters them once on their own device; people without them can’t see any chats.
        </p>
      </main>
    </div>
  );
}
