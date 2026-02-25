import type { Credential, SyncStatus } from '../utils/types';
import { supabase, syncService as supabaseSyncService, deviceService } from './supabase';
import { encryptVaultData, decryptVaultData } from '../utils/crypto';
import { useAuthStore } from '../store/authStore';

export interface SyncItem extends Credential {
    deleted?: boolean;
    encrypted_data?: string;
    iv?: string;
}

export interface SyncResponse {
    changes: SyncItem[];
    lastSynced: number;
}

/**
 * ConflictResolutionStrategy
 * 'lastWriteWins': Server version with latest timestamp wins
 * 'clientWins': Local version wins
 * 'serverWins': Remote version always wins
 * 'manual': Return conflicts for user resolution
 */
type ConflictStrategy = 'lastWriteWins' | 'clientWins' | 'serverWins' | 'manual';

class SyncService {
    private static instance: SyncService;
    private conflictStrategy: ConflictStrategy = 'lastWriteWins';

    private constructor() { }

    public static getInstance(): SyncService {
        if (!SyncService.instance) {
            SyncService.instance = new SyncService();
        }
        return SyncService.instance;
    }

    /**
     * Sync credentials with Supabase
     *
     * This performs a bidirectional sync:
     * 1. Push local changes to Supabase
     * 2. Pull remote changes from Supabase
     * 3. Resolve conflicts based on strategy
     * 4. Merge results
     */
    public async syncChanges(
        localItems: Credential[],
        lastSynced: number,
        encryptionKey: string
    ): Promise<{ status: SyncStatus, serverItems?: Credential[], timestamp?: number }> {
        try {
            console.log('SyncService: Starting Supabase sync...');

            // Get current user
            const session = await supabase.auth.getSession();
            const userId = session.data?.session?.user?.id;

            if (!userId) {
                console.warn('SyncService: No authenticated user');
                return { status: 'error' };
            }

            // Push local changes to Supabase
            const pushResult = await this.pushCredentials(userId, localItems, encryptionKey);
            if (!pushResult.success) {
                return { status: 'error' };
            }

            // Pull remote changes
            const pullResult = await this.pullCredentials(userId, lastSynced, encryptionKey);
            if (!pullResult.success) {
                return { status: 'error' };
            }

            // Resolve conflicts
            const mergedItems = await this.resolveConflicts(localItems, pullResult.credentials || []);

            console.log('SyncService: Sync completed successfully');

            return {
                status: 'synced',
                serverItems: mergedItems,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('SyncService: Sync failed', error);
            return { status: 'error' };
        }
    }

    /**
     * Push local credentials to Supabase (encrypted)
     */
    private async pushCredentials(
        userId: string,
        credentials: Credential[],
        encryptionKey: string
    ): Promise<{ success: boolean }> {
        try {
            const encryptedCredentials = await Promise.all(
                credentials.map(async (cred) => {
                    const data = JSON.stringify({
                        username: cred.username,
                        password: cred.password,
                        notes: cred.notes,
                    });
                    const encrypted = await encryptVaultData(data, encryptionKey);

                    return {
                        id: cred.id,
                        name: cred.name,
                        url: cred.url,
                        encrypted_data: encrypted,
                        version: cred.version,
                        lastUpdated: cred.lastUpdated,
                    };
                })
            );

            // Batch upsert to Supabase
            const result = await supabaseSyncService.batchSyncCredentials(userId, encryptedCredentials);

            if (!result.success) {
                throw new Error('Failed to push credentials');
            }

            console.log('SyncService: Pushed', encryptedCredentials.length, 'credentials');
            return { success: true };

        } catch (error) {
            console.error('SyncService: Push failed', error);
            return { success: false };
        }
    }

    /**
     * Pull remote credentials from Supabase (encrypted)
     */
    private async pullCredentials(
        userId: string,
        lastSynced: number,
        encryptionKey: string
    ): Promise<{ success: boolean; credentials?: Credential[] }> {
        try {
            // Get changes since last sync
            const result = await supabaseSyncService.getChangesSince(userId, lastSynced);

            if (!result.success) {
                throw new Error('Failed to pull credentials');
            }

            const remoteCredentials = result.changes || [];

            // Decrypt credentials
            const decrypted = await Promise.all(
                remoteCredentials.map(async (cred: any) => {
                    try {
                        const data = await decryptVaultData(cred.encrypted_data, encryptionKey);
                        const parsed = JSON.parse(data);
                        return {
                            id: cred.id,
                            name: cred.name,
                            url: cred.url,
                            username: parsed.username,
                            password: parsed.password,
                            notes: parsed.notes || '',
                            tags: parsed.tags || [],
                            version: cred.version,
                            lastUpdated: cred.lastUpdated,
                        } as Credential;
                    } catch (e) {
                        console.error('Failed to decrypt credential:', cred.id, e);
                        return null;
                    }
                })
            );

            return {
                success: true,
                credentials: decrypted.filter((c): c is Credential => c !== null)
            };

        } catch (error) {
            console.error('SyncService: Pull failed', error);
            return { success: false };
        }
    }

    /**
     * Resolve conflicts between local and remote credentials
     */
    private async resolveConflicts(
        local: Credential[],
        remote: Credential[]
    ): Promise<Credential[]> {
        const localMap = new Map(local.map(c => [c.id, c]));
        const remoteMap = new Map(remote.map(c => [c.id, c]));
        const merged = new Map(localMap);

        for (const [id, remoteCred] of remoteMap) {
            const localCred = localMap.get(id);

            if (!localCred) {
                // Remote only - add it
                merged.set(id, remoteCred);
            } else {
                // Both exist - resolve conflict
                const resolved = this.resolveCredentialConflict(localCred, remoteCred);
                merged.set(id, resolved);
            }
        }

        return Array.from(merged.values());
    }

    /**
     * Resolve a single credential conflict
     */
    private resolveCredentialConflict(local: Credential, remote: Credential): Credential {
        switch (this.conflictStrategy) {
            case 'lastWriteWins':
                return local.lastUpdated >= remote.lastUpdated ? local : remote;
            case 'clientWins':
                return local;
            case 'serverWins':
                return remote;
            case 'manual':
                // TODO: Implement manual conflict resolution UI
                return local.lastUpdated >= remote.lastUpdated ? local : remote;
            default:
                return local;
        }
    }

    public async pullChanges(lastSynced: number): Promise<SyncItem[]> {
        console.log('SyncService: Deprecated method pullChanges called');
        return [];
    }

    public async pushChanges(changes: SyncItem[]): Promise<boolean> {
        console.log('SyncService: Deprecated method pushChanges called');
        return true;
    }

    /**
     * Set conflict resolution strategy
     */
    public setConflictStrategy(strategy: ConflictStrategy) {
        this.conflictStrategy = strategy;
    }
}

export const syncService = SyncService.getInstance();
