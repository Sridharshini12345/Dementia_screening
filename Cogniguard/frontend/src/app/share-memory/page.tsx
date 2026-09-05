"use client";
import { useEffect, useRef, useState } from 'react';
import type { Memory } from '@/components/ShareMemoryModal';
import { apiFetch } from '@/lib/api';

const CATEGORIES = ['All', 'Childhood', 'Adulthood', 'Recent'];

export default function ShareMemoryPage() {
  const recognitionRef = useRef<any>(null);
  const dictationBaseRef = useRef('');
  const dictationFinalRef = useRef('');
  const keepListeningRef = useRef(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState('All');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('Adulthood');
  const [saved, setSaved] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  useEffect(() => {
    void load();
  }, []);

  const mapApiMemory = (item: any): Memory => ({
    id: String(item?.id || ''),
    category: String(item?.category || 'Adulthood'),
    text: String(item?.text || ''),
    createdAt: String(item?.created_at || item?.updated_at || new Date().toISOString()),
  });

  const load = async () => {
    const data = await apiFetch('/api/memories');
    const m = (Array.isArray(data) ? data : []).map(mapApiMemory);
    setMemories(m);
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    try {
      if (editId) {
        await apiFetch(`/api/memories/${Number(editId)}`, {
          method: 'PUT',
          body: JSON.stringify({ category, text: text.trim() }),
        });
        setEditId(null);
      } else {
        await apiFetch('/api/memories', {
          method: 'POST',
          body: JSON.stringify({ category, text: text.trim() }),
        });
      }

      setText('');
      setCategory('Adulthood');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch {
      setVoiceError('Unable to save memory right now. Please retry.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/memories/${Number(id)}`, { method: 'DELETE' });
      await load();
    } catch {
      setVoiceError('Unable to delete memory right now. Please retry.');
    }
  };

  const handleEdit = (m: Memory) => {
    setEditId(m.id);
    setText(m.text);
    setCategory(m.category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startVoiceInput = () => {
    setVoiceError('');
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg = 'Voice input is not supported in this browser. Please use Chrome/Edge.';
      setVoiceError(msg);
      window.alert(msg);
      return;
    }

    try {
      if (recognitionRef.current && listening) {
        keepListeningRef.current = false;
        recognitionRef.current.stop();
        setListening(false);
        return;
      }

      const rec = new SpeechRecognition();
      rec.lang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 5;
      keepListeningRef.current = true;

      dictationBaseRef.current = text ? `${text.trim()} ` : '';
      dictationFinalRef.current = '';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < (event.results || []).length; i++) {
          const alternatives = Array.from((event.results[i] || []) as any[]);
          const bestAlternative = alternatives.sort((a: any, b: any) => {
            const confidenceDiff = Number(b?.confidence || 0) - Number(a?.confidence || 0);
            if (confidenceDiff !== 0) return confidenceDiff;
            return String(b?.transcript || '').length - String(a?.transcript || '').length;
          })[0];
          const transcript = String(bestAlternative?.transcript || '').trim();
          if (!transcript) continue;
          if (event.results[i].isFinal) {
            dictationFinalRef.current += `${dictationFinalRef.current ? ' ' : ''}${transcript}`;
          } else {
            interimTranscript += `${interimTranscript ? ' ' : ''}${transcript}`;
          }
        }

        const combined = `${dictationBaseRef.current}${dictationFinalRef.current}${interimTranscript ? ` ${interimTranscript}` : ''}`.trim();
        setText(combined);
      };
      rec.onerror = (event: any) => {
        const msg = event?.error ? `Voice input error: ${event.error}. Please allow microphone access.` : 'Voice input failed.';
        setVoiceError(msg);
        keepListeningRef.current = false;
        setListening(false);
      };
      rec.onend = () => {
        const finalCombined = `${dictationBaseRef.current}${dictationFinalRef.current}`.trim();
        if (finalCombined) {
          setText(finalCombined);
        }
        if (keepListeningRef.current) {
          try {
            rec.start();
            return;
          } catch {
            keepListeningRef.current = false;
          }
        }
        setListening(false);
      };
      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      const msg = 'Unable to start voice input. Please allow microphone permission and retry.';
      setVoiceError(msg);
      window.alert(msg);
      setListening(false);
    }
  };

  const filtered = filter === 'All' ? memories : memories.filter((m) => m.category === filter);
  const catColors: Record<string, string> = {
    Childhood: 'badge-blue',
    Adulthood: 'badge-accent',
    Recent: 'badge-amber',
  };

  return (
    <div className="full-bleed-section" style={{ width: '100%' }}>
      <div className="card card-accent page-hero animate-fadeInUp" style={{ marginBottom: 24, padding: '24px 28px' }}>
        <h1 className="font-heading" style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>
          🧠 Share Your Memories
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Record personal memories and life stories. These are used to personalise your{' '}
          <strong style={{ color: 'var(--accent)' }}>Life Context</strong> test — helping us ask questions that matter to you.
        </p>
      </div>

      <div className="story-grid animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.05s' }}>
        <div className="card interactive-card">
          <h3 className="font-heading" style={{ marginBottom: 8, fontSize: '1.2rem' }}>Prompt Ideas</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Describe a festival you love, a route you walk often, or a meal tied to family tradition.</p>
        </div>
        <div className="card interactive-card">
          <h3 className="font-heading" style={{ marginBottom: 8, fontSize: '1.2rem' }}>Why it matters</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Personal memories help the app generate context-rich tests that feel familiar and clinically useful.</p>
        </div>
      </div>
      <div className="card interactive-card animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.1s' }}>
        <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
          {editId ? '✏️ Edit Memory' : '+ Add New Memory'}
        </h2>
        <div className="form-group">
          <label className="form-label">Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.slice(1).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600,
                  cursor: 'pointer', border: category === c ? 'none' : '1px solid var(--border-subtle)',
                  background: category === c ? 'linear-gradient(135deg, #00c9a7, #4f8ef7)' : 'transparent',
                  color: category === c ? '#050b1a' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >{c}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Your Memory or Story</label>
          <textarea
            className="form-control"
            rows={5}
            placeholder="Describe a memory, a favourite place, a person who is special to you, or a life event…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={startVoiceInput}>
              🎤 {listening ? 'Listening... click to stop' : 'Voice input'}
            </button>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {text.length} chars
            </div>
          </div>
          {voiceError && (
            <div className="alert alert-danger" style={{ marginTop: 10, marginBottom: 0 }}>
              ⚠️ {voiceError}
            </div>
          )}
        </div>

        {saved && (
          <div className="alert alert-success" style={{ marginBottom: 12 }}>
            ✅ Memory {editId ? 'updated' : 'saved'} successfully!
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {editId && (
            <button className="btn btn-secondary" onClick={() => { setEditId(null); setText(''); setCategory('Adulthood'); }}>
              Cancel Edit
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!text.trim()}
            style={{ flex: 1 }}
          >
            {editId ? '💾 Update Memory' : '💾 Save Memory'}
          </button>
        </div>
      </div>
      <div className="card interactive-card animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h2 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Your Memories ({memories.length})
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
                  cursor: 'pointer', border: filter === c ? 'none' : '1px solid var(--border-subtle)',
                  background: filter === c ? 'var(--accent-muted)' : 'transparent',
                  color: filter === c ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >{c}</button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌱</div>
            <p>No memories yet. Add your first one above!</p>
          </div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {filtered.slice().reverse().map((m) => (
              <div key={m.id} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                borderRadius: 12, padding: '16px 18px',
              }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${catColors[m.category] || 'badge-accent'}`}>{m.category}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(m)}>✏️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>🗑️</button>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{m.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
