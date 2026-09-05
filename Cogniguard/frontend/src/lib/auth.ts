export type SessionUser = {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user';
    last_used_at?: string | null;
};

export type Memory = {
    id: string;
    category: string;
    text: string;
    createdAt: string;
};

const TOKEN_KEY = 'cg_token';
const USER_KEY = 'cg_user';
const MEM_KEY = 'cg_memories';
const RESULT_KEY = 'cg_last_result';

function scopedKey(base: string): string {
    const user = getSessionUser();
    const suffix = user?.id ? String(user.id) : 'guest';
    return `${base}_${suffix}`;
}

export function getMemoryStorageKey(): string {
    return scopedKey(MEM_KEY);
}

export function getResultStorageKey(): string {
    return scopedKey(RESULT_KEY);
}
export function saveSession(token: string, user: SessionUser) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function getSessionUser(): SessionUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

export function isLoggedIn(): boolean {
    return !!getToken() && !!getSessionUser();
}
export function getMemories(): Memory[] {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(getMemoryStorageKey()) || '[]'); } catch { return []; }
}

export function saveMemory(memory: Memory) {
    const list = getMemories();
    list.push(memory);
    localStorage.setItem(getMemoryStorageKey(), JSON.stringify(list));
}

export function deleteMemory(id: string) {
    const list = getMemories().filter(m => m.id !== id);
    localStorage.setItem(getMemoryStorageKey(), JSON.stringify(list));
}
