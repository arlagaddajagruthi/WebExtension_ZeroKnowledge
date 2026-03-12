/**
 * apiSync.service.ts
 * 
 * Background synchronization service using the Render backend API.
 * Handles fetching, pushing, and polling for vault updates.
 */
import { apiService } from './api.service';
import { webAppCrypto } from '../utils/webAppCrypto';
import type { Credential } from '../utils/types';

export const apiSyncService = {
    async fetchVault(_masterKey?: string) {
        try {
            const data = await apiService.getVault();
            console.log('apiSyncService: Fetched vault data:', data);

            // The backend returns { userId, vaultVersion, encryptedEntries: [...] }
            const entries = data.encryptedEntries || [];
            const vaultVersion = data.vaultVersion || 0;

            const mappedCredentials = await Promise.all(entries.map(async (entry: any) => {
                // Decrypt the password using webAppCrypto for compatibility
                let decryptedPassword = entry.password;
                try {
                    decryptedPassword = await webAppCrypto.decrypt(entry.password);
                } catch (e) {
                    console.warn(`apiSyncService: Failed to decrypt password for entry ${entry.id}, using raw value`);
                }

                return {
                    id: String(entry.id),
                    name: entry.title || 'Unnamed Item',
                    url: entry.website || '',
                    username: entry.username || '',
                    password: decryptedPassword,
                    notes: '',
                    tags: entry.category ? [entry.category] : [],
                    lastUpdated: entry.updatedAt ? new Date(entry.updatedAt).getTime() : Date.now(),
                    version: entry.version || 1
                } as Credential;
            }));

            return {
                success: true,
                credentials: mappedCredentials,
                vaultVersion,
                lastSyncedAt: data.lastSyncedAt
            };
        } catch (error: any) {
            console.error('apiSyncService: Fetch failed:', error);
            return { success: false, error: error.message };
        }
    },

    async pushVault(credentials: Credential[], _masterKey: string, baseVersion: number = 0) {
        try {
            console.log(`apiSyncService: Pushing vault with baseVersion ${baseVersion}...`);
            // Map extension credentials back to backend format
            const added = await Promise.all(credentials.map(async (c) => ({
                id: Number(c.id) || undefined, // Send as Number if possible, let backend handle new ones
                title: c.name,
                website: c.url,
                username: c.username,
                password: await webAppCrypto.encrypt(c.password),
                isFavorite: false,
                updatedAt: new Date(c.lastUpdated).toISOString()
            })));

            // For now, we use a 'full sync' approach by sending everything as 'added/updated'
            // In a more complex setup, we'd use deltas.
            const result = await apiService.syncVault({
                baseVersion: baseVersion,
                added,
                updated: [],
                deleted: []
            });

            return {
                success: true,
                vaultVersion: result.vaultVersion,
                entries: result.entries
            };
        } catch (error: any) {
            console.error('apiSyncService: Push vault failed:', error);
            throw error; // Rethrow so it can be handled by the store
        }
    },

    async createEntry(entry: any) {
        return apiService.createEntry(entry);
    },

    async updateEntry(id: string | number, entry: any) {
        return apiService.updateEntry(id, entry);
    },

    async deleteEntry(id: string | number) {
        return apiService.deleteEntry(id);
    }
};
