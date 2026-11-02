'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res && res.ok) {
      window.location.href = '/';
      return;
    }
    setBusy(false);
    setError(res ? 'Wrong password' : 'Could not connect. Try again.');
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.jpg" alt="Dazzel Digital" className="login-logo" />
        <h1>WhatsApp Inbox</h1>
        <p>Sign in to view and reply to customer chats.</p>
        <label htmlFor="pw">Team password</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && <div className="login-error">{error}</div>}
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
