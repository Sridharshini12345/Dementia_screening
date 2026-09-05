"use client";
import React, { useEffect, useRef } from 'react';

interface Props {
  score: number;          // 0 = healthy, 1 = high risk
  previousScore?: number;
  label?: string;
  onShareClick?: () => void;
}

function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number = 4) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function MemoryTree({ score, previousScore, label = 'Memory', onShareClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const health = 1.0 - Math.min(score, 1.0);

  const leafCount = Math.floor(health * 55) + 8;
  const leafColor = health > 0.65
    ? ['#00c9a7', '#10b981', '#34d399', '#6ee7b7']
    : health > 0.35
      ? ['#f59e0b', '#fbbf24', '#f97316', '#fb923c']
      : ['#fb7185', '#f43f5e', '#e11d48', '#c0392b'];

  const riskLabel = health > 0.65 ? 'Healthy' : health > 0.35 ? 'Moderate' : 'High Risk';
  const riskColor = health > 0.65 ? '#00c9a7' : health > 0.35 ? '#f59e0b' : '#fb7185';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 200;
    const H = 260;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    const trunkGrad = ctx.createLinearGradient(90, H, 90, H - 130);
    trunkGrad.addColorStop(0, '#5c4033');
    trunkGrad.addColorStop(1, '#8b6347');
    ctx.fillStyle = trunkGrad;
    drawRect(ctx, 85, H - 130, 30, 130, 5);
    ctx.fill();
    ctx.fillStyle = '#4a3020';
    ctx.beginPath();
    ctx.ellipse(100, H - 2, 45, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(90, H - 110);
    ctx.rotate(-Math.PI / 4.5);
    ctx.fillStyle = '#7a5c42';
    drawRect(ctx, 0, 0, 12, 55, 4);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(115, H - 95);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#7a5c42';
    drawRect(ctx, 0, 0, 10, 45, 4);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(96, H - 125);
    ctx.rotate(-Math.PI / 10);
    ctx.fillStyle = '#8b6347';
    drawRect(ctx, 0, 0, 8, 35, 3);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < leafCount; i++) {
      const cx = 45 + Math.random() * 110;
      const cy = 18 + Math.random() * 130;
      const r = 9 + Math.random() * 12;
      const col = leafColor[Math.floor(Math.random() * leafColor.length)];
      ctx.save();
      ctx.globalAlpha = 0.72 + Math.random() * 0.28;
      ctx.fillStyle = col;
      ctx.translate(cx, cy);
      ctx.rotate(Math.random() * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.8, -r * 0.2, r * 0.5, r * 0.5);
      ctx.quadraticCurveTo(0, r, 0, r);
      ctx.quadraticCurveTo(-r * 0.5, r * 0.5, -r * 0.8, -r * 0.2);
      ctx.quadraticCurveTo(-r * 0.2, -r, 0, -r);
      ctx.fill();
      ctx.restore();
    }
    if (health > 0.65) {
      for (let i = 0; i < 8; i++) {
        const sx = 30 + Math.random() * 140;
        const sy = 10 + Math.random() * 110;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, H - 1);
    ctx.lineTo(W - 10, H - 1);
    ctx.stroke();
  }, [score, health, leafCount]);

  return (
    <div
      className="tree-card"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', cursor: onShareClick ? 'pointer' : 'default' }}
    >
      <div style={{
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem',
        color: 'var(--text-secondary)', marginBottom: 10, letterSpacing: '0.05em',
        textTransform: 'uppercase'
      }}>
        {label}
      </div>
      <canvas
        ref={canvasRef}
        width={200}
        height={260}
        style={{ filter: `drop-shadow(0 6px 16px ${riskColor}40)`, maxWidth: '100%' }}
      />
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <div className="badge" style={{ background: `${riskColor}22`, color: riskColor, border: `1px solid ${riskColor}44` }}>
          {riskLabel}
        </div>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          Risk: {(score * 100).toFixed(1)}%
          {typeof previousScore === 'number' && (
            <span style={{ marginLeft: 6, color: score < previousScore ? '#00c9a7' : '#fb7185' }}>
              {score < previousScore ? '▼' : '▲'}{Math.abs((score - previousScore) * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      {onShareClick && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={onShareClick}
          style={{ marginTop: 10, fontSize: '0.78rem' }}
        >
          🧠 Share Memory
        </button>
      )}
    </div>
  );
}
