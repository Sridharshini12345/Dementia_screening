"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { saveSession } from '@/lib/auth';

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '', email: '', password: '',
    age: '', gender: 'prefer_not_to_say', phone: '', city: '', emergencyContact: '', emergencyEmail: '',
    familyHistory: 'no', memoryIssues: 'no'
  });

  const set = (k: keyof typeof formData, v: string) =>
    setFormData((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (step === 1) { setStep(2); return; }
    setLoading(true);
    try {
      await apiFetch('/api/register', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name, email: formData.email,
          password: formData.password,
          age: Number(formData.age || 0),
          gender: formData.gender,
          phone: formData.phone,
          city: formData.city,
          emergency_contact: formData.emergencyContact,
          emergency_email: formData.emergencyEmail,
          family_history: formData.familyHistory,
          memory_issues: formData.memoryIssues,
          role: 'user',
        }),
      });
      const login = await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      saveSession(login.token, login.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Your Profile', 'Baseline Info'];

  return (
    <div className="auth-page">
      <div className="hero-bg"><div className="neural-dots" /></div>
      <div className="auth-left animate-fadeIn">
        <div style={{ fontSize: 72, marginBottom: 20, filter: 'drop-shadow(0 0 20px var(--accent-glow))' }}>🧠</div>
        <h1 className="font-heading" style={{ fontSize: '3rem', fontWeight: 800, marginBottom: 16 }}>
          <span style={{ background: 'var(--gradient-accent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Start Your Journey
          </span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 420, lineHeight: 1.6, fontSize: '1.1rem', margin: '0 auto' }}>
          Create your patient profile and begin proactive <span style={{ color: 'var(--accent)' }}>cognitive health</span> monitoring with our AI platform.
        </p>
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 16 }}>
          {['🔒 AES-256', '🧬 Neural AI', '📊 Insightful'].map(t => (
            <div key={t} className="badge badge-accent animate-fadeInUp" style={{ padding: '8px 16px' }}>{t}</div>
          ))}
        </div>
      </div>
      <div className="auth-right">
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ marginBottom: 32, textAlign: 'center' }}>
            <h2 className="font-heading" style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 12 }}>Create Account</h2>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              {steps.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', fontWeight: 800,
                    background: i + 1 <= step ? 'var(--gradient-accent)' : 'rgba(255,255,255,0.05)',
                    color: i + 1 <= step ? '#050b1a' : 'var(--text-muted)',
                    border: '1px solid',
                    borderColor: i + 1 === step ? 'var(--accent)' : 'var(--border-subtle)',
                    boxShadow: i + 1 === step ? '0 0 15px var(--accent-glow)' : 'none'
                  }}>{i + 1}</div>
                  <span style={{ fontSize: '0.85rem', color: i + 1 === step ? 'var(--accent)' : 'var(--text-muted)', fontWeight: i + 1 === step ? 600 : 500 }}>{s}</span>
                  {i < steps.length - 1 && <div style={{ width: 24, height: 1, background: 'var(--border-subtle)' }} />}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel animate-scaleIn">
            <form onSubmit={handleSubmit}>
              {step === 1 && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Legal Name</label>
                    <input id="reg-name" type="text" className="form-control" placeholder="John Doe" required value={formData.name} onChange={e => set('name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input id="reg-email" type="email" className="form-control" placeholder="you@example.com" required value={formData.email} onChange={e => set('email', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Secure Password</label>
                    <input id="reg-password" type="password" className="form-control" placeholder="Min 8 characters" required value={formData.password} onChange={e => set('password', e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Next: Health Baseline →</button>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="form-group">
                    <label className="form-label">Age</label>
                    <input id="reg-age" type="number" className="form-control" min="18" max="120" placeholder="e.g. 65" required value={formData.age} onChange={e => set('age', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Family history of dementia or Alzheimer's?</label>
                    <select className="form-control" value={formData.familyHistory} onChange={e => set('familyHistory', e.target.value)}>
                      <option value="no">No Family History</option>
                      <option value="yes">Yes — one or more relatives</option>
                      <option value="unknown">Unknown / Not Sure</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Noticed changes in memory recall recently?</label>
                    <select className="form-control" value={formData.memoryIssues} onChange={e => set('memoryIssues', e.target.value)}>
                      <option value="no">No, recall is fine</option>
                      <option value="sometimes">Sometimes forgetful</option>
                      <option value="yes">Yes — frequent issues</option>
                    </select>
                  </div>
                  <div className="grid-2 grid">
                    <div className="form-group">
                      <label className="form-label">Gender</label>
                      <select className="form-control" value={formData.gender} onChange={e => set('gender', e.target.value)}>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="non_binary">Non-binary</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input className="form-control" value={formData.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 ..." />
                    </div>
                  </div>
                  <div className="grid-2 grid">
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <input className="form-control" value={formData.city} onChange={e => set('city', e.target.value)} placeholder="Your city" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Emergency Contact</label>
                      <input className="form-control" value={formData.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} placeholder="Name / Number" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Emergency Contact Email (optional)</label>
                    <input className="form-control" type="email" value={formData.emergencyEmail} onChange={e => set('emergencyEmail', e.target.value)} placeholder="caregiver@example.com" />
                  </div>
                  {error && <div className="alert alert-danger mb-2" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                      {loading ? '⏳ Creating…' : '✅ Create My Account'}
                    </button>
                  </div>
                </>
              )}
            </form>

            <div className="divider" />
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Already registered?{' '}
              <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
