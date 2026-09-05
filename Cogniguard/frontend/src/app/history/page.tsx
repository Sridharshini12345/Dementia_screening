"use client";
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function HistoryPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/user/reports')
      .then(setReports)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const getRiskColor = (score: number) => score < 0.35 ? '#00c9a7' : score < 0.65 ? '#f59e0b' : '#fb7185';
  const getBadge = (score: number) => score < 0.35 ? 'badge-accent' : score < 0.65 ? 'badge-amber' : 'badge-rose';
  const getRiskLabel = (score: number) => score < 0.35 ? 'Low Risk' : score < 0.65 ? 'Moderate' : 'High Risk';

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="card card-accent animate-fadeInUp" style={{ marginBottom: 24, padding: '24px 28px' }}>
        <h1 className="font-heading" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>📈 History & Progress</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Track your cognitive assessment history and progress over time.
        </p>
      </div>

      {loading && (
        <div className="grid" style={{ gap: 12 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />)}
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="card text-center animate-fadeInUp" style={{ padding: '60px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <h3 className="font-heading" style={{ marginBottom: 8 }}>No assessment history</h3>
          <p style={{ color: 'var(--text-muted)' }}>Complete your first assessment to start tracking your progress.</p>
        </div>
      )}

      {!loading && reports.length > 0 && (
        <>
          {reports.length >= 2 && (
            <div className="card animate-fadeInUp" style={{ marginBottom: 20, padding: '18px 24px' }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 2 }}>First Assessment</p>
                  <p className="font-heading" style={{ fontSize: '1.4rem', fontWeight: 800, color: getRiskColor(reports[reports.length - 1].risk_score) }}>
                    {Math.round(reports[reports.length - 1].risk_score * 100)}% risk
                  </p>
                </div>
                <div style={{ fontSize: '1.5rem' }}>→</div>
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 2 }}>Latest Assessment</p>
                  <p className="font-heading" style={{ fontSize: '1.4rem', fontWeight: 800, color: getRiskColor(reports[0].risk_score) }}>
                    {Math.round(reports[0].risk_score * 100)}% risk
                  </p>
                </div>
                <div>
                  {reports[0].risk_score < reports[reports.length - 1].risk_score
                    ? <span className="badge badge-accent">📉 Improving</span>
                    : reports[0].risk_score > reports[reports.length - 1].risk_score
                      ? <span className="badge badge-rose">📈 Increasing</span>
                      : <span className="badge badge-amber">➡️ Stable</span>
                  }
                </div>
              </div>
            </div>
          )}

          <div className="grid animate-fadeInUp" style={{ gap: 14, animationDelay: '0.1s' }}>
            {reports.map((r, idx) => {
              const pct = Math.round(r.risk_score * 100);
              const col = getRiskColor(r.risk_score);
              const pieData = [{ value: pct }, { value: 100 - pct }];
              return (
                <div key={r.id} className="card" style={{ padding: '18px 22px' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-muted)', minWidth: 32, textAlign: 'center' }}>
                      #{reports.length - idx}
                    </div>
                    <div style={{ width: 72, height: 72, flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" innerRadius={22} outerRadius={34} startAngle={90} endAngle={-270} strokeWidth={0}>
                            <Cell fill={col} /><Cell fill="rgba(255,255,255,0.05)" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ textAlign: 'center', marginTop: -44, fontWeight: 800, fontSize: '0.82rem', color: col }}>{pct}%</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <span className="font-heading" style={{ fontWeight: 700 }}>Session #{r.session_id || r.id}</span>
                        <span className={`badge ${getBadge(r.risk_score)}`}>{getRiskLabel(r.risk_score)}</span>
                        {idx === 0 && <span className="badge badge-blue">Latest</span>}
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString() : 'Unknown date'}
                      </p>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>{r.interpretation}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
