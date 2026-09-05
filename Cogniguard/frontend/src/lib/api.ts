import { getToken } from './auth';

export const API_BASE = 'http://127.0.0.1:5000';

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
