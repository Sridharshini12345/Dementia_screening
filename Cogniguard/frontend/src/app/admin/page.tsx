"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#00c9a7', '#4f8ef7', '#a78bfa', '#f59e0b', '#fb7185', '#10b981', '#38bdf8'];

export default function AdminPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [testConfig, setTestConfig] = useState<any>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'patients' | 'reports' | 'feedback' | 'memories' | 'settings'>('overview');

  useEffect(() => {
    const user = getSessionUser();
    if (!user || user.role !== 'admin') { router.replace('/dashboard'); return; }

    Promise.all([
      apiFetch('/api/admin/overview'),
      apiFetch('/api/admin/patients'),
      apiFetch('/api/admin/reports'),
      apiFetch('/api/admin/feedback'),
      apiFetch('/api/admin/memories'),
      apiFetch('/api/admin/tests/config'),
    ]).then(([o, p, r, f, m, cfg]) => {
      setOverview(o); setPatients(p); setReports(r); setFeedback(f); setMemories(m); setTestConfig(cfg);
    }).catch((err: any) => setError(err.message || 'Failed to load admin data'));
  }, []);

  const refreshAdminData = async () => {
    const [o, p, r, f, m] = await Promise.all([
      apiFetch('/api/admin/overview'),
      apiFetch('/api/admin/patients'),
      apiFetch('/api/admin/reports'),
      apiFetch('/api/admin/feedback'),
      apiFetch('/api/admin/memories'),
    ]);
    setOverview(o);
    setPatients(p);
    setReports(r);
    setFeedback(f);
    setMemories(m);
  };

  const updateUserStatus = async (userId: number, isActive: boolean) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      });
      await refreshAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    }
  };

  const deleteUser = async (userId: number, name: string) => {
    const ok = window.confirm(`Delete user ${name} and all related data? This action cannot be undone.`);
    if (!ok) return;
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      await refreshAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };
  const overviewPie = overview ? [
    { name: 'Patients', value: overview.patients_count },
    { name: 'Reports', value: overview.reports_count },
    { name: 'Feedback', value: overview.feedback_count },
  ] : [];

  const riskDistribution = reports.length ? (() => {
    const bins = { Low: 0, Moderate: 0, High: 0 };
    reports.forEach((r: any) => {
      const score = r.risk_score * 100;
      if (score < 35) bins.Low++;
      else if (score < 65) bins.Moderate++;
      else bins.High++;
    });
    return [
      { name: 'Low Risk (<35%)', value: bins.Low, color: '#00c9a7' },
      { name: 'Moderate (35-65%)', value: bins.Moderate, color: '#f59e0b' },
      { name: 'High Risk (>65%)', value: bins.High, color: '#fb7185' },
    ];
  })() : [];

  const reportsPerPatient = patients.slice(0, 8).map(p => ({
    name: p.name?.split(' ')[0] || 'User',
    reports: reports.filter((r: any) => r.patient_name?.toLowerCase().includes(p.name?.split(' ')[0]?.toLowerCase())).length,
  }));

  const TABS = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'patients', label: `Patients (${patients.length})`, icon: '👥' },
    { key: 'reports', label: `Reports (${reports.length})`, icon: '📋' },
    { key: 'feedback', label: `Feedback (${feedback.length})`, icon: '💬' },
    { key: 'memories', label: `Memories (${memories.length})`, icon: '🧠' },
    { key: 'settings', label: 'Assessment Config', icon: '⚙️' },
  ];

  const updateConfigField = (path: 'word_bank' | 'number_bank' | 'memory_prompts.childhood' | 'memory_prompts.adult' | 'memory_prompts.recent', value: string) => {
    setTestConfig((prev: any) => {
      const base = prev && typeof prev === 'object' ? { ...prev } : {};
      if (path === 'word_bank' || path === 'number_bank') {
        base[path] = value
          .split(/\n|,/)
          .map((v) => v.trim())
          .filter(Boolean);
        return base;
      }

      const [, key] = path.split('.');
      base.memory_prompts = { ...(base.memory_prompts || {}), [key]: value };
      return base;
    });
  };

  const saveTestConfig = async () => {
    setConfigSaving(true);
    setConfigMessage('');
    try {
      const payload = {
        word_bank: Array.isArray(testConfig?.word_bank) ? testConfig.word_bank : [],
        number_bank: Array.isArray(testConfig?.number_bank) ? testConfig.number_bank : [],
        memory_prompts: {
          childhood: String(testConfig?.memory_prompts?.childhood || '').trim(),
          adult: String(testConfig?.memory_prompts?.adult || '').trim(),
          recent: String(testConfig?.memory_prompts?.recent || '').trim(),
        },
      };
      const res = await apiFetch('/api/admin/tests/config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res?.config) setTestConfig(res.config);
      setConfigMessage('Assessment questions updated successfully. New tests will use this configuration.');
    } catch (err: any) {
      setError(err.message || 'Failed to save assessment config');
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="full-bleed-section" style={{ width: '100%', padding: '16px 20px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <div className="card card-accent animate-fadeInUp" style={{ marginBottom: 24, padding: '24px 28px' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>
              ⚡ Admin Control Panel
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Full-access patient monitoring & analytics dashboard
            </p>
          </div>
          <div className="badge badge-purple" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>Admin Access</div>
        </div>
      </div>

      {error && <div className="alert alert-danger animate-fadeIn" style={{ marginBottom: 20 }}>⚠️ {error}</div>}
      {overview && (
        <div className="grid-4 grid animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.05s' }}>
          {[
            { label: 'Total Patients', value: overview.patients_count, icon: '👥', color: 'var(--blue)' },
            { label: 'Total Reports', value: overview.reports_count, icon: '📋', color: 'var(--accent)' },
            { label: 'Feedback Entries', value: overview.feedback_count, icon: '💬', color: 'var(--purple)' },
            { label: 'Avg Risk Score', value: `${(overview.average_risk_score * 100).toFixed(1)}%`, icon: '📊', color: 'var(--amber)' },
          ].map((s) => (
            <div key={s.label} className="card stat-card">
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</span>
              </div>
              <div className="font-heading" style={{ fontSize: '2rem', fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn btn-sm ${activeTab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(t.key as any)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'overview' && (
        <div className="grid-2 grid animate-fadeIn" style={{ gap: 20 }}>
          <div className="card">
            <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Platform Activity Mix</h2>
            {overviewPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={overviewPie} dataKey="value" outerRadius={100} innerRadius={55} strokeWidth={2} stroke="rgba(0,0,0,0.3)">
                    {overviewPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(8,18,38,0.95)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 8, color: '#e8f4f8' }} />
                  <Legend wrapperStyle={{ fontSize: '0.82rem', color: 'var(--text-muted)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data yet</div>
            )}
          </div>
          <div className="card">
            <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Patient Risk Distribution</h2>
            {riskDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={riskDistribution} dataKey="value" outerRadius={100} innerRadius={55} strokeWidth={2} stroke="rgba(0,0,0,0.3)">
                    {riskDistribution.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(8,18,38,0.95)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 8, color: '#e8f4f8' }}
                    formatter={(v: any, n: any, p: any) => [`${v} patients`, p.payload.name]} />
                  <Legend wrapperStyle={{ fontSize: '0.82rem', color: 'var(--text-muted)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No reports yet</div>
            )}
          </div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Reports per Patient</h2>
            {reportsPerPatient.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={reportsPerPatient} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'rgba(8,18,38,0.95)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 8, color: '#e8f4f8' }} />
                  <Bar dataKey="reports" fill="#00c9a7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No data yet</div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'patients' && (
        <div className="card animate-fadeIn">
          <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>👥 All Patients</h2>
          {patients.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No patients registered yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Memories</th><th>Created</th><th>Last Active</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-muted)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                            {p.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <span style={{ fontWeight: 600 }}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.email}</td>
                      <td><span className="badge badge-blue">{Number(p.shared_memories_count || 0)}</span></td>
                      <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}</td>
                      <td>{p.last_used_at ? new Date(p.last_used_at).toLocaleDateString() : 'Never'}</td>
                      <td>
                        <span className={`badge ${p.is_active === false ? 'badge-rose' : (p.last_used_at ? 'badge-accent' : 'badge-amber')}`}>
                          {p.is_active === false ? 'Restricted' : (p.last_used_at ? 'Active' : 'Pending')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {p.is_active === false ? (
                            <button className="btn btn-secondary btn-sm" onClick={() => updateUserStatus(p.id, true)}>Allow</button>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => updateUserStatus(p.id, false)}>Restrict</button>
                          )}
                          <button className="btn btn-danger btn-sm" onClick={() => deleteUser(p.id, p.name || `#${p.id}`)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'memories' && (
        <div className="card animate-fadeIn">
          <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>🧠 Shared Memories</h2>
          {memories.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No shared memories yet.</p>
          ) : (
            <div className="grid" style={{ gap: 12 }}>
              {memories.map((m: any) => (
                <div key={m.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700 }}>{m.user_name || 'Unknown'} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({m.user_email || 'no email'})</span></div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge badge-accent">{m.category || 'Adulthood'}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{m.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === 'reports' && (
        <div className="card animate-fadeIn">
          <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>📋 All Assessment Reports</h2>
          {reports.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No reports submitted yet.</p>
          ) : (
            <div className="grid" style={{ gap: 12 }}>
              {reports.map((r: any) => {
                const pct = Math.round(r.risk_score * 100);
                const color = pct < 35 ? 'badge-accent' : pct < 65 ? 'badge-amber' : 'badge-rose';
                const inputs = (r.user_inputs && typeof r.user_inputs === 'object') ? r.user_inputs : {};
                return (
                  <div key={r.id} style={{ display: 'flex', gap: 16, alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '14px 18px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 36, height: 36, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--accent)' }}>
                      #{r.id}
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 600 }}>{r.patient_name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.created_at}</div>
                    </div>
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Risk Score</div>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct < 35 ? '#00c9a7' : pct < 65 ? '#f59e0b' : '#fb7185' }} />
                      </div>
                    </div>
                    <span className={`badge ${color}`}>{pct}% risk</span>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 300 }}>{r.interpretation}</div>

                    {Object.keys(inputs).length > 0 && (
                      <div style={{ width: '100%', marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          User Test Inputs
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {Object.entries(inputs).map(([k, v]) => (
                            <div key={k} style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</strong> {String(v)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {activeTab === 'feedback' && (
        <div className="animate-fadeIn">
          {feedback.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
                Feedback Volume Overview
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={[{ name: 'Feedback Submitted', value: feedback.length }, { name: 'No Feedback', value: Math.max(0, patients.length - feedback.length) }]}
                      dataKey="value" innerRadius={60} outerRadius={90} strokeWidth={0}
                    >
                      <Cell fill="#4f8ef7" />
                      <Cell fill="rgba(255,255,255,0.05)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div>
                  <div style={{ fontSize: '3rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--blue)' }}>{feedback.length}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Total feedback entries</div>
                  <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {patients.length > 0 ? `${Math.round((feedback.length / patients.length) * 100)}% of patients gave feedback` : 'No patients yet'}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="card">
            <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>💬 All Feedback</h2>
            {feedback.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>No feedback submitted yet.</p>
            ) : (
              <div className="grid" style={{ gap: 12 }}>
                {feedback.map((f: any) => (
                  <div key={f.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '16px 18px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-muted)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                          {f.user_name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{f.user_name}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.created_at}</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{f.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="card animate-fadeIn" style={{ display: 'grid', gap: 16 }}>
          <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700 }}>⚙️ Assessment Question Configuration</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Configure the test prompts from this admin panel. Only admins can view/edit this section; regular users only see the final generated questions during tests.
          </p>

          <div className="grid-2 grid" style={{ gap: 16 }}>
            <div>
              <label className="form-label">Word Recall Bank (comma or new line separated)</label>
              <textarea
                className="form-control"
                rows={8}
                value={Array.isArray(testConfig?.word_bank) ? testConfig.word_bank.join(', ') : ''}
                onChange={(e) => updateConfigField('word_bank', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Number Recall Bank (comma or new line separated)</label>
              <textarea
                className="form-control"
                rows={8}
                value={Array.isArray(testConfig?.number_bank) ? testConfig.number_bank.join(', ') : ''}
                onChange={(e) => updateConfigField('number_bank', e.target.value)}
              />
            </div>
          </div>

          <div className="grid-3 grid" style={{ gap: 16 }}>
            <div>
              <label className="form-label">Childhood Prompt</label>
              <textarea
                className="form-control"
                rows={4}
                value={String(testConfig?.memory_prompts?.childhood || '')}
                onChange={(e) => updateConfigField('memory_prompts.childhood', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Adult Prompt</label>
              <textarea
                className="form-control"
                rows={4}
                value={String(testConfig?.memory_prompts?.adult || '')}
                onChange={(e) => updateConfigField('memory_prompts.adult', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Recent Prompt</label>
              <textarea
                className="form-control"
                rows={4}
                value={String(testConfig?.memory_prompts?.recent || '')}
                onChange={(e) => updateConfigField('memory_prompts.recent', e.target.value)}
              />
            </div>
          </div>

          {configMessage && <div className="alert alert-success">✅ {configMessage}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={saveTestConfig} disabled={configSaving}>
              {configSaving ? 'Saving...' : 'Save Question Config'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => apiFetch('/api/admin/tests/config').then(setTestConfig).catch(() => null)}
              disabled={configSaving}
            >
              Reload
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
