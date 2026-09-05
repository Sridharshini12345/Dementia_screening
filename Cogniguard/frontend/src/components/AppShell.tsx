"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getSessionUser, SessionUser } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/register'];

const NAV_ITEMS = [
  { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { href: '/share-memory', icon: '🧠', label: 'Share Memory' },
  { href: '/tests', icon: '🎯', label: 'Take Test' },
  { href: '/reports', icon: '📋', label: 'Previous Reports' },
  { href: '/profile', icon: '👤', label: 'Profile' },
  { href: '/feedback', icon: '💬', label: 'Feedback' },
];

const ADMIN_HIDDEN_NAV = new Set(['/share-memory', '/tests', '/feedback']);
const ADMIN_RESTRICTED_PATHS = new Set(['/share-memory', '/tests', '/feedback']);

const ADMIN_ITEMS = [
  { href: '/admin', icon: '⚡', label: 'Admin Panel' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentPath = pathname ?? '';
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const u = getSessionUser();
    setUser(u);
    if (!u && !PUBLIC_PATHS.includes(currentPath)) {
      router.replace('/login');
    }
    if (u?.role === 'admin' && ADMIN_RESTRICTED_PATHS.has(currentPath)) {
      router.replace('/admin');
    }
  }, [currentPath, router]);

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  const isPublic = PUBLIC_PATHS.includes(currentPath);

  if (!mounted) return null;
  if (isPublic) {
    return <>{children}</>;
  }
  if (!user) return null;

  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const visibleNavItems = user.role === 'admin'
    ? NAV_ITEMS.filter((item) => !ADMIN_HIDDEN_NAV.has(item.href))
    : NAV_ITEMS;

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        <div className="sidebar-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="sidebar-logo">🧬</div>
          <span className="sidebar-brand" style={{ letterSpacing: '-0.01em' }}>CogniGuard</span>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${currentPath === item.href ? 'active' : ''}`}
            >
              <span className="link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

          {user.role === 'admin' && (
            <>
              <div className="sidebar-section-label" style={{ marginTop: 8 }}>Admin</div>
              {ADMIN_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${currentPath === item.href ? 'active' : ''}`}
                >
                  <span className="link-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name" style={{ color: 'var(--text-primary)' }}>{user.name}</div>
              <div className="user-role" style={{ color: 'var(--accent)', opacity: 0.8 }}>{user.role === 'admin' ? '⚡ System Admin' : '👤 Patient Profile'}</div>
            </div>
          </div>
          <button
            className="sidebar-link"
            onClick={handleLogout}
            style={{ 
              width: '100%', 
              border: 'none', 
              cursor: 'pointer', 
              background: 'transparent',
              marginTop: '4px'
            }}
          >
            <span className="link-icon" style={{ opacity: 0.7 }}>🚪</span>
            <span style={{ opacity: 0.7 }}>Logout</span>
          </button>
        </div>
      </aside>
      <main className="main-content animate-fadeIn">
        <div className="page-shell">
        {children}
        </div>
      </main>
    </div>
  );
}
