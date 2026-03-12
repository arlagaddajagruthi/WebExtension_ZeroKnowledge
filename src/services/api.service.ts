/**
 * api.service.ts
 * 
 * Central API service for communicating with the Render backend.
 * Handles authentication headers and provides methods for vault operations.
 */
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Base fetch wrapper with auth header
 */
async function authorizedFetch(path: string, options: RequestInit = {}) {
    const { token } = useAuthStore.getState();

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown API error' }));
        throw new Error(error.error || response.statusText);
    }

    return response.json();
}

export const apiService = {
    // Auth operations
    async login(credentials: any) {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Login failed' }));

            // Allow MFA transitions even on 401/403 if requiresMFA is true
            if (error.requiresMFA) {
                return error;
            }

            throw new Error(error.error || 'Login failed');
        }

        return response.json();
    },

    async register(userData: any) {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Registration failed' }));
            throw new Error(error.error || 'Registration failed');
        }

        return response.json();
    },

    async verifyMfa(userId: string, otp: string) {
        const response = await fetch(`${API_BASE_URL}/auth/verify-mfa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, otp }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Verification failed' }));
            throw new Error(error.error || 'Verification failed');
        }

        return response.json();
    },

    async resendMfa(userId: string) {
        const response = await fetch(`${API_BASE_URL}/auth/resend-mfa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to resend code' }));
            throw new Error(error.error || 'Failed to resend code');
        }

        return response.json();
    },

    // Vault operations
    async getVault() {
        return authorizedFetch('/vault');
    },

    async syncVault(delta: any) {
        return authorizedFetch('/vault/sync', {
            method: 'POST',
            body: JSON.stringify(delta),
        });
    },

    async createEntry(entry: any) {
        return authorizedFetch('/vault', {
            method: 'POST',
            body: JSON.stringify(entry),
        });
    },

    async updateEntry(id: string | number, updates: any) {
        return authorizedFetch(`/vault/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    },

    async deleteEntry(id: string | number) {
        return authorizedFetch(`/vault/${id}`, {
            method: 'DELETE',
        });
    }
};
