'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Conversation, Message, TemplateInfo } from '@/lib/types';

type Filter = 'all' | 'unread' | 'WAITING_FOR_FILES' | 'FILES_RECEIVED' | 'none';

const ERRORS: Record<string, string> = {
  '63016': 'Not delivered: customer has not messaged in 24 hours. Use a template.',
  '63049': 'Not delivered: WhatsApp held back this marketing-type message.',
  '63024': 'Not delivered: invalid recipient.',
  '63003': 'Not delivered: number is not on WhatsApp.',
  '63032': 'Not delivered: customer blocked or opted out.',
  '63051': 'Not delivered: issue with the customer’s WhatsApp account.',
  '11751': 'File over 16 MB — it never reached us. Ask the customer to resend it smaller.',
};

const STATUS_LABEL: Record<string, string> = {
  WAITING_FOR_FILES: 'Waiting for files',
  FILES_RECEIVED: 'Files received',
};

function ist(d: string | Date, opts: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
}
function timeAgo(d: string) {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return ist(d, { day: 'numeric', month: 'short' });
}
function initials(c: Conversation) {
  if (!c.name) return '#';
  const p = c.name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}
function firstName(c: Conversation) {
  const f = (c.name || '').trim().split(/\s+/)[0] || 'there';
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}
function displayName(c: Conversation) {
  return c.name || c.phone;
}
function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('dz_seen') || '{}');
  } catch {
    return {};
  }
}
function writeSeen(v: Record<string, string>) {
  try {
    localStorage.setItem('dz_seen', JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export default function Inbox() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [driveRoot, setDriveRoot] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((t: string) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load conversations');
      setConvs(data.conversations || []);
      setDriveRoot(data.driveRoot || '');
      setLoadError('');
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setSeen(readSeen());
    load();
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 8000);
    const onVis = () => !document.hidden && load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const unreadCount = useCallback(
    (c: Conversation) => {
      const last = seen[c.phone];
      return c.messages.filter((m) => m.dir === 'in' && (!last || m.at > last)).length;
    },
    [seen],
  );

  // Mark the open conversation as read
  const current = convs.find((c) => c.phone === selected) || null;
  useEffect(() => {
    if (!current) return;
    const lastIn = current.lastInAt;
    if (lastIn && seen[current.phone] !== lastIn) {
      const next = { ...seen, [current.phone]: lastIn };
      setSeen(next);
      writeSeen(next);
    }
  }, [current, seen]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    return convs.filter((c) => {
      if (filter === 'unread' && unreadCount(c) === 0) return false;
      if (filter === 'none' && c.status) return false;
      if ((filter === 'WAITING_FOR_FILES' || filter === 'FILES_RECEIVED') && c.status !== filter) return false;
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      if (qd && c.phone.includes(qd)) return true;
      return c.messages.some((m) => m.body.toLowerCase().includes(q));
    });
  }, [convs, query, filter, unreadCount]);

  return (
    <div className={`shell ${current ? 'has-chat' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <img src="/logo.jpg" alt="" />
          <div>
            <div className="brand-title">WhatsApp</div>
            <div className="brand-sub">Two-way conversations with Dazzel Digital customers. Newest at the top.</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn-ghost" onClick={() => { load(); showToast('Refreshed'); }}>Refresh</button>
        </div>
      </header>

      <div className="panes">
        {/* Conversation list */}
        <aside className="list-pane">
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.2 4.2-1.4 1.4-4.2-4.2A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" /></svg>
            <input placeholder="Search conversations…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="chips">
            {(
              [
                ['all', 'All'],
                ['unread', 'Unread'],
                ['WAITING_FOR_FILES', 'Waiting for files'],
                ['FILES_RECEIVED', 'Files received'],
                ['none', 'Not paid'],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button key={k} className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="list">
            {!loaded && <div className="list-empty">Loading conversations…</div>}
            {loaded && loadError && <div className="list-empty error">{loadError}</div>}
            {loaded && !loadError && visible.length === 0 && <div className="list-empty">No conversations</div>}
            {visible.map((c) => {
              const last = c.messages[c.messages.length - 1];
              const unread = unreadCount(c);
              const preview = last ? (last.media && !last.body ? '📎 File' : last.body.replace(/\s+/g, ' ')) : '';
              return (
                <button key={c.phone} className={`row ${c.phone === selected ? 'sel' : ''}`} onClick={() => setSelected(c.phone)}>
                  <div className="row-top">
                    <span className="row-name">{displayName(c)}</span>
                    <span className="row-time">{timeAgo(c.lastAt)}</span>
                  </div>
                  <div className="row-bottom">
                    <span className="row-preview">
                      {last?.dir === 'out' && <b>You: </b>}
                      {preview}
                    </span>
                    {unread > 0 && <span className="unread">{unread}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Chat */}
        <section className="chat-pane">
          {current ? (
            <Chat key={current.phone} conv={current} driveRoot={driveRoot} onBack={() => setSelected(null)} onSent={load} toast={showToast} />
          ) : (
            <div className="chat-empty">
              <img src="/logo.jpg" alt="" />
              <p>Select a conversation to read and reply.</p>
            </div>
          )}
        </section>

        {/* Details */}
        {current && <Details conv={current} driveRoot={driveRoot} toast={showToast} />}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Chat({
  conv,
  driveRoot,
  onBack,
  onSent,
  toast,
}: {
  conv: Conversation;
  driveRoot: string;
  onBack: () => void;
  onSent: () => void;
  toast: (t: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [mode, setMode] = useState<'text' | 'template'>(conv.windowOpen ? 'text' : 'template');

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [conv.messages.length]);

  function onScroll() {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  let lastDay = '';
  const folder = conv.folder || driveRoot;

  return (
    <>
      <div className="chat-head">
        <button className="back" onClick={onBack} aria-label="Back">←</button>
        <div className="avatar">{initials(conv)}</div>
        <div className="chat-head-info">
          <div className="chat-name">{displayName(conv)}</div>
          <div className="chat-phone">{conv.phone}</div>
        </div>
        {folder && (
          <a className="link" href={folder} target="_blank" rel="noopener noreferrer">
            Open files →
          </a>
        )}
      </div>

      <div className="messages" ref={scroller} onScroll={onScroll}>
        {conv.messages.map((m) => {
          const day = ist(m.at, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.sid}>
              {showDay && (
                <div className="day">
                  <span>{day}</span>
                </div>
              )}
              <Bubble m={m} />
            </div>
          );
        })}
      </div>

      <Composer conv={conv} mode={mode} setMode={setMode} onSent={onSent} toast={toast} />
    </>
  );
}

function Bubble({ m }: { m: Message }) {
  const failed = m.status === 'failed' || m.status === 'undelivered';
  let tick = '';
  if (m.dir === 'out') {
    if (m.status === 'read') tick = '✓✓';
    else if (m.status === 'delivered') tick = '✓✓';
    else if (failed) tick = '!';
    else tick = '✓';
  }
  return (
    <div className={`bubble ${m.dir}`}>
      {m.media > 0 && <MediaList sid={m.sid} />}
      {m.body && !(m.media > 0 && /\.\w{2,4}$/.test(m.body)) && <div className="text">{m.body}</div>}
      {m.dir === 'in' && m.error === 11751 && <div className="err">⚠️ {ERRORS['11751']}</div>}
      {m.dir === 'out' && failed && m.error && <div className="err">⚠️ {ERRORS[String(m.error)] || `Not delivered (Twilio error ${m.error})`}</div>}
      <div className="meta">
        {ist(m.at, { hour: 'numeric', minute: '2-digit' })}
        {tick && <span className={`tick ${m.status === 'read' ? 'read' : ''} ${failed ? 'bad' : ''}`}>{tick}</span>}
      </div>
    </div>
  );
}

function MediaList({ sid }: { sid: string }) {
  const [items, setItems] = useState<{ url: string; type: string }[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/media/${sid}`)
      .then((r) => r.json())
      .then((d) => alive && setItems(d.media || []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [sid]);
  if (!items) return <div className="media-loading">Loading file…</div>;
  if (!items.length) return <div className="media-loading">📎 File (no longer available)</div>;
  return (
    <>
      {items.map((it) => {
        if (it.type.startsWith('image/'))
          return (
            <a key={it.url} href={it.url} target="_blank" rel="noopener noreferrer">
              <img className="media" src={it.url} alt="Customer photo" loading="lazy" />
            </a>
          );
        if (it.type.startsWith('video/')) return <video key={it.url} className="media" src={it.url} controls preload="metadata" />;
        if (it.type.startsWith('audio/')) return <audio key={it.url} src={it.url} controls preload="metadata" />;
        return (
          <a key={it.url} className="file-link" href={it.url} target="_blank" rel="noopener noreferrer">
            📎 Open file ({it.type})
          </a>
        );
      })}
    </>
  );
}

function Composer({
  conv,
  mode,
  setMode,
  onSent,
  toast,
}: {
  conv: Conversation;
  mode: 'text' | 'template';
  setMode: (m: 'text' | 'template') => void;
  onSent: () => void;
  toast: (t: string) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<TemplateInfo[] | null>(null);
  const [tplSid, setTplSid] = useState('');
  const [vars, setVars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode !== 'template' || templates) return;
    fetch('/api/templates')
      .then((r) => r.json())
      .then((d) => {
        const list: TemplateInfo[] = d.templates || [];
        setTemplates(list);
        const preferred = list.find((t) => /team_message/.test(t.name)) || list[0];
        if (preferred) setTplSid(preferred.sid);
      })
      .catch(() => setTemplates([]));
  }, [mode, templates]);

  const tpl = templates?.find((t) => t.sid === tplSid) || null;

  useEffect(() => {
    if (!tpl) return;
    const v: Record<string, string> = {};
    for (const k of tpl.variables) v[k] = k === '1' ? firstName(conv) : '';
    if (/payment/.test(tpl.name) && tpl.variables.includes('2')) v['2'] = conv.amount || '299';
    setVars(v);
  }, [tpl, conv]);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: conv.phone, ...payload }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Not sent');
      toast('Sent');
      onSent();
      return true;
    } catch (e) {
      toast(`Not sent: ${(e as Error).message}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function sendText() {
    const t = text.trim();
    if (!t || busy) return;
    if (await post({ body: t })) setText('');
  }

  async function sendTemplate() {
    if (!tpl || busy) return;
    if (await post({ contentSid: tpl.sid, variables: vars })) {
      setVars((v) => Object.fromEntries(Object.keys(v).map((k) => [k, k === '1' ? v[k] : ''])));
    }
  }

  const preview = tpl ? tpl.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] || `{{${k}}}`) : '';

  return (
    <div className="composer">
      <div className="tabs">
        <button className={mode === 'text' ? 'tab on' : 'tab'} onClick={() => setMode('text')}>Free text</button>
        <button className={mode === 'template' ? 'tab on' : 'tab'} onClick={() => setMode('template')}>Template</button>
        <span className={`window ${conv.windowOpen ? 'open' : ''}`}>
          {conv.windowOpen ? '● Free chat open' : '● Free chat closed — use a template'}
        </span>
      </div>

      {mode === 'text' ? (
        <div className="compose-row">
          <textarea
            value={text}
            placeholder={conv.windowOpen ? 'Type a message…' : 'This customer has not messaged in 24 hours. WhatsApp only delivers templates — switch to the Template tab.'}
            disabled={!conv.windowOpen}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            rows={2}
          />
          <button className="btn-primary send" onClick={sendText} disabled={!conv.windowOpen || busy || !text.trim()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9 3 20.5Z" /></svg>
            Send
          </button>
        </div>
      ) : (
        <div className="tpl">
          {!templates && <div className="muted">Loading approved templates…</div>}
          {templates && templates.length === 0 && <div className="muted">No approved WhatsApp templates found in Twilio yet.</div>}
          {templates && templates.length > 0 && (
            <>
              <select value={tplSid} onChange={(e) => setTplSid(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.sid} value={t.sid}>
                    {t.name}
                    {t.category ? ` · ${t.category.toLowerCase()}` : ''}
                  </option>
                ))}
              </select>
              {tpl && tpl.variables.length > 0 && (
                <div className="vars">
                  {tpl.variables.map((k) => (
                    <label key={k}>
                      <span>{`{{${k}}}`}</span>
                      <input
                        value={vars[k] || ''}
                        placeholder={tpl.sample[k] || (k === '1' ? 'Name' : 'Your message')}
                        onChange={(e) => setVars({ ...vars, [k]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
              )}
              <div className="preview">{preview}</div>
              <div className="tpl-actions">
                <button className="btn-primary send" onClick={sendTemplate} disabled={busy || !tpl}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9 3 20.5Z" /></svg>
                  Send template
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Details({ conv, driveRoot, toast }: { conv: Conversation; driveRoot: string; toast: (t: string) => void }) {
  const folder = conv.folder || driveRoot;
  const hoursLeft = conv.lastInAt ? Math.max(0, 24 - (Date.now() - new Date(conv.lastInAt).getTime()) / 3600000) : 0;
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).then(() => toast('Copied'), () => toast('Could not copy'));
  };
  return (
    <aside className="details-pane">
      <div className="details-head">
        <div className="avatar big">{initials(conv)}</div>
        <div>
          <div className="details-name">{displayName(conv)}</div>
          <div className="eyebrow">Customer details</div>
        </div>
      </div>
      <span className={`status ${conv.status ? conv.status.toLowerCase() : 'none'}`}>{STATUS_LABEL[conv.status] || 'Not paid'}</span>

      <div className="section">
        <div className="section-title">Contact</div>
        <div className="field">
          <div>
            <div className="label">Phone</div>
            <div className="value">{conv.phone}</div>
          </div>
          <button className="copy" onClick={() => copy(conv.phone)}>Copy</button>
        </div>
        <div className="field">
          <div>
            <div className="label">WhatsApp window</div>
            <div className="value">{conv.windowOpen ? `Free chat open · ${Math.floor(hoursLeft)}h ${Math.round((hoursLeft % 1) * 60)}m left` : 'Closed · templates only'}</div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">AI Avatar order</div>
        <div className="field">
          <div>
            <div className="label">Payment</div>
            <div className="value">{conv.amount ? `₹${conv.amount} paid` : '—'}</div>
          </div>
        </div>
        <div className="field">
          <div>
            <div className="label">Reminders sent</div>
            <div className="value">{conv.status ? conv.reminders : '—'}</div>
          </div>
        </div>
        <div className="field">
          <div>
            <div className="label">Messages</div>
            <div className="value">
              {conv.messages.filter((m) => m.dir === 'in').length} received · {conv.messages.filter((m) => m.dir === 'out').length} sent
            </div>
          </div>
        </div>
        {folder && (
          <a className="link" href={folder} target="_blank" rel="noopener noreferrer">
            Open Drive folder →
          </a>
        )}
      </div>
    </aside>
  );
}
