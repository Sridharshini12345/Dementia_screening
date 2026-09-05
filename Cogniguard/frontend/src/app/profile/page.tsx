"use client";

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type ProfileForm = {
    name: string;
    email: string;
    age: string;
    gender: string;
    phone: string;
    city: string;
    emergency_contact: string;
    emergency_email: string;
    family_history: string;
    memory_issues: string;
    occupation: string;
    education: string;
    address: string;
    medical_notes: string;
    profile_pic: string;
};

export default function ProfilePage() {
    const [form, setForm] = useState<ProfileForm>({
        name: '',
        email: '',
        age: '',
        gender: 'prefer_not_to_say',
        phone: '',
        city: '',
        emergency_contact: '',
        emergency_email: '',
        family_history: 'unknown',
        memory_issues: 'unknown',
        occupation: '',
        education: '',
        address: '',
        medical_notes: '',
        profile_pic: '',
    });
    const [initialProfile, setInitialProfile] = useState<ProfileForm | null>(null);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [editing, setEditing] = useState(false);

    const photoPreview = useMemo(() => {
        if (photoFile) return URL.createObjectURL(photoFile);
        return form.profile_pic;
    }, [photoFile, form.profile_pic]);

    useEffect(() => {
        apiFetch('/api/me').then((me) => {
            const next = {
                name: me.name || '',
                email: me.email || '',
                age: String(me.age || ''),
                gender: me.gender || 'prefer_not_to_say',
                phone: me.phone || '',
                city: me.city || '',
                emergency_contact: me.emergency_contact || '',
                emergency_email: me.emergency_email || '',
                family_history: me.family_history || 'unknown',
                memory_issues: me.memory_issues || 'unknown',
                occupation: me.occupation || '',
                education: me.education || '',
                address: me.address || '',
                medical_notes: me.medical_notes || '',
                profile_pic: me.profile_pic || ''
            };
            setForm(next);
            setInitialProfile(next);
        }).catch(() => undefined);
    }, []);

    useEffect(() => {
        return () => {
            if (photoFile) {
                URL.revokeObjectURL(photoPreview);
            }
        };
    }, [photoFile, photoPreview]);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus('');
        try {
            await apiFetch('/api/profile', {
                method: 'PUT',
                body: JSON.stringify({
                    name: form.name,
                    age: Number(form.age || 0),
                    gender: form.gender,
                    phone: form.phone,
                    city: form.city,
                    emergency_contact: form.emergency_contact,
                    emergency_email: form.emergency_email,
                    occupation: form.occupation,
                    education: form.education,
                    address: form.address,
                    medical_notes: form.medical_notes,
                })
            });
            setStatus('Profile updated successfully.');
            setEditing(false);
            const refreshed = await apiFetch('/api/me');
            const next = {
                name: refreshed.name || '',
                email: refreshed.email || '',
                age: String(refreshed.age || ''),
                gender: refreshed.gender || 'prefer_not_to_say',
                phone: refreshed.phone || '',
                city: refreshed.city || '',
                emergency_contact: refreshed.emergency_contact || '',
                emergency_email: refreshed.emergency_email || '',
                family_history: refreshed.family_history || 'unknown',
                memory_issues: refreshed.memory_issues || 'unknown',
                occupation: refreshed.occupation || '',
                education: refreshed.education || '',
                address: refreshed.address || '',
                medical_notes: refreshed.medical_notes || '',
                profile_pic: refreshed.profile_pic || '',
            };
            setForm(next);
            setInitialProfile(next);
        } catch (err: any) {
            setStatus(err.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const uploadPhoto = async () => {
        if (!photoFile) return;
        setPhotoUploading(true);
        setStatus('');
        try {
            const fd = new FormData();
            fd.append('photo', photoFile);
            const res = await apiFetch('/api/profile/photo', {
                method: 'POST',
                body: fd,
            });
            setForm((p) => ({ ...p, profile_pic: res.profile_pic || p.profile_pic }));
            setPhotoFile(null);
            setStatus('Profile photo updated successfully.');
        } catch (err: any) {
            setStatus(err.message || 'Failed to upload profile photo');
        } finally {
            setPhotoUploading(false);
        }
    };

    const displayRows = [
        { label: 'Full Name', value: form.name },
        { label: 'Email', value: form.email },
        { label: 'Age', value: form.age || 'Not set' },
        { label: 'Gender', value: form.gender || 'Not set' },
        { label: 'Phone', value: form.phone || 'Not set' },
        { label: 'City', value: form.city || 'Not set' },
        { label: 'Emergency Contact', value: form.emergency_contact || 'Not set' },
        { label: 'Emergency Email', value: form.emergency_email || 'Not set' },
        { label: 'Family History', value: form.family_history || 'unknown' },
        { label: 'Memory Changes', value: form.memory_issues || 'unknown' },
        { label: 'Occupation', value: form.occupation || 'Not set' },
        { label: 'Education', value: form.education || 'Not set' },
        { label: 'Address', value: form.address || 'Not set' },
        { label: 'Medical Notes', value: form.medical_notes || 'Not set' },
    ];

    return (
        <div className="full-bleed-section" style={{ width: '100%' }}>
            <div className="card card-accent page-hero animate-fadeInUp" style={{ marginBottom: 24 }}>
                <div className="flex items-center justify-between" style={{ gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h1 className="font-heading" style={{ fontSize: '1.8rem', marginBottom: 6 }}>👤 Your Profile</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Registration baseline values are shown below and kept pre-filled. Update contact and care details anytime.</p>
                    </div>
                    <div className="badge badge-blue">Patient Account</div>
                </div>
            </div>

            <div className="story-grid animate-fadeInUp" style={{ marginBottom: 24, animationDelay: '0.08s' }}>
                <div className="card interactive-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {photoPreview ? (
                            <img
                                src={photoPreview}
                                alt="Profile"
                                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,127,138,0.3)' }}
                            />
                        ) : (
                            <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, color: 'var(--accent-strong)', background: 'rgba(0,127,138,0.15)', border: '2px solid rgba(0,127,138,0.25)' }}>
                                {(form.name || 'U').slice(0, 1).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h3 className="font-heading" style={{ marginBottom: 4 }}>{form.name || 'Your name'}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{form.email || 'No email available'}</p>
                        </div>
                    </div>
                    {editing && (
                        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={uploadPhoto} disabled={!photoFile || photoUploading}>
                                {photoUploading ? 'Uploading...' : 'Upload Profile Photo'}
                            </button>
                        </div>
                    )}
                </div>
                <div className="card interactive-card">
                    <p className="badge badge-accent" style={{ marginBottom: 10 }}>Baseline Snapshot (From Registration)</p>
                    <p style={{ color: 'var(--text-secondary)' }}>Family history: <strong>{form.family_history || 'unknown'}</strong></p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Memory changes: <strong>{form.memory_issues || 'unknown'}</strong></p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Saved once and shown here as the profile baseline.</p>
                </div>
            </div>

            <div className="card interactive-card animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <h2 className="font-heading" style={{ marginBottom: 4 }}>Profile Details</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{editing ? 'Edit and save the details below.' : 'Read-only view. Click edit to update your profile.'}</p>
                    </div>
                    {!editing ? (
                        <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Edit Profile</button>
                    ) : (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => { setEditing(false); if (initialProfile) setForm(initialProfile); }}>Cancel</button>
                            <button className="btn btn-primary" type="submit" form="profile-form" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    )}
                </div>

                {!editing ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <tbody>
                                {displayRows.map((row) => (
                                    <tr key={row.label}>
                                        <th style={{ width: '30%' }}>{row.label}</th>
                                        <td>{row.value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <form id="profile-form" onSubmit={save}>
                        <div className="grid-2 grid">
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input className="form-control" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input className="form-control" value={form.email} disabled />
                            </div>
                        </div>

                        <div className="grid-3 grid">
                            <div className="form-group">
                                <label className="form-label">Age</label>
                                <input className="form-control" type="number" min="1" value={form.age} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Gender</label>
                                <select className="form-control" value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}>
                                    <option value="female">Female</option>
                                    <option value="male">Male</option>
                                    <option value="non_binary">Non-binary</option>
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-control" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
                            </div>
                        </div>

                        <div className="grid-2 grid">
                            <div className="form-group">
                                <label className="form-label">City</label>
                                <input className="form-control" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Emergency Contact</label>
                                <input className="form-control" value={form.emergency_contact} onChange={(e) => setForm((p) => ({ ...p, emergency_contact: e.target.value }))} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Emergency Email</label>
                            <input className="form-control" type="email" value={form.emergency_email} onChange={(e) => setForm((p) => ({ ...p, emergency_email: e.target.value }))} placeholder="caregiver@example.com" />
                        </div>

                        <div className="grid-2 grid">
                            <div className="form-group">
                                <label className="form-label">Occupation</label>
                                <input className="form-control" value={form.occupation} onChange={(e) => setForm((p) => ({ ...p, occupation: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Education</label>
                                <input className="form-control" value={form.education} onChange={(e) => setForm((p) => ({ ...p, education: e.target.value }))} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <textarea className="form-control" rows={2} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Medical Notes</label>
                            <textarea className="form-control" rows={3} value={form.medical_notes} onChange={(e) => setForm((p) => ({ ...p, medical_notes: e.target.value }))} />
                        </div>

                        {status && <div className="alert alert-info" style={{ marginBottom: 12 }}>{status}</div>}
                    </form>
                )}

                {!editing && status && <div className="alert alert-info" style={{ marginTop: 12 }}>{status}</div>}
            </div>
        </div>
    );
}
