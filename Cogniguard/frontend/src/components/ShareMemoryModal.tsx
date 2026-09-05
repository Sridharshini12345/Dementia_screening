"use client";
import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

export type Memory = {
  id: string;
  category: string;
  text: string;
  createdAt: string;
};

const CATEGORIES = ['Childhood', 'Adulthood', 'Recent'];

interface Props {
  onClose: () => void;
  onSaved: (m: Memory) => void;
}

export default function ShareMemoryModal({ onClose, onSaved }: Props) {
  const recognitionRef = useRef<any>(null);
  const dictationBaseRef = useRef('');
  const dictationFinalRef = useRef('');
  const keepListeningRef = useRef(false);
  const [category, setCategory] = useState('Family');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const startVoiceInput = () => {
    setVoiceError('');
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. Please use Chrome/Edge.');
      return;
    }

    try {
      if (recognitionRef.current && listening) {
        keepListeningRef.current = false;
        recognitionRef.current.stop?.();
        setListening(false);
        return;
      }

      recognitionRef.current?.stop?.();
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
        setVoiceError(event?.error ? `Voice input error: ${event.error}` : 'Voice input failed.');
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
      setVoiceError('Unable to start microphone. Please allow microphone permission.');
      setListening(false);
    }
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    try {
      const res = await apiFetch('/api/memories', {
        method: 'POST',
        body: JSON.stringify({ category, text: text.trim() }),
      });
      const m = res?.memory || {};
      const memory: Memory = {
        id: String(m.id || Date.now()),
        category: String(m.category || category),
        text: String(m.text || text.trim()),
        createdAt: String(m.created_at || new Date().toISOString()),
      };
      setSaved(true);
      setTimeout(() => {
        onSaved(memory);
        onClose();
      }, 900);
    } catch {
      setVoiceError('Failed to save memory. Please retry.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3" style={{ marginBottom: 20 }}>
          <div>
            <h3 className="font-heading" style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 4 }}>
              🧠 Share a Memory
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Your memories will be used to personalise the Life Context test.
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {saved ? (
          <div className="alert alert-success animate-scaleIn" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600 }}>Memory saved successfully!</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>It will appear in your Life Context test.</div>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Memory Category</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`badge ${category === c ? 'badge-accent' : ''}`}
                    style={{
                      cursor: 'pointer', border: category === c ? undefined : '1px solid var(--border-subtle)',
                      background: category !== c ? 'transparent' : undefined, color: category !== c ? 'var(--text-muted)' : undefined,
                      padding: '6px 14px', fontSize: '0.82rem',
                    }}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Your Memory</label>
              <textarea
                className="form-control"
                rows={5}
                placeholder="Share a memory, story, or experience from your past or present life…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={startVoiceInput}>
                  🎤 {listening ? 'Listening...' : 'Voice input'}
                </button>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {text.length} characters
                </div>
              </div>
              {voiceError && (
                <div className="alert alert-danger" style={{ marginTop: 8, padding: '8px 10px', fontSize: '0.8rem' }}>
                  ⚠️ {voiceError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={handleSave}
                disabled={!text.trim()}
              >
                💾 Save Memory
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
