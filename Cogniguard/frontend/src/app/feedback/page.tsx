"use client";
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

const TOPICS = ['User Experience', 'Test Difficulty', 'Report Quality', 'App Performance', 'Suggestions', 'Other'];

export default function FeedbackPage() {
  const [message, setMessage] = useState('');
  const [topic, setTopic] = useState('User Experience');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setStatus('');
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ message: `[${topic}] ⭐${rating}/5\n${message}` }),
      });
      setSubmitted(true);
    } catch (err: any) {
      setStatus(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="full-bleed-section" style={{ width: '100%' }}>
        <div className="card text-center interactive-card animate-scaleIn" style={{ padding: '60px 40px', maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🌟</div>
          <h2 className="font-heading" style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 12 }}>
            Thank You!
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
            Your feedback helps us improve CogniGuard for every patient. We read every submission carefully.
          </p>
          <button className="btn btn-primary" onClick={() => { setSubmitted(false); setMessage(''); setRating(0); setTopic('User Experience'); }}>
            Submit Another →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="full-bleed-section" style={{ width: '100%' }}>
      <div className="card card-accent page-hero animate-fadeInUp" style={{ marginBottom: 24, padding: '24px 28px' }}>
        <h1 className="font-heading" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>
          💬 Share Your Feedback
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Your experience matters. Help us make CogniGuard better for you and every patient.
        </p>
      </div>

      <div className="story-grid animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.05s' }}>
        <div className="card interactive-card">
          <h3 className="font-heading" style={{ marginBottom: 8, fontSize: '1.2rem' }}>What helps most</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Mention what made tasks easier or harder so we can improve accessibility and flow.</p>
        </div>
        <div className="card interactive-card">
          <h3 className="font-heading" style={{ marginBottom: 8, fontSize: '1.2rem' }}>Product quality</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Your comments directly shape design, stability, and clinical readability in the next release.</p>
        </div>
      </div>

      <div className="card interactive-card animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Topic</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  style={{
                    padding: '7px 16px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600,
                    cursor: 'pointer', border: topic === t ? 'none' : '1px solid var(--border-subtle)',
                    background: topic === t ? 'linear-gradient(135deg, #00c9a7, #4f8ef7)' : 'transparent',
                    color: topic === t ? '#050b1a' : 'var(--text-muted)',
                    transition: 'all 0.2s',
                  }}
                >{t}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Overall Rating</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  style={{
                    fontSize: '2rem', background: 'none', border: 'none', cursor: 'pointer',
                    color: star <= (hoverRating || rating) ? '#f59e0b' : 'rgba(255,255,255,0.15)',
                    transition: 'all 0.15s', transform: star <= (hoverRating || rating) ? 'scale(1.2)' : 'scale(1)',
                    lineHeight: 1,
                  }}
                >★</button>
              ))}
              {rating > 0 && (
                <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
                </span>
              )}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Your Message</label>
            <textarea
              className="form-control"
              rows={6}
              placeholder="Tell us what you liked, what could be improved, or share any suggestions…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {message.length} characters
            </div>
          </div>

          {status && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>
              ⚠️ {status}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading || !message.trim()}
          >
            {loading ? '⏳ Submitting…' : '🚀 Submit Feedback'}
          </button>
        </form>

        <div className="divider" />

        <div className="alert alert-info" style={{ fontSize: '0.85rem' }}>
          🔒 Your feedback is anonymous and encrypted. It is only visible to the CogniGuard admin team.
        </div>
      </div>
    </div>
  );
}
