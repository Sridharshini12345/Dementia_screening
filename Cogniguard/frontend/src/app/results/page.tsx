"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getResultStorageKey } from '@/lib/auth';
import html2canvas from 'html2canvas';

const LEVEL_META: Record<string, { label: string; icon: string; color: string }> = {
  word_forward: { label: 'Word Recall Forward', icon: '🔤', color: '#00c9a7' },
  word_reverse: { label: 'Word Recall Reverse', icon: '🔄', color: '#4f8ef7' },
  number_forward: { label: 'Number Recall Forward', icon: '🧮', color: '#a78bfa' },
  number_reverse: { label: 'Number Recall Reverse', icon: '➗', color: '#f59e0b' },
  childhood: { label: 'Childhood Memory', icon: '🧒', color: '#10b981' },
  adult: { label: 'Adult Memory', icon: '🧑', color: '#fb7185' },
  recent: { label: 'Recent Memory', icon: '🌿', color: '#38bdf8' },
  adaptive: { label: 'Adaptive Follow-up', icon: '🧠', color: '#a78bfa' },
};

const ADVICE_BY_SCORE = (overall: number) => {
  if (overall >= 0.75) return {
    level: 'Excellent',
    color: '#00c9a7',
    icon: '🌟',
    message: "Outstanding cognitive performance! Your brain is functioning at a high level.",
    tips: [
      '🧩 Keep challenging your mind with puzzles, crosswords, and new skills.',
      '🏃 Maintain regular physical exercise — 30 min daily cardio is ideal.',
      '🥗 Continue a brain-healthy diet rich in omega-3s, blueberries, and leafy greens.',
      '💤 Prioritise 7–9 hours of quality sleep every night.',
      '🤝 Stay socially connected — regular engagement protects cognitive reserve.',
      '📚 Read widely and engage in lifelong learning activities.',
    ]
  };
  if (overall >= 0.55) return {
    level: 'Good',
    color: '#4f8ef7',
    icon: '💙',
    message: "Good cognitive function with some areas to strengthen. Small daily habits make a big difference.",
    tips: [
      '🎵 Try music therapy — learning an instrument stimulates multiple brain regions.',
      '🧘 Practice mindfulness or meditation for 10 minutes daily to reduce stress hormones.',
      '✍️ Keep a daily journal — writing improves language recall and verbal fluency.',
      '🌿 Incorporate turmeric, nuts, and fish into your diet for neuroprotection.',
      '🎮 Play memory games and brain-training apps for 15–20 minutes daily.',
      '🚶 Take walks in nature — green spaces reduce cognitive stress.',
    ]
  };
  if (overall >= 0.35) return {
    level: 'Moderate Concern',
    color: '#f59e0b',
    icon: '⚠️',
    message: "Some cognitive areas need attention. We recommend consistent mental exercise and speaking with a healthcare professional.",
    tips: [
      '🏥 Schedule a consultation with a neurologist or geriatrician for a comprehensive evaluation.',
      '💊 Ask your doctor about vitamin D, B12, and folate levels — deficiencies affect cognition.',
      '📅 Establish strong daily routines — structure reduces cognitive load.',
      '👨‍👩‍👧 Involve family or caregivers in your daily activities for support.',
      '🎨 Engage in creative activities: painting, knitting, gardening — all protect cognition.',
      '📵 Limit screen time and reduce social isolation.',
    ]
  };
  return {
    level: 'High Risk',
    color: '#fb7185',
    icon: '🔴',
    message: "Significant cognitive indicators detected. Please consult a healthcare professional as soon as possible.",
    tips: [
      '🏥 Seek immediate medical evaluation — early intervention is the most effective strategy.',
      '💬 Talk to your doctor about cognitive assessment tools like MMSE or MoCA.',
      '🧑‍⚕️ Ask about cognitive rehabilitation therapy programmes.',
      '🏠 Consider environmental modifications for safety and daily living support.',
      '📋 Connect with Alzheimer\'s/dementia support groups and caregiver networks.',
      '❤️ Remember: a diagnosis is the beginning of a care plan, not the end of life.',
    ]
  };
};

const CONVERSATIONS: Record<string, string[]> = {
  high: [
    "You did a wonderful job today — it takes courage to complete this assessment.",
    "Every answer you gave helps us understand your unique cognitive profile better.",
    "The areas where you found difficulty are exactly what we'll focus on supporting.",
    "Remember: many conditions are treatable when caught early. You've done the right thing.",
  ],
  mid: [
    "Excellent effort throughout the assessment! You showed real determination.",
    "Your responses gave us valuable insights across all seven domains.",
    "There are clear strengths in your cognition — let's build on those.",
    "With the right activities and support, you can strengthen every area we've identified.",
  ],
  good: [
    "Brilliant work! Your cognitive performance is something to be proud of.",
    "Your memory recall, reasoning, and life-context responses were all impressive.",
    "Keep doing what you're doing — your lifestyle habits clearly support brain health.",
    "See you at your next assessment — stay curious and keep challenging your mind! 🧬",
  ],
};

function MiniPie({ score, color, label, icon }: { score: number; color: string; label: string; icon: string }) {
  const pct = Math.round(score * 100);
  const data = [{ value: pct }, { value: 100 - pct }];
  return (
    <div className="chart-container">
      <div className="chart-title">{icon} {label}</div>
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={48} outerRadius={72} startAngle={90} endAngle={-270} strokeWidth={0}>
            <Cell fill={color} />
            <Cell fill="rgba(255,255,255,0.05)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', marginTop: -16 }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color }}>{pct}%</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>performance</div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const reportRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<any>(null);
  const [chatIdx, setChatIdx] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfExportMode, setPdfExportMode] = useState(false);

  useEffect(() => {
    const r = localStorage.getItem(getResultStorageKey());
    if (!r) { router.replace('/tests'); return; }
    setResult(JSON.parse(r));
    setTimeout(() => setShowChat(true), 800);
  }, []);

  if (!result) return (
    <div className="text-center" style={{ padding: '80px' }}>
      <div style={{ fontSize: 40 }}>⏳</div>
      <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Loading results…</p>
    </div>
  );

  const { scores, overallRisk, date, details = {} } = result;
  const overallPerf = 1 - overallRisk;
  const advice = ADVICE_BY_SCORE(overallPerf);
  const chatMessages = overallPerf >= 0.75 ? CONVERSATIONS.good : overallPerf >= 0.5 ? CONVERSATIONS.mid : CONVERSATIONS.high;

  const averageScore = (() => {
    const vals = Object.values(scores || {}).map((v) => Number(v) || 0);
    if (!vals.length) return 0;
    return vals.reduce((sum, v) => sum + v, 0) / vals.length;
  })();

  const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const toPct = (value: number) => Math.round(clamp01(value) * 100);

  const resolveRowMetrics = (sectionKey: string, sectionScore: number) => {
    const d: any = details?.[sectionKey] || {};
    const perf = clamp01(sectionScore);
    const correctness = clamp01(typeof d.correctness === 'number' ? d.correctness : typeof d.score === 'number' ? d.score : perf);
    const speed = clamp01(typeof d.responseTime === 'number' ? d.responseTime : perf);
    const speech = clamp01(typeof d.speechActivity === 'number' ? d.speechActivity : perf);
    const flow = clamp01(typeof d.pauseControl === 'number' ? d.pauseControl : perf);
    return { correctness, speed, speech, flow };
  };

  const addSectionCanvasToPdf = (canvas: HTMLCanvasElement, pdf: any, y: number) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const maxHeightOnPage = pageHeight - margin * 2;
    const fullImgHeight = (canvas.height * contentWidth) / canvas.width;

    if (fullImgHeight <= maxHeightOnPage) {
      if (y + fullImgHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, contentWidth, fullImgHeight);
      return y + fullImgHeight + 5;
    }

    const pageCanvasHeight = Math.floor((canvas.width * maxHeightOnPage) / contentWidth);
    let renderedHeight = 0;

    while (renderedHeight < canvas.height) {
      if (y > margin) {
        pdf.addPage();
        y = margin;
      }

      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const imgData = pageCanvas.toDataURL('image/png');
      const sliceImgHeight = (sliceHeight * contentWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', margin, y, contentWidth, sliceImgHeight);

      renderedHeight += sliceHeight;
      y += sliceImgHeight + 4;
    }

    return y;
  };
  const overallData = Object.entries(scores).map(([key, val]) => ({
    name: LEVEL_META[key]?.label || key,
    value: Math.round((val as number) * 100),
    color: LEVEL_META[key]?.color || '#888',
  }));

  const metricPieData = (() => {
    const sectionEntries = Object.entries(scores || {});
    const n = Math.max(1, sectionEntries.length);

    let correctness = 0;
    let responseSpeed = 0;
    let speakingActivity = 0;
    let flowPause = 0;

    sectionEntries.forEach(([key, val]) => {
      const metrics = resolveRowMetrics(key, Number(val) || averageScore);
      correctness += metrics.correctness;
      responseSpeed += metrics.speed;
      speakingActivity += metrics.speech;
      flowPause += metrics.flow;
    });

    const c = toPct(correctness / n);
    const s = toPct(responseSpeed / n);
    const sp = toPct(speakingActivity / n);
    const f = toPct(flowPause / n);

    return [
      { name: 'Correctness', value: c, color: '#00c9a7' },
      { name: 'Response Speed', value: s, color: '#4f8ef7' },
      { name: 'Speaking Activity', value: sp, color: '#a78bfa' },
      { name: 'Flow / Pause Control', value: f, color: '#f59e0b' },
    ];
  })();

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;

    try {
      setExportingPdf(true);
      setPdfExportMode(true);
      await new Promise((resolve) => setTimeout(resolve, 120));

      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let y = 10;

      const sectionNodes = Array.from(reportRef.current.querySelectorAll<HTMLElement>('[data-pdf-section="true"]'));
      const targets = sectionNodes.length ? sectionNodes : [reportRef.current];

      for (const node of targets) {
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: Math.max(node.scrollWidth, 1120),
          windowHeight: node.scrollHeight,
          scrollY: -window.scrollY,
          onclone: (doc) => {
            const body = doc.body as HTMLElement | null;
            if (body) {
              body.style.width = '1120px';
              body.style.background = '#ffffff';
            }

            doc.querySelectorAll<HTMLElement>('.animate-fadeInUp, .animate-fadeIn, .animate-scaleIn').forEach((el) => {
              el.style.animation = 'none';
              el.style.opacity = '1';
              el.style.transform = 'none';
            });

            const clonedRoot = doc.getElementById('results-export-root');
            if (clonedRoot) {
              clonedRoot.style.background = '#ffffff';
              clonedRoot.style.color = '#0f172a';
            }
          },
        });

        y = addSectionCanvasToPdf(canvas, pdf, y);
      }

      pdf.save(`CogniGuard_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      window.alert(err?.message || 'Failed to generate PDF report.');
    } finally {
      setExportingPdf(false);
      setPdfExportMode(false);
    }
  };

  return (
    <div className="full-bleed-section" style={{ width: '100%', padding: '16px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      <div className="flex items-center justify-between animate-fadeIn" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="font-heading" style={{ fontSize: '1.6rem', fontWeight: 800 }}>📊 Assessment Results</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Completed on {new Date(date).toLocaleString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => router.push('/tests')}>🔄 Retake Assessment</button>
          <button className="btn btn-primary" onClick={handleDownloadPDF} disabled={exportingPdf}>
            {exportingPdf ? 'Generating PDF...' : '⬇️ Download PDF Report'}
          </button>
        </div>
      </div>
      <div id="results-export-root" ref={reportRef} style={exportingPdf ? { background: '#ffffff', color: '#0f172a', padding: 8 } : undefined}>
        <div data-pdf-section="true" className="card card-accent animate-fadeInUp" style={{ marginBottom: 24, padding: '32px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overall Performance</p>
              <div style={{ fontSize: '4rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: advice.color, lineHeight: 1 }}>
                {Math.round(overallPerf * 100)}%
              </div>
              <div style={{ marginTop: 8 }}>
                <span className="badge" style={{ background: `${advice.color}20`, color: advice.color, border: `1px solid ${advice.color}40`, fontSize: '0.9rem', padding: '6px 16px' }}>
                  {advice.icon} {advice.level}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.7, fontSize: '0.95rem', maxWidth: 400 }}>
                {advice.message}
              </p>
            </div>
            <div style={{ width: 320, minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overallData} dataKey="value" outerRadius={100} innerRadius={55} startAngle={90} endAngle={-270} strokeWidth={2} stroke="rgba(0,0,0,0.3)">
                    {overallData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(8,18,38,0.95)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 8, color: '#e8f4f8' }} formatter={(v: any) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
              </div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))', gap: 6, width: '100%' }}>
                {overallData.map((d) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div data-pdf-section="true" className="card animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.1s', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <h2 className="font-heading" style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 20 }}>📈 Level-by-Level Breakdown</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {Object.entries(scores).map(([key, val]) => {
              const meta = LEVEL_META[key] || { label: key, icon: '📊', color: '#888' };
              return (
                <MiniPie key={key} score={val as number} color={meta.color} label={meta.label} icon={meta.icon} />
              );
            })}
          </div>
        </div>
        <div data-pdf-section="true" className="card animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.12s', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <h2 className="font-heading" style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>🧠 Scoring Dimensions (Average Across Levels)</h2>
          <div style={{ width: '100%', height: 340, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 560 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metricPieData} dataKey="value" innerRadius={70} outerRadius={110} startAngle={90} endAngle={-270}>
                  {metricPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(8,18,38,0.95)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 8, color: '#e8f4f8' }} formatter={(v: any) => [`${v}%`]} />
                <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} />
              </PieChart>
            </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div data-pdf-section="true" className="card animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.15s', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <h2 className="font-heading" style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>📋 Detailed Scores</h2>
          <table className="data-table" style={{ width: '100%', tableLayout: pdfExportMode ? 'fixed' : 'auto', fontSize: pdfExportMode ? '0.82rem' : undefined }}>
            <thead>
              <tr>
                <th>Level</th>
                <th>Score</th>
                <th>Performance</th>
                <th>Correctness</th>
                <th>Speed</th>
                <th>Speech</th>
                <th>Flow</th>
                {!pdfExportMode && <th>Status</th>}
              </tr>
            </thead>
            <tbody>
              {Object.entries(scores).map(([key, val]) => {
                const meta = LEVEL_META[key] || { label: key, icon: '📊', color: '#888' };
                const pct = Math.round((val as number) * 100);
                const rowMetrics = resolveRowMetrics(key, Number(val) || 0);
                const rowCorrectness = toPct(rowMetrics.correctness);
                const rowSpeed = toPct(rowMetrics.speed);
                const rowSpeech = toPct(rowMetrics.speech);
                const rowFlow = toPct(rowMetrics.flow);
                const status = pct >= 70 ? ['Strong', 'badge-accent'] : pct >= 45 ? ['Moderate', 'badge-amber'] : ['Needs Work', 'badge-rose'];
                return (
                  <tr key={key}>
                    <td><span style={{ fontWeight: 600 }}>{meta.icon} {meta.label}</span></td>
                    <td style={{ fontWeight: 700, color: meta.color, fontFamily: 'var(--font-heading)', fontSize: '1.1rem' }}>{pct}%</td>
                    <td style={{ minWidth: pdfExportMode ? 120 : 160 }}>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: meta.color }} />
                      </div>
                    </td>
                    <td>{rowCorrectness}%</td>
                    <td>{rowSpeed}%</td>
                    <td>{rowSpeech}%</td>
                    <td>{rowFlow}%</td>
                    {!pdfExportMode && <td><span className={`badge ${status[1]}`}>{status[0]}</span></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div data-pdf-section="true" className="card animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.2s', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <h2 className="font-heading" style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>
            💡 Personalised Recommendations
          </h2>
          <div className="grid-2 grid" style={{ gap: 12 }}>
            {advice.tips.map((tip, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 16px',
                borderLeft: `3px solid ${advice.color}`, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6
              }}>
                {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
      {showChat && (
        <div data-pdf-section="true" className="card animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          <h2 className="font-heading" style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 16 }}>
            💬 A Message From CogniGuard
          </h2>
          <div style={{ background: 'rgba(0,201,167,0.06)', border: '1px solid rgba(0,201,167,0.2)', borderRadius: 16, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #00c9a7, #4f8ef7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🧬</div>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 8, fontSize: '0.9rem' }}>CogniGuard AI</div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: '0.95rem' }}>
                  {chatMessages[chatIdx]}
                </p>
              </div>
            </div>
          </div>
          {chatIdx < chatMessages.length - 1
            ? <button className="btn btn-ghost btn-sm" onClick={() => setChatIdx(c => c + 1)}>
              Continue conversation →
            </button>
            : <div className="badge badge-accent">✅ End of session</div>
          }
        </div>
      )}
      </div>
    </div>
  );
}
