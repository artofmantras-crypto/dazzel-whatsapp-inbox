'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Inbox' },
  { href: '/templates', label: 'Templates' },
  { href: '/settings', label: 'Settings' },
];

export default function TopBar({ children }: { children?: React.ReactNode }) {
  const path = usePathname();
  return (
    <header className="topbar">
      <div className="brand">
        <img src="/logo.jpg" alt="" />
        <div>
          <div className="brand-title">WhatsApp</div>
          <div className="brand-sub">Dazzel Digital customer conversations</div>
        </div>
      </div>
      <nav className="nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? 'nav-link on' : 'nav-link'}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="topbar-actions">{children}</div>
    </header>
  );
}
