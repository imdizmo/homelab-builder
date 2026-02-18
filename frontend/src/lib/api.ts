const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Assuming User type is defined elsewhere or needs a placeholder
interface User {
    id: string;
    email: string;
    // Add other user properties as needed
}

export class ApiError extends Error {
    public status: number;
    public code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new ApiError(res.status, errorData.code || 'UNKNOWN', errorData.error || res.statusText);
    }

    // Some endpoints might return empty body
    if (res.status === 204) return {} as T;

    return res.json();
}

export const api = {
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    devLogin: async (email: string) => {
        const res = await request<{ data: { token: string; user: User } }>('/auth/dev', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
        if (res.data?.token) {
            localStorage.setItem('auth_token', res.data.token);
        }
        return res;
    }
};
