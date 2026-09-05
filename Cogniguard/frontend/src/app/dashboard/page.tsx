"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MemoryTree from '@/components/MemoryTree';
import ShareMemoryModal from '@/components/ShareMemoryModal';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import type { Memory } from '@/components/ShareMemoryModal';

export default function Dashboard() {
  const [reports, setReports] = useState<any[]>([]);
  const [latest, setLatest] = useState<any>(null);
  const [previous, setPrevious] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? '🌅 Good morning' : h < 17 ? '☀️ Good afternoon' : '🌙 Good evening');

    const user = getSessionUser();
    const path = user?.role === 'admin' ? '/api/admin/reports' : '/api/user/reports';
    apiFetch(path).then((data) => {
      setReports(data);
      setLatest(data[0] || null);
      setPrevious(data[1] || null);
    }).catch(() => undefined);
    apiFetch('/api/me').then(setMe).catch(() => undefined);

    apiFetch('/api/memories').then((items) => {
      const mapped: Memory[] = (Array.isArray(items) ? items : []).map((item: any) => ({
        id: String(item.id),
        category: String(item.category || 'Adulthood'),
        text: String(item.text || ''),
        createdAt: String(item.created_at || item.updated_at || new Date().toISOString()),
      }));
      setMemories(mapped);
    }).catch(() => setMemories([]));
  }, []);

  const user = getSessionUser();
  const isAdmin = user?.role === 'admin';
  const firstName = user?.name?.split(' ')[0] || 'there';

  const handleMemorySaved = (m: Memory) => {
    setMemories((prev) => [...prev, m]);
  };
  const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const score1 = clamp01(latest?.risk_score ?? 0.28);
  const score2 = clamp01(1 - Number(latest?.sections?.number_forward ?? latest?.sections?.word_forward ?? 0.72));
  const score3 = clamp01(1 - Number(latest?.sections?.adaptive ?? latest?.sections?.recent ?? 0.7));

  const STATS = [
    { label: 'Total Sessions', value: reports.length, icon: '📋', color: 'var(--blue)' },
    { label: 'Memories Shared', value: memories.length, icon: '🧠', color: 'var(--accent)' },
    { label: 'Risk Score', value: latest ? `${(latest.risk_score * 100).toFixed(1)}%` : 'N/A', icon: '📊', color: 'var(--amber)' },
    { label: 'Last Assessment', value: latest?.created_at ? new Date(latest.created_at).toLocaleDateString() : 'None', icon: '📅', color: 'var(--purple)' },
  ];

  return (
    <div className="full-bleed-section" style={{ width: '100%' }}>
      <div className="card page-hero animate-fadeInUp" style={{ 
        marginBottom: 32, 
        padding: '32px 40px',
        background: 'linear-gradient(135deg, rgba(0, 245, 212, 0.08), rgba(59, 130, 246, 0.05))',
        border: '1px solid rgba(0, 245, 212, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ 
          position: 'absolute', top: -20, right: -20, width: 120, height: 120, 
          background: 'var(--accent-glow)', borderRadius: '50%', filter: 'blur(40px)', zIndex: 0 
        }} />

        <div className="flex items-center justify-between" style={{ position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: 20 }}>
          <div>
            <p style={{ color: 'var(--accent)', fontSize: '0.95rem', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{greeting}</p>
            <h1 className="font-heading" style={{ fontSize: '2.8rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
              Welcome back, {firstName}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', opacity: 0.8 }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {!isAdmin && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowShareModal(true)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                🧠 Share a Memory
              </button>
              <Link href="/tests">
                <button className="btn btn-primary btn-lg" style={{ boxShadow: '0 0 20px var(--accent-glow)' }}>
                  🎯 Start Assessment
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="story-grid animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.08s' }}>
        <div className="card interactive-card">
          <p className="badge badge-blue" style={{ marginBottom: 10 }}>Daily Insight</p>
          <h3 className="font-heading" style={{ marginBottom: 8, fontSize: '1.25rem' }}>Consistency grows clarity</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Short sessions over multiple days improve signal quality for longitudinal cognitive trends.</p>
        </div>
        <div className="card interactive-card">
          <p className="badge badge-accent" style={{ marginBottom: 10 }}>Care Tip</p>
          <h3 className="font-heading" style={{ marginBottom: 8, fontSize: '1.25rem' }}>Anchor routines with memory cues</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Use names, places, and familiar stories in daily conversation to reinforce retrieval pathways.</p>
        </div>
      </div>
      <div className="grid-4 grid animate-fadeInUp" style={{ marginBottom: 32, animationDelay: '0.1s' }}>
        {STATS.map((s) => (
          <div key={s.label} className="card stat-card interactive-card" style={{ borderLeft: `3px solid ${s.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 
              }}>
                {s.icon}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</span>
            </div>
            <div className="font-heading" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="card interactive-card animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div>
            <h2 className="font-heading" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>🌳 Cognitive Memory Trees</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Each tree represents a cognitive domain. Greener = healthier recall.
            </p>
          </div>
          {!isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowShareModal(true)}>
              + Share Memory
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 }}>
          <MemoryTree
            score={score1}
            previousScore={previous?.risk_score}
            label="Overall Cognition"
            onShareClick={isAdmin ? undefined : () => setShowShareModal(true)}
          />
          <MemoryTree
            score={score2}
            label="Verbal Memory"
            onShareClick={isAdmin ? undefined : () => setShowShareModal(true)}
          />
          <MemoryTree
            score={score3}
            label="Adaptive Memory"
            onShareClick={isAdmin ? undefined : () => setShowShareModal(true)}
          />
        </div>
        {memories.length > 0 && (
          <>
            <div className="divider" />
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 12, color: 'var(--text-secondary)' }}>
                🧠 Your Shared Memories ({memories.length})
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {memories.slice(-6).map((m) => (
                  <div key={m.id} className="badge badge-accent" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    <span>{m.category}</span>
                    <span style={{ color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                      — {m.text.slice(0, 40)}{m.text.length > 40 ? '…' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {latest && (
        <div className="card interactive-card animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>📊 Latest Assessment Summary</h2>
          <div className="grid-2 grid">
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 8 }}>Report #{latest.id} — {latest.created_at}</p>
              <p><strong style={{ color: 'var(--accent)' }}>Risk Score:</strong> {(latest.risk_score * 100).toFixed(1)}%</p>
              <p style={{ marginTop: 6 }}>{latest.interpretation}</p>
              <div style={{ marginTop: 16 }}>
                <Link href="/reports">
                  <button className="btn btn-secondary btn-sm">View Full Report →</button>
                </Link>
              </div>
            </div>
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Section Scores</p>
              {Object.entries(latest.sections || {}).map(([k, v]: any) => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div className="flex justify-between" style={{ marginBottom: 4, fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: 600 }}>{(Number(v) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar-fill" style={{ width: `${Number(v) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!latest && !isAdmin && (
        <div className="card text-center animate-fadeInUp" style={{ animationDelay: '0.3s', padding: '48px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
          <h3 className="font-heading" style={{ marginBottom: 8 }}>No assessments yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Start your first cognitive assessment to see your Memory Trees come alive.</p>
          <Link href="/tests">
            <button className="btn btn-primary btn-lg">🎯 Begin First Assessment</button>
          </Link>
        </div>
      )}
      {showShareModal && !isAdmin && (
        <ShareMemoryModal
          onClose={() => setShowShareModal(false)}
          onSaved={handleMemorySaved}
        />
      )}
    </div>
  );
}
