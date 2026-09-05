"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { saveSession } from '@/lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveSession(data.token, data.user);
      router.push(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="hero-bg">
        <div className="neural-dots" />
      </div>
      <div className="auth-left animate-fadeIn">
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 72, marginBottom: 20, filter: 'drop-shadow(0 0 20px var(--accent-glow))' }}>🧬</div>
          <h1 className="font-heading" style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>
            <span style={{ background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CogniGuard
            </span>
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: 440, lineHeight: 1.6, margin: '0 auto' }}>
            The next generation of <span style={{ color: 'var(--accent)' }}>AI-assisted</span> cognitive screening.
          </p>
        </div>

        <div className="grid" style={{ gap: 20, maxWidth: 420, width: '100%' }}>
          {[
            { icon: '🎯', title: 'Smart Assessment', desc: 'Multidimensional cognitive signals analysis' },
            { icon: '🌳', title: 'Memory Mapping', desc: 'Interactive visual growth of your cognitive health' },
            { icon: '🔐', title: 'Medical Grade Security', desc: 'AES-256 encryption for all your private data' },
          ].map((f) => (
            <div key={f.title} className="card animate-fadeInUp" style={{ padding: '20px', display: 'flex', gap: 16, alignItems: 'center', textAlign: 'left', background: 'var(--bg-card)' }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, background: 'var(--accent-muted)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{f.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="auth-right">
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <h2 className="font-heading" style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 8 }}>Welcome back</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sign in to your CogniGuard account</p>
          </div>

          <div className="glass-panel animate-scaleIn">
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-control"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Password</label>
                <input
                  id="login-password"
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="alert alert-danger mb-4">
                  ⚠️ {error}
                </div>
              )}

              <button id="login-btn" type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginBottom: 24 }} disabled={loading}>
                {loading ? (
                  <span>⏳ Authenticating…</span>
                ) : (
                  <span>🔐 Sign In Securely</span>
                )}
              </button>
            </form>

            <div className="divider" />

            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
                Don't have an account?{' '}
                <Link href="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  Create one now →
                </Link>
              </p>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Use your registered credentials to sign in securely.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
