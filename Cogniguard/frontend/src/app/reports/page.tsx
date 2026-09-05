"use client";
import { useEffect, useRef, useState } from 'react';
import { API_BASE, apiFetch, authHeaders } from '@/lib/api';
import { getSessionUser } from '@/lib/auth';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [error, setError] = useState('');
  const reportCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const printRef = useRef<HTMLDivElement | null>(null);
  const [printReport, setPrintReport] = useState<any | null>(null);

  const addCanvasToPdf = (canvas: HTMLCanvasElement, pdf: any) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageCanvasHeight = Math.floor((canvas.width * pageHeight) / pageWidth);

    let renderedHeight = 0;
    let firstPage = true;

    while (renderedHeight < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const imgData = pageCanvas.toDataURL('image/png');
      const sliceImgHeight = (sliceHeight * pageWidth) / canvas.width;

      if (!firstPage) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, sliceImgHeight);

      renderedHeight += sliceHeight;
      firstPage = false;
    }
  };

  const downloadReport = async (id: number, name: string) => {
    try {
      const h = authHeaders();
      const res = await fetch(`${API_BASE}/api/reports/${id}/download`, { headers: h });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CogniGuard_Report_${name}_${id}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Download failed');
    }
  };

  const downloadVisualPdf = async (id: number, name: string) => {
    const report = reports.find((r) => r.id === id);
    if (!report) return;

    try {
      const { default: jsPDF } = await import('jspdf');
      setPrintReport(report);
      await new Promise((resolve) => setTimeout(resolve, 60));
      const node = printRef.current;
      if (!node) return;

      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
        scrollY: 0,
        onclone: (doc) => {
          const body = doc.body as HTMLElement | null;
          if (body) {
            body.style.width = '1100px';
            body.style.background = '#ffffff';
          }

          doc.querySelectorAll<HTMLElement>('.animate-fadeInUp, .animate-fadeIn, .animate-scaleIn').forEach((el) => {
            el.style.animation = 'none';
            el.style.opacity = '1';
            el.style.transform = 'none';
          });

          const clonedRoot = doc.querySelector('[data-report-print-root]') as HTMLElement | null;
          if (clonedRoot) {
            clonedRoot.style.background = '#ffffff';
            clonedRoot.style.color = '#173842';
          }
        },
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      addCanvasToPdf(canvas, pdf);

      pdf.save(`CogniGuard_Report_${name}_${id}.pdf`);
    } catch (err: any) {
      alert(err.message || 'PDF export failed');
    } finally {
      setPrintReport(null);
    }
  };

  useEffect(() => {
    const user = getSessionUser();
    const r = (user?.role || 'user') as 'admin' | 'user';
    setRole(r);
    const path = r === 'admin' ? '/api/admin/reports' : '/api/user/reports';
    apiFetch(path).then(setReports).catch((err: any) => setError(err.message || 'Failed to load reports'));
  }, []);

  const getRiskColor = (score: number) => score < 0.35 ? '#00c9a7' : score < 0.65 ? '#f59e0b' : '#fb7185';
  const getRiskLabel = (score: number) => score < 0.35 ? 'Low Risk' : score < 0.65 ? 'Moderate' : 'High Risk';
  const getBadge = (score: number) => score < 0.35 ? 'badge-accent' : score < 0.65 ? 'badge-amber' : 'badge-rose';

  const buildRows = (report: any) => {
    const entries = Object.entries(report?.sections || {});
    return entries.map(([key, value]: any) => {
      const pct = Math.round(Number(value || 0) * 100);
      return {
        key,
        label: String(key).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
        pct,
        status: pct >= 70 ? 'Strong' : pct >= 45 ? 'Moderate' : 'Needs work',
      };
    });
  };

  return (
    <div className="full-bleed-section" style={{ width: '100%', padding: '20px' }}>
      <div className="card card-accent page-hero animate-fadeInUp" style={{ marginBottom: 24, padding: '32px 40px' }}>
        <h1 className="font-heading" style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>
          📋 Assessment Reports
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
          {role === 'admin' ? 'All patient cognitive assessment reports.' : 'Your historical cognitive assessment reports. Download any report as a text file.'}
        </p>
      </div>

      <div className="story-grid animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.06s', gap: 12 }}>
        <div className="card interactive-card">
          <h3 className="font-heading" style={{ marginBottom: 10, fontSize: '1.2rem' }}>Track progression</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>Compare current section scores with previous sessions to monitor change over time.</p>
        </div>
        <div className="card interactive-card">
          <h3 className="font-heading" style={{ marginBottom: 10, fontSize: '1.2rem' }}>Share with clinician</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>Downloaded reports are formatted for quick review in routine appointments.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger animate-fadeIn" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

      {reports.length === 0 && !error && (
        <div className="card text-center animate-fadeInUp" style={{ padding: '80px 40px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
          <h3 className="font-heading" style={{ marginBottom: 8, fontSize: '1.4rem' }}>No reports yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Complete an assessment to generate your first report.</p>
        </div>
      )}

      <div className="animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        {reports.map((r) => {
          const pct = Math.round(r.risk_score * 100);
          const col = getRiskColor(r.risk_score);
          const pieData = [{ value: pct }, { value: 100 - pct }];

          return (
            <div
              key={r.id}
              ref={(el) => { reportCardRefs.current[r.id] = el; }}
              className="card interactive-card"
              style={{ padding: '24px 28px', marginBottom: 16 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center', gridAutoFlow: 'row wrap' }}>
                <div style={{ width: 100, height: 100, flexShrink: 0, gridRow: '1 / 3', gridColumn: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" innerRadius={32} outerRadius={45} startAngle={90} endAngle={-270} strokeWidth={0}>
                        <Cell fill={col} />
                        <Cell fill="rgba(255,255,255,0.05)" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ textAlign: 'center', marginTop: -60, fontWeight: 800, fontSize: '1.2rem', fontFamily: 'var(--font-heading)', color: col }}>
                    {pct}%
                  </div>
                </div>
                <div style={{ gridColumn: 2, gridRow: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <h3 className="font-heading" style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                      Report #{r.id} {role === 'admin' && r.patient_name ? `— ${r.patient_name}` : ''}
                    </h3>
                    <span className={`badge ${getBadge(r.risk_score)}`}>{getRiskLabel(r.risk_score)}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString() : 'Date unknown'}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{r.interpretation}</p>
                </div>
                <div style={{ gridColumn: 3, gridRow: 1, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => downloadVisualPdf(r.id, r.patient_name || 'report')}
                    style={{ height: 'fit-content' }}
                  >
                    ⬇️ PDF
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => downloadReport(r.id, r.patient_name || 'report')}
                    style={{ height: 'fit-content' }}
                  >
                    HTML
                  </button>
                </div>
                {r.sections && (
                  <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    {Object.entries(r.sections || {}).map(([k, v]: any) => (
                      <div key={k}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 500 }}>{k.replace(/_/g, ' ')}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round(Number(v) * 100)}%</span>
                        </div>
                        <div className="progress-bar-wrap" style={{ height: 6 }}>
                          <div className="progress-bar-fill" style={{ width: `${Number(v) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {printReport && (
        <div style={{ position: 'fixed', left: -10000, top: 0, width: 1100, background: '#fff', zIndex: -1 }}>
          <div data-report-print-root ref={printRef} style={{ padding: 24, fontFamily: 'Manrope, sans-serif', color: '#173842', background: '#ffffff', width: '100%' }}>
            <div style={{ border: '1px solid rgba(18,89,102,0.18)', borderRadius: 18, padding: 22, marginBottom: 18, background: 'linear-gradient(135deg, rgba(0,127,138,0.08), rgba(47,125,200,0.08), rgba(255,255,255,0.92))', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Assessment Results</h1>
              <p style={{ margin: '8px 0 0 0', color: '#40616a', fontSize: 14 }}>Completed on {printReport.created_at ? new Date(printReport.created_at).toLocaleString() : 'N/A'}</p>
            </div>

            <div style={{ border: '1px solid rgba(18,89,102,0.15)', borderRadius: 18, padding: 24, marginBottom: 18, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
                <div>
                  <p style={{ margin: 0, color: '#6f8f96', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overall Risk</p>
                  <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: getRiskColor(Number(printReport.risk_score || 0)) }}>
                    {Math.round(Number(printReport.risk_score || 0) * 100)}%
                  </div>
                  <div style={{ marginTop: 8, display: 'inline-block', borderRadius: 999, background: 'rgba(0,127,138,0.1)', border: '1px solid rgba(0,127,138,0.25)', padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>
                    {getRiskLabel(Number(printReport.risk_score || 0))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <p style={{ margin: 0, color: '#40616a', lineHeight: 1.7 }}>{printReport.interpretation || 'No interpretation available.'}</p>
                </div>
              </div>
            </div>

            <div style={{ border: '1px solid rgba(18,89,102,0.15)', borderRadius: 18, padding: 22, marginBottom: 18, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <h2 style={{ margin: 0, fontSize: 22, marginBottom: 14 }}>Level-by-Level Breakdown</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #d6e6e9' }}>Level</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #d6e6e9' }}>Score</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #d6e6e9' }}>Performance</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #d6e6e9' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {buildRows(printReport).map((row) => (
                    <tr key={row.key}>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #edf3f4' }}>{row.label}</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #edf3f4', fontWeight: 700 }}>{row.pct}%</td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #edf3f4' }}>
                        <div style={{ height: 8, borderRadius: 99, background: 'rgba(6,68,78,0.12)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${row.pct}%`, background: 'linear-gradient(135deg, #007f8a, #5cbec6)' }} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', borderBottom: '1px solid #edf3f4' }}>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ border: '1px solid rgba(18,89,102,0.15)', borderRadius: 18, padding: 22, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <h2 style={{ margin: 0, fontSize: 22, marginBottom: 10 }}>Clinical Notes</h2>
              <p style={{ margin: 0, lineHeight: 1.7, color: '#40616a' }}>{printReport.doctor_summary || 'No clinical notes provided.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
