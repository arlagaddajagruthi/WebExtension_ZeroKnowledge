import type { Credential, SyncStatus } from '../utils/types';

export interface SyncItem extends Credential {
    deleted?: boolean;
}

export interface SyncResponse {
    changes: SyncItem[];
    lastSynced: number;
}

// Mock delay to simulate network request
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class SyncService {
    private static instance: SyncService;
    private mockServerData: Map<string, SyncItem> = new Map();

    private constructor() { }

    public static getInstance(): SyncService {
        if (!SyncService.instance) {
            SyncService.instance = new SyncService();
        }
        return SyncService.instance;
    }

    /**
     * Simulates syncing local changes with the server.
     * In a real app, this would send a POST request with local changes 
     * and receive remote changes in response.
     */
    public async syncChanges(
        localItems: Credential[],
        lastSynced: number
    ): Promise<{ status: SyncStatus, serverItems?: Credential[], timestamp?: number }> {
        try {
            console.log('SyncService: Starting sync...');
            await delay(1500); // Simulate network latency

            // 1. Identification: In a real app, we'd send IDs and versions.
            // For this mock, we'll just log that we are "syncing".

            // 2. Conflict Resolution (Mock):
            // We'll assume "Server Wins" or "Last Write Wins" based on timestamps.
            // For now, we'll just return success and update the timestamp.

            // Simulate a random failure (10% chance) to test error handling
            if (Math.random() < 0.1) {
                throw new Error('Network error');
            }

            console.log('SyncService: Sync completed successfully.');

            return {
                status: 'synced',
                serverItems: localItems, // In a real mock, we might return different data
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('SyncService: Sync failed', error);
            return { status: 'error' };
        }
    }

    public async pullChanges(lastSynced: number): Promise<SyncItem[]> {
        await delay(1000);
        return []; // No remote changes in this mock
    }

    public async pushChanges(changes: SyncItem[]): Promise<boolean> {
        await delay(1000);
        console.log('SyncService: Pushed changes to server', changes);
        return true;
    }
}

export const syncService = SyncService.getInstance();
