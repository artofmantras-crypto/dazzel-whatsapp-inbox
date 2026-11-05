'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '../TopBar';
import type { TemplateInfo } from '@/lib/types';

const STATUS: Record<string, { label: string; cls: string; help: string }> = {
  approved: { label: 'Approved', cls: 'ok', help: 'Ready to use in chats.' },
  received: { label: 'In review', cls: 'wait', help: 'Sent to WhatsApp. Usually takes a few minutes, sometimes up to 24 hours.' },
  pending: { label: 'In review', cls: 'wait', help: 'Sent to WhatsApp. Usually takes a few minutes, sometimes up to 24 hours.' },
  rejected: { label: 'Rejected', cls: 'bad', help: 'WhatsApp did not approve it. Edit the wording and create it again.' },
  paused: { label: 'Paused', cls: 'bad', help: 'WhatsApp paused it after poor customer feedback.' },
  disabled: { label: 'Disabled', cls: 'bad', help: 'WhatsApp disabled it.' },
  unsubmitted: { label: 'Not sent for approval', cls: 'muted', help: 'Saved in Twilio but never sent to WhatsApp.' },
};

const LANGS = [
  ['en', 'English'],
  ['en_US', 'English (US)'],
  ['hi', 'Hindi'],
  ['te', 'Telugu'],
  ['ta', 'Tamil'],
  ['kn', 'Kannada'],
  ['mr', 'Marathi'],
];

function varsOf(body: string) {
  return Array.from(new Set((body.match(/\{\{\s*(\w+)\s*\}\}/g) || []).map((v) => v.replace(/[{}\s]/g, ''))));
}

export default function TemplatesPage() {
  const [list, setList] = useState<TemplateInfo[] | null>(null);
  const [error, setError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [filter, setFilter] = useState<'all' | 'approved' | 'review' | 'rejected'>('all');
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState('');

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(''), 3500);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/templates', { cache: 'no-store' });
      const d = await res.json();
      setNeedsSetup(!!d.needsSetup);
      if (!res.ok) throw new Error(d.error || 'Could not load templates');
      setList(d.templates || []);
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setList((l) => l || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While anything is in review, check again every 30 seconds
  const inReview = (list || []).some((t) => t.status === 'pending' || t.status === 'received');
  useEffect(() => {
    if (!inReview) return;
    const t = setInterval(() => !document.hidden && load(), 30000);
    return () => clearInterval(t);
  }, [inReview, load]);

  const shown = useMemo(() => {
    return (list || []).filter((t) => {
      if (filter === 'approved') return t.status === 'approved';
      if (filter === 'review') return t.status === 'pending' || t.status === 'received';
      if (filter === 'rejected') return ['rejected', 'paused', 'disabled'].includes(t.status);
      return true;
    });
  }, [list, filter]);

  async function remove(t: TemplateInfo) {
    if (!window.confirm(`Delete template “${t.name}”? This removes it from Twilio.`)) return;
    const res = await fetch(`/api/templates/${t.sid}`, { method: 'DELETE' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return flash(d.error || 'Could not delete');
    flash('Deleted');
    load();
  }

  async function submit(t: TemplateInfo) {
    const category = window.prompt('Category for WhatsApp review: UTILITY or MARKETING', 'UTILITY');
    if (!category) return;
    const res = await fetch(`/api/templates/${t.sid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: t.name, category }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return flash(d.error || 'Could not send for approval');
    flash('Sent to WhatsApp for approval');
    load();
  }

  const count = (s: string[]) => (list || []).filter((t) => s.includes(t.status)).length;

  return (
    <div className="shell">
      <TopBar>
        <button className="btn-ghost" onClick={() => { load(); flash('Status refreshed'); }}>Check status</button>
      </TopBar>
      <main className="page wide">
        <div className="page-head">
          <h1>Templates</h1>
          {!needsSetup && (
            <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Close' : '+ New template'}
            </button>
          )}
        </div>
        <p className="muted">
          WhatsApp only lets you message a customer who hasn’t written in the last 24 hours using an <b>approved template</b>. Create one here — it goes to WhatsApp for review, and once it shows <span className="badge ok">Approved</span> you can send it from any chat.
        </p>

        {needsSetup && (
          <div className="card setup-card">
            <b>Connect Twilio first</b>
            <span className="muted">Templates are created in your Twilio account.</span>
            <Link className="btn-primary" href="/settings">Open Settings</Link>
          </div>
        )}

        {showForm && (
          <NewTemplate
            onDone={(name) => {
              setShowForm(false);
              flash(`“${name}” sent to WhatsApp for approval`);
              load();
            }}
          />
        )}

        {!needsSetup && (
          <>
            <div className="chips flat">
              {(
                [
                  ['all', `All (${list?.length ?? 0})`],
                  ['approved', `Approved (${count(['approved'])})`],
                  ['review', `In review (${count(['pending', 'received'])})`],
                  ['rejected', `Rejected (${count(['rejected', 'paused', 'disabled'])})`],
                ] as const
              ).map(([k, label]) => (
                <button key={k} className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k)}>
                  {label}
                </button>
              ))}
            </div>

            {error && <div className="note bad">{error}</div>}
            {!list && <div className="muted">Loading templates…</div>}
            {list && shown.length === 0 && !error && <div className="muted empty">No templates here yet.</div>}

            <div className="tpl-grid">
              {shown.map((t) => {
                const st = STATUS[t.status] || { label: t.status, cls: 'muted', help: '' };
                return (
                  <div key={t.sid} className="card tpl-card">
                    <div className="tpl-top">
                      <div>
                        <div className="tpl-name">{t.name}</div>
                        <div className="muted small">
                          {[t.category && t.category.toLowerCase(), t.language, t.variables.length ? `${t.variables.length} blank${t.variables.length > 1 ? 's' : ''}` : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <span className={`badge ${st.cls}`} title={st.help}>
                        {st.label}
                      </span>
                    </div>
                    <div className="bubble-preview">{t.body}</div>
                    {t.reason && <div className="note bad small">Reason: {t.reason}</div>}
                    {t.category === 'MARKETING' && t.status === 'approved' && (
                      <div className="note warn small">WhatsApp classed this as Marketing. Marketing messages are often held back for Indian numbers (error 63049) — for order updates and reminders use a Utility template.</div>
                    )}
                    {!t.reason && st.help && t.status !== 'approved' && <div className="muted small">{st.help}</div>}
                    <div className="tpl-foot">
                      {t.status === 'approved' && <span className="ok-text">✓ Ready to use in chats</span>}
                      {t.status === 'unsubmitted' && (
                        <button className="btn-ghost sm" onClick={() => submit(t)}>
                          Send for approval
                        </button>
                      )}
                      <button className="link-btn danger" onClick={() => remove(t)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function NewTemplate({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('UTILITY');
  const [language, setLanguage] = useState('en');
  const [body, setBody] = useState('Hi {{1}}, ');
  const [samples, setSamples] = useState<Record<string, string>>({ '1': 'Rahul' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);

  const vars = varsOf(body);
  const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  const preview = body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => samples[k] || `{{${k}}}`);

  // Renumber blanks in reading order ({{1}}, {{2}}, …) and carry example values along
  function renumber(text: string, vals: Record<string, string>) {
    const map: Record<string, string> = {};
    let n = 0;
    const out = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
      if (!map[k]) map[k] = String(++n);
      return `{{${map[k]}}}`;
    });
    const nextVals: Record<string, string> = {};
    for (const [oldK, newK] of Object.entries(map)) if (vals[oldK]) nextVals[newK] = vals[oldK];
    return { out, nextVals };
  }

  function addBlank() {
    const el = area.current;
    const pos = el && document.activeElement === el ? el.selectionStart : body.length;
    const marker = `{{${vars.length + 1}}}`;
    const { out, nextVals } = renumber(body.slice(0, pos) + marker + body.slice(pos), samples);
    setBody(out);
    setSamples(nextVals);
    requestAnimationFrame(() => {
      el?.focus();
      const p = pos + marker.length;
      el?.setSelectionRange(p, p);
    });
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, category, language, body, samples }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not create template');
      onDone(d.name || cleanName);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card new-tpl" onSubmit={create}>
      <h2>New template</h2>
      <div className="form-row">
        <label className="form-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="order_ready_update" required />
          {name && cleanName !== name && <small className="muted">Will be saved as: {cleanName}</small>}
        </label>
        <label className="form-field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="UTILITY">Utility — order updates, reminders, confirmations</option>
            <option value="MARKETING">Marketing — offers, promotions</option>
          </select>
        </label>
        <label className="form-field">
          <span>Language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="form-field">
        <span className="row-between">
          Message
          <button type="button" className="btn-ghost sm" onClick={addBlank}>
            + Add blank {`{{${vars.length + 1}}}`}
          </button>
        </span>
        <textarea ref={area} rows={5} value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => { const r = renumber(body, samples); if (r.out !== body) { setBody(r.out); setSamples(r.nextVals); } }} maxLength={1024} required />
        <small className="muted">Blanks like {'{{1}}'} are filled in when you send (e.g. the customer’s name). {body.length}/1024</small>
      </label>

      {vars.length > 0 && (
        <div className="form-field">
          <span>Example values (WhatsApp uses these to review)</span>
          <div className="vars">
            {vars.map((k) => (
              <label key={k}>
                <span>{`{{${k}}}`}</span>
                <input value={samples[k] || ''} onChange={(e) => setSamples({ ...samples, [k]: e.target.value })} placeholder={k === '1' ? 'Rahul' : 'Example'} />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="form-field">
        <span>Preview</span>
        <div className="bubble-preview">{preview}</div>
      </div>

      <ul className="tips muted small">
        <li>Utility templates are approved faster, cost less and are delivered reliably — keep them about the customer’s order. WhatsApp may switch a template to Marketing if it sounds promotional; Marketing messages are often blocked for Indian numbers.</li>
        <li>Don’t start or end the message with a blank, and avoid words like “offer”, “discount” in Utility.</li>
      </ul>

      {err && <div className="note bad">{err}</div>}
      <div className="form-actions">
        <button className="btn-primary" disabled={busy || !cleanName}>
          {busy ? 'Submitting…' : 'Create & send for approval'}
        </button>
      </div>
    </form>
  );
}
