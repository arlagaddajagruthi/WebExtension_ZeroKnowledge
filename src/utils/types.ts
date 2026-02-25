export interface Credential {
    id: string;
    name?: string;
    url: string;
    username: string;
    password: string;
    notes?: string;
    tags?: string[];
    lastUpdated: number;
    version: number;
    _deviceId?: string;
    _createdAt?: number;
    _isDeleted?: boolean;
    _deletedAt?: number;
}

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'offline' | 'error';

export interface VaultState {
    isLocked: boolean;
    credentials: Credential[];
    lastSynced?: number;
    syncStatus: SyncStatus;
}

export interface AuthState {
    isRegistered: boolean;
    isAuthenticated: boolean;
    masterPasswordHash?: string;
    vaultSalt?: string;
}
