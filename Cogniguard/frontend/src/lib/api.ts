import { getToken } from './auth';

// API base URL resolution:
//  - In production (Vercel), set the NEXT_PUBLIC_API_BASE env var in your Vercel
//    project settings to the deployed backend URL, e.g. https://cogniguard-api.onrender.com
//  - NEXT_PUBLIC_* variables are inlined at BUILD time by Next.js, so set the value
//    BEFORE building/redeploying on Vercel.
//  - Without the env var, it falls back to the local dev backend (localhost:5000).
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:5000').replace(/\/+$/, '');

export async function apiFetch(path: string, init: RequestInit = {}) {
    const token = typeof window !== 'undefined' ? getToken() : null;
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const headers: Record<string, string> = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...((init.headers as Record<string, string>) || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
    });

    let payload: any = null;
    try {
        payload = await res.json();
    } catch {
        payload = null;
    }

    if (!res.ok) {
        throw new Error(payload?.error || payload?.message || `Request failed: ${res.status}`);
    }

    return payload;
}

export function authHeaders(extra: Record<string, string> = {}) {
    const token = typeof window !== 'undefined' ? getToken() : null;
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extra,
    };
}
