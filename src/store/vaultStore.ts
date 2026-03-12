/**
 * vaultStore.ts
 * 
 * Zustand store for managing the vault's credentials and lock status.
 * Orchestrates CRUD operations and synchronization with the backend.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { VaultState, Credential, SyncStatus } from '../utils/types';
import { matchURL } from '../utils/urlMatcher';
import { saveCredentials } from '../services/storage';
import { useAuthStore } from './authStore';
import { syncService } from '../services/sync.service';

interface VaultStore extends VaultState {
    vaultVersion: number;
    addCredential: (credential: Omit<Credential, 'id' | 'lastUpdated' | 'version'>) => Promise<void>;
    updateCredential: (id: string, updates: Partial<Credential>) => Promise<void>;
    deleteCredential: (id: string) => Promise<void>;
    setSyncStatus: (status: SyncStatus) => void;
    setLocked: (locked: boolean) => void;
    clearVault: () => void;
    setCredentials: (credentials: Credential[]) => void;
    syncVault: () => Promise<void>;
    reset: () => void;
}

// Helper to save to storage
const persistToStorage = async (credentials: Credential[]) => {
    const key = useAuthStore.getState().encryptionKey;
    if (key) {
        await saveCredentials(credentials, key);
        console.log('VaultStore: Persisted to storage');
    } else {
        console.warn('VaultStore: Cannot persist, no encryption key');
    }
};

/**
 * useVaultStore Hook
 */
export const useVaultStore = create<VaultStore>()(
    persist(
        (set, get) => ({
            isLocked: true,
            credentials: [],
            syncStatus: 'synced',
            lastSynced: Date.now(),
            vaultVersion: 0,

            addCredential: async (credential) => {
                const newCredential = {
                    ...credential,
                    id: crypto.randomUUID(),
                    lastUpdated: Date.now(),
                    version: 1,
                };

                set((state) => ({
                    credentials: [...state.credentials, newCredential],
                    syncStatus: 'pending'
                }));

                await persistToStorage(get().credentials);
                get().syncVault();
            },

            updateCredential: async (id, updates) => {
                set((state) => ({
                    credentials: state.credentials.map((c) =>
                        c.id === id ? { ...c, ...updates, lastUpdated: Date.now(), version: (c.version || 0) + 1 } : c
                    ),
                    syncStatus: 'pending'
                }));

                await persistToStorage(get().credentials);
                get().syncVault();
            },

            deleteCredential: async (id) => {
                set((state) => ({
                    credentials: state.credentials.filter((c) => c.id !== id),
                    syncStatus: 'pending'
                }));

                await persistToStorage(get().credentials);
                get().syncVault();
            },

            setSyncStatus: (status: SyncStatus) => set({ syncStatus: status }),

            setLocked: (locked: boolean) => set({ isLocked: locked }),

            clearVault: () => set({ credentials: [], lastSynced: undefined, syncStatus: 'synced', vaultVersion: 0 }),

            setCredentials: (credentials: Credential[]) => set({ credentials }),

            syncVault: async () => {
                const { credentials, setSyncStatus, lastSynced } = get();
                const encryptionKey = useAuthStore.getState().encryptionKey;

                if (!encryptionKey) {
                    console.warn('VaultStore: Cannot sync, no encryption key');
                    setSyncStatus('error');
                    return;
                }

                try {
                    setSyncStatus('syncing');

                    console.log('VaultStore: Starting sync with Supabase...');
                    const result = await syncService.syncChanges(
                        credentials,
                        lastSynced || 0,
                        encryptionKey
                    );

                    if (result.status === 'synced' && result.serverItems) {
                        console.log('VaultStore: Sync successful, updating state');

                        set({
                            credentials: result.serverItems,
                            lastSynced: result.timestamp || Date.now(),
                            syncStatus: 'synced',
                            vaultVersion: (get().vaultVersion || 0) + 1 // Simple increment for local tracking
                        });

                        // Persist to local secure storage
                        await persistToStorage(result.serverItems);
                    } else {
                        console.error('VaultStore: Sync failed with status:', result.status);
                        setSyncStatus('error');
                    }
                } catch (error) {
                    console.error('VaultStore: Sync exception:', error);
                    setSyncStatus('error');
                }
            },

            reset: () => {
                set({
                    isLocked: true,
                    credentials: [],
                    syncStatus: 'synced',
                    lastSynced: Date.now(),
                    vaultVersion: 0,
                });
                localStorage.removeItem('zerovault-vault-storage');
            }
        }),
        {
            name: 'zerovault-vault-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                isLocked: state.isLocked,
                syncStatus: state.syncStatus,
                lastSynced: state.lastSynced,
                vaultVersion: state.vaultVersion
            }),
        }
    )
);

// Helper function to get credentials by URL (outside the store)
export function getCredentialsByURL(url: string): Credential[] {
    const state = useVaultStore.getState();
    return state.credentials.filter((c) => matchURL(c.url, url));
}
